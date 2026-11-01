#ifndef WEJAMMIN_RECEIVING_BOOTSTRAP_SHA256_H
#define WEJAMMIN_RECEIVING_BOOTSTRAP_SHA256_H
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>
typedef struct rb_file_slot {
  int fd;
  int original_fd;
  struct stat identity;
  bool identity_known;
  bool close_attempted;
  bool uncertain;
  int first_error;
  struct rb_file_slot *next;
} rb_file_slot;
static rb_file_slot *rb_file_tombstones;
static inline void rb_file_mark(rb_file_slot *slot, int error) {
  if (slot && slot->first_error == 0)
    slot->first_error = error ? error : EIO;
}
static inline void rb_file_anchor(rb_file_slot *slot) {
  slot->next = rb_file_tombstones;
  rb_file_tombstones = slot;
}
static inline bool rb_file_same_identity(const struct stat *left,
                                         const struct stat *right) {
  return left && right && left->st_dev == right->st_dev &&
         left->st_ino == right->st_ino && left->st_mode == right->st_mode &&
         left->st_uid == right->st_uid && left->st_gid == right->st_gid;
}
static inline rb_file_slot *rb_file_open(const char *path, int flags) {
  rb_file_slot *slot = calloc(1, sizeof(*slot));
  if (!slot)
    return NULL;
  slot->fd = -1;
  slot->original_fd = -1;
  int descriptor = open(path, flags);
  if (descriptor < 0) {
    free(slot);
    return NULL;
  }
  slot->fd = descriptor;
  slot->original_fd = descriptor;
  if (fstat(descriptor, &slot->identity) != 0) {
    rb_file_mark(slot, errno);
    return slot;
  }
  slot->identity_known = true;
  return slot;
}
static inline bool rb_file_close(rb_file_slot *slot) {
  if (!slot || slot->close_attempted)
    return false;
  slot->close_attempted = true;
  if (slot->fd < 0) {
    if (slot->uncertain) {
      rb_file_anchor(slot);
      return false;
    }
    free(slot);
    return true;
  }
  struct stat current;
  if (!slot->identity_known || fstat(slot->fd, &current) != 0 ||
      !rb_file_same_identity(&slot->identity, &current)) {
    rb_file_mark(slot, slot->first_error ? slot->first_error : EIO);
    slot->fd = -1;
    slot->uncertain = true;
    rb_file_anchor(slot);
    return false;
  }
  int descriptor = slot->fd;
  slot->fd = -1;
  if (close(descriptor) == 0) {
    free(slot);
    return true;
  }
  rb_file_mark(slot, errno);
  slot->uncertain = true;
  rb_file_anchor(slot);
  return false;
}
typedef struct {
  uint32_t state[8];
  uint64_t bits;
  size_t used;
  uint8_t block[64];
} rb_sha256_state;
static inline uint32_t rb_sha256_rotr(uint32_t value, unsigned shift) {
  return (value >> shift) | (value << (32U - shift));
}
static inline void rb_sha256_transform(rb_sha256_state *context,
                                       const uint8_t block[64]) {
  static const uint32_t constants[64] = {
      0x428a2f98U, 0x71374491U, 0xb5c0fbcfU, 0xe9b5dba5U, 0x3956c25bU,
      0x59f111f1U, 0x923f82a4U, 0xab1c5ed5U, 0xd807aa98U, 0x12835b01U,
      0x243185beU, 0x550c7dc3U, 0x72be5d74U, 0x80deb1feU, 0x9bdc06a7U,
      0xc19bf174U, 0xe49b69c1U, 0xefbe4786U, 0x0fc19dc6U, 0x240ca1ccU,
      0x2de92c6fU, 0x4a7484aaU, 0x5cb0a9dcU, 0x76f988daU, 0x983e5152U,
      0xa831c66dU, 0xb00327c8U, 0xbf597fc7U, 0xc6e00bf3U, 0xd5a79147U,
      0x06ca6351U, 0x14292967U, 0x27b70a85U, 0x2e1b2138U, 0x4d2c6dfcU,
      0x53380d13U, 0x650a7354U, 0x766a0abbU, 0x81c2c92eU, 0x92722c85U,
      0xa2bfe8a1U, 0xa81a664bU, 0xc24b8b70U, 0xc76c51a3U, 0xd192e819U,
      0xd6990624U, 0xf40e3585U, 0x106aa070U, 0x19a4c116U, 0x1e376c08U,
      0x2748774cU, 0x34b0bcb5U, 0x391c0cb3U, 0x4ed8aa4aU, 0x5b9cca4fU,
      0x682e6ff3U, 0x748f82eeU, 0x78a5636fU, 0x84c87814U, 0x8cc70208U,
      0x90befffaU, 0xa4506cebU, 0xbef9a3f7U, 0xc67178f2U};
  uint32_t words[64];
  for (unsigned index = 0; index < 16U; index++) {
    unsigned offset = index * 4U;
    words[index] = ((uint32_t)block[offset] << 24U) |
                   ((uint32_t)block[offset + 1U] << 16U) |
                   ((uint32_t)block[offset + 2U] << 8U) | block[offset + 3U];
  }
  for (unsigned index = 16U; index < 64U; index++) {
    uint32_t first = rb_sha256_rotr(words[index - 15U], 7U) ^
                     rb_sha256_rotr(words[index - 15U], 18U) ^
                     (words[index - 15U] >> 3U);
    uint32_t second = rb_sha256_rotr(words[index - 2U], 17U) ^
                      rb_sha256_rotr(words[index - 2U], 19U) ^
                      (words[index - 2U] >> 10U);
    words[index] = words[index - 16U] + first + words[index - 7U] + second;
  }
  uint32_t a = context->state[0];
  uint32_t b = context->state[1];
  uint32_t c = context->state[2];
  uint32_t d = context->state[3];
  uint32_t e = context->state[4];
  uint32_t f = context->state[5];
  uint32_t g = context->state[6];
  uint32_t h = context->state[7];
  for (unsigned index = 0; index < 64U; index++) {
    uint32_t upper =
        rb_sha256_rotr(e, 6U) ^ rb_sha256_rotr(e, 11U) ^ rb_sha256_rotr(e, 25U);
    uint32_t choose = (e & f) ^ ((~e) & g);
    uint32_t lower =
        rb_sha256_rotr(a, 2U) ^ rb_sha256_rotr(a, 13U) ^ rb_sha256_rotr(a, 22U);
    uint32_t majority = (a & b) ^ (a & c) ^ (b & c);
    uint32_t first = h + upper + choose + constants[index] + words[index];
    uint32_t second = lower + majority;
    h = g;
    g = f;
    f = e;
    e = d + first;
    d = c;
    c = b;
    b = a;
    a = first + second;
  }
  context->state[0] += a;
  context->state[1] += b;
  context->state[2] += c;
  context->state[3] += d;
  context->state[4] += e;
  context->state[5] += f;
  context->state[6] += g;
  context->state[7] += h;
}
static inline void rb_sha256_init(rb_sha256_state *context) {
  *context = (rb_sha256_state){.state = {0x6a09e667U, 0xbb67ae85U, 0x3c6ef372U,
                                         0xa54ff53aU, 0x510e527fU, 0x9b05688cU,
                                         0x1f83d9abU, 0x5be0cd19U}};
}
static inline bool rb_sha256_update(rb_sha256_state *context,
                                    const uint8_t *bytes, size_t length) {
  if (!context || (!bytes && length) ||
      (uint64_t)length > (UINT64_MAX - context->bits) / 8U)
    return false;
  context->bits += (uint64_t)length * 8U;
  while (length) {
    size_t count = sizeof(context->block) - context->used;
    if (count > length)
      count = length;
    memcpy(context->block + context->used, bytes, count);
    context->used += count;
    bytes += count;
    length -= count;
    if (context->used == sizeof(context->block)) {
      rb_sha256_transform(context, context->block);
      context->used = 0;
    }
  }
  return true;
}
static inline void rb_sha256_final(rb_sha256_state *context,
                                   uint8_t digest[32]) {
  uint64_t bits = context->bits;
  context->block[context->used++] = 0x80U;
  if (context->used > 56U) {
    memset(context->block + context->used, 0, 64U - context->used);
    rb_sha256_transform(context, context->block);
    context->used = 0;
  }
  memset(context->block + context->used, 0, 56U - context->used);
  for (unsigned index = 0; index < 8U; index++)
    context->block[56U + index] = (uint8_t)(bits >> (56U - index * 8U));
  rb_sha256_transform(context, context->block);
  for (unsigned index = 0; index < 8U; index++) {
    digest[index * 4U] = (uint8_t)(context->state[index] >> 24U);
    digest[index * 4U + 1U] = (uint8_t)(context->state[index] >> 16U);
    digest[index * 4U + 2U] = (uint8_t)(context->state[index] >> 8U);
    digest[index * 4U + 3U] = (uint8_t)context->state[index];
  }
}
static inline int rb_sha256_hex(char value) {
  if (value >= '0' && value <= '9')
    return value - '0';
  if (value >= 'a' && value <= 'f')
    return value - 'a' + 10;
  return -1;
}
static inline bool rb_sha256_matches(const uint8_t digest[32],
                                     const char *hex) {
  if (!digest || !hex || strlen(hex) != 64U)
    return false;
  for (unsigned index = 0; index < 32U; index++) {
    int high = rb_sha256_hex(hex[index * 2U]);
    int low = rb_sha256_hex(hex[index * 2U + 1U]);
    if (high < 0 || low < 0 || digest[index] != (uint8_t)((high << 4) | low))
      return false;
  }
  return true;
}
static inline bool rb_image_stat_matches(const struct stat *actual,
                                         uint64_t size, uid_t uid, mode_t mode,
                                         const struct stat *executed) {
  return actual && executed && S_ISREG(actual->st_mode) &&
         actual->st_size >= 0 && (uintmax_t)actual->st_size == size &&
         executed->st_size >= 0 && (uintmax_t)executed->st_size == size &&
         actual->st_uid == uid && actual->st_mode == mode &&
         rb_file_same_identity(actual, executed);
}
static inline bool rb_image_file(const char *path, uint64_t size, uid_t uid,
                                 mode_t mode, const char *hex,
                                 const struct stat *executed) {
  char resolved[PATH_MAX];
  struct stat named;
  if (!path || !hex || !executed || size > (uint64_t)SIZE_MAX ||
      !realpath(path, resolved) || strcmp(resolved, path) != 0 ||
      lstat(path, &named) != 0 ||
      !rb_image_stat_matches(&named, size, uid, mode, executed))
    return false;
  rb_file_slot *slot = rb_file_open(path, O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
  if (!slot)
    return false;
  bool valid =
      slot->identity_known && rb_file_same_identity(&slot->identity, &named);
  rb_sha256_state context;
  uint8_t digest[32];
  rb_sha256_init(&context);
  uint64_t total = 0;
  unsigned char bytes[8192];
  while (valid && total < size) {
    uint64_t remaining = size - total;
    size_t wanted =
        remaining > sizeof(bytes) ? sizeof(bytes) : (size_t)remaining;
    ssize_t count = read(slot->fd, bytes, wanted);
    if (count < 0 && errno == EINTR)
      continue;
    if (count <= 0 || (uint64_t)count > remaining ||
        !rb_sha256_update(&context, bytes, (size_t)count)) {
      rb_file_mark(slot, errno);
      valid = false;
      break;
    }
    total += (uint64_t)count;
  }
  unsigned char overflow;
  ssize_t extra = 0;
  if (valid)
    do {
      extra = read(slot->fd, &overflow, 1U);
    } while (extra < 0 && errno == EINTR);
  if (valid && (extra < 0 || extra > 1))
    valid = false;
  if (valid && (total != size || extra != 0))
    valid = false;
  if (valid)
    rb_sha256_final(&context, digest);
  struct stat final_stat;
  struct stat final_named;
  if (valid &&
      (fstat(slot->fd, &final_stat) != 0 || lstat(path, &final_named) != 0 ||
       !rb_image_stat_matches(&final_stat, size, uid, mode, executed) ||
       !rb_file_same_identity(&final_stat, &final_named) ||
       !realpath(path, resolved) || strcmp(resolved, path) != 0 ||
       !rb_sha256_matches(digest, hex)))
    valid = false;
  bool closed = rb_file_close(slot);
  return valid && closed;
}
#endif
