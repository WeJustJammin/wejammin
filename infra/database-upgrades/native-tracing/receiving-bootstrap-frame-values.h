#ifndef WEJAMMIN_DEC203_BOOTSTRAP_FRAME_VALUES_H
#define WEJAMMIN_DEC203_BOOTSTRAP_FRAME_VALUES_H
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#ifndef DEC203_NATIVE_FRAME_BYTES
#error "receiving-bootstrap-profile.h must be included first"
#endif
static inline bool rb_json_equal(const char *text, size_t length,
                                 const char *literal) {
  size_t expected = 0;
  while (literal[expected])
    expected++;
  return expected == length &&
         (length == 0 || __builtin_memcmp(text, literal, length) == 0);
}
typedef enum {
  RB_HELLO,
  RB_INIT,
  RB_LEASE_READY,
  RB_START,
  RB_ADOPT,
  RB_ADOPTION_ACK,
  RB_CANCEL,
  RB_CANCEL_ACK,
  RB_SETTLED,
  RB_FINISH,
  RB_TERMINAL
} rb_kind;
typedef struct {
  rb_kind kind;
  const char *role;
  const char *reason;
  const char *state;
  const char *failure;
  bool has_exit_code;
  int32_t exit_code;
  const char *signal;
} rb_frame;
#define RB_ROLE_OWNER "owner"
#define RB_ROLE_COORDINATOR "coordinator"
#define RB_REASON_CANCEL "cancel"
#define RB_REASON_TIMEOUT "timeout"
#define RB_REASON_SIGNAL "signal"
#define RB_REASON_CLOSE "close"
#define RB_REASON_PROTOCOL "protocol"
#define RB_STATE_WORK_TERMINAL "work-terminal"
#define RB_STATE_UNCERTAIN "uncertain"
#define RB_STATE_DRAINED "drained"
static inline bool rb_uuid(const char *text) {
  if (!text || __builtin_strlen(text) != 36)
    return false;
  for (size_t index = 0; index < 36; index++) {
    char value = text[index];
    bool dash = index == 8 || index == 13 || index == 18 || index == 23;
    if (dash ? value != '-'
             : !((value >= '0' && value <= '9') ||
                 (value >= 'a' && value <= 'f')))
      return false;
  }
  return text[14] == '4' && (text[19] == '8' || text[19] == '9' ||
                             text[19] == 'a' || text[19] == 'b');
}
static inline const char *rb_frame_kind_text(rb_kind kind) {
  static const char *const values[] = {"HELLO",  "INIT",       "LEASE_READY",
                                       "START",  "ADOPT",      "ADOPTION_ACK",
                                       "CANCEL", "CANCEL_ACK", "SETTLED",
                                       "FINISH", "TERMINAL"};
  return kind >= RB_HELLO && kind <= RB_TERMINAL ? values[kind] : NULL;
}
static inline const char *rb_frame_text(unsigned group, const char *text,
                                        size_t length) {
  static const char *const values[] = {RB_ROLE_OWNER,
                                       RB_ROLE_COORDINATOR,
                                       RB_REASON_CANCEL,
                                       RB_REASON_TIMEOUT,
                                       RB_REASON_SIGNAL,
                                       RB_REASON_CLOSE,
                                       RB_REASON_PROTOCOL,
                                       RB_STATE_WORK_TERMINAL,
                                       RB_STATE_UNCERTAIN,
                                       RB_STATE_DRAINED,
                                       DEC203_ERROR_REFUSED,
                                       DEC203_ERROR_IDENTITY_CHANGED,
                                       DEC203_ERROR_UNAVAILABLE,
                                       DEC203_ERROR_PROTOCOL,
                                       DEC203_ERROR_HISTORY_GAP,
                                       DEC203_ERROR_CANCELLED,
                                       DEC203_ERROR_TIMEOUT,
                                       DEC203_ERROR_FAILED,
                                       DEC203_ERROR_DRAIN_UNCERTAIN,
                                       "SIGHUP",
                                       "SIGINT",
                                       "SIGQUIT",
                                       "SIGILL",
                                       "SIGTRAP",
                                       "SIGABRT",
                                       "SIGBUS",
                                       "SIGFPE",
                                       "SIGKILL",
                                       "SIGUSR1",
                                       "SIGSEGV",
                                       "SIGUSR2",
                                       "SIGPIPE",
                                       "SIGALRM",
                                       "SIGTERM",
                                       "SIGCHLD",
                                       "SIGCONT",
                                       "SIGSTOP",
                                       "SIGTSTP",
                                       "SIGTTIN",
                                       "SIGTTOU",
                                       "SIGURG",
                                       "SIGXCPU",
                                       "SIGXFSZ",
                                       "SIGVTALRM",
                                       "SIGPROF",
                                       "SIGWINCH",
                                       "SIGIO",
                                       "SIGPWR",
                                       "SIGSYS"};
  static const unsigned starts[] = {0, 2, 7, 10, 19},
                        ends[] = {2, 7, 10, 19, 49};
  if (!group || group > 5)
    return NULL;
  for (unsigned index = starts[group - 1]; index < ends[group - 1]; index++)
    if (rb_json_equal(text, length, values[index]))
      return values[index];
  return NULL;
}
static inline bool rb_frame_sequence(const char *text, size_t length,
                                     uint64_t *sequence) {
  if (!text || !length || text[0] == '0')
    return false;
  uint64_t result = 0;
  for (size_t index = 0; index < length; index++) {
    unsigned digit = (unsigned)(text[index] - '0');
    if (digit > 9 || result > (DEC203_SEQUENCE_MAX - digit) / 10U)
      return false;
    result = result * 10U + digit;
  }
  *sequence = result;
  return result != 0;
}
static inline bool rb_frame_valid(const rb_frame *frame) {
  if (!frame)
    return false;
  if (frame->kind < RB_HELLO || frame->kind > RB_TERMINAL)
    return false;
  size_t state_length = frame->state ? __builtin_strlen(frame->state) : 0,
         failure_length = frame->failure ? __builtin_strlen(frame->failure) : 0;
  bool no_tail = !frame->state && !frame->failure && !frame->has_exit_code &&
                 !frame->signal;
  if (frame->kind == RB_HELLO)
    return frame->role && !frame->reason && no_tail &&
           rb_frame_text(1, frame->role, __builtin_strlen(frame->role));
  if (frame->kind == RB_CANCEL)
    return frame->reason && !frame->role && no_tail &&
           rb_frame_text(2, frame->reason, __builtin_strlen(frame->reason));
  if (frame->kind != RB_SETTLED && frame->kind != RB_TERMINAL)
    return !frame->role && !frame->reason && no_tail;
  bool terminal = frame->kind == RB_TERMINAL;
  bool uncertain =
      rb_json_equal(frame->state, state_length, RB_STATE_UNCERTAIN);
  const char *normal_state =
      terminal ? RB_STATE_DRAINED : RB_STATE_WORK_TERMINAL;
  bool valid_state =
      frame->state &&
      (uncertain || rb_json_equal(frame->state, state_length, normal_state));
  bool valid_failure =
      !frame->failure || rb_frame_text(4, frame->failure, failure_length);
  if (!valid_state || !valid_failure || (uncertain && !frame->failure) ||
      frame->role || frame->reason)
    return false;
  if (!terminal)
    return !frame->has_exit_code && !frame->signal;
  if (frame->has_exit_code && frame->signal)
    return false;
  if (!uncertain && !frame->has_exit_code && !frame->signal)
    return false;
  return !frame->signal ||
         rb_frame_text(5, frame->signal, __builtin_strlen(frame->signal));
}
#endif
