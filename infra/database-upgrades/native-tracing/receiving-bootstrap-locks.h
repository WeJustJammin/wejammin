#ifndef WEJAMMIN_RECEIVING_BOOTSTRAP_LOCKS_H
#define WEJAMMIN_RECEIVING_BOOTSTRAP_LOCKS_H

typedef struct {
  unsigned long long major_number;
  unsigned long long minor_number;
  unsigned long long inode;
  long owner;
  char mode[6];
} rb_flock_row;

static inline bool rb_lock_row(const char *line, rb_flock_row *row) {
  unsigned long long number, start;
  char end[4];
  int consumed = 0;
  if (sscanf(line, "%llu: FLOCK ADVISORY %5s %ld %llx:%llx:%llu %llu %3s %n",
             &number, row->mode, &row->owner, &row->major_number,
             &row->minor_number, &row->inode, &start, end, &consumed) != 8 ||
      row->owner <= 0 || start != 0 || strcmp(end, "EOF") != 0)
    return false;
  for (const char *rest = line + consumed; *rest; rest++) {
    if (!isspace((unsigned char)*rest))
      return false;
  }
  return strcmp(row->mode, "READ") == 0 || strcmp(row->mode, "WRITE") == 0;
}

static inline bool rb_lock_row_same(const rb_flock_row *left,
                                    const rb_flock_row *right) {
  return left->owner == right->owner && left->inode == right->inode &&
         left->major_number == right->major_number &&
         left->minor_number == right->minor_number &&
         strcmp(left->mode, right->mode) == 0;
}

static inline bool rb_fdinfo_number(const char *text, const char *key, int base,
                                    uint64_t *value) {
  unsigned found = 0;
  size_t length = strlen(key);
  for (const char *line = text; *line;) {
    const char *end = strchr(line, '\n');
    if (!end)
      end = line + strlen(line);
    if ((size_t)(end - line) >= length && memcmp(line, key, length) == 0) {
      const char *begin = line + length;
      while (begin < end && isspace((unsigned char)*begin))
        begin++;
      if (begin == end || *begin < '0' || *begin > '9' || found++)
        return false;
      char *after;
      errno = 0;
      unsigned long long number = strtoull(begin, &after, base);
      if (errno || after == begin || after > end)
        return false;
      while (after < end && isspace((unsigned char)*after))
        after++;
      if (after != end)
        return false;
      *value = number;
    }
    line = *end ? end + 1 : end;
  }
  return found == 1;
}

static inline bool rb_lock_fdinfo(pid_t holder, int descriptor,
                                  const struct stat *identity, pid_t owner,
                                  const char *mode) {
  char path[96], text[4096];
  size_t length;
  uint64_t inode, flags;
  int written = snprintf(path, sizeof(path), "/proc/%ld/fdinfo/%d",
                         (long)holder, descriptor);
  if (written <= 0 || (size_t)written >= sizeof(path) ||
      !rb_process_read(path, text, sizeof(text), &length) ||
      !rb_fdinfo_number(text, "ino:", 10, &inode) ||
      inode != identity->st_ino ||
      !rb_fdinfo_number(text, "flags:", 8, &flags) ||
      !(flags & DEC203_FDINFO_CLOEXEC))
    return false;
  rb_flock_row expected = {0};
  unsigned found = 0;
  for (char *line = text; line && *line;) {
    char *next = strchr(line, '\n');
    if (next)
      *next++ = 0;
    if (strncmp(line, "lock:", 5) == 0) {
      if (found++ || !rb_lock_row(line + 5, &expected))
        return false;
    }
    line = next;
  }
  if (found != 1 || expected.owner != owner ||
      strcmp(expected.mode, mode) != 0 || expected.inode != identity->st_ino ||
      expected.major_number != major(identity->st_dev) ||
      expected.minor_number != minor(identity->st_dev))
    return false;
  char records[65536];
  if (!rb_process_read("/proc/locks", records, sizeof(records), &length))
    return false;
  unsigned matches = 0;
  for (char *line = records; line && *line;) {
    char *next = strchr(line, '\n');
    if (next)
      *next++ = 0;
    rb_flock_row current;
    if (rb_lock_row(line, &current) && rb_lock_row_same(&current, &expected))
      matches++;
    line = next;
  }
  return matches == 1;
}

