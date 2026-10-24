#ifndef WEJAMMIN_RECEIVING_LEASE_STATE_H
#define WEJAMMIN_RECEIVING_LEASE_STATE_H

typedef struct rl_state {
  pthread_mutex_t state_mutex;
  pthread_mutex_t notification_mutex;
  pthread_cond_t changed;
  unsigned references;
  bool retained;
  struct rl_state *retained_next;
  unsigned accepted_wakes;
  bool wake_pending;
  bool environment_closing;
  bool revoked;
  bool expired;
  bool startup_known;
  bool reader_created;
  bool reader_enabled;
  bool joined;
  bool notification_finalized;
  bool aliases_clean;
  bool hook_registered;
  bool hook_ran;
  bool work_queued;
  bool participant_owned;
  bool adopted;
  bool adopt_spent;
  bool cancelled;
  bool settled;
  bool finished;
  bool publication_attempted[3];
  bool publication_settled[3];
  bool cleanup_uncertain;
  const char *failure;
  uint64_t close_deadline;
  pthread_t reader;
  int descriptors[8];
  struct stat identities[8];
  int wake[2];
  char bootstrap_id[DEC203_BOOTSTRAP_ID_BYTES + 1];
  rb_process owner;
  rb_process driver;
  rb_channel input;
  rb_channel output;
  napi_env environment;
  napi_threadsafe_function notification;
  napi_async_work join_work;
  napi_ref owner_reference;
  napi_ref promise_references[3];
  napi_deferred adopted_deferred;
  napi_deferred settled_deferred;
  napi_deferred close_deferred;
  napi_value adopted_promise;
  napi_value settled_promise;
  napi_value close_promise;
} rl_state;

static const napi_type_tag rl_owner_tag = {0xdec203a170fd83c1ULL,
                                           0xe14a5e8b90964b26ULL};
static pthread_mutex_t rl_entry_mutex = PTHREAD_MUTEX_INITIALIZER;
static bool rl_entry_spent;
static pthread_mutex_t rl_retained_mutex = PTHREAD_MUTEX_INITIALIZER;
static rl_state *rl_retained;

static void rl_publish(napi_env env, rl_state *state);
static int rl_flush_ack(rl_state *state);
static void rl_publication(rl_state *state, unsigned index, napi_status status);

static bool rl_cancelled_failure(const char *failure) {
  return failure && strcmp(failure, DEC203_ERROR_CANCELLED) == 0;
}

static uint64_t rl_milliseconds(void) {
  struct timespec now;
  if (clock_gettime(CLOCK_MONOTONIC, &now) != 0)
    return 0;
  return (uint64_t)now.tv_sec * 1000 + (uint64_t)now.tv_nsec / 1000000;
}

static void rl_reference(rl_state *state) {
  pthread_mutex_lock(&state->state_mutex);
  state->references++;
  pthread_mutex_unlock(&state->state_mutex);
}

static void rl_anchor(rl_state *state) {
  pthread_mutex_lock(&state->state_mutex);
  bool retained = state->retained;
  state->retained = true;
  pthread_mutex_unlock(&state->state_mutex);
  if (!retained) {
    pthread_mutex_lock(&rl_retained_mutex);
    state->retained_next = rl_retained;
    rl_retained = state;
    pthread_mutex_unlock(&rl_retained_mutex);
  }
}

static void rl_unreference(rl_state *state) {
  pthread_mutex_lock(&state->state_mutex);
  state->references--;
  bool zero = state->references == 0;
  bool destroy = zero && !state->retained && state->joined &&
                 state->aliases_clean && state->notification_finalized &&
                 state->accepted_wakes == 0;
  pthread_mutex_unlock(&state->state_mutex);
  if (!destroy) {
    if (zero)
      rl_anchor(state);
    return;
  }
  pthread_cond_destroy(&state->changed);
  pthread_mutex_destroy(&state->notification_mutex);
  pthread_mutex_destroy(&state->state_mutex);
  free(state);
}

static void rl_latch_locked(rl_state *state, const char *failure) {
  state->revoked = true;
  if (!state->failure)
    state->failure = failure;
  if (!state->close_deadline) {
    uint64_t now = rl_milliseconds();
    state->close_deadline = now ? now + DEC203_SETTLEMENT_MILLISECONDS : 1;
  }
  pthread_cond_broadcast(&state->changed);
}

static void rl_wake(rl_state *state) {
  unsigned char byte = 1;
  pthread_mutex_lock(&state->notification_mutex);
  if (state->wake[1] >= 0) {
    ssize_t result = write(state->wake[1], &byte, sizeof(byte));
    if (result < 0 && errno != EAGAIN && errno != EINTR) {
      pthread_mutex_lock(&state->state_mutex);
      rl_latch_locked(state, DEC203_ERROR_FAILED);
      pthread_mutex_unlock(&state->state_mutex);
    }
  }
  pthread_mutex_unlock(&state->notification_mutex);
}

static void rl_latch(rl_state *state, const char *failure) {
  pthread_mutex_lock(&state->state_mutex);
  rl_latch_locked(state, failure);
  pthread_mutex_unlock(&state->state_mutex);
  rl_wake(state);
}

static bool rl_close_slot(int *slot) {
  int descriptor = *slot;
  *slot = -1;
  return descriptor < 0 || close(descriptor) == 0;
}

