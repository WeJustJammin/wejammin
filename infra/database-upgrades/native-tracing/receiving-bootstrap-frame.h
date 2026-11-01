#ifndef WEJAMMIN_DEC203_BOOTSTRAP_FRAME_H
#define WEJAMMIN_DEC203_BOOTSTRAP_FRAME_H
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#ifndef DEC203_NATIVE_FRAME_BYTES
#error "receiving-bootstrap-profile.h must be included first"
#endif
static inline bool rb_frame_body_value(rb_json_cursor *cursor, unsigned bit,
                                       rb_frame *frame, char *text,
                                       size_t capacity) {
  size_t length;
  rb_json_ws(cursor);
  if (bit == 8 || bit == 32) {
    const char **slot = bit == 8 ? &frame->failure : &frame->signal;
    if (rb_json_word(cursor, "null")) {
      *slot = NULL;
      return true;
    }
    if (!rb_json_string(cursor, text, capacity, &length))
      return false;
    const char *mapped = rb_frame_text(bit == 8 ? 4 : 5, text, length);
    if (!mapped)
      return false;
    *slot = mapped;
    return true;
  }
  if (bit == 16) {
    if (rb_json_word(cursor, "null")) {
      frame->has_exit_code = false;
      return true;
    }
    int64_t number;
    if (!rb_json_integer(cursor, &number) || number < INT32_MIN ||
        number > INT32_MAX)
      return false;
    frame->has_exit_code = true;
    frame->exit_code = (int32_t)number;
    return true;
  }
  if (!rb_json_string(cursor, text, capacity, &length))
    return false;
  const char *mapped = rb_frame_text(bit == 1   ? 1
                                     : bit == 2 ? 2
                                                : 3,
                                     text, length);
  if (!mapped)
    return false;
  const char **slot = bit == 1   ? &frame->role
                      : bit == 2 ? &frame->reason
                                 : &frame->state;
  *slot = mapped;
  return true;
}
static inline bool rb_frame_body(rb_json_cursor *cursor, rb_frame *frame,
                                 unsigned *fields) {
  char key[32];
  char text[128];
  size_t key_length;
  unsigned seen = 0;
  if (cursor->at >= cursor->end || *cursor->at++ != '{')
    return false;
  rb_json_ws(cursor);
  if (cursor->at < cursor->end && *cursor->at == '}')
    cursor->at++;
  else {
    for (;;) {
      if (!rb_json_string(cursor, key, sizeof(key), &key_length))
        return false;
      rb_json_ws(cursor);
      if (cursor->at >= cursor->end || *cursor->at++ != ':')
        return false;
      unsigned bit = rb_json_equal(key, key_length, "role")       ? 1
                     : rb_json_equal(key, key_length, "reason")   ? 2
                     : rb_json_equal(key, key_length, "state")    ? 4
                     : rb_json_equal(key, key_length, "failure")  ? 8
                     : rb_json_equal(key, key_length, "exitCode") ? 16
                     : rb_json_equal(key, key_length, "signal")   ? 32
                                                                  : 0;
      if (!bit || (seen & bit) ||
          !rb_frame_body_value(cursor, bit, frame, text, sizeof(text)))
        return false;
      seen |= bit;
      rb_json_ws(cursor);
      if (cursor->at < cursor->end && *cursor->at == '}') {
        cursor->at++;
        break;
      }
      if (cursor->at >= cursor->end || *cursor->at++ != ',')
        return false;
      rb_json_ws(cursor);
    }
  }
  *fields = seen;
  return true;
}
static inline bool rb_frame_decode(const unsigned char *bytes, size_t length,
                                   const char *expected_id, rb_frame *frame,
                                   uint64_t *sequence, const char **error) {
  if (error)
    *error = DEC203_ERROR_PROTOCOL;
  if (!bytes || !length || length > DEC203_NATIVE_FRAME_BYTES || !expected_id ||
      !rb_uuid(expected_id) || !frame || !sequence)
    return false;
  rb_json_cursor cursor = {bytes, bytes + length};
  char key[32], text[128];
  size_t key_length, text_length;
  unsigned seen = 0, body_fields = 0;
  rb_kind kind = RB_HELLO;
  int64_t version;
  uint64_t parsed_sequence = 0;
  *frame = (rb_frame){0};
  rb_json_ws(&cursor);
  if (cursor.at >= cursor.end || *cursor.at++ != '{')
    return false;
  rb_json_ws(&cursor);
  for (;;) {
    if (!rb_json_string(&cursor, key, sizeof(key), &key_length))
      return false;
    rb_json_ws(&cursor);
    if (cursor.at >= cursor.end || *cursor.at++ != ':')
      return false;
    unsigned bit = rb_json_equal(key, key_length, "v")             ? 64
                   : rb_json_equal(key, key_length, "bootstrapId") ? 128
                   : rb_json_equal(key, key_length, "seq")         ? 256
                   : rb_json_equal(key, key_length, "kind")        ? 512
                   : rb_json_equal(key, key_length, "body")        ? 1024
                                                                   : 0;
    if (!bit || (seen & bit))
      return false;
    seen |= bit;
    rb_json_ws(&cursor);
    if (bit == 64) {
      if (!rb_json_integer(&cursor, &version) || version != 1)
        return false;
    } else if (bit == 128) {
      if (!rb_json_string(&cursor, text, sizeof(text), &text_length) ||
          text_length != 36 || !rb_uuid(text) ||
          !rb_json_equal(text, text_length, expected_id)) {
        if (error)
          *error = DEC203_ERROR_REFUSED;
        return false;
      }
    } else if (bit == 256) {
      if (!rb_json_string(&cursor, text, sizeof(text), &text_length) ||
          !rb_frame_sequence(text, text_length, &parsed_sequence))
        return false;
    } else if (bit == 512) {
      if (!rb_json_string(&cursor, text, sizeof(text), &text_length))
        return false;
      for (kind = RB_HELLO; kind <= RB_TERMINAL; kind++)
        if (rb_json_equal(text, text_length, rb_frame_kind_text(kind)))
          break;
      if (kind > RB_TERMINAL)
        return false;
    } else if (!rb_frame_body(&cursor, frame, &body_fields)) {
      return false;
    }
    rb_json_ws(&cursor);
    if (cursor.at < cursor.end && *cursor.at == '}') {
      cursor.at++;
      break;
    }
    if (cursor.at >= cursor.end || *cursor.at++ != ',')
      return false;
    rb_json_ws(&cursor);
  }
  rb_json_ws(&cursor);
  unsigned expected_body = kind == RB_HELLO      ? 1
                           : kind == RB_CANCEL   ? 2
                           : kind == RB_SETTLED  ? 12
                           : kind == RB_TERMINAL ? 60
                                                 : 0;
  if (cursor.at != cursor.end || seen != 1984 || body_fields != expected_body)
    return false;
  frame->kind = kind;
  if (!rb_frame_valid(frame))
    return false;
  *sequence = parsed_sequence;
  return true;
}
#endif
