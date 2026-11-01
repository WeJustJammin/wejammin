#ifndef WEJAMMIN_RECEIVING_LEASE_OWNER_LEDGER_H
#define WEJAMMIN_RECEIVING_LEASE_OWNER_LEDGER_H

static bool ro_close(ro_state *state, int *slot) {
  int descriptor = *slot;
  *slot = -1;
  if (descriptor < 0)
    return true;
  if (!rb_fd_close(&state->ledger, descriptor)) {
    state->ledger.uncertain = true;
    return false;
  }
  return true;
}

static bool ro_owned(ro_state *state, int descriptor) {
  rb_owned_fd *slot = rb_fd_find(&state->ledger, descriptor);
  struct stat current;
  return slot && slot->known && fstat(descriptor, &current) == 0 &&
         rb_same_object(&slot->identity, &current) &&
         slot->identity.st_mode == current.st_mode;
}

static int ro_duplicate(ro_state *state, int source) {
  if (!ro_owned(state, source))
    return -1;
  rb_owned_fd *slot = rb_fd_reserve(&state->ledger);
  if (!slot)
    return -1;
  slot->fd = fcntl(source, F_DUPFD_CLOEXEC, DEC203_SCRATCH_FIRST_FD);
  if (slot->fd < 0)
    return -1;
  if (!rb_fd_identify(slot)) {
    state->ledger.uncertain = true;
    return -1;
  }
  return slot->fd;
}

static bool ro_map(ro_state *state, int source, int target, bool inheritable) {
  if (!ro_owned(state, source))
    return false;
  rb_owned_fd *slot = rb_fd_find(&state->ledger, source);
  if (source != target) {
    errno = 0;
    if (fcntl(target, F_GETFD) >= 0 || errno != EBADF) {
      state->ledger.uncertain = true;
      return false;
    }
    slot = rb_fd_reserve(&state->ledger);
    if (!slot || dup2(source, target) != target)
      return false;
    slot->fd = target;
  }
  int flags = fcntl(target, F_GETFD);
  bool identified = rb_fd_identify(slot);
  if (!identified || flags < 0 ||
      fcntl(target, F_SETFD,
            inheritable ? flags & ~FD_CLOEXEC : flags | FD_CLOEXEC) != 0) {
    state->ledger.uncertain = true;
    return false;
  }
  return source == target || ro_close(state, &source);
}

static bool ro_inherit(ro_state *state) {
  for (int descriptor = 0; descriptor <= DEC203_ENTRY_EVENT_FD; descriptor++) {
    rb_owned_fd *slot = rb_fd_reserve(&state->ledger);
    if (!slot)
      return false;
    slot->fd = descriptor;
    if (!rb_fd_identify(slot)) {
      state->ledger.uncertain = true;
      return false;
    }
  }
  return true;
}

static bool ro_channels(ro_state *state) {
  rb_owned_fd *command = rb_fd_find(&state->ledger, DEC203_ENTRY_COMMAND_FD);
  rb_owned_fd *event = rb_fd_find(&state->ledger, DEC203_ENTRY_EVENT_FD);
  if (!command || !event || !S_ISSOCK(command->identity.st_mode) ||
      !S_ISSOCK(event->identity.st_mode) ||
      rb_same_object(&command->identity, &event->identity))
    return false;
  rb_owned_fd *channels[] = {command, event};
  for (unsigned index = 0; index < 2; index++) {
    rb_owned_fd *slot = channels[index];
    if (!ro_owned(state, slot->fd) ||
        fcntl(slot->fd, F_SETFL, slot->status | O_NONBLOCK) != 0)
      return false;
    slot->status = fcntl(slot->fd, F_GETFL);
    if (slot->status < 0)
      return false;
  }
  int commands = ro_duplicate(state, DEC203_ENTRY_COMMAND_FD);
  int events = ro_duplicate(state, DEC203_ENTRY_EVENT_FD);
  int old_command = DEC203_ENTRY_COMMAND_FD;
  int old_event = DEC203_ENTRY_EVENT_FD;
  if (commands < 0 || events < 0 || !ro_close(state, &old_command) ||
      !ro_close(state, &old_event) ||
      !ro_map(state, commands, DEC203_OUTER_COMMAND_FD, false) ||
      !ro_map(state, events, DEC203_OUTER_EVENT_FD, false))
    return false;
  rb_channel_init(&state->commands, DEC203_OUTER_COMMAND_FD);
  rb_channel_init(&state->events, DEC203_OUTER_EVENT_FD);
  return rb_fd_guard(&state->ledger);
}

