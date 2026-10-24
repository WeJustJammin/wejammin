#ifndef WEJAMMIN_DEC203_BOOTSTRAP_WIRE_H
#define WEJAMMIN_DEC203_BOOTSTRAP_WIRE_H

#include <errno.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <sys/types.h>
#include <unistd.h>

#ifndef DEC203_NATIVE_FRAME_BYTES
#error "receiving-bootstrap-profile.h must be included first"
#endif

#define RB_WIRE_PREFIX_BYTES 4U
#define RB_WIRE_BYTES (RB_WIRE_PREFIX_BYTES + DEC203_NATIVE_FRAME_BYTES)

typedef struct {
  int fd;
  unsigned char rx[RB_WIRE_BYTES];
  unsigned char tx[RB_WIRE_BYTES];
  size_t rx_used;
  size_t rx_need;
  size_t tx_length;
  size_t tx_offset;
  uint64_t in_seq;
  uint64_t out_seq;
  bool eof;
  const char *error;
} rb_channel;

static inline bool rb_wire_bytes(unsigned char *out, size_t capacity,
                                 size_t *used, const void *data,
                                 size_t length) {
  if (!out || !used || *used > capacity || length > capacity - *used)
    return false;
  __builtin_memcpy(out + *used, data, length);
  *used += length;
  return true;
}

static inline bool rb_wire_literal(unsigned char *out, size_t capacity,
                                   size_t *used, const char *literal) {
  return rb_wire_bytes(out, capacity, used, literal, __builtin_strlen(literal));
}

static inline bool rb_wire_string(unsigned char *out, size_t capacity,
                                  size_t *used, const char *value) {
  if (!value || !rb_wire_literal(out, capacity, used, "\""))
    return false;
  for (size_t index = 0; value[index]; index++) {
    unsigned char byte = (unsigned char)value[index];
    if (byte < 0x20)
      return false;
    if (byte == '"' || byte == '\\') {
      char escaped[2] = {'\\', (char)byte};
      if (!rb_wire_bytes(out, capacity, used, escaped, sizeof(escaped)))
        return false;
    } else if (!rb_wire_bytes(out, capacity, used, &byte, 1)) {
      return false;
    }
  }
  return rb_wire_literal(out, capacity, used, "\"");
}

static inline bool rb_wire_number(unsigned char *out, size_t capacity,
                                  size_t *used, int32_t value) {
  char text[32];
  int length = snprintf(text, sizeof(text), "%d", value);
  return length > 0 && (size_t)length < sizeof(text) &&
         rb_wire_bytes(out, capacity, used, text, (size_t)length);
}

static inline bool rb_wire_sequence(unsigned char *out, size_t capacity,
                                    size_t *used, uint64_t value) {
  char text[32];
  int length = snprintf(text, sizeof(text), "%llu", (unsigned long long)value);
  return length > 0 && (size_t)length < sizeof(text) &&
         rb_wire_string(out, capacity, used, text);
}

static inline bool rb_wire_member(unsigned char *out, size_t capacity,
                                  size_t *used, bool *first, const char *key) {
  if (!*first && !rb_wire_literal(out, capacity, used, ","))
    return false;
  *first = false;
  return rb_wire_string(out, capacity, used, key) &&
         rb_wire_literal(out, capacity, used, ":");
}

static inline bool rb_wire_nullable(unsigned char *out, size_t capacity,
                                    size_t *used, const char *value) {
  return value ? rb_wire_string(out, capacity, used, value)
               : rb_wire_literal(out, capacity, used, "null");
}

static inline bool rb_wire_body(unsigned char *out, size_t capacity,
                                size_t *used, const rb_frame *frame) {
  bool first = true;
  if (!rb_wire_literal(out, capacity, used, "{"))
    return false;
  if (frame->role && (!rb_wire_member(out, capacity, used, &first, "role") ||
                      !rb_wire_string(out, capacity, used, frame->role)))
    return false;
  if (frame->reason &&
      (!rb_wire_member(out, capacity, used, &first, "reason") ||
       !rb_wire_string(out, capacity, used, frame->reason)))
    return false;
  if (frame->state && (!rb_wire_member(out, capacity, used, &first, "state") ||
                       !rb_wire_string(out, capacity, used, frame->state)))
    return false;
  if (frame->kind == RB_SETTLED || frame->kind == RB_TERMINAL) {
    if (!rb_wire_member(out, capacity, used, &first, "failure") ||
        !rb_wire_nullable(out, capacity, used, frame->failure))
      return false;
  }
  if (frame->kind == RB_TERMINAL) {
    if (!rb_wire_member(out, capacity, used, &first, "exitCode") ||
        (frame->has_exit_code
             ? !rb_wire_number(out, capacity, used, frame->exit_code)
             : !rb_wire_literal(out, capacity, used, "null")))
      return false;
    if (!rb_wire_member(out, capacity, used, &first, "signal") ||
        !rb_wire_nullable(out, capacity, used, frame->signal))
      return false;
  }
  return rb_wire_literal(out, capacity, used, "}");
}

static inline bool rb_wire_encode(unsigned char *out, size_t capacity,
                                  const char *bootstrap_id, uint64_t sequence,
                                  const rb_frame *frame, size_t *length) {
  size_t used = 0;
  if (!out || !length || !bootstrap_id || !rb_uuid(bootstrap_id) || !frame ||
      !sequence || !rb_frame_valid(frame))
    return false;
  if (!rb_wire_literal(out, capacity, &used, "{\"v\":1,\"bootstrapId\":"))
    return false;
  if (!rb_wire_string(out, capacity, &used, bootstrap_id) ||
      !rb_wire_literal(out, capacity, &used, ",\"seq\":"))
    return false;
  if (!rb_wire_sequence(out, capacity, &used, sequence) ||
      !rb_wire_literal(out, capacity, &used, ",\"kind\":"))
    return false;
  if (!rb_wire_string(out, capacity, &used, rb_frame_kind_text(frame->kind)) ||
      !rb_wire_literal(out, capacity, &used, ",\"body\":") ||
      !rb_wire_body(out, capacity, &used, frame) ||
      !rb_wire_literal(out, capacity, &used, "}"))
    return false;
  *length = used;
  return used > 0 && used <= DEC203_NATIVE_FRAME_BYTES;
}

