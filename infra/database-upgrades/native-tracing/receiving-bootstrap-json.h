#ifndef WEJAMMIN_DEC203_BOOTSTRAP_JSON_H
#define WEJAMMIN_DEC203_BOOTSTRAP_JSON_H
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#ifndef DEC203_NATIVE_FRAME_BYTES
#error "receiving-bootstrap-profile.h must be included first"
#endif

typedef struct {
  const unsigned char *at;
  const unsigned char *end;
} rb_json_cursor;
static inline size_t rb_json_left(const rb_json_cursor *cursor) {
  return cursor->at <= cursor->end ? (size_t)(cursor->end - cursor->at) : 0;
}
static inline void rb_json_ws(rb_json_cursor *cursor) {
  while (cursor->at < cursor->end &&
         (*cursor->at == ' ' || *cursor->at == '\t' || *cursor->at == '\n' ||
          *cursor->at == '\r'))
    cursor->at++;
}
static inline int rb_json_hex(unsigned char value) {
  if (value >= '0' && value <= '9')
    return value - '0';
  if (value >= 'a' && value <= 'f')
    return value - 'a' + 10;
  if (value >= 'A' && value <= 'F')
    return value - 'A' + 10;
  return -1;
}
static inline bool rb_json_u16(rb_json_cursor *cursor, uint16_t *value) {
  if (rb_json_left(cursor) < 4)
    return false;
  int a = rb_json_hex(cursor->at[0]);
  int b = rb_json_hex(cursor->at[1]);
  int c = rb_json_hex(cursor->at[2]);
  int d = rb_json_hex(cursor->at[3]);
  if (a < 0 || b < 0 || c < 0 || d < 0)
    return false;
  cursor->at += 4;
  *value = (uint16_t)((a << 12) | (b << 8) | (c << 4) | d);
  return true;
}
static inline bool rb_json_put_utf8(char *out, size_t capacity, size_t *used,
                                    uint32_t codepoint) {
  unsigned char bytes[4];
  size_t width;
  if (codepoint <= 0x7f) {
    bytes[0] = (unsigned char)codepoint;
    width = 1;
  } else if (codepoint <= 0x7ff) {
    bytes[0] = (unsigned char)(0xc0 | (codepoint >> 6));
    bytes[1] = (unsigned char)(0x80 | (codepoint & 0x3f));
    width = 2;
  } else if (codepoint <= 0xffff) {
    bytes[0] = (unsigned char)(0xe0 | (codepoint >> 12));
    bytes[1] = (unsigned char)(0x80 | ((codepoint >> 6) & 0x3f));
    bytes[2] = (unsigned char)(0x80 | (codepoint & 0x3f));
    width = 3;
  } else if (codepoint <= 0x10ffff) {
    bytes[0] = (unsigned char)(0xf0 | (codepoint >> 18));
    bytes[1] = (unsigned char)(0x80 | ((codepoint >> 12) & 0x3f));
    bytes[2] = (unsigned char)(0x80 | ((codepoint >> 6) & 0x3f));
    bytes[3] = (unsigned char)(0x80 | (codepoint & 0x3f));
    width = 4;
  } else {
    return false;
  }
  if (out && (width >= capacity || *used > capacity - width - 1))
    return false;
  if (out)
    for (size_t index = 0; index < width; index++)
      out[*used + index] = (char)bytes[index];
  *used += width;
  return true;
}
static inline bool rb_json_string(rb_json_cursor *cursor, char *out,
                                  size_t capacity, size_t *length) {
  if (cursor->at >= cursor->end || *cursor->at++ != '"')
    return false;
  size_t used = 0;
  while (cursor->at < cursor->end) {
    unsigned char byte = *cursor->at++;
    if (byte == '"') {
      if (out && used >= capacity)
        return false;
      if (out)
        out[used] = '\0';
      *length = used;
      return true;
    }
    if (byte == '\\') {
      if (cursor->at >= cursor->end)
        return false;
      unsigned char escaped = *cursor->at++;
      uint32_t codepoint;
      if (escaped == '"' || escaped == '\\' || escaped == '/')
        codepoint = escaped;
      else if (escaped == 'b')
        codepoint = '\b';
      else if (escaped == 'f')
        codepoint = '\f';
      else if (escaped == 'n')
        codepoint = '\n';
      else if (escaped == 'r')
        codepoint = '\r';
      else if (escaped == 't')
        codepoint = '\t';
      else if (escaped == 'u') {
        uint16_t high;
        if (!rb_json_u16(cursor, &high))
          return false;
        if (high >= 0xd800 && high <= 0xdbff) {
          uint16_t low;
          if (rb_json_left(cursor) < 6 || cursor->at[0] != '\\' ||
              cursor->at[1] != 'u')
            return false;
          cursor->at += 2;
          if (!rb_json_u16(cursor, &low) || low < 0xdc00 || low > 0xdfff)
            return false;
          codepoint = 0x10000U + ((uint32_t)high - 0xd800U) * 0x400U +
                      ((uint32_t)low - 0xdc00U);
        } else {
          if (high >= 0xdc00 && high <= 0xdfff)
            return false;
          codepoint = high;
        }
      } else {
        return false;
      }
      if (!rb_json_put_utf8(out, capacity, &used, codepoint))
        return false;
      continue;
    }
    if (byte < 0x20)
      return false;
    if (byte < 0x80) {
      if (!rb_json_put_utf8(out, capacity, &used, byte))
        return false;
      continue;
    }
    unsigned continuation = byte >= 0xc2 && byte <= 0xdf   ? 1
                            : byte >= 0xe0 && byte <= 0xef ? 2
                            : byte >= 0xf0 && byte <= 0xf4 ? 3
                                                           : 0;
    if (!continuation || rb_json_left(cursor) < continuation)
      return false;
    if ((byte == 0xe0 && cursor->at[0] < 0xa0) ||
        (byte == 0xed && cursor->at[0] >= 0xa0) ||
        (byte == 0xf0 && cursor->at[0] < 0x90) ||
        (byte == 0xf4 && cursor->at[0] >= 0x90))
      return false;
    uint32_t codepoint = byte & (continuation == 1   ? 0x1f
                                 : continuation == 2 ? 0x0f
                                                     : 0x07);
    for (unsigned index = 0; index < continuation; index++) {
      unsigned char part = cursor->at[index];
      if (part < 0x80 || part > 0xbf)
        return false;
      codepoint = (codepoint << 6) | (part & 0x3f);
    }
    cursor->at += continuation;
    if (!rb_json_put_utf8(out, capacity, &used, codepoint))
      return false;
  }
  return false;
}

