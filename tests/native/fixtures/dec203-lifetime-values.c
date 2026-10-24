#define _GNU_SOURCE
#include <node_api.h>
#include <stdbool.h>
#include <stdlib.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <unistd.h>

#if NAPI_VERSION != 8
#error DEC203_test_fixture_requires_Node_API_8
#endif

typedef struct {
  int descriptors[2];
  struct stat identities[2];
  bool closed;
} owned_pair;

static bool close_pair(owned_pair *pair) {
  if (pair->closed) return true;
  pair->closed = true;
  bool intact = true;
  for (int index = 0; index < 2; index++) {
    int fd = pair->descriptors[index];
    pair->descriptors[index] = -1;
    struct stat actual;
    if (fstat(fd, &actual) != 0 || !S_ISSOCK(actual.st_mode)
        || actual.st_dev != pair->identities[index].st_dev
        || actual.st_ino != pair->identities[index].st_ino) {
      intact = false;
      continue;
    }
    if (close(fd) != 0) intact = false;
  }
  return intact;
}

static void finalize_pair(napi_env env, void *data, void *hint) {
  (void)env;
  (void)hint;
  owned_pair *pair = data;
  close_pair(pair);
  free(pair);
}

static napi_value close_owned_pair(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  owned_pair *pair = NULL;
  if (napi_get_cb_info(env, info, &argc, argv, NULL, (void **)&pair) != napi_ok
      || argc != 0 || pair == NULL) {
    napi_throw_error(env, "DEC203_LIFETIME_FIXTURE_INVALID", "DEC203_LIFETIME_FIXTURE_INVALID");
    return NULL;
  }
  if (!close_pair(pair)) {
    napi_throw_error(env, "DEC203_LIFETIME_FIXTURE_CHANGED", "DEC203_LIFETIME_FIXTURE_CHANGED");
    return NULL;
  }
  napi_value result;
  if (napi_get_undefined(env, &result) != napi_ok) return NULL;
  return result;
}

static bool connected_datagram(int fd) {
  struct sockaddr_storage local;
  struct sockaddr_storage peer;
  socklen_t local_length = sizeof(local);
  socklen_t peer_length = sizeof(peer);
  int type = 0;
  socklen_t type_length = sizeof(type);
  struct ucred credentials;
  socklen_t credential_length = sizeof(credentials);
  return getsockname(fd, (struct sockaddr *)&local, &local_length) == 0
      && getpeername(fd, (struct sockaddr *)&peer, &peer_length) == 0
      && local.ss_family == AF_UNIX && peer.ss_family == AF_UNIX
      && getsockopt(fd, SOL_SOCKET, SO_TYPE, &type, &type_length) == 0
      && type_length == sizeof(type) && type == SOCK_DGRAM
      && getsockopt(fd, SOL_SOCKET, SO_PEERCRED, &credentials, &credential_length) == 0
      && credential_length == sizeof(credentials)
      && credentials.pid == getpid() && credentials.uid == geteuid()
      && credentials.gid == getegid();
}

