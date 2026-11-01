#define _GNU_SOURCE
#define NAPI_VERSION 8
#include "peer-lifetime-state.h"
#include <math.h>
#include <node_api.h>

static const napi_type_tag lifetime_tag = {0x58b3dca1c7f24e69ULL,
                                           0xa12c80d39e5b674fULL};

static const char *error_token(lifetime_error error) {
  switch (error) {
  case LIFE_INVALID_SOCKET:
    return "DEC203_PIDFD_INVALID_SOCKET";
  case LIFE_CLOSED:
    return "DEC203_PIDFD_CAPABILITY_CLOSED";
  case LIFE_INVALID_CAPABILITY:
    return "DEC203_PIDFD_INVALID_CAPABILITY";
  case LIFE_EXITED:
    return "DEC203_PIDFD_PEER_EXITED";
  case LIFE_LINKAGE_CHANGED:
    return "DEC203_PIDFD_LINKAGE_CHANGED";
  case LIFE_IDENTITY_CHANGED:
    return "DEC203_PIDFD_IDENTITY_CHANGED";
  case LIFE_CLEANUP_FAILED:
    return "DEC203_PIDFD_CLEANUP_FAILED";
  default:
    return "DEC203_PIDFD_UNAVAILABLE";
  }
}

static napi_value throw_lifetime(napi_env env, lifetime_error error) {
  const char *token = error_token(error);
  napi_throw_error(env, token, token);
  return NULL;
}

static lifetime_state *receiver_state(napi_env env, napi_callback_info info) {
  size_t count = 1;
  napi_value argv[1];
  napi_value receiver;
  napi_valuetype type;
  bool tagged = false;
  lifetime_state *state = NULL;
  if (napi_get_cb_info(env, info, &count, argv, &receiver, NULL) != napi_ok ||
      count != 0 || napi_typeof(env, receiver, &type) != napi_ok ||
      type != napi_object ||
      napi_check_object_type_tag(env, receiver, &lifetime_tag, &tagged) !=
          napi_ok ||
      !tagged || napi_unwrap(env, receiver, (void **)&state) != napi_ok ||
      state == NULL) {
    throw_lifetime(env, LIFE_INVALID_CAPABILITY);
    return NULL;
  }
  return state;
}

static void finalize_lifetime(napi_env env, void *data, void *hint) {
  (void)env;
  (void)hint;
  lifetime_state *state = data;
  release_lifetime(state);
  free(state);
}

static napi_value close_lifetime(napi_env env, napi_callback_info info) {
  lifetime_state *state = receiver_state(env, info);
  if (state == NULL)
    return NULL;
  if (!release_lifetime(state))
    return throw_lifetime(env, LIFE_CLEANUP_FAILED);
  napi_value result;
  if (napi_get_undefined(env, &result) != napi_ok)
    return throw_lifetime(env, LIFE_UNAVAILABLE);
  return result;
}

static napi_value read_peer_lifetime(napi_env env, napi_callback_info info) {
  lifetime_state *state = receiver_state(env, info);
  if (state == NULL)
    return NULL;
  lifetime_error status = read_lifetime(state);
  if (status != LIFE_OK)
    return throw_lifetime(env, status);
  napi_value result;
  napi_value pid;
  napi_value alive;
  if (napi_create_object(env, &result) != napi_ok ||
      napi_create_int32(env, state->pid, &pid) != napi_ok ||
      napi_get_boolean(env, true, &alive) != napi_ok ||
      napi_set_named_property(env, result, "pid", pid) != napi_ok ||
      napi_set_named_property(env, result, "fdInfoPid", pid) != napi_ok ||
      napi_set_named_property(env, result, "alive", alive) != napi_ok ||
      napi_object_freeze(env, result) != napi_ok)
    return throw_lifetime(env, LIFE_UNAVAILABLE);
  return result;
}

static napi_value open_peer_pidfd(napi_env env, napi_callback_info info) {
  size_t count = 2;
  napi_value argv[2];
  napi_valuetype type;
  double value;
  if (napi_get_cb_info(env, info, &count, argv, NULL, NULL) != napi_ok ||
      count != 1 || napi_typeof(env, argv[0], &type) != napi_ok ||
      type != napi_number ||
      napi_get_value_double(env, argv[0], &value) != napi_ok ||
      !isfinite(value) || value < 0 || value > INT_MAX ||
      (double)(int)value != value)
    return throw_lifetime(env, LIFE_INVALID_SOCKET);
  lifetime_state *state = calloc(1, sizeof(*state));
  if (state == NULL)
    return throw_lifetime(env, LIFE_UNAVAILABLE);
  state->socket_fd = -1;
  state->pidfd = -1;
  lifetime_error status = acquire_lifetime((int)value, state);
  if (status != LIFE_OK) {
    bool cleaned = release_lifetime(state);
    free(state);
    return throw_lifetime(env, cleaned ? status : LIFE_CLEANUP_FAILED);
  }
  napi_value result;
  bool wrapped = false;
  napi_status created = napi_create_object(env, &result);
  if (created == napi_ok)
    created = napi_type_tag_object(env, result, &lifetime_tag);
  if (created == napi_ok) {
    created = napi_wrap(env, result, state, finalize_lifetime, NULL, NULL);
    wrapped = created == napi_ok;
  }
  napi_property_descriptor methods[] = {
      {"read", NULL, read_peer_lifetime, NULL, NULL, NULL, napi_default, NULL},
      {"close", NULL, close_lifetime, NULL, NULL, NULL, napi_default, NULL}};
  if (created == napi_ok)
    created = napi_define_properties(env, result, 2, methods);
  if (created == napi_ok)
    created = napi_object_freeze(env, result);
  if (created != napi_ok) {
    bool cleaned = release_lifetime(state);
    if (!wrapped)
      free(state);
    return throw_lifetime(env,
                          cleaned ? LIFE_UNAVAILABLE : LIFE_CLEANUP_FAILED);
  }
  return result;
}

static napi_value initialize(napi_env env, napi_value exports) {
  napi_property_descriptor entry = {
      "openPeerPidfd", NULL, open_peer_pidfd, NULL, NULL, NULL,
      napi_default,    NULL};
  if (napi_define_properties(env, exports, 1, &entry) != napi_ok)
    return NULL;
  return exports;
}

NAPI_MODULE(peer_lifetime, initialize)
