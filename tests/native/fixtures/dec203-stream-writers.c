#define _GNU_SOURCE
#include "dec203-stream-writers-state.h"

struct child {
  pid_t pid;
  int control;
  bool terminal;
  int status;
};

static int settle(struct child *child) {
  int failed = close_owned(&child->control);
  if (child->pid <= 0 || child->terminal)
    return failed;
  int status = 0;
  if (waitpid(child->pid, &status, 0) != child->pid)
    return -1;
  child->terminal = true;
  child->status = WIFEXITED(status) ? WEXITSTATUS(status) : -1;
  return failed || child->status != 0 ? -1 : 0;
}

static int start_b(struct child *b) {
  int pair[2];
  if (socketpair(AF_UNIX, SOCK_SEQPACKET | SOCK_CLOEXEC, 0, pair) != 0)
    return -1;
  b->pid = fork();
  if (b->pid == 0) {
    close(pair[0]);
    _exit(writer_loop(pair[1], -1, false));
  }
  close(pair[1]);
  b->control = pair[0];
  return b->pid > 0 ? 0 : -1;
}

static int start_a(struct child *a, struct child *b, int client) {
  int pair[2];
  if (socketpair(AF_UNIX, SOCK_SEQPACKET | SOCK_CLOEXEC, 0, pair) != 0)
    return -1;
  a->pid = fork();
  if (a->pid == 0) {
    close(pair[0]);
    close(b->control);
    _exit(writer_loop(pair[1], client, true));
  }
  close(pair[1]);
  a->control = pair[0];
  return a->pid > 0 ? 0 : -1;
}

static int connect_client(const char *path) {
  struct sockaddr_un address = {.sun_family = AF_UNIX};
  if (path[0] != '/' || strlen(path) >= sizeof(address.sun_path))
    return -1;
  memcpy(address.sun_path, path, strlen(path) + 1);
  int client = socket(AF_UNIX, SOCK_STREAM | SOCK_CLOEXEC, 0);
  if (client < 0)
    return -1;
  if (connect(client, (struct sockaddr *)&address, sizeof(address)) != 0 ||
      fcntl(client, F_SETFL, O_NONBLOCK) != 0) {
    close_owned(&client);
  }
  return client;
}

static int ready(struct child *child, const struct stat *stat) {
  struct packet reply = {0};
  if (packet_receive(child->control, &reply) != 0 || reply.operation != READY ||
      reply.unrelated != 1 || reply.device != (uint64_t)stat->st_dev ||
      reply.inode != (uint64_t)stat->st_ino)
    return -1;
  return 0;
}

static int action(struct child *child, int operation, const char *name) {
  struct packet command = {.operation = operation};
  struct packet reply = {0};
  if (child->terminal || packet_send(child->control, &command) != 0)
    return -1;
  if (operation == EXIT_WRITER) {
    if (settle(child) != 0)
      return -1;
    printf("{\"command\":\"%s\",\"terminal\":true,\"status\":0}\n", name);
    return fflush(stdout) == 0 ? 0 : -1;
  }
  if (packet_receive(child->control, &reply) != 0 ||
      reply.operation != operation || reply.unrelated != 1)
    return -1;
  printf("{\"command\":\"%s\",\"count\":%d,\"errno\":%d,\"unrelated\":true}\n",
         name, reply.count, reply.error);
  return fflush(stdout) == 0 ? 0 : -1;
}

int main(int argc, char **argv) {
  struct child a = {.control = -1}, b = {.control = -1};
  int client = -1;
  int status = 1;
  bool half_closed = false;
  bool finished = false;
  struct stat stat;
  if (argc != 2 || start_b(&b) != 0)
    goto done;
  client = connect_client(argv[1]);
  if (client < 0 || fstat(client, &stat) != 0 || start_a(&a, &b, client) != 0 ||
      transfer_send(b.control, client) != 0 || ready(&a, &stat) != 0 ||
      ready(&b, &stat) != 0 || close_owned(&client) != 0)
    goto done;
  printf("{\"ready\":true,\"connector\":%ld,\"a\":%ld,\"b\":%ld,"
         "\"uid\":%ld,\"gid\":%ld,\"transferred\":true}\n",
         (long)getpid(), (long)a.pid, (long)b.pid, (long)getuid(),
         (long)getgid());
  if (fflush(stdout) != 0)
    goto done;
  for (;;) {
    char line[64];
    if (fgets(line, sizeof(line), stdin) == NULL) {
      status = 0;
      break;
    }
    if (strchr(line, '\n') == NULL)
      goto protocol;
    line[strcspn(line, "\n")] = '\0';
    if (strcmp(line, "FINISH") == 0) {
      status = 0;
      finished = true;
      break;
    }
    struct child *selected = NULL;
    int operation = 0;
    if (strcmp(line, "EXIT_A") == 0) {
      selected = &a;
      operation = EXIT_WRITER;
    } else if (strcmp(line, "EXIT_B") == 0) {
      selected = &b;
      operation = EXIT_WRITER;
    } else if (!half_closed) {
      if (strcmp(line, "SEND_A") == 0) {
        selected = &a;
        operation = SEND_A;
      } else if (strcmp(line, "SEND_B") == 0) {
        selected = &b;
        operation = SEND_B;
      } else if (strcmp(line, "SPLIT_A") == 0) {
        selected = &a;
        operation = SPLIT_A;
      } else if (strcmp(line, "TRY_RIGHTS_A") == 0) {
        selected = &a;
        operation = TRY_RIGHTS_A;
      } else if (strcmp(line, "TRY_RIGHTS_B") == 0) {
        selected = &b;
        operation = TRY_RIGHTS_B;
      } else if (strcmp(line, "HALF_CLOSE") == 0) {
        selected = a.terminal ? &b : &a;
        operation = HALF_CLOSE;
      }
    }
    if (selected == NULL || action(selected, operation, line) != 0)
      goto protocol;
    if (operation == HALF_CLOSE)
      half_closed = true;
  }
  goto done;
protocol:
  printf("{\"error\":\"DEC203_FIXTURE_PROTOCOL\"}\n");
  fflush(stdout);
done:
  if (close_owned(&client) != 0)
    status = 1;
  if (settle(&a) != 0)
    status = 1;
  if (settle(&b) != 0)
    status = 1;
  if (status != 0) {
    fprintf(stderr, "DEC203_FIXTURE_PRECONDITION\n");
  } else if (finished) {
    printf(
        "{\"command\":\"FINISH\",\"terminal\":true,\"aExit\":0,\"bExit\":0}\n");
    if (fflush(stdout) != 0)
      status = 1;
  }
  return status;
}
