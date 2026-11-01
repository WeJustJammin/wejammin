#ifndef WEJAMMIN_RECEIVING_LEASE_READER_H
#define WEJAMMIN_RECEIVING_LEASE_READER_H

static bool rl_guard(rl_state *state) {
  return rb_live(&state->owner, &state->driver) &&
         rb_lease_check(&state->owner, &state->driver);
}

static bool rl_input(rl_state *state, bool *adopt_pending) {
  rb_frame frame;
  int received;
  while ((received = rb_receive(&state->input, state->bootstrap_id, &frame)) >
         0) {
    pthread_mutex_lock(&state->state_mutex);
    if (frame.kind == RB_CANCEL && !state->cancelled) {
      state->cancelled = true;
      rl_latch_locked(state, DEC203_ERROR_CANCELLED);
    } else if (frame.kind == RB_ADOPT && !state->adopt_spent &&
               !state->revoked) {
      state->adopt_spent = true;
      *adopt_pending = true;
    } else if (frame.kind == RB_FINISH && state->settled && state->cancelled &&
               !rb_pending(&state->output) &&
               rl_cancelled_failure(state->failure)) {
      state->finished = true;
    } else {
      rl_latch_locked(state, DEC203_ERROR_PROTOCOL);
    }
    bool finished = state->finished;
    pthread_mutex_unlock(&state->state_mutex);
    if (finished)
      return true;
  }
  if (received < 0)
    rl_latch(state, state->input.error);
  return false;
}

static void *rl_reader_main(void *data) {
  rl_state *state = data;
  sigset_t blocked;
  sigemptyset(&blocked);
  sigaddset(&blocked, SIGPIPE);
  pthread_sigmask(SIG_BLOCK, &blocked, NULL);
  pthread_mutex_lock(&state->state_mutex);
  while (!state->reader_enabled)
    pthread_cond_wait(&state->changed, &state->state_mutex);
  pthread_mutex_unlock(&state->state_mutex);
  rb_frame outgoing = {.kind = RB_HELLO, .role = "coordinator"};
  if (rb_send(&state->output, state->bootstrap_id, &outgoing) < 0)
    rl_latch(state, state->output.error);
  bool adopt_pending = false;
  bool cancel_acknowledged = false;
  bool settlement_queued = false;
  for (;;) {
    if (rl_input(state, &adopt_pending))
      break;
    if (!rb_live(&state->owner, &state->driver))
      rl_latch(state, DEC203_ERROR_IDENTITY_CHANGED);
    int flushed = outgoing.kind == RB_ADOPTION_ACK ? rl_flush_ack(state)
                                                   : rb_flush(&state->output);
    if (flushed < 0) {
      rl_latch(state, state->output.error);
    } else if (flushed > 0 && outgoing.kind == RB_ADOPTION_ACK) {
      bool valid = rl_guard(state);
      pthread_mutex_lock(&state->state_mutex);
      if (valid && !state->revoked)
        state->adopted = true;
      else
        rl_latch_locked(state, DEC203_ERROR_IDENTITY_CHANGED);
      pthread_mutex_unlock(&state->state_mutex);
      outgoing.kind = RB_HELLO;
      rl_notify(state);
    } else if (flushed > 0 && outgoing.kind == RB_CANCEL_ACK) {
      cancel_acknowledged = true;
      outgoing.kind = RB_HELLO;
    } else if (flushed > 0 && outgoing.kind == RB_SETTLED) {
      pthread_mutex_lock(&state->state_mutex);
      state->settled = true;
      pthread_mutex_unlock(&state->state_mutex);
      outgoing.kind = RB_HELLO;
      rl_notify(state);
    }
    pthread_mutex_lock(&state->state_mutex);
    bool cancelled = state->cancelled;
    bool revoked = state->revoked;
    bool adopted = state->adopted;
    const char *failure = state->failure;
    bool expired_now = state->close_deadline && !state->expired &&
                       rl_milliseconds() >= state->close_deadline;
    if (expired_now)
      state->expired = true;
    pthread_mutex_unlock(&state->state_mutex);
    if (expired_now)
      rl_notify(state);
    if (!rb_pending(&state->output) && !state->output.error) {
      bool send = false;
      memset(&outgoing, 0, sizeof(outgoing));
      if (cancelled && !cancel_acknowledged) {
        outgoing.kind = RB_CANCEL_ACK;
        send = true;
      } else if (cancelled && cancel_acknowledged && !settlement_queued) {
        outgoing.kind = RB_SETTLED;
        outgoing.state =
            rl_cancelled_failure(failure) ? "work-terminal" : "uncertain";
        outgoing.failure = failure ? failure : DEC203_ERROR_CANCELLED;
        settlement_queued = true;
        send = true;
      } else if (adopt_pending && !adopted && !revoked &&
                 !rb_partial(&state->input)) {
        bool valid = rl_guard(state);
        pthread_mutex_lock(&state->state_mutex);
        if (valid && !state->revoked) {
          outgoing.kind = RB_ADOPTION_ACK;
          if (rb_send(&state->output, state->bootstrap_id, &outgoing) < 0)
            rl_latch_locked(state, state->output.error);
          else
            adopt_pending = false;
        } else if (!valid) {
          rl_latch_locked(state, DEC203_ERROR_IDENTITY_CHANGED);
        }
        pthread_mutex_unlock(&state->state_mutex);
      }
      if (send && rb_send(&state->output, state->bootstrap_id, &outgoing) < 0)
        rl_latch(state, state->output.error);
    }
    struct pollfd descriptors[] = {
        {DEC203_INNER_COMMAND_FD, POLLIN, 0},
        {DEC203_INNER_EVENT_FD, rb_pending(&state->output) ? POLLOUT : 0, 0},
        {DEC203_OWNER_PIDFD, POLLIN, 0},
        {DEC203_DRIVER_PIDFD, POLLIN, 0},
        {state->wake[0], POLLIN, 0}};
    int result = poll(descriptors, 5, 10);
    if (result < 0 && errno != EINTR)
      rl_latch(state, DEC203_ERROR_UNAVAILABLE);
    if (descriptors[4].revents & POLLIN) {
      unsigned char bytes[64];
      while (read(state->wake[0], bytes, sizeof(bytes)) > 0) {
      }
    }
  }
  rl_close_aliases(state);
  rl_release_notification(state,
                          false); /* Last TSFN operation by this reader. */
  rl_unreference(state);
  return NULL;
}

