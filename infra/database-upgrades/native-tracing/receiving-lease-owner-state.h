#ifndef WEJAMMIN_RECEIVING_LEASE_OWNER_STATE_H
#define WEJAMMIN_RECEIVING_LEASE_OWNER_STATE_H

typedef struct {
  rb_process owner;
  rb_process driver;
  rb_fd_ledger ledger;
  rb_channel commands;
  rb_channel events;
  rb_channel inner_events;
  rb_channel inner_commands;
  rb_kind inner_queued_kind;
  rb_kind outer_queued_kind;
  int child_commands;
  int child_events;
  pid_t child;
  bool fork_spent;
  bool revoked;
  bool outer_cancel_received;
  bool cancel_sent;
  bool cancel_written;
  bool cancel_acknowledged;
  bool settled;
  bool finish_sent;
  bool finish_written;
  bool child_waited;
  bool inner_eof;
  int child_status;
  const char *failure;
  const char *reason;
  uint64_t close_deadline;
  char id[DEC203_BOOTSTRAP_ID_BYTES + 1];
  char root[PATH_MAX];
} ro_state;

static bool ro_close(ro_state *state, int *slot);
static bool ro_channels(ro_state *state);
static bool ro_pidfds(ro_state *state);
static bool ro_open_lock(ro_state *state, unsigned index);
static bool ro_inner_pipes(ro_state *state);
static bool ro_close_ledger(ro_state *state, bool keep_outer);

static uint64_t ro_milliseconds(void) {
  struct timespec now;
  if (clock_gettime(CLOCK_MONOTONIC, &now) != 0)
    return 0;
  return (uint64_t)now.tv_sec * 1000 + (uint64_t)now.tv_nsec / 1000000;
}

static void ro_revoke(ro_state *state, const char *failure,
                      const char *reason) {
  state->revoked = true;
  if (!state->failure)
    state->failure = failure;
  if (!state->reason)
    state->reason = reason;
  if (!state->close_deadline) {
    uint64_t now = ro_milliseconds();
    state->close_deadline = now ? now + DEC203_SETTLEMENT_MILLISECONDS : 1;
  }
}

static bool ro_release_kind(rb_kind kind) {
  return kind == RB_HELLO || kind == RB_ADOPT || kind == RB_ADOPTION_ACK ||
         kind == RB_LEASE_READY;
}

static bool ro_queue(ro_state *state, rb_channel *channel, rb_frame frame) {
  if (state->revoked && ro_release_kind(frame.kind))
    return false;
  if (channel == &state->inner_commands) {
    if ((frame.kind == RB_CANCEL && state->cancel_sent) ||
        (frame.kind == RB_FINISH && state->finish_sent)) {
      ro_revoke(state, DEC203_ERROR_PROTOCOL, "protocol");
      return false;
    }
    state->cancel_sent = state->cancel_sent || frame.kind == RB_CANCEL;
    state->finish_sent = state->finish_sent || frame.kind == RB_FINISH;
    state->inner_queued_kind = frame.kind;
  } else if (channel == &state->events) {
    state->outer_queued_kind = frame.kind;
  }
  if (rb_send(channel, state->id, &frame) == 0)
    return true;
  ro_revoke(state, channel->error, "protocol");
  return false;
}

static void ro_flush(ro_state *state, rb_channel *channel) {
  rb_kind kind = channel == &state->inner_commands ? state->inner_queued_kind
                                                   : state->outer_queued_kind;
  if (state->revoked && rb_pending(channel) && ro_release_kind(kind)) {
    if (!channel->error)
      channel->error = DEC203_ERROR_HISTORY_GAP;
    ro_revoke(state, channel->error, "protocol");
    return; /* Burned frame/sequence stays intact; no splice or refund. */
  }
  bool pending = rb_pending(channel);
  int result = rb_flush(channel);
  if (result < 0)
    ro_revoke(state, channel->error, "protocol");
  else if (pending && result > 0 && channel == &state->inner_commands) {
    state->cancel_written = state->cancel_written || kind == RB_CANCEL;
    state->finish_written = state->finish_written || kind == RB_FINISH;
  }
}

