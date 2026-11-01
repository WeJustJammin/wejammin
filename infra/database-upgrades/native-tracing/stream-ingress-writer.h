#ifndef DEC203_STREAM_INGRESS_WRITER_H
#define DEC203_STREAM_INGRESS_WRITER_H

static si_error si_writer_poll(si_segment *segment) {
  struct pollfd watched = {
      .fd = segment->pidfd, .events = POLLIN, .revents = 0};
  int result = poll(&watched, 1, 0);
  if (result < 0 || result > 1 || (result == 0 && watched.revents != 0) ||
      (result == 1 && watched.revents == 0))
    return SI_UNAVAILABLE;
  if (result == 1) {
    short known = POLLIN | POLLHUP | POLLERR | POLLNVAL;
    if ((watched.revents & ~known) != 0)
      return SI_UNAVAILABLE;
    if ((watched.revents & (POLLIN | POLLHUP)) != 0) {
      segment->exited = true;
      return SI_EXITED;
    }
    return SI_UNAVAILABLE;
  }
  return SI_OK;
}

static bool si_parse_fdinfo(char *bytes, long *pid) {
  unsigned matches = 0;
  char *line = bytes;
  while (*line != '\0') {
    char *end = strchr(line, '\n');
    if (end == NULL)
      return false;
    if (strncmp(line, "Pid:", 4) == 0) {
      char *value = line + 4;
      while (*value == ' ' || *value == '\t')
        value++;
      if (*value != '-' && (*value < '0' || *value > '9'))
        return false;
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

static si_error si_writer_fdinfo(si_segment *segment, long *pid) {
  char path[64];
  char bytes[4096];
  int length =
      snprintf(path, sizeof(path), "/proc/self/fdinfo/%d", segment->pidfd);
  if (length < 1 || (size_t)length >= sizeof(path))
    return SI_UNAVAILABLE;
  int input = open(path, O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
  if (input < 0)
    return SI_UNAVAILABLE;
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
  bool closed = si_take_close(&input);
  if (!closed)
    segment->stream->group->uncertain = true;
  if (!valid || memchr(bytes, '\0', used) != NULL)
    return SI_UNAVAILABLE;
  bytes[used] = '\0';
  if (!si_parse_fdinfo(bytes, pid))
    return SI_UNAVAILABLE;
  return closed ? SI_OK : SI_CLEANUP;
}

static si_error si_read_writer(si_segment *segment) {
  if (segment->closed || segment->stream->closed ||
      segment->stream->group->closed)
    return SI_CLOSED;
  if (segment->exited)
    return SI_EXITED;
  si_error status = si_writer_poll(segment);
  if (status != SI_OK)
    return status;
  long observed = -1;
  si_error linkage = si_writer_fdinfo(segment, &observed);
  status = si_writer_poll(segment);
  if (status != SI_OK)
    return status;
  if (linkage != SI_OK)
    return linkage;
  if (observed <= 0)
    return SI_UNAVAILABLE;
  if (observed != segment->credentials.pid)
    return SI_LINKAGE;
  return SI_OK;
}

#endif