static void rl_join_execute(napi_env env, void *data) {
  (void)env;
  rl_state *state = data;
  pthread_mutex_lock(&state->state_mutex);
  while (!state->startup_known)
    pthread_cond_wait(&state->changed, &state->state_mutex);
  bool created = state->reader_created;
  pthread_t reader = state->reader;
  pthread_mutex_unlock(&state->state_mutex);
  bool joined = !created || pthread_join(reader, NULL) == 0;
  pthread_mutex_lock(&state->state_mutex);
  state->joined = joined;
  if (!joined) {
    state->cleanup_uncertain = true;
    rl_latch_locked(state, DEC203_ERROR_DRAIN_UNCERTAIN);
  }
  while (!state->notification_finalized || state->accepted_wakes != 0)
    pthread_cond_wait(&state->changed, &state->state_mutex);
  pthread_mutex_unlock(&state->state_mutex);
}

static bool rl_error(napi_env env, const char *token, napi_value *result) {
  napi_value text;
  return napi_create_string_utf8(env, token, NAPI_AUTO_LENGTH, &text) ==
             napi_ok &&
         napi_create_error(env, text, text, result) == napi_ok;
}

static void rl_publication(rl_state *state, unsigned index,
                           napi_status status) {
  if (!rl_napi(state, status))
    return;
  pthread_mutex_lock(&state->state_mutex);
  state->publication_settled[index] = true;
  pthread_mutex_unlock(&state->state_mutex);
}