static int ro_commands(ro_state *state, rb_frame *frame) {
  if (state->commands.fd < 0)
    return 0;
  int result = rb_receive(&state->commands, state->id, frame);
  if (result < 0) {
    ro_revoke(state, state->commands.error, "protocol");
    return 0;
  }
  if (result > 0 && frame->kind == RB_CANCEL) {
    if (state->outer_cancel_received)
      ro_revoke(state, DEC203_ERROR_PROTOCOL, "protocol");
    else {
      state->outer_cancel_received = true;
      ro_revoke(state, DEC203_ERROR_CANCELLED, frame->reason);
    }
    return 0;
  }
  return result;
}

static void ro_poll(ro_state *state) {
  struct pollfd descriptors[] = {
      {state->commands.fd, POLLIN, 0},
      {state->events.fd, rb_pending(&state->events) ? POLLOUT : 0, 0},
      {state->driver.pidfd, POLLIN, 0},
      {state->child > 0 ? DEC203_PARENT_INNER_EVENT_FD : -1, POLLIN, 0},
      {state->child > 0 ? DEC203_PARENT_INNER_COMMAND_FD : -1,
       rb_pending(&state->inner_commands) ? POLLOUT : 0, 0}};
  if (poll(descriptors, 5, 10) < 0 && errno != EINTR)
    ro_revoke(state, DEC203_ERROR_UNAVAILABLE, "protocol");
  short broken = POLLHUP | POLLERR | POLLNVAL;
  if ((descriptors[0].revents & broken) || (descriptors[1].revents & broken) ||
      (!state->finish_written && (descriptors[4].revents & broken)))
    ro_revoke(state, DEC203_ERROR_HISTORY_GAP, "protocol");
  if (!rb_live(&state->owner, &state->driver))
    ro_revoke(state, DEC203_ERROR_IDENTITY_CHANGED, "protocol");
}

static bool ro_wait_command(ro_state *state, rb_kind expected) {
  while (!state->revoked) {
    rb_frame frame;
    if (ro_commands(state, &frame) > 0) {
      if (frame.kind == expected && !rb_partial(&state->commands))
        return true;
      ro_revoke(state, DEC203_ERROR_PROTOCOL, "protocol");
    }
    ro_flush(state, &state->events);
    ro_poll(state);
  }
  return false;
}

static bool ro_lock_guard(ro_state *state, unsigned count) {
  if (!rb_live(&state->owner, &state->driver) || !rb_fd_guard(&state->ledger))
    return false;
  for (unsigned index = 0; index < count; index++) {
    if (!rb_lock_check(index, state->owner.pid, true))
      return false;
  }
  return rb_live(&state->owner, &state->driver) && rb_fd_guard(&state->ledger);
}

static bool ro_acquire(ro_state *state) {
  for (unsigned index = 0; index < DEC203_LOCK_COUNT; index++) {
    uint64_t now = ro_milliseconds();
    uint64_t budget = index == DEC203_LOCK_COUNT - 1
                          ? DEC203_RESET_LOCK_MILLISECONDS
                          : DEC203_LOCK_MILLISECONDS;
    uint64_t deadline = now + budget;
    if (!now || !ro_open_lock(state, index))
      return false;
    for (;;) {
      rb_frame unexpected;
      if (ro_commands(state, &unexpected) > 0)
        ro_revoke(state, DEC203_ERROR_PROTOCOL, "protocol");
      if (state->revoked || !ro_lock_guard(state, index))
        return false;
      int mode = index == DEC203_QUIET_LOCK_INDEX ? LOCK_SH : LOCK_EX;
      if (flock((int)index + DEC203_LOCK_FIRST_FD, mode | LOCK_NB) == 0)
        break;
      if ((errno != EAGAIN && errno != EWOULDBLOCK && errno != EINTR) ||
          ro_milliseconds() >= deadline)
        return false;
      ro_flush(state, &state->events);
      ro_poll(state);
    }
    if (!ro_lock_guard(state, index + 1))
      return false;
  }
  return true;
}

static bool ro_before_release(ro_state *state) {
  do {
    rb_frame frame;
    int count;
    while ((count = ro_commands(state, &frame)) > 0)
      ro_revoke(state, DEC203_ERROR_PROTOCOL, "protocol");
    if (state->revoked)
      return false;
    if (rb_partial(&state->commands))
      ro_poll(state);
  } while (rb_partial(&state->commands) && !state->revoked);
  return !state->revoked && ro_lock_guard(state, DEC203_LOCK_COUNT);
}

#endif
