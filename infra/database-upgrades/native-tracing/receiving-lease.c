#define _GNU_SOURCE
#include <dirent.h>
#include <errno.h>
#include <fcntl.h>
#include <inttypes.h>
#include <limits.h>
#include <node_api.h>
#include <poll.h>
#include <pthread.h>
#include <signal.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/file.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <sys/sysmacros.h>
#include <time.h>
#include <unistd.h>

#include "receiving-bootstrap-profile.h"
#include "receiving-bootstrap-json.h"
#include "receiving-bootstrap-frame-values.h"
#include "receiving-bootstrap-frame.h"
#include "receiving-bootstrap-wire.h"
#include "receiving-bootstrap-sha256.h"
#include "receiving-bootstrap-process.h"
#include "receiving-bootstrap-entry.h"
#include "receiving-bootstrap-locks.h"
#include "receiving-lease-state.h"
#include "receiving-lease-reader.h"

static int rl_flush_ack(rl_state *state) {
  pthread_mutex_lock(&state->state_mutex);
  rb_channel *channel = &state->output;
  int result = 0;
  if (!rb_pending(channel)) {
    result = channel->error ? -1 : 1;
  } else if (channel->error || state->revoked) {
    state->cleanup_uncertain = true;
    if (!channel->error)
      channel->error = DEC203_ERROR_HISTORY_GAP;
    rl_latch_locked(state, channel->error);
    result = -1;
  } else {
    ssize_t written = write(channel->fd, channel->tx + channel->tx_offset,
                            channel->tx_length - channel->tx_offset);
    if (written > 0) {
      channel->tx_offset += (size_t)written;
      result = rb_pending(channel) ? 0 : 1;
    } else if (written == 0 ||
               (errno != EAGAIN && errno != EWOULDBLOCK && errno != EINTR)) {
      channel->error = DEC203_ERROR_HISTORY_GAP;
      state->cleanup_uncertain = true;
      rl_latch_locked(state, channel->error);
      result = -1;
    }
  }
  pthread_mutex_unlock(&state->state_mutex);
  return result;
}

static napi_value rl_throw(napi_env env, const char *token) {
  bool pending = false;
  napi_is_exception_pending(env, &pending);
  if (!pending)
    napi_throw_error(env, token, token);
  return NULL;
}

static rl_state *rl_receiver(napi_env env, napi_callback_info information) {
  napi_value receiver, argument;
  size_t count = 1;
  bool tagged = false;
  rl_state *state = NULL;
  if (napi_get_cb_info(env, information, &count, &argument, &receiver, NULL) !=
          napi_ok ||
      napi_check_object_type_tag(env, receiver, &rl_owner_tag, &tagged) !=
          napi_ok ||
      !tagged || napi_unwrap(env, receiver, (void **)&state) != napi_ok ||
      !state) {
    rl_throw(env, DEC203_ERROR_REFUSED);
    return NULL;
  }
  if (count != 0) {
    rl_throw(env, DEC203_ERROR_REFUSED);
    return NULL;
  }
  return state;
}

static napi_value rl_settle(napi_env env, napi_callback_info information) {
  rl_state *state = rl_receiver(env, information);
  if (!state)
    return NULL;
  rl_publish(env, state);
  napi_value promise;
  if (napi_get_reference_value(env, state->promise_references[1], &promise) !=
      napi_ok)
    return rl_throw(env, DEC203_ERROR_FAILED);
  return promise;
}

static napi_value rl_close(napi_env env, napi_callback_info information) {
  rl_state *state = rl_receiver(env, information);
  if (!state)
    return NULL;
  rl_latch(state, DEC203_ERROR_CANCELLED);
  rl_publish(env, state);
  napi_value promise;
  if (napi_get_reference_value(env, state->promise_references[2], &promise) !=
      napi_ok)
    return rl_throw(env, DEC203_ERROR_FAILED);
  return promise;
}

static rl_state *rl_allocate(napi_env env) {
  rl_state *state = calloc(1, sizeof(*state));
  if (!state)
    return NULL;
  if (pthread_mutex_init(&state->state_mutex, NULL) != 0) {
    free(state);
    return NULL;
  }
  if (pthread_mutex_init(&state->notification_mutex, NULL) != 0) {
    pthread_mutex_destroy(&state->state_mutex);
    free(state);
    return NULL;
  }
  if (pthread_cond_init(&state->changed, NULL) != 0) {
    pthread_mutex_destroy(&state->notification_mutex);
    pthread_mutex_destroy(&state->state_mutex);
    free(state);
    return NULL;
  }
  state->references = 1;
  state->environment = env;
  state->notification_finalized = true;
  state->wake[0] = -1;
  state->wake[1] = -1;
  for (unsigned index = 0; index < 8; index++)
    state->descriptors[index] = -1;
  return state;
}

static void rl_failed_start(rl_state *state) {
  pthread_mutex_lock(&state->state_mutex);
  rl_latch_locked(state, DEC203_ERROR_FAILED);
  state->startup_known = true;
  state->reader_enabled = true;
  if (!state->work_queued)
    state->joined = true;
  pthread_cond_broadcast(&state->changed);
  pthread_mutex_unlock(&state->state_mutex);
  rl_close_aliases(state);
  rl_release_notification(state, false);
  rl_publish(state->environment, state);
  if (!state->work_queued)
    rl_anchor(state);
  /* Post-wrap allocation belongs to the wrapper. Unproved teardown stays
   * retained. */
}

