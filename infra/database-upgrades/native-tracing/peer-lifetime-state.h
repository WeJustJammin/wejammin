#ifndef DEC203_PEER_LIFETIME_STATE_H
#define DEC203_PEER_LIFETIME_STATE_H

#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <poll.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/un.h>
#include <unistd.h>

typedef enum {
  LIFE_OK,
  LIFE_INVALID_SOCKET,
  LIFE_UNAVAILABLE,
  LIFE_CLOSED,
  LIFE_INVALID_CAPABILITY,
  LIFE_EXITED,
  LIFE_LINKAGE_CHANGED,
  LIFE_IDENTITY_CHANGED,
  LIFE_CLEANUP_FAILED
} lifetime_error;

typedef struct {
  int socket_fd;
  int pidfd;
  pid_t pid;
  struct stat identity;
  bool closed;
  bool exited;
} lifetime_state;

static bool same_socket(const struct stat *left, const struct stat *right) {
  return left->st_dev == right->st_dev && left->st_ino == right->st_ino &&
         left->st_mode == right->st_mode && left->st_uid == right->st_uid &&
         left->st_gid == right->st_gid;
}

static bool take_close(int *slot) {
  int fd = *slot;
  *slot = -1;
  return fd < 0 || close(fd) == 0;
}

static bool release_lifetime(lifetime_state *state) {
  state->closed = true;
  bool pidfd_closed = take_close(&state->pidfd);
  bool socket_closed = take_close(&state->socket_fd);
  return pidfd_closed && socket_closed;
}

static bool socket_integer(int fd, int option, int expected) {
  int value = 0;
  socklen_t length = sizeof(value);
  return getsockopt(fd, SOL_SOCKET, option, &value, &length) == 0 &&
         length == sizeof(value) && value == expected;
}

static lifetime_error acquire_lifetime(int fd, lifetime_state *state) {
  struct stat before;
  struct sockaddr_un peer_address;
  socklen_t address_length = sizeof(peer_address);
  struct ucred peer;
  socklen_t credential_length = sizeof(peer);
  if (fstat(fd, &before) != 0 || !S_ISSOCK(before.st_mode))
    return LIFE_INVALID_SOCKET;
  state->socket_fd = fcntl(fd, F_DUPFD_CLOEXEC, 3);
  if (state->socket_fd < 0)
    return errno == EBADF ? LIFE_INVALID_SOCKET : LIFE_UNAVAILABLE;
  if (fstat(state->socket_fd, &state->identity) != 0 ||
      !same_socket(&before, &state->identity) ||
      !socket_integer(state->socket_fd, SO_TYPE, SOCK_STREAM) ||
      !socket_integer(state->socket_fd, SO_DOMAIN, AF_UNIX) ||
      getpeername(state->socket_fd, (struct sockaddr *)&peer_address,
                  &address_length) != 0 ||
      address_length < sizeof(peer_address.sun_family) ||
      peer_address.sun_family != AF_UNIX ||
      getsockopt(state->socket_fd, SOL_SOCKET, SO_PEERCRED, &peer,
                 &credential_length) != 0 ||
      credential_length != sizeof(peer) || peer.pid <= 0)
    return LIFE_INVALID_SOCKET;
  state->pid = peer.pid;
#ifdef SO_PEERPIDFD
  int acquired = -1;
  socklen_t length = sizeof(acquired);
  if (getsockopt(state->socket_fd, SOL_SOCKET, SO_PEERPIDFD, &acquired,
                 &length) != 0) {
    if (errno == EBADF || errno == ENOTSOCK || errno == EINVAL ||
        errno == ENODATA || errno == ENOTCONN)
      return LIFE_INVALID_SOCKET;
    return LIFE_UNAVAILABLE;
  }
  if (acquired < 0 || acquired == fd || acquired == state->socket_fd)
    return LIFE_UNAVAILABLE;
  state->pidfd = acquired;
  if (length != sizeof(acquired))
    return LIFE_UNAVAILABLE;
  int flags = fcntl(state->pidfd, F_GETFD);
  if (flags < 0 || fcntl(state->pidfd, F_SETFD, flags | FD_CLOEXEC) != 0)
    return LIFE_UNAVAILABLE;
  struct stat after;
  if (fstat(fd, &after) != 0 || !same_socket(&before, &after))
    return LIFE_INVALID_SOCKET;
  return LIFE_OK;
#else
  return LIFE_UNAVAILABLE;
#endif
}

static lifetime_error poll_lifetime(lifetime_state *state) {
  struct pollfd watched = {.fd = state->pidfd, .events = POLLIN, .revents = 0};
  int rc = poll(&watched, 1, 0);
  if (rc < 0 || rc > 1 || (rc == 0 && watched.revents != 0) ||
      (rc == 1 && watched.revents == 0))
    return LIFE_UNAVAILABLE;
  if (rc == 1) {
    if ((watched.revents & (POLLIN | POLLHUP)) != 0) {
      state->exited = true;
      return LIFE_EXITED;
    }
    return LIFE_UNAVAILABLE;
  }
  return LIFE_OK;
}

static bool fdinfo_pid(int fd, long *pid) {
  char path[64];
  char bytes[4096];
  int length = snprintf(path, sizeof(path), "/proc/self/fdinfo/%d", fd);
  if (length < 1 || (size_t)length >= sizeof(path))
    return false;
  int input = open(path, O_RDONLY | O_CLOEXEC);
  if (input < 0)
    return false;
  size_t used = 0;
  bool valid = true;
  for (;;) {
    ssize_t count = read(input, bytes + used, sizeof(bytes) - 1 - used);
    if (count < 0) {
      valid = false;
      break;
    }
    if (count == 0)
      break;
    used += (size_t)count;
    if (used == sizeof(bytes) - 1) {
      valid = false;
      break;
    }
  }
  if (!take_close(&input))
    valid = false;
  if (!valid || memchr(bytes, '\0', used) != NULL)
    return false;
  bytes[used] = '\0';
  int matches = 0;
  char *line = bytes;
  while (*line != '\0') {
    char *end = strchr(line, '\n');
    if (end == NULL)
      return false;
    if (strncmp(line, "Pid:", 4) == 0) {
      char *value = line + 4;
      while (*value == ' ' || *value == '\t')
        value++;
      char *tail;
      errno = 0;
      long parsed = strtol(value, &tail, 10);
      if (tail == value || errno != 0)
        return false;
      while (tail < end && (*tail == ' ' || *tail == '\t'))
        tail++;
      if (tail != end)
        return false;
      *pid = parsed;
      matches++;
    }
    line = end + 1;
  }
  return matches == 1;
}

static lifetime_error read_lifetime(lifetime_state *state) {
  if (state->closed)
    return LIFE_CLOSED;
  if (state->exited)
    return LIFE_EXITED;
  struct stat actual;
  if (fstat(state->socket_fd, &actual) != 0 ||
      !same_socket(&state->identity, &actual))
    return LIFE_IDENTITY_CHANGED;
  lifetime_error status = poll_lifetime(state);
  if (status != LIFE_OK)
    return status;
  long observed = -1;
  bool valid = fdinfo_pid(state->pidfd, &observed);
  status = poll_lifetime(state);
  if (status != LIFE_OK)
    return status;
  if (!valid || observed <= 0)
    return LIFE_UNAVAILABLE;
  if (observed != state->pid)
    return LIFE_LINKAGE_CHANGED;
  return LIFE_OK;
}

#endif