static napi_value create_datagram_pair(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  if (napi_get_cb_info(env, info, &argc, argv, NULL, NULL) != napi_ok || argc != 0) {
    napi_throw_error(env, "DEC203_LIFETIME_FIXTURE_INVALID", "DEC203_LIFETIME_FIXTURE_INVALID");
    return NULL;
  }
  owned_pair *pair = calloc(1, sizeof(*pair));
  if (pair == NULL) {
    napi_throw_error(env, "DEC203_LIFETIME_FIXTURE_FAILED", "DEC203_LIFETIME_FIXTURE_FAILED");
    return NULL;
  }
  pair->descriptors[0] = -1;
  pair->descriptors[1] = -1;
  if (socketpair(AF_UNIX, SOCK_DGRAM | SOCK_CLOEXEC, 0, pair->descriptors) != 0) {
    free(pair);
    napi_throw_error(env, "DEC203_LIFETIME_FIXTURE_FAILED", "DEC203_LIFETIME_FIXTURE_FAILED");
    return NULL;
  }
  bool valid = true;
  for (int index = 0; index < 2; index++) {
    valid = fstat(pair->descriptors[index], &pair->identities[index]) == 0
        && connected_datagram(pair->descriptors[index]) && valid;
  }
  if (!valid) {
    close(pair->descriptors[0]);
    close(pair->descriptors[1]);
    free(pair);
    napi_throw_error(env, "DEC203_LIFETIME_FIXTURE_FAILED", "DEC203_LIFETIME_FIXTURE_FAILED");
    return NULL;
  }
  napi_value result;
  napi_value fd;
  napi_value closer;
  bool gc_owned = false;
  napi_status status = napi_create_object(env, &result);
  if (status == napi_ok) status = napi_create_int32(env, pair->descriptors[0], &fd);
  if (status == napi_ok) {
    status = napi_create_function(env, "close", NAPI_AUTO_LENGTH, close_owned_pair, pair, &closer);
  }
  if (status == napi_ok) {
    status = napi_add_finalizer(env, closer, pair, finalize_pair, NULL, NULL);
    gc_owned = status == napi_ok;
  }
  if (status == napi_ok) status = napi_set_named_property(env, result, "fd", fd);
  if (status == napi_ok) status = napi_set_named_property(env, result, "close", closer);
  if (status == napi_ok) status = napi_object_freeze(env, result);
  if (status != napi_ok) {
    close_pair(pair);
    if (!gc_owned) free(pair);
    napi_throw_error(env, "DEC203_LIFETIME_FIXTURE_FAILED", "DEC203_LIFETIME_FIXTURE_FAILED");
    return NULL;
  }
  return result;
}

static void finalize_foreign(napi_env env, void *data, void *hint) {
  (void)env;
  (void)hint;
  free(data);
}

static napi_value create_foreign(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  if (napi_get_cb_info(env, info, &argc, argv, NULL, NULL) != napi_ok || argc != 0) {
    napi_throw_error(env, "DEC203_LIFETIME_FIXTURE_INVALID", "DEC203_LIFETIME_FIXTURE_INVALID");
    return NULL;
  }
  /* Foreign owned allocation, deliberately NO production type tag or pidfd. */
  unsigned char *foreign = calloc(256, 1);
  if (foreign == NULL) {
    napi_throw_error(env, "DEC203_LIFETIME_FIXTURE_FAILED", "DEC203_LIFETIME_FIXTURE_FAILED");
    return NULL;
  }
  foreign[0] = 0xa5;
  napi_value object;
  if (napi_create_object(env, &object) != napi_ok) {
    free(foreign);
    napi_throw_error(env, "DEC203_LIFETIME_FIXTURE_FAILED", "DEC203_LIFETIME_FIXTURE_FAILED");
    return NULL;
  }
  if (napi_wrap(env, object, foreign, finalize_foreign, NULL, NULL) != napi_ok) {
    free(foreign);
    napi_throw_error(env, "DEC203_LIFETIME_FIXTURE_FAILED", "DEC203_LIFETIME_FIXTURE_FAILED");
    return NULL;
  }
  if (napi_object_freeze(env, object) != napi_ok) {
    napi_throw_error(env, "DEC203_LIFETIME_FIXTURE_FAILED", "DEC203_LIFETIME_FIXTURE_FAILED");
    return NULL;
  }
  return object;
}

static napi_value initialize(napi_env env, napi_value exports) {
  napi_property_descriptor descriptors[] = {
    {"createDatagramPair", NULL, create_datagram_pair, NULL, NULL, NULL, napi_default, NULL},
    {"createForeign", NULL, create_foreign, NULL, NULL, NULL, napi_default, NULL}
  };
  if (napi_define_properties(env, exports, 2, descriptors) != napi_ok) return NULL;
  return exports;
}

NAPI_MODULE(dec203_lifetime_values, initialize)
