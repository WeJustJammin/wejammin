#ifndef DEC203_STREAM_INGRESS_STATE_H
#define DEC203_STREAM_INGRESS_STATE_H

#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <node_api.h>
#include <poll.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/uio.h>
#include <sys/un.h>
#include <unistd.h>

enum { SI_BYTES = 16384, SI_STREAMS = 16, SI_PER_STREAM = 4, SI_SEGMENTS = 32 };
typedef enum {
  SI_OK,
  SI_INVALID_CAPABILITY,
  SI_CLOSED,
  SI_UNAVAILABLE,
  SI_IDENTITY,
  SI_PROTOCOL,
  SI_EXITED,
  SI_LINKAGE,
  SI_IO,
  SI_CLEANUP
} si_error;
typedef struct si_group si_group;
typedef struct si_stream si_stream;
typedef struct si_segment si_segment;

struct si_group {
  size_t references;
  int directory_fd;
  int listener_fd;
  struct stat parent_identity;
  struct stat listener_identity;
  struct stat entry_identity;
  char parent[PATH_MAX];
  bool closed;
  bool uncertain;
  bool bound;
  bool entry_known;
  unsigned open_streams;
  unsigned segments;
  si_stream *streams;
  si_group *retained_next;
};

struct si_stream {
  size_t references;
  si_group *group;
  si_stream *next;
  si_segment *segments;
  int fd;
  struct stat identity;
  unsigned outstanding;
  bool closed;
  bool eof;
  bool cleanup_failed;
};

struct si_segment {
  size_t references;
  si_stream *stream;
  si_segment *next;
  unsigned char *bytes;
  size_t length;
  struct ucred credentials;
  int pidfd;
  bool closed;
  bool exited;
  bool cleanup_failed;
};

static const char *si_token(si_error error) {
  switch (error) {
  case SI_INVALID_CAPABILITY:
    return "DEC203_STREAM_INVALID_CAPABILITY";
  case SI_CLOSED:
    return "DEC203_STREAM_CAPABILITY_CLOSED";
  case SI_IDENTITY:
    return "DEC203_STREAM_IDENTITY_CHANGED";
  case SI_PROTOCOL:
    return "DEC203_STREAM_PROTOCOL";
  case SI_EXITED:
    return "DEC203_STREAM_WRITER_EXITED";
  case SI_LINKAGE:
    return "DEC203_STREAM_LINKAGE_CHANGED";
  case SI_IO:
    return "DEC203_STREAM_IO_FAILED";
  case SI_CLEANUP:
    return "DEC203_STREAM_CLEANUP_FAILED";
  default:
    return "DEC203_STREAM_UNAVAILABLE";
  }
}

static napi_value si_throw(napi_env env, si_error error) {
  bool pending = false;
  if (napi_is_exception_pending(env, &pending) == napi_ok && pending)
    return NULL;
  const char *token = si_token(error);
  napi_throw_error(env, token, token);
  return NULL;
}

static napi_value si_undefined(napi_env env) {
  napi_value value;
  return napi_get_undefined(env, &value) == napi_ok
             ? value
             : si_throw(env, SI_UNAVAILABLE);
}

static bool si_same(const struct stat *a, const struct stat *b) {
  return a->st_dev == b->st_dev && a->st_ino == b->st_ino &&
         a->st_mode == b->st_mode && a->st_uid == b->st_uid &&
         a->st_gid == b->st_gid;
}

/* Detach first: a failed close never authorizes retrying a reused integer. */
static bool si_take_close(int *slot) {
  int fd = *slot;
  *slot = -1;
  return fd < 0 || close(fd) == 0;
}

static bool si_release_segment(si_segment *segment) {
  if (!segment->closed) {
    segment->closed = true;
    segment->stream->outstanding--;
    segment->stream->group->segments--;
    if (!si_take_close(&segment->pidfd))
      segment->cleanup_failed = true;
    free(segment->bytes);
    segment->bytes = NULL;
    segment->length = 0;
  }
  if (segment->cleanup_failed)
    segment->stream->group->uncertain = true;
  return !segment->cleanup_failed;
}

static bool si_close_stream(si_stream *stream) {
  if (!stream->closed) {
    stream->closed = true;
    stream->group->open_streams--;
    for (si_segment *item = stream->segments; item != NULL; item = item->next)
      if (!si_release_segment(item))
        stream->cleanup_failed = true;
    if (!si_take_close(&stream->fd))
      stream->cleanup_failed = true;
  }
  if (stream->cleanup_failed)
    stream->group->uncertain = true;
  return !stream->cleanup_failed;
}

static bool si_parent_matches(si_group *group) {
  struct stat descriptor;
  struct stat entry;
  return fstat(group->directory_fd, &descriptor) == 0 &&
         lstat(group->parent, &entry) == 0 &&
         si_same(&group->parent_identity, &descriptor) &&
         si_same(&group->parent_identity, &entry);
}

static bool si_close_group(si_group *group) {
  if (!group->closed) {
    group->closed = true;
    for (si_stream *item = group->streams; item != NULL; item = item->next)
      if (!si_close_stream(item))
        group->uncertain = true;
    if (!si_take_close(&group->listener_fd))
      group->uncertain = true;
    if (group->bound) {
      struct stat entry;
      if (!group->entry_known || !si_parent_matches(group) ||
          fstatat(group->directory_fd, "docker.sock", &entry,
                  AT_SYMLINK_NOFOLLOW) != 0 ||
          !si_same(&group->entry_identity, &entry) ||
          unlinkat(group->directory_fd, "docker.sock", 0) != 0)
        group->uncertain = true;
      group->bound = false;
    }
    if (!si_take_close(&group->directory_fd))
      group->uncertain = true;
  }
  return !group->uncertain;
}

/* No API can turn an uncertain finalizer/constructor into observed drain. */
static _Thread_local si_group *si_retained_groups = NULL;

static void si_group_unref(si_group *group) {
  if (--group->references != 0)
    return;
  if (group->uncertain) {
    group->retained_next = si_retained_groups;
    si_retained_groups = group;
  } else {
    free(group);
  }
}

static void si_stream_unref(si_stream *stream) {
  if (--stream->references != 0)
    return;
  si_group *group = stream->group;
  si_stream **link = &group->streams;
  while (*link != stream)
    link = &(*link)->next;
  *link = stream->next;
  free(stream);
  si_group_unref(group);
}

static void si_segment_unref(si_segment *segment) {
  if (--segment->references != 0)
    return;
  si_stream *stream = segment->stream;
  si_segment **link = &stream->segments;
  while (*link != segment)
    link = &(*link)->next;
  *link = segment->next;
  free(segment);
  si_stream_unref(stream);
}

static void *si_receiver(napi_env env, napi_callback_info info,
                         const napi_type_tag *tag, size_t *count) {
  napi_value argument;
  napi_value receiver;
  napi_valuetype type;
  bool tagged = false;
  void *state = NULL;
  *count = 1;
  if (napi_get_cb_info(env, info, count, &argument, &receiver, NULL) !=
          napi_ok ||
      napi_typeof(env, receiver, &type) != napi_ok || type != napi_object ||
      napi_check_object_type_tag(env, receiver, tag, &tagged) != napi_ok ||
      !tagged || napi_unwrap(env, receiver, &state) != napi_ok ||
      state == NULL) {
    si_throw(env, SI_INVALID_CAPABILITY);
    return NULL;
  }
  return state;
}

#endif
