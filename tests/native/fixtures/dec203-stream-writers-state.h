#ifndef DEC203_STREAM_WRITERS_STATE_H
#define DEC203_STREAM_WRITERS_STATE_H

#include <errno.h>
#include <fcntl.h>
#include <poll.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/un.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

enum operation {
  TAKE = 1,
  READY,
  SEND_A,
  SEND_B,
  SPLIT_A,
  TRY_RIGHTS_A,
  TRY_RIGHTS_B,
  HALF_CLOSE,
  EXIT_WRITER
};

struct packet {
  int operation;
  int error;
  int count;
  int unrelated;
  uint64_t device;
  uint64_t inode;
};

static int close_owned(int *slot) {
  int descriptor = *slot;
  *slot = -1;
  if (descriptor < 0)
    return 0;
  return close(descriptor) == 0 ? 0 : errno;
}

static int packet_send(int control, struct packet *packet) {
  ssize_t count = send(control, packet, sizeof(*packet), MSG_NOSIGNAL);
  return count == (ssize_t)sizeof(*packet) ? 0 : (errno ? errno : EIO);
}

static int packet_receive(int control, struct packet *packet) {
  ssize_t count = recv(control, packet, sizeof(*packet), MSG_TRUNC);
  if (count == 0)
    return 1;
  if (count != (ssize_t)sizeof(*packet))
    return -1;
  return 0;
}

static int transfer_send(int control, int client) {
  struct packet packet = {.operation = TAKE};
  struct iovec vector = {&packet, sizeof(packet)};
  union {
    struct cmsghdr aligned;
    char bytes[CMSG_SPACE(sizeof(int))];
  } data;
  memset(&data, 0, sizeof(data));
  struct msghdr message = {0};
  message.msg_iov = &vector;
  message.msg_iovlen = 1;
  message.msg_control = data.bytes;
  message.msg_controllen = sizeof(data.bytes);
  struct cmsghdr *header = CMSG_FIRSTHDR(&message);
  header->cmsg_level = SOL_SOCKET;
  header->cmsg_type = SCM_RIGHTS;
  header->cmsg_len = CMSG_LEN(sizeof(int));
  memcpy(CMSG_DATA(header), &client, sizeof(client));
  return sendmsg(control, &message, MSG_NOSIGNAL) == (ssize_t)sizeof(packet)
             ? 0
             : -1;
}

static int transfer_receive(int control) {
  struct packet packet = {0};
  struct iovec vector = {&packet, sizeof(packet)};
  union {
    struct cmsghdr aligned;
    char bytes[CMSG_SPACE(sizeof(int))];
  } data;
  memset(&data, 0, sizeof(data));
  struct msghdr message = {0};
  message.msg_iov = &vector;
  message.msg_iovlen = 1;
  message.msg_control = data.bytes;
  message.msg_controllen = sizeof(data.bytes);
  ssize_t count = recvmsg(control, &message, MSG_CMSG_CLOEXEC);
  struct cmsghdr *header = CMSG_FIRSTHDR(&message);
  int descriptor = -1;
  if (header && header->cmsg_level == SOL_SOCKET &&
      header->cmsg_type == SCM_RIGHTS &&
      header->cmsg_len == CMSG_LEN(sizeof(int))) {
    memcpy(&descriptor, CMSG_DATA(header), sizeof(descriptor));
  }
  if (count != (ssize_t)sizeof(packet) || packet.operation != TAKE ||
      (message.msg_flags & (MSG_CTRUNC | MSG_TRUNC)) || descriptor < 0 ||
      CMSG_NXTHDR(&message, header) != NULL) {
    close_owned(&descriptor);
    return -1;
  }
  return descriptor;
}

static int64_t monotonic_milliseconds(void) {
  struct timespec value;
  if (clock_gettime(CLOCK_MONOTONIC, &value) != 0)
    return -1;
  return (int64_t)value.tv_sec * 1000 + value.tv_nsec / 1000000;
}

