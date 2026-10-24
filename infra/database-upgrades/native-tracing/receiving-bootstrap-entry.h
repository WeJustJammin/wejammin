#ifndef WEJAMMIN_RECEIVING_BOOTSTRAP_ENTRY_H
#define WEJAMMIN_RECEIVING_BOOTSTRAP_ENTRY_H

static inline bool rb_process_arguments(pid_t pid, char bytes[8192],
                                        char *arguments[4], size_t count) {
  char path[96];
  size_t size, offset = 0;
  if (count > 4 || !rb_process_proc_path(pid, "cmdline", path, sizeof(path)) ||
      !rb_process_read(path, bytes, 8192, &size) || !size ||
      bytes[size - 1] != 0)
    return false;
  for (size_t index = 0; index < count; index++) {
    if (offset >= size)
      return false;
    arguments[index] = bytes + offset;
    offset += strlen(bytes + offset) + 1;
  }
  return offset == size;
}

static inline bool
rb_process_argv_exact(pid_t pid, const char *const expected[], size_t count) {
  char bytes[8192], *arguments[4];
  if (!rb_process_arguments(pid, bytes, arguments, count))
    return false;
  for (size_t index = 0; index < count; index++) {
    if (strcmp(expected[index], arguments[index]) != 0)
      return false;
  }
  return true;
}

static inline bool rb_process_image_exact(const rb_process *process,
                                          const char *path, uint64_t size,
                                          uid_t uid, mode_t mode,
                                          const char *sha256) {
  return strcmp(process->exe_path, path) == 0 &&
         rb_image_file(path, size, uid, mode, sha256, &process->exe_stat);
}

static inline bool rb_entry_object_same(const struct stat *left,
                                        const struct stat *right) {
  return left->st_dev == right->st_dev && left->st_ino == right->st_ino &&
         left->st_mode == right->st_mode && left->st_uid == right->st_uid &&
         left->st_size == right->st_size;
}