static inline bool rb_lock_check(unsigned index, pid_t owner, bool cloexec) {
  static const char *const paths[] = {DEC203_LOCK_PATHS};
  if (index >= DEC203_LOCK_COUNT || owner <= 0)
    return false;
  int descriptor = (int)index + DEC203_LOCK_FIRST_FD;
  struct stat named, held;
  char resolved[PATH_MAX];
  if (!realpath(paths[index], resolved) ||
      strcmp(resolved, paths[index]) != 0 || lstat(paths[index], &named) != 0 ||
      fstat(descriptor, &held) != 0 || named.st_mode != DEC203_LOCK_MODE ||
      named.st_uid != DEC203_LOCK_UID || named.st_gid != DEC203_LOCK_GID ||
      named.st_dev != held.st_dev || named.st_ino != held.st_ino ||
      named.st_mode != held.st_mode || held.st_uid != named.st_uid ||
      held.st_gid != named.st_gid)
    return false;
  int flags = fcntl(descriptor, F_GETFD);
  if (flags < 0 || (cloexec && !(flags & FD_CLOEXEC)))
    return false;
  pid_t holders[] = {owner, getpid()};
  for (unsigned slot = 0; slot < 2; slot++) {
    char path[96], target[PATH_MAX];
    struct stat inherited;
    int size = snprintf(path, sizeof(path), "/proc/%ld/fd/%d",
                        (long)holders[slot], descriptor);
    if (size <= 0 || (size_t)size >= sizeof(path) ||
        stat(path, &inherited) != 0)
      return false;
    ssize_t bytes = readlink(path, target, sizeof(target) - 1);
    if (bytes <= 0 || (size_t)bytes >= sizeof(target) - 1)
      return false;
    target[bytes] = 0;
    const char *mode = index == DEC203_QUIET_LOCK_INDEX ? "READ" : "WRITE";
    if (strcmp(target, paths[index]) != 0 || inherited.st_dev != held.st_dev ||
        inherited.st_ino != held.st_ino || inherited.st_mode != held.st_mode ||
        !rb_lock_fdinfo(holders[slot], descriptor, &held, owner, mode))
      return false;
  }
  return true;
}

typedef struct {
  int fd;
  int original_fd;
  int status;
  bool known;
  bool close_attempted;
  struct stat identity;
} rb_owned_fd;

typedef struct {
  rb_owned_fd slots[DEC203_INVENTORY_FD_COUNT];
  unsigned count;
  bool uncertain;
} rb_fd_ledger;

static inline rb_owned_fd *rb_fd_reserve(rb_fd_ledger *ledger) {
  if (ledger->count >= DEC203_INVENTORY_FD_COUNT) {
    ledger->uncertain = true;
    return NULL;
  }
  rb_owned_fd *slot = &ledger->slots[ledger->count++];
  *slot = (rb_owned_fd){.fd = -1, .original_fd = -1};
  return slot;
}

static inline bool rb_fd_identify(rb_owned_fd *slot) {
  slot->original_fd = slot->fd;
  slot->known = slot->fd >= 0 && fstat(slot->fd, &slot->identity) == 0 &&
                (slot->status = fcntl(slot->fd, F_GETFL)) >= 0;
  return slot->known;
}

static inline rb_owned_fd *rb_fd_find(rb_fd_ledger *ledger, int descriptor) {
  for (unsigned index = 0; index < ledger->count; index++) {
    if (ledger->slots[index].fd == descriptor)
      return &ledger->slots[index];
  }
  return NULL;
}