static void rl_close_aliases(rl_state *state) {
  bool clean = !rb_file_tombstones && !rb_directory_tombstones;
  for (unsigned index = 0; index < 8; index++) {
    int descriptor = state->descriptors[index];
    if (descriptor < 0)
      continue;
    struct stat current;
    if (fstat(descriptor, &current) != 0 ||
        current.st_dev != state->identities[index].st_dev ||
        current.st_ino != state->identities[index].st_ino ||
        current.st_mode != state->identities[index].st_mode) {
      state->descriptors[index] = -1;
      clean = false; /* Never close an unverified replacement integer. */
    } else if (!rl_close_slot(&state->descriptors[index])) {
      clean = false; /* Detached uncertain close is never retried. */
    }
  }
  pthread_mutex_lock(&state->notification_mutex);
  clean = rl_close_slot(&state->wake[0]) && clean;
  clean = rl_close_slot(&state->wake[1]) && clean;
  pthread_mutex_unlock(&state->notification_mutex);
  pthread_mutex_lock(&state->state_mutex);
  state->aliases_clean = clean;
  if (!clean) {
    state->cleanup_uncertain = true;
    rl_latch_locked(state, DEC203_ERROR_DRAIN_UNCERTAIN);
  }
  pthread_mutex_unlock(&state->state_mutex);
}

static void rl_notify(rl_state *state) {
  pthread_mutex_lock(&state->notification_mutex);
  pthread_mutex_lock(&state->state_mutex);
  if (state->environment_closing || !state->participant_owned ||
      !state->notification || state->wake_pending) {
    pthread_mutex_unlock(&state->state_mutex);
    pthread_mutex_unlock(&state->notification_mutex);
    return;
  }
  unsigned previous_wakes = state->accepted_wakes;
  state->wake_pending = true;
  state->accepted_wakes++;
  state->references++;
  pthread_mutex_unlock(&state->state_mutex);
  napi_status result = napi_call_threadsafe_function(state->notification, NULL,
                                                     napi_tsfn_nonblocking);
  if (result != napi_ok) {
    pthread_mutex_lock(&state->state_mutex);
    state->wake_pending = false;
    state->accepted_wakes--;
    state->references--;
    if (result == napi_closing) {
      state->notification = NULL;
      state->participant_owned = false; /* Push already consumed it. */
      rl_latch_locked(state, DEC203_ERROR_DRAIN_UNCERTAIN);
    } else if (result != napi_queue_full || previous_wakes == 0) {
      rl_latch_locked(state, DEC203_ERROR_FAILED);
    }
    pthread_cond_broadcast(&state->changed);
    pthread_mutex_unlock(&state->state_mutex);
  }
  pthread_mutex_unlock(&state->notification_mutex);
}

static void rl_release_notification(rl_state *state, bool aborting) {
  pthread_mutex_lock(&state->notification_mutex);
  napi_threadsafe_function function = state->notification;
  bool owned = state->participant_owned;
  state->notification = NULL;
  state->participant_owned = false;
  if (function && owned)
    napi_release_threadsafe_function(function, aborting ? napi_tsfn_abort
                                                        : napi_tsfn_release);
  pthread_mutex_unlock(&state->notification_mutex);
}

static void rl_notification_finalizer(napi_env env, void *data, void *hint) {
  (void)env;
  (void)hint;
  rl_state *state = data;
  pthread_mutex_lock(&state->state_mutex);
  state->notification_finalized = true;
  pthread_cond_broadcast(&state->changed);
  pthread_mutex_unlock(&state->state_mutex);
  rl_unreference(state);
}

static void rl_notification_call(napi_env env, napi_value callback,
                                 void *context, void *data) {
  (void)callback;
  (void)data;
  rl_state *state = context;
  pthread_mutex_lock(&state->state_mutex);
  state->wake_pending = false;
  bool active = !state->environment_closing;
  pthread_mutex_unlock(&state->state_mutex);
  if (env && active)
    rl_publish(env, state);
  pthread_mutex_lock(&state->state_mutex);
  state->accepted_wakes--;
  pthread_cond_broadcast(&state->changed);
  pthread_mutex_unlock(&state->state_mutex);
  rl_unreference(state);
}

static void rl_environment_cleanup(void *data) {
  rl_state *state = data;
  pthread_mutex_lock(&state->state_mutex);
  state->environment_closing = true;
  state->hook_ran = true;
  state->hook_registered = false;
  state->reader_enabled = true;
  rl_latch_locked(state, DEC203_ERROR_CANCELLED);
  pthread_mutex_unlock(&state->state_mutex);
  rl_wake(state);
  rl_release_notification(state, true);
  rl_unreference(state);
}

static void rl_owner_finalizer(napi_env env, void *data, void *hint) {
  (void)hint;
  rl_state *state = data;
  rl_latch(state, DEC203_ERROR_CANCELLED);
  if (env && !state->environment_closing) {
    for (unsigned index = 0; index < 3; index++) {
      if (state->promise_references[index])
        napi_delete_reference(env, state->promise_references[index]);
    }
  }
  rl_unreference(state);
}

static bool rl_napi(rl_state *state, napi_status status) {
  if (status == napi_ok)
    return true;
  pthread_mutex_lock(&state->state_mutex);
  state->cleanup_uncertain = true;
  rl_latch_locked(state, DEC203_ERROR_FAILED);
  pthread_mutex_unlock(&state->state_mutex);
  rl_wake(state);
  return false;
}

#endif