static inline bool rb_entry_directory(const char *path) {
  char resolved[PATH_MAX];
  struct stat before, after;
  if (!realpath(path, resolved) || strcmp(resolved, path) != 0 ||
      lstat(path, &before) != 0 || before.st_mode != DEC203_DIRECTORY_MODE ||
      before.st_uid != DEC203_PROFILE_UID)
    return false;
  rb_file_slot *slot =
      rb_file_open(path, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (!slot)
    return false;
  bool valid =
      slot->identity_known && rb_entry_object_same(&before, &slot->identity) &&
      lstat(path, &after) == 0 && rb_entry_object_same(&before, &after);
  return rb_file_close(slot) && valid;
}

static inline bool rb_entry_cwd(pid_t pid, const char *expected) {
  char path[96], actual[PATH_MAX];
  if (!rb_process_proc_path(pid, "cwd", path, sizeof(path)))
    return false;
  ssize_t size = readlink(path, actual, sizeof(actual) - 1);
  if (size <= 0 || (size_t)size >= sizeof(actual) - 1)
    return false;
  actual[size] = 0;
  return strcmp(actual, expected) == 0;
}

static inline bool rb_entry_root(const rb_process *owner) {
  const char suffix[] = "/" DEC203_OWNER_RELATIVE_PATH;
  size_t size = strlen(owner->exe_path);
  size_t suffix_size = sizeof(suffix) - 1;
  if (size <= suffix_size ||
      strcmp(owner->exe_path + size - suffix_size, suffix) != 0)
    return false;
  char root[PATH_MAX], directory[PATH_MAX], cwd[PATH_MAX];
  size_t root_size = size - suffix_size;
  memcpy(root, owner->exe_path, root_size);
  root[root_size] = 0;
  if (!getcwd(cwd, sizeof(cwd)) || strcmp(cwd, root) != 0 ||
      !rb_entry_cwd(owner->pid, root) || !rb_entry_directory(root))
    return false;
  const char *const names[] = {DEC203_OWNER_DIRECTORY, DEC203_LEASE_DIRECTORY};
  for (unsigned index = 0; index < 2; index++) {
    int count =
        snprintf(directory, sizeof(directory), "%s/%s", root, names[index]);
    if (count <= 0 || (size_t)count >= sizeof(directory) ||
        !rb_entry_directory(directory))
      return false;
  }
  rb_file_slot *image =
      rb_file_open(owner->exe_path, O_RDONLY | O_NOFOLLOW | O_CLOEXEC);
  if (!image)
    return false;
  struct stat named;
  bool valid = image->identity_known && owner->exe_stat.st_size > 0 &&
               owner->exe_stat.st_mode == DEC203_OWNER_EXECUTABLE_MODE &&
               owner->exe_stat.st_uid == DEC203_PROFILE_UID &&
               rb_entry_object_same(&owner->exe_stat, &image->identity) &&
               lstat(owner->exe_path, &named) == 0 &&
               rb_entry_object_same(&image->identity, &named);
  return rb_file_close(image) && valid;
}

static inline bool rb_entry_driver(const rb_process *driver) {
  const char *const arguments[] = {DEC203_NODE_PATH, "--",
                                   DEC203_LAUNCHER_PATH};
  char repository[] = DEC203_SOURCE_DIRECTORY;
  const char suffix[] = "/infra/database-upgrades/native-tracing";
  size_t size = strlen(repository), suffix_size = sizeof(suffix) - 1;
  if (size <= suffix_size ||
      strcmp(repository + size - suffix_size, suffix) != 0)
    return false;
  repository[size - suffix_size] = 0;
  return rb_process_argv_exact(driver->pid, arguments, 3) &&
         rb_entry_cwd(driver->pid, repository) &&
         rb_process_image_exact(driver, DEC203_NODE_PATH, DEC203_NODE_SIZE,
                                DEC203_NODE_UID, DEC203_NODE_MODE,
                                DEC203_NODE_SHA256);
}

static inline bool rb_owner_entry(const char *id, rb_process *owner,
                                  rb_process *driver) {
  rb_process after;
  if (!rb_uuid(id) || getuid() != DEC203_PROFILE_UID ||
      geteuid() != DEC203_PROFILE_UID ||
      !rb_process_capture(getpid(), DEC203_OWNER_PIDFD, owner) ||
      !rb_process_capture(getppid(), DEC203_DRIVER_PIDFD, driver))
    return false;
  const char *const arguments[] = {owner->exe_path, id};
  return owner->ppid == driver->pid &&
         rb_process_argv_exact(owner->pid, arguments, 2) &&
         rb_entry_root(owner) && rb_entry_driver(driver) &&
         rb_process_capture(owner->pid, owner->pidfd, &after) &&
         rb_process_same(owner, &after) && rb_live(owner, driver);
}

static inline bool rb_lease_entry(char id_out[37], rb_process *owner,
                                  rb_process *driver) {
  char bytes[8192], *arguments[4];
  rb_process self, after;
  if (getuid() != DEC203_PROFILE_UID || geteuid() != DEC203_PROFILE_UID ||
      !rb_process_arguments(getpid(), bytes, arguments, 4) ||
      strcmp(arguments[0], DEC203_NODE_PATH) != 0 ||
      strcmp(arguments[1], "--") != 0 ||
      strcmp(arguments[2], DEC203_COORDINATOR_PATH) != 0 ||
      !rb_uuid(arguments[3]) || !rb_process_capture(getpid(), -1, &self) ||
      !rb_process_capture(getppid(), DEC203_OWNER_PIDFD, owner) ||
      !rb_process_capture(owner->ppid, DEC203_DRIVER_PIDFD, driver))
    return false;
  const char *const parent_arguments[] = {owner->exe_path, arguments[3]};
  bool valid = self.ppid == owner->pid && owner->ppid == driver->pid &&
               rb_process_argv_exact(owner->pid, parent_arguments, 2) &&
               rb_entry_root(owner) && rb_entry_driver(driver) &&
               rb_process_image_exact(&self, DEC203_NODE_PATH, DEC203_NODE_SIZE,
                                      DEC203_NODE_UID, DEC203_NODE_MODE,
                                      DEC203_NODE_SHA256) &&
               rb_process_capture(self.pid, -1, &after) &&
               rb_process_same(&self, &after) && rb_live(owner, driver);
  if (valid)
    memcpy(id_out, arguments[3], 37);
  return valid;
}

#endif