static bool ro_pidfds(ro_state *state) {
  rb_process before;
  pid_t parent = getppid();
  if (!rb_process_capture(parent, -1, &before))
    return false;
  for (unsigned index = 0; index < 2; index++) {
    rb_owned_fd *slot = rb_fd_reserve(&state->ledger);
    if (!slot)
      return false;
    slot->fd = (int)syscall(SYS_pidfd_open, index ? parent : getpid(), 0);
    if (slot->fd < 0)
      return false;
    if (!rb_fd_identify(slot)) {
      state->ledger.uncertain = true;
      return false;
    }
    if (!ro_map(state, slot->fd,
                index ? DEC203_DRIVER_PIDFD : DEC203_OWNER_PIDFD, false))
      return false;
  }
  return rb_owner_entry(state->id, &state->owner, &state->driver) &&
         rb_process_same(&before, &state->driver) && getppid() == parent &&
         rb_fd_guard(&state->ledger);
}

static bool ro_open_lock(ro_state *state, unsigned index) {
  static const char *const paths[] = {DEC203_LOCK_PATHS};
  if (index >= DEC203_LOCK_COUNT)
    return false;
  rb_owned_fd *slot = rb_fd_reserve(&state->ledger);
  if (!slot)
    return false;
  slot->fd = open(paths[index], O_RDWR | O_NOFOLLOW | O_CLOEXEC);
  if (slot->fd < 0)
    return false;
  if (!rb_fd_identify(slot)) {
    state->ledger.uncertain = true;
    return false;
  }
  return ro_map(state, slot->fd, (int)index + DEC203_LOCK_FIRST_FD, false);
}

static bool ro_inner_pipes(ro_state *state) {
  int ends[4];
  for (unsigned pair = 0; pair < 2; pair++) {
    rb_owned_fd *read_end = rb_fd_reserve(&state->ledger);
    rb_owned_fd *write_end = rb_fd_reserve(&state->ledger);
    int descriptors[2];
    if (!read_end || !write_end ||
        pipe2(descriptors, O_CLOEXEC | O_NONBLOCK) != 0)
      return false;
    read_end->fd = descriptors[0];
    write_end->fd = descriptors[1];
    bool read_known = rb_fd_identify(read_end);
    bool write_known = rb_fd_identify(write_end);
    if (!read_known || !write_known) {
      state->ledger.uncertain = true;
      return false;
    }
    for (unsigned side = 0; side < 2; side++) {
      ends[pair * 2 + side] = ro_duplicate(state, descriptors[side]);
      if (ends[pair * 2 + side] < 0 || !ro_close(state, &descriptors[side]))
        return false;
    }
  }
  state->child_commands = ends[0];
  state->child_events = ends[3];
  if (!ro_map(state, ends[2], DEC203_PARENT_INNER_EVENT_FD, false) ||
      !ro_map(state, ends[1], DEC203_PARENT_INNER_COMMAND_FD, false))
    return false;
  rb_channel_init(&state->inner_events, DEC203_PARENT_INNER_EVENT_FD);
  rb_channel_init(&state->inner_commands, DEC203_PARENT_INNER_COMMAND_FD);
  return rb_fd_guard(&state->ledger);
}

static bool ro_close_ledger(ro_state *state, bool keep_outer) {
  bool clean = !state->ledger.uncertain && !rb_file_tombstones &&
               !rb_directory_tombstones;
  for (unsigned index = 0; index < state->ledger.count; index++) {
    int descriptor = state->ledger.slots[index].fd;
    if (descriptor < 0 ||
        (keep_outer &&
         (descriptor == STDOUT_FILENO || descriptor == STDERR_FILENO ||
          descriptor == DEC203_OUTER_COMMAND_FD ||
          descriptor == DEC203_OUTER_EVENT_FD)))
      continue;
    clean = ro_close(state, &descriptor) && clean;
  }
  return clean && !state->ledger.uncertain;
}

#endif
