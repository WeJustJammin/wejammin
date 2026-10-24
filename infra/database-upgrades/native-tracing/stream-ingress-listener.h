#ifndef DEC203_STREAM_INGRESS_LISTENER_H
#define DEC203_STREAM_INGRESS_LISTENER_H

static bool si_integer_option(int fd, int option, int expected) {
  int value = -1;
  socklen_t length = sizeof(value);
  return getsockopt(fd, SOL_SOCKET, option, &value, &length) == 0 &&
         length == sizeof(value) && value == expected;
}

static bool si_receive_options(int fd, bool configure) {
#if defined(SO_PASSCRED) && defined(SO_PASSPIDFD) && defined(SO_PASSRIGHTS)
  const int options[] = {SO_PASSCRED, SO_PASSPIDFD, SO_PASSRIGHTS};
  const int values[] = {1, 1, 0};
  for (size_t index = 0; index < 3; index++) {
    if (configure && setsockopt(fd, SOL_SOCKET, options[index], &values[index],
                                sizeof(values[index])) != 0)
      return false;
    if (!si_integer_option(fd, options[index], values[index]))
      return false;
  }
  return true;
#else
  (void)fd;
  (void)configure;
  return false;
#endif
}

static bool si_socket_flags(int fd) {
  int flags = fcntl(fd, F_GETFL);
  int descriptor_flags = fcntl(fd, F_GETFD);
  return flags >= 0 && (flags & O_NONBLOCK) != 0 && descriptor_flags >= 0 &&
         (descriptor_flags & FD_CLOEXEC) != 0 &&
         si_integer_option(fd, SO_TYPE, SOCK_STREAM) &&
         si_integer_option(fd, SO_DOMAIN, AF_UNIX);
}

static si_error si_group_identity(si_group *group) {
  struct stat descriptor;
  struct stat entry;
  if (!si_parent_matches(group) ||
      fstat(group->listener_fd, &descriptor) != 0 ||
      !si_same(&group->listener_identity, &descriptor) ||
      fstatat(group->directory_fd, "docker.sock", &entry,
              AT_SYMLINK_NOFOLLOW) != 0 ||
      !si_same(&group->entry_identity, &entry))
    return SI_IDENTITY;
  return SI_OK;
}

static si_error si_stream_identity(si_stream *stream) {
  struct stat actual;
  si_error status = si_group_identity(stream->group);
  if (status != SI_OK)
    return status;
  if (fstat(stream->fd, &actual) != 0 || !si_same(&stream->identity, &actual))
    return SI_IDENTITY;
  if (!si_socket_flags(stream->fd) || !si_receive_options(stream->fd, false))
    return SI_UNAVAILABLE;
  return SI_OK;
}

/* -1 is failure, zero is no readiness, one permits a single nonblocking call.
 */
static int si_readiness(int fd, bool listener) {
  struct pollfd watched = {.fd = fd, .events = POLLIN, .revents = 0};
  int result = poll(&watched, 1, 0);
  if (result < 0 || result > 1 || (result == 0 && watched.revents != 0) ||
      (result == 1 && watched.revents == 0))
    return -1;
  if (result == 0)
    return 0;
  short allowed = POLLIN | POLLHUP;
  if ((watched.revents & ~allowed) != 0 ||
      (listener && (watched.revents & POLLHUP) != 0))
    return -1;
  return 1;
}

