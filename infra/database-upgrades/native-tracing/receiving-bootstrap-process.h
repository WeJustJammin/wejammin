#ifndef WEJAMMIN_RECEIVING_BOOTSTRAP_PROCESS_H
#define WEJAMMIN_RECEIVING_BOOTSTRAP_PROCESS_H

#include <ctype.h>
#include <limits.h>
#include <poll.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

typedef struct {
  pid_t pid;
  pid_t ppid;
  uint64_t start;
  uid_t uid;
  struct stat exe_stat;
  char exe_path[PATH_MAX];
  int pidfd;
} rb_process;

static inline bool rb_process_read(const char *path, char *buffer,
                                   size_t capacity, size_t *length) {
  if (capacity < 2)
    return false;
  rb_file_slot *slot = rb_file_open(path, O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
  if (!slot || slot->fd < 0)
    return false;
  if (!slot->identity_known) {
    rb_file_close(slot);
    return false;
  }
  size_t used = 0;
  bool valid = true;
  while (used < capacity - 1) {
    ssize_t count = read(slot->fd, buffer + used, capacity - 1 - used);
    if (count == 0)
      break;
    if (count < 0 && errno == EINTR)
      continue;
    if (count < 0) {
      valid = false;
      break;
    }
    used += (size_t)count;
  }
  if (used == capacity - 1)
    valid = false;
  buffer[used] = 0;
  *length = used;
  return rb_file_close(slot) && valid;
}

static inline bool rb_process_proc_path(pid_t pid, const char *suffix,
                                        char *path, size_t capacity) {
  int size = snprintf(path, capacity, "/proc/%ld/%s", (long)pid, suffix);
  return pid > 0 && size > 0 && (size_t)size < capacity;
}

static inline bool rb_process_number(const char **cursor, const char *end,
                                     uint64_t *value) {
  const char *at = *cursor;
  while (at < end && isspace((unsigned char)*at))
    at++;
  if (at == end || !isdigit((unsigned char)*at))
    return false;
  uint64_t result = 0;
  do {
    unsigned digit = (unsigned)(*at++ - '0');
    if (result > (UINT64_MAX - digit) / 10)
      return false;
    result = result * 10 + digit;
  } while (at < end && isdigit((unsigned char)*at));
  if (at < end && !isspace((unsigned char)*at))
    return false;
  *cursor = at;
  *value = result;
  return true;
}

static inline bool rb_process_status_value(const char *text, size_t length,
                                           const char *key, uint64_t *value) {
  const char *end = text + length;
  unsigned matches = 0;
  for (const char *line = text; line < end;) {
    const char *next = memchr(line, '\n', (size_t)(end - line));
    if (!next)
      next = end;
    size_t key_size = strlen(key);
    if ((size_t)(next - line) >= key_size && memcmp(line, key, key_size) == 0) {
      const char *at = line + key_size;
      if (matches++ || !rb_process_number(&at, next, value))
        return false;
      unsigned remaining = strcmp(key, "Uid:") == 0 ? 3 : 0;
      while (remaining--) {
        uint64_t other;
        if (!rb_process_number(&at, next, &other) || other != *value)
          return false;
      }
      while (at < next && isspace((unsigned char)*at))
        at++;
      if (at != next)
        return false;
    }
    line = next < end ? next + 1 : end;
  }
  return matches == 1;
}

static inline bool rb_process_stat_start(const char *text, size_t length,
                                         uint64_t *start) {
  const char *right = memrchr(text, ')', length);
  const char *end = text + length;
  if (!right || right + 4 >= end || right[1] != ' ' || right[3] != ' ')
    return false;
  const char *at = right + 4;
  for (unsigned field = 4; field <= 22; field++) {
    while (at < end && isspace((unsigned char)*at))
      at++;
    bool negative = at < end && *at == '-';
    if (negative)
      at++;
    uint64_t number;
    if (!rb_process_number(&at, end, &number))
      return false;
    if (field == 22) {
      if (negative || number == 0)
        return false;
      *start = number;
    }
  }
  return true;
}

static inline bool rb_process_pidfd_live(int descriptor, pid_t expected) {
  struct pollfd handle = {descriptor, POLLIN, 0};
  char path[64], text[4096];
  size_t size;
  uint64_t linked;
  int count = snprintf(path, sizeof(path), "/proc/self/fdinfo/%d", descriptor);
  if (descriptor < 0 || expected <= 0 || count <= 0 ||
      (size_t)count >= sizeof(path) || poll(&handle, 1, 0) != 0 ||
      handle.revents || !rb_process_read(path, text, sizeof(text), &size) ||
      !rb_process_status_value(text, size, "Pid:", &linked) ||
      linked != (uint64_t)expected)
    return false;
  handle.revents = 0;
  return poll(&handle, 1, 0) == 0 && handle.revents == 0;
}

static inline bool rb_process_capture(pid_t pid, int pidfd, rb_process *out) {
  char path[96], text[16384];
  size_t size;
  uint64_t found, parent, uid, before, after;
  rb_process value = {.pid = pid, .pidfd = pidfd};
  if (!rb_process_proc_path(pid, "stat", path, sizeof(path)) ||
      !rb_process_read(path, text, sizeof(text), &size) ||
      !rb_process_stat_start(text, size, &before) ||
      !rb_process_proc_path(pid, "status", path, sizeof(path)) ||
      !rb_process_read(path, text, sizeof(text), &size) ||
      !rb_process_status_value(text, size, "Pid:", &found) ||
      found != (uint64_t)pid ||
      !rb_process_status_value(text, size, "PPid:", &parent) ||
      parent > INT_MAX || !rb_process_status_value(text, size, "Uid:", &uid) ||
      uid != DEC203_PROFILE_UID ||
      !rb_process_proc_path(pid, "exe", path, sizeof(path)))
    return false;
  ssize_t bytes = readlink(path, value.exe_path, sizeof(value.exe_path) - 1);
  if (bytes <= 0 || (size_t)bytes >= sizeof(value.exe_path) - 1 ||
      stat(path, &value.exe_stat) != 0 || !S_ISREG(value.exe_stat.st_mode))
    return false;
  value.exe_path[bytes] = 0;
  if (!rb_process_proc_path(pid, "stat", path, sizeof(path)) ||
      !rb_process_read(path, text, sizeof(text), &size) ||
      !rb_process_stat_start(text, size, &after) || before != after ||
      (pidfd >= 0 && !rb_process_pidfd_live(pidfd, pid)))
    return false;
  value.ppid = (pid_t)parent;
  value.uid = (uid_t)uid;
  value.start = before;
  *out = value;
  return true;
}

static inline bool rb_process_same(const rb_process *left,
                                   const rb_process *right) {
  return left->pid == right->pid && left->ppid == right->ppid &&
         left->start == right->start && left->uid == right->uid &&
         left->exe_stat.st_dev == right->exe_stat.st_dev &&
         left->exe_stat.st_ino == right->exe_stat.st_ino &&
         left->exe_stat.st_mode == right->exe_stat.st_mode &&
         left->exe_stat.st_size == right->exe_stat.st_size &&
         strcmp(left->exe_path, right->exe_path) == 0;
}

static inline bool rb_live(const rb_process *owner, const rb_process *driver) {
  rb_process current_owner, current_driver;
  return owner && driver && rb_process_pidfd_live(owner->pidfd, owner->pid) &&
         rb_process_pidfd_live(driver->pidfd, driver->pid) &&
         rb_process_capture(owner->pid, owner->pidfd, &current_owner) &&
         rb_process_capture(driver->pid, driver->pidfd, &current_driver) &&
         rb_process_same(owner, &current_owner) &&
         rb_process_same(driver, &current_driver) &&
         ((getpid() == owner->pid && getppid() == driver->pid) ||
          (getppid() == owner->pid && owner->ppid == driver->pid)) &&
         rb_process_pidfd_live(owner->pidfd, owner->pid) &&
         rb_process_pidfd_live(driver->pidfd, driver->pid);
}

static inline bool rb_same_object(const struct stat *left,
                                  const struct stat *right) {
  return left->st_dev == right->st_dev && left->st_ino == right->st_ino;
}

typedef struct rb_directory_slot {
  DIR *directory;
  int original_fd;
  struct stat identity;
  struct rb_directory_slot *next;
} rb_directory_slot;
static rb_directory_slot *rb_directory_tombstones;

static inline bool rb_alias_scan(pid_t process, const struct stat objects[],
                                 const int permitted[], unsigned objects_count,
                                 bool closed_table) {
  char path[96];
  int size = snprintf(path, sizeof(path), "/proc/%ld/fd", (long)process);
  if (size <= 0 || (size_t)size >= sizeof(path))
    return false;
  rb_directory_slot *inspection = calloc(1, sizeof(*inspection));
  if (!inspection)
    return false;
  inspection->directory = opendir(path);
  DIR *directory = inspection->directory;
  if (!directory) {
    free(inspection);
    return false;
  }
  inspection->original_fd = dirfd(directory);
  bool valid = true;
  if (fstat(inspection->original_fd, &inspection->identity) != 0)
    valid = false;
  unsigned count = 0;
  struct dirent *entry;
  errno = 0;
  while ((entry = readdir(directory))) {
    if (entry->d_name[0] == '.')
      continue;
    char *end;
    errno = 0;
    long number = strtol(entry->d_name, &end, 10);
    if (errno || *end || number < 0 || number > INT_MAX ||
        ++count > DEC203_INVENTORY_FD_COUNT) {
      valid = false;
      break;
    }
    struct stat current;
    if (fstatat(dirfd(directory), entry->d_name, &current, 0) != 0) {
      valid = false;
      break;
    }
    bool protected = false, allowed = false;
    for (unsigned index = 0; index < objects_count; index++) {
      if (rb_same_object(&current, &objects[index])) {
      protected
        = true;
        allowed = allowed || number == permitted[index];
      }
    }
    if ((protected && !allowed) ||
        (closed_table && !allowed && number != inspection->original_fd)) {
      valid = false;
      break;
    }
    errno = 0;
  }
  if (errno)
    valid = false;
  inspection->directory = NULL;
  if (closedir(directory) != 0) {
    inspection->next = rb_directory_tombstones;
    rb_directory_tombstones = inspection;
    return false;
  }
  free(inspection);
  return valid;
}

#endif