static void rl_publish(napi_env env, rl_state *state) {
  pthread_mutex_lock(&state->state_mutex);
  if (state->environment_closing) {
    pthread_mutex_unlock(&state->state_mutex);
    return;
  }
  bool adoption = state->adopted_deferred && !state->publication_attempted[0] &&
                  (state->adopted || state->failure);
  bool adopted = state->adopted;
  bool settlement = state->settled_deferred &&
                    !state->publication_attempted[1] &&
                    (state->settled || state->expired);
  bool closure = state->close_deferred && !state->publication_attempted[2] &&
                 (state->expired || state->cleanup_uncertain ||
                  (state->joined && state->notification_finalized &&
                   state->accepted_wakes == 0 && state->aliases_clean &&
                   !state->hook_registered && !state->join_work));
  bool uncertain = state->expired || state->cleanup_uncertain;
  const char *failure = state->failure;
  if (adoption)
    state->publication_attempted[0] = true;
  if (settlement)
    state->publication_attempted[1] = true;
  if (closure)
    state->publication_attempted[2] = true;
  pthread_mutex_unlock(&state->state_mutex);
  napi_value nothing;
  if (!rl_napi(state, napi_get_undefined(env, &nothing)))
    return;
  if (adoption) {
    napi_value error;
    if (adopted)
      rl_publication(
          state, 0,
          napi_resolve_deferred(env, state->adopted_deferred, nothing));
    else if (rl_error(env, failure ? failure : DEC203_ERROR_FAILED, &error))
      rl_publication(state, 0,
                     napi_reject_deferred(env, state->adopted_deferred, error));
    else
      rl_napi(state, napi_generic_failure);
  }
  if (settlement) {
    napi_value value, status, error;
    const char *name = uncertain || !rl_cancelled_failure(failure)
                           ? "uncertain"
                           : "work-terminal";
    if (rl_napi(state, napi_create_object(env, &value)) &&
        rl_napi(state, napi_create_string_utf8(env, name, NAPI_AUTO_LENGTH,
                                               &status)) &&
        rl_napi(state,
                rl_error(env, failure ? failure : DEC203_ERROR_DRAIN_UNCERTAIN,
                         &error)
                    ? napi_ok
                    : napi_generic_failure) &&
        rl_napi(state, napi_set_named_property(env, value, "state", status)) &&
        rl_napi(state, napi_set_named_property(env, value, "failure", error)) &&
        rl_napi(state, napi_object_freeze(env, value)))
      rl_publication(
          state, 1, napi_resolve_deferred(env, state->settled_deferred, value));
  }
  if (closure) {
    napi_value error;
    if (!uncertain)
      rl_publication(
          state, 2, napi_resolve_deferred(env, state->close_deferred, nothing));
    else if (rl_error(env, DEC203_ERROR_DRAIN_UNCERTAIN, &error))
      rl_publication(state, 2,
                     napi_reject_deferred(env, state->close_deferred, error));
    else
      rl_napi(state, napi_generic_failure);
  }
}

static void rl_join_complete(napi_env env, napi_status status, void *data) {
  rl_state *state = data;
  pthread_mutex_lock(&state->state_mutex);
  bool active = env && !state->environment_closing;
  if (status != napi_ok) {
    state->cleanup_uncertain = true;
    rl_latch_locked(state, DEC203_ERROR_DRAIN_UNCERTAIN);
  }
  state->work_queued = false;
  bool closed = state->joined && state->notification_finalized &&
                state->accepted_wakes == 0 && state->aliases_clean;
  pthread_mutex_unlock(&state->state_mutex);
  if (active) {
    if (closed) {
      if (state->hook_registered && !state->hook_ran) {
        napi_status removed =
            napi_remove_env_cleanup_hook(env, rl_environment_cleanup, state);
        if (removed == napi_ok) {
          state->hook_registered = false;
          rl_unreference(state);
        } else {
          state->cleanup_uncertain = true;
          rl_latch(state, DEC203_ERROR_DRAIN_UNCERTAIN);
        }
      }
      if (napi_delete_async_work(env, state->join_work) == napi_ok)
        state->join_work = NULL;
      else
        rl_napi(state, napi_generic_failure);
      if (state->owner_reference) {
        if (rl_napi(state, napi_delete_reference(env, state->owner_reference)))
          state->owner_reference = NULL;
        else
          rl_anchor(state);
      }
    }
    rl_publish(env, state);
  }
  rl_unreference(state);
}

#endif