static inline void rb_channel_init(rb_channel *channel, int fd) {
  channel->fd = fd;
  channel->rx_used = 0;
  channel->rx_need = RB_WIRE_PREFIX_BYTES;
  channel->tx_length = 0;
  channel->tx_offset = 0;
  channel->in_seq = 0;
  channel->out_seq = 1;
  channel->eof = false;
  channel->error = NULL;
}

static inline bool rb_pending(const rb_channel *channel) {
  return channel && channel->tx_offset < channel->tx_length;
}

static inline bool rb_partial(const rb_channel *channel) {
  return channel && channel->rx_used != 0;
}

static inline int rb_wire_read_more(rb_channel *channel) {
  if (channel->fd < 0) {
    channel->error = DEC203_ERROR_UNAVAILABLE;
    return -1;
  }
  ssize_t received = read(channel->fd, channel->rx + channel->rx_used,
                          channel->rx_need - channel->rx_used);
  if (received > 0) {
    channel->rx_used += (size_t)received;
    return 1;
  }
  if (received == 0) {
    channel->eof = true;
    channel->error = DEC203_ERROR_HISTORY_GAP;
    return -1;
  }
  if (errno == EAGAIN || errno == EWOULDBLOCK || errno == EINTR)
    return 0;
  channel->error = DEC203_ERROR_UNAVAILABLE;
  return -1;
}

static inline int rb_receive(rb_channel *channel, const char *bootstrap_id,
                             rb_frame *frame) {
  if (!channel || !bootstrap_id || !frame)
    return -1;
  if (channel->error)
    return -1;
  for (;;) {
    if (channel->rx_used < channel->rx_need) {
      int result = rb_wire_read_more(channel);
      if (result <= 0)
        return result;
      continue;
    }
    if (channel->rx_need == RB_WIRE_PREFIX_BYTES) {
      uint32_t payload = ((uint32_t)channel->rx[0] << 24) |
                         ((uint32_t)channel->rx[1] << 16) |
                         ((uint32_t)channel->rx[2] << 8) | channel->rx[3];
      if (!payload || payload > DEC203_NATIVE_FRAME_BYTES) {
        channel->error = DEC203_ERROR_PROTOCOL;
        return -1;
      }
      channel->rx_need = RB_WIRE_PREFIX_BYTES + payload;
      continue;
    }
    const char *error = DEC203_ERROR_PROTOCOL;
    uint64_t sequence = 0;
    size_t payload = channel->rx_need - RB_WIRE_PREFIX_BYTES;
    if (!rb_frame_decode(channel->rx + RB_WIRE_PREFIX_BYTES, payload,
                         bootstrap_id, frame, &sequence, &error)) {
      channel->error = error;
      return -1;
    }
    if (channel->in_seq == UINT64_MAX || sequence != channel->in_seq + 1) {
      channel->error = DEC203_ERROR_HISTORY_GAP;
      return -1;
    }
    channel->in_seq = sequence;
    channel->rx_used = 0;
    channel->rx_need = RB_WIRE_PREFIX_BYTES;
    return 1;
  }
}

static inline int rb_flush(rb_channel *channel) {
  if (!channel)
    return -1;
  if (channel->error)
    return -1;
  if (!rb_pending(channel))
    return 1;
  if (channel->fd < 0) {
    channel->error = DEC203_ERROR_UNAVAILABLE;
    return -1;
  }
  ssize_t written = write(channel->fd, channel->tx + channel->tx_offset,
                          channel->tx_length - channel->tx_offset);
  if (written > 0) {
    channel->tx_offset += (size_t)written;
    return rb_pending(channel) ? 0 : 1;
  }
  if (written < 0 &&
      (errno == EAGAIN || errno == EWOULDBLOCK || errno == EINTR))
    return 0;
  channel->error = DEC203_ERROR_HISTORY_GAP;
  return -1;
}

static inline int rb_send(rb_channel *channel, const char *bootstrap_id,
                          const rb_frame *frame) {
  if (!channel)
    return -1;
  if (channel->error)
    return -1;
  if (rb_pending(channel) || channel->out_seq == 0) {
    channel->error = channel->out_seq == 0 ? DEC203_ERROR_HISTORY_GAP
                                           : DEC203_ERROR_PROTOCOL;
    return -1;
  }
  size_t payload = 0;
  if (!rb_wire_encode(channel->tx + RB_WIRE_PREFIX_BYTES,
                      DEC203_NATIVE_FRAME_BYTES, bootstrap_id, channel->out_seq,
                      frame, &payload)) {
    channel->error = DEC203_ERROR_PROTOCOL;
    return -1;
  }
  channel->tx[0] = (unsigned char)(payload >> 24);
  channel->tx[1] = (unsigned char)(payload >> 16);
  channel->tx[2] = (unsigned char)(payload >> 8);
  channel->tx[3] = (unsigned char)payload;
  channel->tx_length = RB_WIRE_PREFIX_BYTES + payload;
  channel->tx_offset = 0;
  channel->out_seq = channel->out_seq == UINT64_MAX ? 0 : channel->out_seq + 1;
  return 0;
}

#endif