static int send_literal(int client, const char *bytes, size_t length) {
  int64_t started = monotonic_milliseconds();
  if (started < 0)
    return -1;
  size_t offset = 0;
  while (offset < length) {
    int64_t now = monotonic_milliseconds();
    if (now < started || now - started >= 5000) {
      errno = ETIMEDOUT;
      return -1;
    }
    ssize_t count = send(client, bytes + offset, length - offset,
                         MSG_NOSIGNAL | MSG_DONTWAIT);
    if (count > 0) {
      offset += (size_t)count;
      continue;
    }
    if (count < 0 && (errno == EAGAIN || errno == EWOULDBLOCK)) {
      struct pollfd descriptor = {.fd = client, .events = POLLOUT};
      int remaining = (int)(5000 - (now - started));
      if (poll(&descriptor, 1, remaining) == 1 && descriptor.revents == POLLOUT)
        continue;
    }
    return -1;
  }
  return (int)offset;
}

static void try_rights(int client, struct packet *reply) {
  char byte = 'R';
  struct iovec vector = {&byte, 1};
  union {
    struct cmsghdr aligned;
    char bytes[CMSG_SPACE(sizeof(int))];
  } data;
  memset(&data, 0, sizeof(data));
  struct msghdr message = {0};
  message.msg_iov = &vector;
  message.msg_iovlen = 1;
  message.msg_control = data.bytes;
  message.msg_controllen = sizeof(data.bytes);
  struct cmsghdr *header = CMSG_FIRSTHDR(&message);
  header->cmsg_level = SOL_SOCKET;
  header->cmsg_type = SCM_RIGHTS;
  header->cmsg_len = CMSG_LEN(sizeof(int));
  memcpy(CMSG_DATA(header), &client, sizeof(client));
  ssize_t count = sendmsg(client, &message, MSG_NOSIGNAL | MSG_DONTWAIT);
  reply->count = count < 0 ? -1 : (int)count;
  reply->error = count < 0 ? errno : 0;
}

static int writer_loop(int control, int client, bool writer_a) {
  close(STDIN_FILENO);
  close(STDOUT_FILENO);
  close(STDERR_FILENO);
  if (client < 0)
    client = transfer_receive(control);
  int unrelated = open("/dev/null", O_RDONLY | O_CLOEXEC);
  struct stat stat;
  struct packet reply = {.operation = READY, .unrelated = 1};
  int status = 0;
  if (client < 0 || unrelated < 0 || fstat(client, &stat) != 0) {
    status = 1;
    goto done;
  }
  reply.device = (uint64_t)stat.st_dev;
  reply.inode = (uint64_t)stat.st_ino;
  if (packet_send(control, &reply) != 0) {
    status = 1;
    goto done;
  }
  for (;;) {
    struct packet command = {0};
    int received = packet_receive(control, &command);
    if (received == 1)
      break;
    if (received != 0) {
      status = 1;
      break;
    }
    if (command.operation == EXIT_WRITER)
      break;
    memset(&reply, 0, sizeof(reply));
    reply.operation = command.operation;
    if (command.operation == SEND_A && writer_a) {
      reply.count = send_literal(client, "AAAA", 4);
    } else if (command.operation == SEND_B && !writer_a) {
      reply.count = send_literal(client, "bbbb", 4);
    } else if (command.operation == SPLIT_A && writer_a) {
      int one = send_literal(client, "s1", 2);
      int two = one == 2 ? send_literal(client, "s2", 2) : -1;
      int three = two == 2 ? send_literal(client, "s3", 2) : -1;
      reply.count = three == 2 ? 6 : -1;
    } else if ((command.operation == TRY_RIGHTS_A && writer_a) ||
               (command.operation == TRY_RIGHTS_B && !writer_a)) {
      try_rights(client, &reply);
    } else if (command.operation == HALF_CLOSE) {
      reply.count = shutdown(client, SHUT_WR);
    } else {
      reply.count = -1;
      reply.error = EINVAL;
    }
    if (reply.count < 0 && reply.error == 0)
      reply.error = errno ? errno : EIO;
    reply.unrelated = fcntl(unrelated, F_GETFD) >= 0;
    if (packet_send(control, &reply) != 0) {
      status = 1;
      break;
    }
  }
done:
  if (close_owned(&client) != 0)
    status = 1;
  if (close_owned(&unrelated) != 0)
    status = 1;
  if (close_owned(&control) != 0)
    status = 1;
  return status;
}

#endif