static napi_value rl_adopt(napi_env env, napi_callback_info information) {
  size_t count = 1;
  napi_value argument, owner, name;
  pthread_mutex_lock(&rl_entry_mutex);
  bool spent = rl_entry_spent;
  rl_entry_spent = true;
  pthread_mutex_unlock(&rl_entry_mutex);
  if (spent ||
      napi_get_cb_info(env, information, &count, &argument, NULL, NULL) !=
          napi_ok ||
      count != 0)
    return rl_throw(env, DEC203_ERROR_REFUSED);
  rl_state *state = rl_allocate(env);
  if (!state)
    return rl_throw(env, DEC203_ERROR_UNAVAILABLE);
  if (!rb_lease_entry(state->bootstrap_id, &state->owner, &state->driver) ||
      !rb_lease_check(&state->owner, &state->driver)) {
    state->joined = true;
    state->aliases_clean = true;
    rl_unreference(state);
    return rl_throw(env, DEC203_ERROR_REFUSED);
  }
  for (unsigned index = 0; index < 8; index++) {
    int descriptor = (int)index + DEC203_FIRST_EXEC_FIRST_FD;
    if (fstat(descriptor, &state->identities[index]) != 0) {
      state->cleanup_uncertain = true;
      rl_latch(state, DEC203_ERROR_IDENTITY_CHANGED);
      state->joined = true;
      rl_unreference(state);
      return rl_throw(env, DEC203_ERROR_IDENTITY_CHANGED);
    }
    state->descriptors[index] = descriptor;
  }
  rb_channel_init(&state->input, DEC203_INNER_COMMAND_FD);
  rb_channel_init(&state->output, DEC203_INNER_EVENT_FD);
  bool wrapped = false;
  if (napi_create_object(env, &owner) != napi_ok ||
      napi_type_tag_object(env, owner, &rl_owner_tag) != napi_ok ||
      napi_wrap(env, owner, state, rl_owner_finalizer, NULL, NULL) != napi_ok) {
    rl_failed_start(state);
    rl_unreference(state);
    return rl_throw(env, DEC203_ERROR_FAILED);
  }
  wrapped = true;
  if (!rl_napi(state, napi_create_promise(env, &state->adopted_deferred,
                                          &state->adopted_promise)) ||
      !rl_napi(state, napi_create_promise(env, &state->settled_deferred,
                                          &state->settled_promise)) ||
      !rl_napi(state, napi_create_promise(env, &state->close_deferred,
                                          &state->close_promise)))
    goto failed;
  napi_value promises[] = {state->adopted_promise, state->settled_promise,
                           state->close_promise};
  for (unsigned index = 0; index < 3; index++) {
    if (!rl_napi(state,
                 napi_create_reference(env, promises[index], 1,
                                       &state->promise_references[index])))
      goto failed;
  }
  napi_property_descriptor properties[] = {
      {"adopted", NULL, NULL, NULL, NULL, state->adopted_promise,
       napi_enumerable, NULL},
      {"settle", NULL, rl_settle, NULL, NULL, NULL, napi_enumerable, NULL},
      {"close", NULL, rl_close, NULL, NULL, NULL, napi_enumerable, NULL}};
  if (!rl_napi(state, napi_define_properties(env, owner, 3, properties)) ||
      !rl_napi(state, napi_object_freeze(env, owner)) ||
      !rl_napi(state,
               napi_create_reference(env, owner, 1, &state->owner_reference)) ||
      pipe2(state->wake, O_CLOEXEC | O_NONBLOCK) != 0 ||
      !rl_napi(state, napi_create_string_utf8(env, "DEC203 lease",
                                              NAPI_AUTO_LENGTH, &name)))
    goto failed;
  rl_reference(state);
  napi_status notification = napi_create_threadsafe_function(
      env, NULL, NULL, name, 1, 1, state, rl_notification_finalizer, state,
      rl_notification_call, &state->notification);
  if (notification != napi_ok) {
    rl_unreference(state);
    goto failed;
  }
  state->notification_finalized = false;
  state->participant_owned = true;
  rl_reference(state);
  if (napi_add_env_cleanup_hook(env, rl_environment_cleanup, state) !=
      napi_ok) {
    rl_unreference(state);
    goto failed;
  }
  state->hook_registered = true;
  if (!rl_napi(state, napi_create_async_work(env, NULL, name, rl_join_execute,
                                             rl_join_complete, state,
                                             &state->join_work)))
    goto failed;
  rl_reference(state);
  if (napi_queue_async_work(env, state->join_work) != napi_ok) {
    rl_unreference(state);
    napi_delete_async_work(env, state->join_work);
    state->join_work = NULL;
    goto failed;
  }
  state->work_queued = true;
  rl_reference(state);
  if (pthread_create(&state->reader, NULL, rl_reader_main, state) != 0) {
    rl_unreference(state);
    goto failed;
  }
  pthread_mutex_lock(&state->state_mutex);
  state->reader_created = true;
  state->startup_known = true;
  state->reader_enabled = true;
  pthread_cond_broadcast(&state->changed);
  pthread_mutex_unlock(&state->state_mutex);
  return owner;
failed:
  rl_failed_start(state);
  if (!wrapped)
    rl_unreference(state);
  return rl_throw(env, DEC203_ERROR_FAILED);
}

NAPI_MODULE_INIT() {
  napi_property_descriptor property = {
      "adoptReceivingLease", NULL, rl_adopt, NULL, NULL, NULL,
      napi_enumerable,       NULL};
  if (napi_define_properties(env, exports, 1, &property) != napi_ok ||
      napi_object_freeze(env, exports) != napi_ok)
    return rl_throw(env, DEC203_ERROR_FAILED);
  return exports;
}
