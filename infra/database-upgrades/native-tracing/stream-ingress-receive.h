#ifndef DEC203_STREAM_INGRESS_RECEIVE_H
#define DEC203_STREAM_INGRESS_RECEIVE_H

typedef struct {
  int descriptors[SI_BYTES / sizeof(int)];
  size_t count;
  int writer_index;
  unsigned credential_count;
  unsigned pidfd_count;
  struct ucred credentials;
  bool invalid;
  bool uncertain;
} si_control;

static void si_ledger_fd(si_control *control, int fd) {
  if (fd < 0) {
    control->invalid = true;
    return;
  }
  for (size_t index = 0; index < control->count; index++) {
    if (control->descriptors[index] == fd) {
      control->invalid = true;
      control->uncertain = true;
      return;
    }
  }
  if (control->count >= SI_BYTES / sizeof(int)) {
    control->invalid = true;
    control->uncertain = true;
    return;
  }
  control->descriptors[control->count++] = fd;
}

static void si_parse_control(const unsigned char *bytes, size_t length,
                             si_control *control) {
  size_t offset = 0;
  while (offset < length) {
    size_t remaining = length - offset;
    struct cmsghdr header;
    if (remaining < sizeof(header)) {
      control->invalid = true;
      control->uncertain = true;
      break;
    }
    memcpy(&header, bytes + offset, sizeof(header));
    if (header.cmsg_len < CMSG_LEN(0) || header.cmsg_len > remaining) {
      control->invalid = true;
      control->uncertain = true;
      break;
    }
    size_t payload_length = header.cmsg_len - CMSG_LEN(0);
    const unsigned char *payload = bytes + offset + CMSG_LEN(0);
    if (header.cmsg_level != SOL_SOCKET) {
      control->invalid = true;
      control->uncertain = true;
    } else if (header.cmsg_type == SCM_CREDENTIALS) {
      control->credential_count++;
      if (payload_length == sizeof(struct ucred))
        memcpy(&control->credentials, payload, sizeof(struct ucred));
      else
        control->invalid = true;
    } else if (header.cmsg_type == SCM_PIDFD) {
      control->pidfd_count++;
      size_t before = control->count;
      if (payload_length >= sizeof(int)) {
        int fd;
        memcpy(&fd, payload, sizeof(fd));
        si_ledger_fd(control, fd);
        if (control->pidfd_count == 1 && control->count > before)
          control->writer_index = (int)before;
      }
      if (payload_length != sizeof(int)) {
        control->invalid = true;
        control->uncertain = true;
      }
    } else if (header.cmsg_type == SCM_RIGHTS) {
      control->invalid = true;
      for (size_t index = 0; index + sizeof(int) <= payload_length;
           index += sizeof(int)) {
        int fd;
        memcpy(&fd, payload + index, sizeof(fd));
        si_ledger_fd(control, fd);
      }
      if (payload_length % sizeof(int) != 0)
        control->uncertain = true;
    } else {
      /* Unknown integers are not guessed to be descriptors. */
      control->invalid = true;
      control->uncertain = true;
    }
    size_t aligned = CMSG_ALIGN(header.cmsg_len);
    if (aligned < header.cmsg_len || aligned > remaining) {
      control->invalid = true;
      control->uncertain = true;
      break;
    }
    offset += aligned;
  }
}

static void si_control_close(si_group *group, si_control *control) {
  for (size_t index = 0; index < control->count; index++)
    if (!si_take_close(&control->descriptors[index]))
      group->uncertain = true;
}

static si_error si_bad_receive(si_stream *stream, si_control *control,
                               si_error primary) {
  si_control_close(stream->group, control);
  if (control->uncertain || stream->group->uncertain) {
    stream->group->uncertain = true;
    si_close_group(stream->group);
  } else {
    si_close_stream(stream);
  }
  return primary;
}