static inline bool rb_json_number_token(rb_json_cursor *cursor,
                                        const unsigned char **start,
                                        const unsigned char **finish) {
  const unsigned char *at = cursor->at;
  if (at < cursor->end && *at == '-')
    at++;
  if (at >= cursor->end || *at < '0' || *at > '9')
    return false;
  if (*at == '0') {
    at++;
    if (at < cursor->end && *at >= '0' && *at <= '9')
      return false;
  } else {
    while (at < cursor->end && *at >= '0' && *at <= '9')
      at++;
  }
  if (at < cursor->end && *at == '.') {
    at++;
    if (at >= cursor->end || *at < '0' || *at > '9')
      return false;
    while (at < cursor->end && *at >= '0' && *at <= '9')
      at++;
  }
  if (at < cursor->end && (*at == 'e' || *at == 'E')) {
    at++;
    if (at < cursor->end && (*at == '+' || *at == '-'))
      at++;
    if (at >= cursor->end || *at < '0' || *at > '9')
      return false;
    while (at < cursor->end && *at >= '0' && *at <= '9')
      at++;
  }
  *start = cursor->at;
  *finish = at;
  cursor->at = at;
  return true;
}

static inline bool rb_json_integer(rb_json_cursor *cursor, int64_t *value) {
  const unsigned char *start, *finish;
  if (!rb_json_number_token(cursor, &start, &finish))
    return false;
  char digits[DEC203_NATIVE_FRAME_BYTES];
  size_t count = 0, before_dot = 0;
  bool dot = false;
  const unsigned char *at = start;
  if (at < finish && *at == '-')
    at++;
  while (at < finish && *at != 'e' && *at != 'E') {
    if (*at == '.') {
      dot = true;
    } else {
      if (count == sizeof(digits))
        return false;
      digits[count++] = (char)*at;
      if (!dot)
        before_dot++;
    }
    at++;
  }
  bool negative_exponent = false;
  uint64_t exponent = 0;
  if (at < finish) {
    at++;
    if (at < finish && (*at == '+' || *at == '-')) {
      negative_exponent = *at == '-';
      at++;
    }
    while (at < finish) {
      if (exponent < 100000)
        exponent = exponent * 10 + (unsigned)(*at - '0');
      at++;
    }
  }
  int64_t point = (int64_t)before_dot;
  point += negative_exponent ? -(int64_t)exponent : (int64_t)exponent;
  size_t first_fraction = point > 0 ? (size_t)point : 0;
  if (point < (int64_t)count)
    for (size_t index = first_fraction; index < count; index++)
      if (digits[index] != '0')
        return false;
  if (point <= 0) {
    *value = 0;
    return true;
  }
  uint64_t limit = start < finish && *start == '-' ? 9223372036854775808ULL
                                                   : 9223372036854775807ULL;
  uint64_t magnitude = 0;
  size_t whole = point < (int64_t)count ? (size_t)point : count;
  for (size_t index = 0; index < whole; index++) {
    unsigned digit = (unsigned)(digits[index] - '0');
    if (magnitude > (limit - digit) / 10)
      return false;
    magnitude = magnitude * 10 + digit;
  }
  if (point > (int64_t)count) {
    uint64_t zeros = (uint64_t)point - count;
    if (magnitude && zeros > 19)
      return false;
    while (magnitude && zeros--) {
      if (magnitude > limit / 10)
        return false;
      magnitude *= 10;
    }
  }
  if (start < finish && *start == '-')
    *value =
        magnitude == 9223372036854775808ULL ? INT64_MIN : -(int64_t)magnitude;
  else
    *value = (int64_t)magnitude;
  return true;
}

static inline bool rb_json_word(rb_json_cursor *cursor, const char *word) {
  size_t length = 0;
  while (word[length])
    length++;
  if (rb_json_left(cursor) < length ||
      (length && __builtin_memcmp(cursor->at, word, length) != 0))
    return false;
  cursor->at += length;
  return true;
}
#endif
