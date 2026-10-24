#ifndef DEC203_STREAM_INGRESS_VALUES_H
#define DEC203_STREAM_INGRESS_VALUES_H

static const napi_type_tag si_owner_tag = {0x38c0fb1a70294d63ULL,
                                           0x86b08de5c47a19f2ULL};
static const napi_type_tag si_stream_tag = {0x4eeb7e8ba0e843f1ULL,
                                            0x9230cb16d754a268ULL};
static const napi_type_tag si_segment_tag = {0x5d1da091e4724b82ULL,
                                             0xa307b4c5806dfe19ULL};
static const napi_type_tag si_writer_tag = {0x62edc8bf3a5741d0ULL,
                                            0xbfa05e7318c42996ULL};

static void si_finalize_owner(napi_env env, void *data, void *hint) {
  (void)env;
  (void)hint;
  si_group *group = data;
  si_close_group(group);
  si_group_unref(group);
}

static void si_finalize_stream(napi_env env, void *data, void *hint) {
  (void)env;
  (void)hint;
  si_stream *stream = data;
  si_close_stream(stream);
  si_stream_unref(stream);
}

static void si_finalize_segment(napi_env env, void *data, void *hint) {
  (void)env;
  (void)hint;
  si_segment *segment = data;
  si_release_segment(segment);
  si_segment_unref(segment);
}

static void si_finalize_writer(napi_env env, void *data, void *hint) {
  (void)env;
  (void)hint;
  si_segment_unref(data);
}

/* After successful wrap only the finalizer may release this allocation ref. */
static napi_status si_wrap(napi_env env, void *data, const napi_type_tag *tag,
                           napi_finalize finalize, napi_value *value,
                           bool *wrapped) {
  *wrapped = false;
  napi_status status = napi_create_object(env, value);
  if (status == napi_ok)
    status = napi_type_tag_object(env, *value, tag);
  if (status == napi_ok) {
    status = napi_wrap(env, *value, data, finalize, NULL, NULL);
    *wrapped = status == napi_ok;
  }
  return status;
}

static si_error si_segment_status(si_segment *segment, size_t count) {
  if (segment->closed || segment->stream->closed ||
      segment->stream->group->closed)
    return SI_CLOSED;
  if (count != 0)
    return SI_PROTOCOL;
  return segment->stream->group->uncertain ? SI_CLEANUP : SI_OK;
}

static napi_value si_copy_bytes(napi_env env, napi_callback_info info) {
  size_t count;
  si_segment *segment = si_receiver(env, info, &si_segment_tag, &count);
  if (segment == NULL)
    return NULL;
  si_error status = si_segment_status(segment, count);
  if (status != SI_OK)
    return si_throw(env, status);
  napi_value value;
  if (napi_create_buffer_copy(env, segment->length, segment->bytes, NULL,
                              &value) != napi_ok)
    return si_throw(env, SI_UNAVAILABLE);
  return value;
}

static napi_value si_release_value(napi_env env, napi_callback_info info) {
  size_t count;
  si_segment *segment = si_receiver(env, info, &si_segment_tag, &count);
  if (segment == NULL)
    return NULL;
  if (!segment->closed && count != 0)
    return si_throw(env, SI_PROTOCOL);
  if (!si_release_segment(segment) || segment->stream->group->uncertain)
    return si_throw(env, SI_CLEANUP);
  return si_undefined(env);
}

static napi_value si_writer_value_read(napi_env env, napi_callback_info info) {
  size_t count;
  si_segment *segment = si_receiver(env, info, &si_writer_tag, &count);
  if (segment == NULL)
    return NULL;
  si_error status = si_segment_status(segment, count);
  if (status == SI_OK)
    status = si_read_writer(segment);
  if (status != SI_OK)
    return si_throw(env, status);
  napi_value result;
  napi_value pid;
  napi_value uid;
  napi_value gid;
  napi_value alive;
  if (napi_create_object(env, &result) != napi_ok ||
      napi_create_int32(env, segment->credentials.pid, &pid) != napi_ok ||
      napi_create_uint32(env, segment->credentials.uid, &uid) != napi_ok ||
      napi_create_uint32(env, segment->credentials.gid, &gid) != napi_ok ||
      napi_get_boolean(env, true, &alive) != napi_ok)
    return si_throw(env, SI_UNAVAILABLE);
  napi_property_descriptor properties[] = {
      {"pid", NULL, NULL, NULL, NULL, pid, napi_enumerable, NULL},
      {"uid", NULL, NULL, NULL, NULL, uid, napi_enumerable, NULL},
      {"gid", NULL, NULL, NULL, NULL, gid, napi_enumerable, NULL},
      {"fdInfoPid", NULL, NULL, NULL, NULL, pid, napi_enumerable, NULL},
      {"alive", NULL, NULL, NULL, NULL, alive, napi_enumerable, NULL}};
  if (napi_define_properties(env, result, 5, properties) != napi_ok ||
      napi_object_freeze(env, result) != napi_ok)
    return si_throw(env, SI_UNAVAILABLE);
  return result;
}

static napi_value si_segment_value(napi_env env, si_segment *segment) {
  napi_value value;
  napi_value writer;
  bool wrapped = false;
  bool writer_wrapped = false;
  napi_status status = si_wrap(env, segment, &si_segment_tag,
                               si_finalize_segment, &value, &wrapped);
  if (status == napi_ok) {
    segment->references++;
    status = si_wrap(env, segment, &si_writer_tag, si_finalize_writer, &writer,
                     &writer_wrapped);
    if (!writer_wrapped)
      si_segment_unref(segment);
  }
  napi_property_descriptor read = {"read", NULL, si_writer_value_read, NULL,
                                   NULL,   NULL, napi_default,         NULL};
  if (status == napi_ok)
    status = napi_define_properties(env, writer, 1, &read);
  if (status == napi_ok)
    status = napi_object_freeze(env, writer);
  if (status == napi_ok) {
    napi_property_descriptor properties[] = {
        {"copyBytes", NULL, si_copy_bytes, NULL, NULL, NULL, napi_default,
         NULL},
        {"writer", NULL, NULL, NULL, NULL, writer, napi_default, NULL},
        {"release", NULL, si_release_value, NULL, NULL, NULL, napi_default,
         NULL}};
    status = napi_define_properties(env, value, 3, properties);
  }
  if (status == napi_ok)
    status = napi_object_freeze(env, value);
  if (status != napi_ok) {
    /* Consumed, unpublished bytes cannot silently disappear into a later read.
     */
    si_close_stream(segment->stream);
    if (!wrapped)
      si_segment_unref(segment);
    return si_throw(env, SI_UNAVAILABLE);
  }
  return value;
}

#endif
