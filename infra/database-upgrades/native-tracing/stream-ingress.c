#define _GNU_SOURCE
#define NAPI_VERSION 8
#include "stream-ingress-state.h"
#include "stream-ingress-listener.h"
#include "stream-ingress-receive.h"
#include "stream-ingress-writer.h"
#include "stream-ingress-values.h"

_Static_assert(sizeof(uid_t) <= sizeof(uint32_t), "unsupported uid ABI");
_Static_assert(sizeof(gid_t) <= sizeof(uint32_t), "unsupported gid ABI");

static napi_value si_owner_close(napi_env env, napi_callback_info info) {
  size_t count;
  si_group *group = si_receiver(env, info, &si_owner_tag, &count);
  if (group == NULL)
    return NULL;
  if (!group->closed && count != 0)
    return si_throw(env, SI_PROTOCOL);
  if (!si_close_group(group))
    return si_throw(env, SI_CLEANUP);
  return si_undefined(env);
}

static napi_value si_stream_close(napi_env env, napi_callback_info info) {
  size_t count;
  si_stream *stream = si_receiver(env, info, &si_stream_tag, &count);
  if (stream == NULL)
    return NULL;
  if (!stream->closed && count != 0)
    return si_throw(env, SI_PROTOCOL);
  if (!si_close_stream(stream) || stream->group->uncertain)
    return si_throw(env, SI_CLEANUP);
  return si_undefined(env);
}

static napi_value si_stream_receive(napi_env env, napi_callback_info info) {
  size_t count;
  si_stream *stream = si_receiver(env, info, &si_stream_tag, &count);
  if (stream == NULL)
    return NULL;
  if (stream->closed || stream->group->closed)
    return si_throw(env, SI_CLOSED);
  if (count != 0)
    return si_throw(env, SI_PROTOCOL);
  if (stream->group->uncertain)
    return si_throw(env, SI_CLEANUP);
  si_segment *segment;
  si_error status = si_receive(stream, &segment);
  if (status != SI_OK)
    return si_throw(env, status);
  if (segment != NULL)
    return si_segment_value(env, segment);
  if (stream->eof) {
    napi_value result;
    if (napi_get_null(env, &result) != napi_ok)
      return si_throw(env, SI_UNAVAILABLE);
    return result;
  }
  return si_undefined(env);
}

static napi_value si_stream_value(napi_env env, si_stream *stream) {
  napi_value result;
  bool wrapped = false;
  napi_status status = si_wrap(env, stream, &si_stream_tag, si_finalize_stream,
                               &result, &wrapped);
  napi_property_descriptor methods[] = {
      {"receive", NULL, si_stream_receive, NULL, NULL, NULL, napi_default,
       NULL},
      {"close", NULL, si_stream_close, NULL, NULL, NULL, napi_default, NULL}};
  if (status == napi_ok)
    status = napi_define_properties(env, result, 2, methods);
  if (status == napi_ok)
    status = napi_object_freeze(env, result);
  if (status != napi_ok) {
    si_close_stream(stream);
    if (!wrapped)
      si_stream_unref(stream);
    return si_throw(env, SI_UNAVAILABLE);
  }
  return result;
}

static napi_value si_owner_accept(napi_env env, napi_callback_info info) {
  size_t count;
  si_group *group = si_receiver(env, info, &si_owner_tag, &count);
  if (group == NULL)
    return NULL;
  if (group->closed)
    return si_throw(env, SI_CLOSED);
  if (count != 0)
    return si_throw(env, SI_PROTOCOL);
  if (group->uncertain)
    return si_throw(env, SI_CLEANUP);
  si_stream *stream;
  si_error status = si_accept(group, &stream);
  if (status != SI_OK)
    return si_throw(env, status);
  return stream == NULL ? si_undefined(env) : si_stream_value(env, stream);
}

static napi_value si_create_ingress(napi_env env, napi_callback_info info) {
  size_t count = 2;
  napi_value arguments[2];
  napi_valuetype type;
  size_t length;
  char parent[PATH_MAX];
  if (napi_get_cb_info(env, info, &count, arguments, NULL, NULL) != napi_ok ||
      count != 1 || napi_typeof(env, arguments[0], &type) != napi_ok ||
      type != napi_string ||
      napi_get_value_string_utf8(env, arguments[0], NULL, 0, &length) !=
          napi_ok ||
      length == 0 || length >= sizeof(parent))
    return si_throw(env, SI_PROTOCOL);
  size_t copied;
  if (napi_get_value_string_utf8(env, arguments[0], parent, sizeof(parent),
                                 &copied) != napi_ok ||
      copied != length || strlen(parent) != length ||
      strchr(parent, '\r') != NULL || strchr(parent, '\n') != NULL)
    return si_throw(env, SI_PROTOCOL);
  si_group *group = calloc(1, sizeof(*group));
  if (group == NULL)
    return si_throw(env, SI_UNAVAILABLE);
  group->references = 1;
  group->directory_fd = -1;
  group->listener_fd = -1;
  si_error error = si_listen(group, parent);
  if (error != SI_OK) {
    si_close_group(group);
    si_group_unref(group);
    return si_throw(env, error);
  }
  napi_value result;
  bool wrapped = false;
  napi_status status =
      si_wrap(env, group, &si_owner_tag, si_finalize_owner, &result, &wrapped);
  napi_property_descriptor methods[] = {
      {"accept", NULL, si_owner_accept, NULL, NULL, NULL, napi_default, NULL},
      {"close", NULL, si_owner_close, NULL, NULL, NULL, napi_default, NULL}};
  if (status == napi_ok)
    status = napi_define_properties(env, result, 2, methods);
  if (status == napi_ok)
    status = napi_object_freeze(env, result);
  if (status != napi_ok) {
    si_close_group(group);
    if (!wrapped)
      si_group_unref(group);
    return si_throw(env, SI_UNAVAILABLE);
  }
  return result;
}

static napi_value si_initialize(napi_env env, napi_value exports) {
  napi_property_descriptor entry = {
      "createIngress", NULL, si_create_ingress, NULL, NULL, NULL,
      napi_default,    NULL};
  if (napi_define_properties(env, exports, 1, &entry) != napi_ok)
    return si_throw(env, SI_UNAVAILABLE);
  return exports;
}

NAPI_MODULE(stream_ingress, si_initialize)
