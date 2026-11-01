#define _GNU_SOURCE
#define NAPI_VERSION 8
#include <node_api.h>
#include <fcntl.h>
#include <inttypes.h>
#include <limits.h>
#include <math.h>
#include <stdio.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/un.h>
#include <unistd.h>

static napi_value invalid_socket(napi_env env) {
  napi_throw_error(env, "DEC203_INVALID_SOCKET", "DEC203_INVALID_SOCKET");
  return NULL;
}

static int same_descriptor(const struct stat *left, const struct stat *right) {
  return left->st_dev == right->st_dev &&
         left->st_ino == right->st_ino &&
         left->st_mode == right->st_mode &&
         left->st_uid == right->st_uid &&
         left->st_gid == right->st_gid;
}

static int socket_integer(int descriptor, int option, int expected) {
  int value = 0;
  socklen_t length = sizeof(value);
  return getsockopt(descriptor, SOL_SOCKET, option, &value, &length) == 0 &&
         length == sizeof(value) && value == expected;
}

static int acquire_peer(int descriptor, struct stat *identity, struct ucred *peer) {
  struct stat pinned;
  struct stat after;
  struct sockaddr_un address;
  socklen_t address_length = sizeof(address);
  socklen_t credential_length = sizeof(*peer);
  int duplicate;
  int valid;

  if (fstat(descriptor, identity) != 0 || !S_ISSOCK(identity->st_mode)) {
    return 0;
  }
  duplicate = fcntl(descriptor, F_DUPFD_CLOEXEC, 3);
  if (duplicate < 0) return 0;
  valid = fstat(duplicate, &pinned) == 0 &&
          same_descriptor(identity, &pinned) &&
          socket_integer(duplicate, SO_TYPE, SOCK_STREAM) &&
          socket_integer(duplicate, SO_DOMAIN, AF_UNIX) &&
          getpeername(duplicate, (struct sockaddr *)&address, &address_length) == 0 &&
          address_length >= sizeof(address.sun_family) &&
          address.sun_family == AF_UNIX &&
          getsockopt(duplicate, SOL_SOCKET, SO_PEERCRED, peer, &credential_length) == 0 &&
          credential_length == sizeof(*peer) &&
          peer->pid > 0 &&
          fstat(descriptor, &after) == 0 &&
          same_descriptor(identity, &after);
  if (close(duplicate) != 0) valid = 0;
  return valid;
}

static int set_number(napi_env env, napi_value result, const char *key, double value) {
  napi_value number;
  return napi_create_double(env, value, &number) == napi_ok &&
         napi_set_named_property(env, result, key, number) == napi_ok;
}

static int set_decimal(napi_env env, napi_value result, const char *key,
                       uintmax_t value) {
  char buffer[sizeof(uintmax_t) * 3 + 1];
  napi_value string;
  int length = snprintf(buffer, sizeof(buffer), "%" PRIuMAX, value);
  if (length < 1 || (size_t)length >= sizeof(buffer)) return 0;
  return napi_create_string_utf8(env, buffer, (size_t)length, &string) == napi_ok &&
         napi_set_named_property(env, result, key, string) == napi_ok;
}

static napi_value read_peer_credentials(napi_env env, napi_callback_info info) {
  size_t count = 2;
  napi_value arguments[2];
  napi_valuetype type;
  napi_value result;
  double value;
  int descriptor;
  struct stat identity;
  struct ucred peer;

  if (napi_get_cb_info(env, info, &count, arguments, NULL, NULL) != napi_ok ||
      count != 1 ||
      napi_typeof(env, arguments[0], &type) != napi_ok ||
      type != napi_number ||
      napi_get_value_double(env, arguments[0], &value) != napi_ok ||
      !isfinite(value) || value < 0 || value > INT_MAX) {
    return invalid_socket(env);
  }
  descriptor = (int)value;
  if ((double)descriptor != value || !acquire_peer(descriptor, &identity, &peer)) {
    return invalid_socket(env);
  }
  if (napi_create_object(env, &result) != napi_ok ||
      !set_number(env, result, "pid", (double)peer.pid) ||
      !set_number(env, result, "uid", (double)peer.uid) ||
      !set_number(env, result, "gid", (double)peer.gid) ||
      !set_decimal(env, result, "device", (uintmax_t)identity.st_dev) ||
      !set_decimal(env, result, "inode", (uintmax_t)identity.st_ino) ||
      napi_object_freeze(env, result) != napi_ok) {
    return invalid_socket(env);
  }
  return result;
}

static napi_value initialize(napi_env env, napi_value exports) {
  napi_property_descriptor method = {
    "readPeerCredentials", NULL, read_peer_credentials, NULL, NULL, NULL,
    napi_default, NULL
  };
  if (napi_define_properties(env, exports, 1, &method) != napi_ok) return NULL;
  return exports;
}

NAPI_MODULE(peer_credentials, initialize)
