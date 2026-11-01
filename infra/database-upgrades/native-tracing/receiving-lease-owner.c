#include <dirent.h>
#include <errno.h>
#include <fcntl.h>
#include <inttypes.h>
#include <limits.h>
#include <poll.h>
#include <signal.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/file.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <sys/sysmacros.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

#include "receiving-bootstrap-profile.h"
#include "receiving-bootstrap-json.h"
#include "receiving-bootstrap-frame-values.h"
#include "receiving-bootstrap-frame.h"
#include "receiving-bootstrap-wire.h"
#include "receiving-bootstrap-sha256.h"
#include "receiving-bootstrap-process.h"
#include "receiving-bootstrap-entry.h"
#include "receiving-bootstrap-locks.h"
#include "receiving-lease-owner-state.h"
#include "receiving-lease-owner-ledger.h"

static void ro_retain(ro_state *state) {
  (void)state;
  for (;;) {
    poll(NULL, 0, 1000);
    /* Uncertainty is retained, not repaired by exit, unlock or a fresh attempt.
     */
  }
}

static void ro_child_exec(ro_state *state) {
  int unused[] = {DEC203_OUTER_COMMAND_FD, DEC203_OUTER_EVENT_FD,
                  DEC203_PARENT_INNER_EVENT_FD, DEC203_PARENT_INNER_COMMAND_FD};
  bool clean = true;
  for (unsigned index = 0; index < sizeof(unused) / sizeof(unused[0]); index++)
    clean = ro_close(state, &unused[index]) && clean;
  if (!clean ||
      !ro_map(state, state->child_commands, DEC203_INNER_COMMAND_FD, false) ||
      !ro_map(state, state->child_events, DEC203_INNER_EVENT_FD, false) ||
      !rb_fd_guard(&state->ledger))
    _exit(1); /* Failed first exec is not a coordinator settlement proof. */
  for (int descriptor = DEC203_FIRST_EXEC_FIRST_FD;
       descriptor <= DEC203_FIRST_EXEC_LAST_FD; descriptor++) {
    int flags = fcntl(descriptor, F_GETFD);
    if (flags < 0 || fcntl(descriptor, F_SETFD, flags & ~FD_CLOEXEC) != 0)
      _exit(1);
  }
  char *const arguments[] = {DEC203_NODE_PATH, "--", DEC203_COORDINATOR_PATH,
                             state->id, NULL};
  char *const environment[] = {"PATH=/usr/bin:/bin", "LANG=C", "LC_ALL=C",
                               "TZ=UTC", NULL};
  execve(DEC203_NODE_PATH, arguments, environment);
  _exit(1);
}

static bool ro_fork(ro_state *state) {
  if (state->fork_spent || !ro_inner_pipes(state) || !ro_before_release(state))
    return false;
  state->fork_spent = true;
  state->child = fork();
  if (state->child == 0)
    ro_child_exec(state);
  if (state->child < 0)
    return false;
  bool clean = ro_close(state, &state->child_commands);
  clean = ro_close(state, &state->child_events) && clean;
  int input = STDIN_FILENO;
  clean = ro_close(state, &input) && clean;
  return rb_fd_guard(&state->ledger) && clean;
}

static bool ro_child_identity(ro_state *state) {
  rb_process child;
  const char *const arguments[] = {DEC203_NODE_PATH, "--",
                                   DEC203_COORDINATOR_PATH, state->id};
  return !state->child_waited && rb_process_capture(state->child, -1, &child) &&
         child.ppid == getpid() && child.uid == DEC203_PROFILE_UID &&
         rb_process_argv_exact(child.pid, arguments, 4) &&
         rb_process_image_exact(&child, DEC203_NODE_PATH, DEC203_NODE_SIZE,
                                DEC203_NODE_UID, DEC203_NODE_MODE,
                                DEC203_NODE_SHA256) &&
         ro_before_release(state);
}

static void ro_inner(ro_state *state, bool *hello, bool *adopted) {
  rb_frame frame;
  int received;
  while ((received = rb_receive(&state->inner_events, state->id, &frame)) > 0) {
    if (frame.kind == RB_HELLO && !*hello && !state->revoked && frame.role &&
        strcmp(frame.role, "coordinator") == 0 && ro_child_identity(state)) {
      *hello = true;
      ro_queue(state, &state->inner_commands, (rb_frame){.kind = RB_ADOPT});
    } else if (frame.kind == RB_ADOPTION_ACK && *hello && !*adopted &&
               !state->revoked && !state->inner_commands.error &&
               state->inner_queued_kind == RB_ADOPT &&
               !rb_pending(&state->inner_commands) &&
               ro_before_release(state)) {
      *adopted = true;
      if (!rb_pending(&state->events))
        ro_queue(state, &state->events, (rb_frame){.kind = RB_ADOPTION_ACK});
      else
        ro_revoke(state, DEC203_ERROR_PROTOCOL, "protocol");
    } else if (frame.kind == RB_CANCEL_ACK && state->cancel_written &&
               !state->cancel_acknowledged) {
      state->cancel_acknowledged = true;
      if (!rb_pending(&state->events))
        ro_queue(state, &state->events, (rb_frame){.kind = RB_CANCEL_ACK});
      else
        ro_revoke(state, DEC203_ERROR_PROTOCOL, "protocol");
    } else if (frame.kind == RB_SETTLED && state->cancel_acknowledged &&
               !state->settled && frame.state && frame.failure &&
               strcmp(frame.state, "work-terminal") == 0 &&
               strcmp(frame.failure, DEC203_ERROR_CANCELLED) == 0 &&
               !rb_pending(&state->inner_commands) &&
               !state->inner_commands.error) {
      state->settled = true;
      ro_queue(state, &state->inner_commands, (rb_frame){.kind = RB_FINISH});
    } else {
      ro_revoke(state, DEC203_ERROR_PROTOCOL, "protocol");
    }
  }
  if (received < 0) {
    if (state->inner_events.eof && !rb_partial(&state->inner_events) &&
        state->settled && state->finish_written)
      state->inner_eof = true;
    else
      ro_revoke(state, state->inner_events.error, "protocol");
  }
}