static si_error si_listen(si_group *group, const char *parent) {
  char canonical[PATH_MAX];
  struct stat initial;
  if (parent[0] != '/' || realpath(parent, canonical) == NULL ||
      strcmp(parent, canonical) != 0 || lstat(parent, &initial) != 0 ||
      initial.st_mode != (S_IFDIR | 0700) || initial.st_uid != getuid())
    return SI_PROTOCOL;
  struct sockaddr_un address = {.sun_family = AF_UNIX};
  int length = snprintf(address.sun_path, sizeof(address.sun_path),
                        "%s/docker.sock", parent);
  if (length < 1 || (size_t)length >= sizeof(address.sun_path))
    return SI_PROTOCOL;
  memcpy(group->parent, parent, strlen(parent) + 1);
  group->parent_identity = initial;
  group->directory_fd = open(parent, O_RDONLY | O_DIRECTORY | O_NOFOLLOW |
                                         O_CLOEXEC | O_NONBLOCK);
  if (group->directory_fd < 0 || !si_parent_matches(group))
    return SI_IDENTITY;
  struct stat existing;
  if (fstatat(group->directory_fd, "docker.sock", &existing,
              AT_SYMLINK_NOFOLLOW) == 0 ||
      errno != ENOENT)
    return SI_PROTOCOL;
  group->listener_fd =
      socket(AF_UNIX, SOCK_STREAM | SOCK_NONBLOCK | SOCK_CLOEXEC, 0);
  if (group->listener_fd < 0 || !si_receive_options(group->listener_fd, true) ||
      !si_socket_flags(group->listener_fd) ||
      fstat(group->listener_fd, &group->listener_identity) != 0 ||
      !S_ISSOCK(group->listener_identity.st_mode))
    return SI_UNAVAILABLE;
  if (!si_parent_matches(group))
    return SI_IDENTITY;
  if (bind(group->listener_fd, (struct sockaddr *)&address, sizeof(address)) !=
      0)
    return SI_IO;
  group->bound = true;
  if (fstatat(group->directory_fd, "docker.sock", &group->entry_identity,
              AT_SYMLINK_NOFOLLOW) != 0 ||
      !S_ISSOCK(group->entry_identity.st_mode) ||
      group->entry_identity.st_uid != getuid())
    return SI_IDENTITY;
  group->entry_known = true;
  struct stat before = group->entry_identity;
  if (fchmodat(group->directory_fd, "docker.sock", 0600, 0) != 0)
    return SI_IO;
  struct stat after;
  if (fstatat(group->directory_fd, "docker.sock", &after,
              AT_SYMLINK_NOFOLLOW) != 0 ||
      after.st_dev != before.st_dev || after.st_ino != before.st_ino ||
      after.st_mode != (S_IFSOCK | 0600) || after.st_uid != getuid() ||
      after.st_gid != before.st_gid)
    return SI_IDENTITY;
  /* Never replace the owned identity with an observed foreign entry. */
  group->entry_identity = after;
  if (!si_parent_matches(group))
    return SI_IDENTITY;
  if (listen(group->listener_fd, SI_STREAMS) != 0)
    return SI_IO;
  if (fstat(group->listener_fd, &group->listener_identity) != 0 ||
      !S_ISSOCK(group->listener_identity.st_mode))
    return SI_IDENTITY;
  return si_group_identity(group);
}

static si_error si_accept(si_group *group, si_stream **accepted) {
  *accepted = NULL;
  si_error status = si_group_identity(group);
  if (status != SI_OK)
    return status;
  if (group->open_streams >= SI_STREAMS)
    return SI_OK;
  int readiness = si_readiness(group->listener_fd, true);
  if (readiness < 0)
    return SI_IO;
  if (readiness == 0)
    return SI_OK;
  /* Allocate and register the state before taking the new descriptor. */
  si_stream *stream = calloc(1, sizeof(*stream));
  if (stream == NULL)
    return SI_UNAVAILABLE;
  stream->fd = -1;
  stream->references = 1;
  stream->group = group;
  stream->next = group->streams;
  group->streams = stream;
  group->references++;
  group->open_streams++;
  stream->fd =
      accept4(group->listener_fd, NULL, NULL, SOCK_NONBLOCK | SOCK_CLOEXEC);
  if (stream->fd < 0) {
    int saved = errno;
    si_close_stream(stream);
    si_stream_unref(stream);
    return saved == EAGAIN || saved == EWOULDBLOCK ? SI_OK : SI_IO;
  }
  if (fstat(stream->fd, &stream->identity) != 0 ||
      !S_ISSOCK(stream->identity.st_mode) || !si_socket_flags(stream->fd) ||
      !si_receive_options(stream->fd, false))
    status = SI_UNAVAILABLE;
  else
    status = si_stream_identity(stream);
  if (status != SI_OK) {
    si_close_stream(stream);
    si_stream_unref(stream);
    return status;
  }
  *accepted = stream;
  return SI_OK;
}

#endif