static inline bool rb_fd_close(rb_fd_ledger *ledger, int descriptor) {
  rb_owned_fd *slot = rb_fd_find(ledger, descriptor);
  if (!slot)
    return false;
  struct stat current;
  bool owned = slot->known && fstat(descriptor, &current) == 0 &&
               rb_same_object(&slot->identity, &current) &&
               slot->identity.st_mode == current.st_mode;
  slot->fd = -1;
  slot->close_attempted = true;
  if (!owned || close(descriptor) != 0) {
    ledger->uncertain = true;
    return false;
  }
  return true;
}

static inline bool rb_fd_guard(const rb_fd_ledger *ledger) {
  struct stat objects[DEC203_INVENTORY_FD_COUNT];
  int numbers[DEC203_INVENTORY_FD_COUNT];
  unsigned count = 0;
  if (ledger->uncertain)
    return false;
  for (unsigned index = 0; index < ledger->count; index++) {
    const rb_owned_fd *slot = &ledger->slots[index];
    if (slot->fd < 0)
      continue;
    int flags = fcntl(slot->fd, F_GETFD);
    struct stat current;
    if (!slot->known || flags < 0 || (slot->fd >= 3 && !(flags & FD_CLOEXEC)) ||
        fstat(slot->fd, &current) != 0 ||
        !rb_same_object(&current, &slot->identity) ||
        current.st_mode != slot->identity.st_mode ||
        (slot->fd >= 3 && fcntl(slot->fd, F_GETFL) != slot->status))
      return false;
    objects[count] = slot->identity;
    numbers[count++] = slot->fd;
  }
  return rb_alias_scan(getpid(), objects, numbers, count, true);
}

static inline bool rb_lease_check(const rb_process *owner,
                                  const rb_process *driver) {
  static const int parent_numbers[] = {3, 4, 5, 6, 7, 8, 9, 10, 12, 13};
  static const int child_numbers[] = {3, 4, 5, 6, 7, -1, -1, 10, 9, 8};
  struct stat parent[10], child[8];
  if (!rb_live(owner, driver) || getppid() != owner->pid)
    return false;
  for (unsigned index = 0; index < 10; index++) {
    char path[96];
    int size = snprintf(path, sizeof(path), "/proc/%ld/fd/%d", (long)owner->pid,
                        parent_numbers[index]);
    if (size <= 0 || (size_t)size >= sizeof(path) ||
        stat(path, &parent[index]) != 0)
      return false;
    for (unsigned previous = 0; previous < index; previous++) {
      if (rb_same_object(&parent[index], &parent[previous]))
        return false;
    }
  }
  for (unsigned index = 0; index < 8; index++) {
    int descriptor = (int)index + 3;
    int flags = fcntl(descriptor, F_GETFD);
    if (flags < 0 || !(flags & FD_CLOEXEC) ||
        fstat(descriptor, &child[index]) != 0)
      return false;
    unsigned parent_index = index == 5 ? 9 : index == 6 ? 8 : index;
    if (!rb_same_object(&child[index], &parent[parent_index]))
      return false;
  }
  if (!S_ISSOCK(parent[5].st_mode) || !S_ISSOCK(parent[6].st_mode) ||
      !S_ISFIFO(child[5].st_mode) || !S_ISFIFO(child[6].st_mode) ||
      (fcntl(8, F_GETFL) & (O_ACCMODE | O_NONBLOCK)) !=
          (O_RDONLY | O_NONBLOCK) ||
      (fcntl(9, F_GETFL) & (O_ACCMODE | O_NONBLOCK)) != (O_WRONLY | O_NONBLOCK))
    return false;
  for (unsigned index = 0; index < DEC203_LOCK_COUNT; index++) {
    if (!rb_lock_check(index, owner->pid, true))
      return false;
  }
  return rb_alias_scan(owner->pid, parent, parent_numbers, 10, false) &&
         rb_alias_scan(getpid(), parent, child_numbers, 10, false) &&
         rb_live(owner, driver);
}

#endif