static int ro_never_forked(ro_state *state) {
  if (state->fork_spent)
    ro_retain(state);
  ro_revoke(state, DEC203_ERROR_FAILED, "protocol");
  do {
    rb_frame frame;
    while (ro_commands(state, &frame) > 0)
      ro_revoke(state, DEC203_ERROR_PROTOCOL, "protocol");
    if (rb_partial(&state->commands))
      ro_poll(state);
    if (ro_milliseconds() >= state->close_deadline)
      ro_retain(state);
  } while (rb_partial(&state->commands));
  bool acknowledge = state->outer_cancel_received;
  for (;;) {
    if (!rb_pending(&state->events)) {
      if (!acknowledge)
        break;
      acknowledge = false;
      if (!ro_queue(state, &state->events, (rb_frame){.kind = RB_CANCEL_ACK}))
        ro_retain(state);
    }
    ro_flush(state, &state->events);
    if (state->events.error || ro_milliseconds() >= state->close_deadline)
      ro_retain(state);
    struct pollfd event = {state->events.fd, POLLOUT, 0};
    poll(&event, 1, 10);
  }
  bool complete = rb_fd_guard(&state->ledger);
  if (!ro_close_ledger(state, false) || !complete)
    ro_retain(state);
  return 1; /* No I existed: never fabricate SETTLED, TERMINAL or an I wait. */
}

static int ro_terminal(ro_state *state) {
  if (!WIFEXITED(state->child_status))
    ro_retain(state);
  int code = WEXITSTATUS(state->child_status);
  if (code != 0)
    ro_revoke(state, DEC203_ERROR_FAILED, "protocol");
  if (!ro_close_ledger(state, true))
    ro_retain(state);
  rb_frame terminal = {.kind = RB_TERMINAL,
                       .state = "drained",
                       .failure = state->failure,
                       .has_exit_code = true,
                       .exit_code = code};
  if (!ro_queue(state, &state->events, terminal))
    ro_retain(state);
  while (rb_pending(&state->events)) {
    ro_flush(state, &state->events);
    if (state->events.error || ro_milliseconds() >= state->close_deadline)
      ro_retain(state);
    struct pollfd event = {state->events.fd, POLLOUT, 0};
    poll(&event, 1, 10);
  }
  if (!ro_close_ledger(state, false))
    ro_retain(state);
  return code == 0 ? 0 : 1;
}

int main(int count, char **arguments) {
  ro_state state = {0};
  state.child_commands = -1;
  state.child_events = -1;
  state.owner.pidfd = -1;
  state.driver.pidfd = -1;
  state.commands.fd = -1;
  state.events.fd = -1;
  state.inner_commands.fd = -1;
  state.inner_events.fd = -1;
  if (count != 2 || !rb_uuid(arguments[1]) || geteuid() != DEC203_PROFILE_UID)
    return 1;
  memcpy(state.id, arguments[1], sizeof(state.id));
  struct sigaction ignored = {.sa_handler = SIG_IGN};
  if (sigemptyset(&ignored.sa_mask) != 0 ||
      sigaction(SIGPIPE, &ignored, NULL) != 0 || !ro_inherit(&state) ||
      !getcwd(state.root, sizeof(state.root)) || !ro_channels(&state) ||
      !ro_pidfds(&state))
    return ro_never_forked(&state);
  if (!ro_queue(&state, &state.events,
                (rb_frame){.kind = RB_HELLO, .role = "owner"}) ||
      !ro_wait_command(&state, RB_INIT) || !ro_acquire(&state) ||
      !ro_before_release(&state) ||
      !ro_queue(&state, &state.events, (rb_frame){.kind = RB_LEASE_READY}) ||
      !ro_wait_command(&state, RB_START) || !ro_fork(&state))
    return ro_never_forked(&state);
  bool hello = false, adopted = false;
  for (;;) {
    rb_frame unexpected;
    if (ro_commands(&state, &unexpected) > 0)
      ro_revoke(&state, DEC203_ERROR_PROTOCOL, "protocol");
    ro_inner(&state, &hello, &adopted);
    if (state.revoked && !state.cancel_sent &&
        !rb_pending(&state.inner_commands))
      ro_queue(&state, &state.inner_commands,
               (rb_frame){.kind = RB_CANCEL, .reason = state.reason});
    ro_flush(&state, &state.inner_commands);
    ro_flush(&state, &state.events);
    if (!state.child_waited) {
      pid_t result = waitpid(state.child, &state.child_status, WNOHANG);
      if (result == state.child)
        state.child_waited = true;
      else if (result < 0 && errno != EINTR)
        ro_revoke(&state, DEC203_ERROR_DRAIN_UNCERTAIN, "protocol");
    }
    if (state.child_waited && state.inner_eof && state.settled &&
        state.finish_written && !state.inner_commands.error &&
        !state.events.error && !rb_pending(&state.inner_commands) &&
        !rb_pending(&state.events) && state.close_deadline &&
        ro_milliseconds() < state.close_deadline)
      return ro_terminal(&state);
    if (state.close_deadline && ro_milliseconds() >= state.close_deadline)
      ro_retain(&state);
    ro_poll(&state);
  }
}
