# DEC203 Node22.23.1 completion API inventory

Root public-source research, 2026-10-18T20:07Z. No project/native import,
compiler, process, lock, database, daemon, service or configuration action.
Source/API support is not successful native construction, thread join or drain.

| Official fixed-version source | Bytes | SHA256 |
| --- | ---: | --- |
| [Node-API documentation](https://github.com/nodejs/node/blob/v22.23.1/doc/api/n-api.md) |241517|20b8b3351be836c196f75aaa5ad805f7363997198adb14c3c4c2a39eb2dba620|
| [Node-API implementation](https://github.com/nodejs/node/blob/v22.23.1/src/node_api.cc) |48554|75a708e1667e8219663bd1ba63659f90c43618bcd3d24a298efbce607fc77333|

## Confirmed primary-source semantics

- Documentation6608–6616 allows no JS function when a custom C call_js_cb exists;
  the TSFN API is Node-API4, below the selected8. Implementation1343–1347
  explicitly requires that custom callback when func is null.
- Documentation6509–6512 describes teardown callbacks without a usable environment
  or JS callback. Such paths must reclaim native data without JavaScript success.
- Documentation6615–6616 makes a zero queue limit unbounded. The proposed finite1
  is not that mode. Documentation6687–6693 warns about main-thread blocking and
  distinguishes accepted data from closing failure.
- The thread-lifetime section requires release as the last TSFN operation;
  finalization owns associated-data reclamation. Release/closing is not drain proof.
- Documentation5876–5884 places execute on a worker and complete on the event loop.
  Documentation5839–5848 requires retaining work until complete, even cancellation;
  cancelling queued work does not replace joining a running native thread.

## Additional pinned teardown facts — 2026-10-18

- The same documentation1937–1942 specifies reverse cleanup-hook registration
  order and exact removal;2045–2050 places finalizers after manual cleanup hooks.
- The same implementation229 registers TSFN's own environment cleanup hook.
  Push251–256 decrements its thread count before returning napi_closing;
  Release277–296 separately decrements it. A closing return must NOT be followed
  by another release or any other TSFN operation. Documentation6538–6544 and
  6559–6564 explicitly prohibit further use of that potentially freed TSFN.
- Implementation426–432 calls the custom TSFN finalizer before
  EmptyQueueAndDelete299–303 invokes remaining queued callbacks with null env/JS
  callback. Finalizer-called alone therefore does NOT prove wake-queue teardown.
- Implementation498–500 invokes CloseHandlesAndMaybeDelete435–455 from TSFN's
  environment hook. A separately registered post-TSFN native cleanup hook must
  quiesce concurrent TSFN calls before that built-in hook can destroy the handle.

Design inference, not runtime proof: serialize notification-pointer/participant
ownership; a native cleanup hook latches refusal and wakes without JS success,
then prevents further calls and spends any still-owned participant exactly once.
Accepted wakes need separately accounted context references, including null-env
callbacks; actual join plus finalizer-called plus zero accepted-wake references
must precede any live-env close success. No event-thread join or forced exit follows.

## Design inference requiring real validation

A fixed native async-work join can keep pthread_join off Node's event thread.
Its native context must outlive reader, queue finalization and worker completion.
Queueing before thread creation can avoid a live-thread owner gap on queue failure;
startup state must explicitly distinguish created versus failed/no thread.
Neither declarations nor these sources prove that proposed ordering is implemented.
No public callback, forced exit, unref, detach or successful teardown receipt follows.
Actual owned positive controls and separately reached failure controls remain open.