static si_error si_receive(si_stream *stream, si_segment **received) {
  *received = NULL;
  si_error status = si_stream_identity(stream);
  if (status != SI_OK)
    return status;
  if (stream->eof || stream->outstanding >= SI_PER_STREAM ||
      stream->group->segments >= SI_SEGMENTS)
    return SI_OK;
  int readiness = si_readiness(stream->fd, false);
  if (readiness < 0) {
    si_close_stream(stream);
    return SI_IO;
  }
  if (readiness == 0)
    return SI_OK;
  unsigned char data[SI_BYTES];
  union {
    struct cmsghdr alignment;
    unsigned char bytes[SI_BYTES];
  } ancillary = {0};
  struct iovec vector = {.iov_base = data, .iov_len = sizeof(data)};
  struct msghdr message = {.msg_iov = &vector,
                           .msg_iovlen = 1,
                           .msg_control = ancillary.bytes,
                           .msg_controllen = sizeof(ancillary.bytes)};
  ssize_t count =
      recvmsg(stream->fd, &message, MSG_DONTWAIT | MSG_CMSG_CLOEXEC);
  if (count < 0) {
    if (errno == EAGAIN || errno == EWOULDBLOCK)
      return SI_OK;
    si_close_stream(stream);
    return SI_IO;
  }
  si_control control = {.writer_index = -1};
  for (size_t index = 0; index < SI_BYTES / sizeof(int); index++)
    control.descriptors[index] = -1;
  size_t control_length = message.msg_controllen;
  if (control_length > sizeof(ancillary.bytes)) {
    control_length = sizeof(ancillary.bytes);
    control.invalid = true;
    control.uncertain = true;
  }
  /* Enumerate every recognizable installed fd before allocation or rejection.
   */
  si_parse_control(ancillary.bytes, control_length, &control);
  if ((message.msg_flags & (MSG_CTRUNC | MSG_TRUNC)) != 0)
    control.invalid = true;
  if ((message.msg_flags & MSG_CTRUNC) != 0)
    control.uncertain = true;
  if ((message.msg_flags & ~(MSG_CMSG_CLOEXEC | MSG_CTRUNC | MSG_TRUNC)) != 0)
    control.invalid = true;
  if (count == 0) {
    bool sentinel = control.credential_count == 1 && control.pidfd_count == 0 &&
                    control.count == 0 && control.credentials.pid == 0 &&
                    control.credentials.uid == 0 &&
                    control.credentials.gid == 0;
    if (control.invalid || (control_length != 0 && !sentinel))
      return si_bad_receive(stream, &control, SI_PROTOCOL);
    /* The zero-cookie EOF sentinel grants no writer, bytes or segment credit.
     */
    stream->eof = true;
    return SI_OK;
  }
  if (count > SI_BYTES || control.credential_count != 1 ||
      control.pidfd_count != 1 || control.writer_index < 0 ||
      control.credentials.pid <= 0)
    control.invalid = true;
  if (control.invalid)
    return si_bad_receive(stream, &control, SI_PROTOCOL);
  int pidfd = control.descriptors[control.writer_index];
  int flags = fcntl(pidfd, F_GETFD);
  if (flags < 0 || (flags & FD_CLOEXEC) == 0)
    return si_bad_receive(stream, &control, SI_UNAVAILABLE);
  si_segment *segment = calloc(1, sizeof(*segment));
  if (segment == NULL)
    return si_bad_receive(stream, &control, SI_UNAVAILABLE);
  segment->pidfd = -1;
  segment->bytes = malloc((size_t)count);
  if (segment->bytes == NULL) {
    free(segment);
    return si_bad_receive(stream, &control, SI_UNAVAILABLE);
  }
  memcpy(segment->bytes, data, (size_t)count);
  segment->length = (size_t)count;
  segment->credentials = control.credentials;
  segment->pidfd = pidfd;
  control.descriptors[control.writer_index] = -1;
  segment->references = 1;
  segment->stream = stream;
  segment->next = stream->segments;
  stream->segments = segment;
  stream->references++;
  stream->outstanding++;
  stream->group->segments++;
  si_control_close(stream->group, &control);
  if (stream->group->uncertain) {
    si_release_segment(segment);
    si_segment_unref(segment);
    si_close_stream(stream);
    return SI_CLEANUP;
  }
  *received = segment;
  return SI_OK;
}

#endif
