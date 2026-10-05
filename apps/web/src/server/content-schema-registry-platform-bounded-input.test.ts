import { expect, it, vi } from 'vitest';

import { JSON_VALUE_MAX_BYTES } from '@wejammin/contracts';

import {
  CMS_REGISTRY_MAX_BODY_BYTES,
  contentSchemaRegistryMutationOperationFromJsonText,
  readBoundedMutationBody,
} from './content-schema-registry-platform-bounded-input';
import { forwardContentSchemaRegistryMutation } from './content-schema-registry-platform-api';
import { contentSchemaRegistryMutationOperationFromRequest } from './content-schema-registry-platform-mutation';

/*
 * CMS-03A bounded mutation input (RED): the registry mutation facade must
 * apply the same 256 KiB ceiling every other first-party CMS boundary already
 * applies. A declared oversize length is refused before the body is touched,
 * a headerless oversize stream is cancelled at the ceiling instead of being
 * buffered, and the whole body is read exactly once — neither the facade nor
 * the native page helpers may parse a second clone of the request body.
 *
 * The transport helpers used here do not exist yet; importing them is part of
 * the RED contract. GREEN replaces request.clone() in
 * content-schema-registry-platform-input.ts and
 * content-schema-registry-platform-mutation.ts with a single bounded read.
 */

const origin = 'https://app.test';
const TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
const UUID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const HASH = 'a'.repeat(64);
const INSTANT = '2026-09-02T12:00:00.000Z';

const transportHeaders = {
  cookie: 'wj_access=session; wj_csrf=csrf',
  origin,
  'x-csrf-token': 'csrf',
  'idempotency-key': 'cms-operation-123',
};

const validField = {
  key: 'title',
  kind: 'short_text',
  constraints: {},
  required: true,
  validatorKey: null,
  validatorVersion: null,
  defaultMode: 'none',
  localizationMode: 'none',
  editorConfig: { label: 'Title', order: 0 },
  lifecycle: 'active',
  migrationPlanId: null,
} as const;

const assignment = {
  action: 'create',
  expectedVersion: '2',
  reviewerPersonId: UUID,
  expiresAt: '2026-10-05T12:00:00Z',
} as const;

const fieldResource = {
  id: UUID,
  version: '5',
  contentHash: HASH,
  createdAt: INSTANT,
  updatedAt: INSTANT,
  resourceKind: 'field_definition_version',
  contentTypeVersionId: VERSION_ID,
  stableFieldId: UUID,
  key: 'title',
  kind: 'short_text',
  required: true,
  validatorKey: null,
  validatorVersion: null,
  defaultMode: 'none',
  localizationMode: 'none',
  lifecycle: 'active',
  migrationPlanId: null,
} as const;

/** A closed source sized by byte count, counting pulls and cancels. */
const observedSource = (total: number) => {
  let pulled = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (pulled >= total) {
          controller.close();
          return;
        }
        const size = Math.min(total - pulled, 65_536);
        pulled += size;
        controller.enqueue(new Uint8Array(size).fill(0x20));
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  return { stream, pulled: () => pulled, cancelled: () => cancelled };
};

const post = (body: BodyInit, extra: Record<string, string> = {}): Request =>
  new Request(origin + '/app/cms-content-modeling', {
    method: 'POST',
    body,
    headers: {
      ...transportHeaders,
      'content-type': 'application/json',
      ...extra,
    },
  });

const postStream = (
  stream: ReadableStream<Uint8Array>,
  extra: Record<string, string> = {},
): Request =>
  new Request(origin + '/app/cms-content-modeling', {
    method: 'POST',
    body: stream,
    duplex: 'half',
    headers: {
      ...transportHeaders,
      'content-type': 'application/json',
      ...extra,
    },
  } as RequestInit);

/** A closed source carrying exactly `text`, counting pulls and cancels. */
const observedTextSource = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let pulled = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (pulled >= bytes.byteLength) {
          controller.close();
          return;
        }
        const size = Math.min(bytes.byteLength - pulled, 65_536);
        controller.enqueue(bytes.slice(pulled, pulled + size));
        pulled += size;
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  return { stream, pulled: () => pulled, cancelled: () => cancelled };
};

const jsonResponse = (body: unknown, status = 201): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', etag: '"5"' },
  });

it('pins the locked 256 KiB mutation ceiling', () => {
  expect(CMS_REGISTRY_MAX_BODY_BYTES).toBe(262_144);
  expect(CMS_REGISTRY_MAX_BODY_BYTES).toBe(JSON_VALUE_MAX_BYTES);
});

it('refuses an unscoped read at the locked 262144-byte ceiling', async () => {
  const source = observedTextSource(
    'x'.repeat(CMS_REGISTRY_MAX_BODY_BYTES + 1),
  );
  const request = postStream(source.stream);
  const outcome = await readBoundedMutationBody(request);
  expect(outcome).toStrictEqual({ ok: false, reason: 'too-large' });
  // The source emits 65536-byte chunks, so the ceiling is crossed by the
  // final 1-byte chunk; the read pulls it and then cancels the stream.
  expect(source.pulled()).toBe(CMS_REGISTRY_MAX_BODY_BYTES + 1);
  expect(source.cancelled()).toBe(true);
});

it('memoizes one bounded read per request via the WeakMap cache', async () => {
  const text = JSON.stringify(validField);
  const source = observedTextSource(text);
  const request = postStream(source.stream);
  const first = readBoundedMutationBody(request);
  const second = readBoundedMutationBody(request);
  expect(second).toBe(first);
  const [a, b] = await Promise.all([first, second]);
  expect(a).toBe(b);
  if (a.ok) {
    expect(a.bytes.byteLength).toBe(text.length);
  }
  expect(source.cancelled()).toBe(false);
  expect(source.pulled()).toBe(text.length);
});

it('refuses an oversize declared body without pulling the stream', async () => {
  const fetch = vi.fn(async () => jsonResponse(fieldResource));
  const source = observedSource(JSON_VALUE_MAX_BYTES);
  const request = postStream(source.stream, {
    'content-length': String(JSON_VALUE_MAX_BYTES + 1),
  });
  const response = await forwardContentSchemaRegistryMutation(
    request,
    { fetch },
    {
      operationId: 'CMS-03A-02',
      contentTypeId: TYPE_ID,
      versionId: VERSION_ID,
    },
  );
  expect(response.status).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
  expect(source.pulled()).toBe(0);
  expect(source.cancelled()).toBe(false);
});

it('refuses and cancels a headerless oversize stream at the ceiling', async () => {
  const fetch = vi.fn(async () => jsonResponse(fieldResource));
  const source = observedSource(JSON_VALUE_MAX_BYTES + 65_536);
  const response = await forwardContentSchemaRegistryMutation(
    postStream(source.stream),
    { fetch },
    {
      operationId: 'CMS-03A-02',
      contentTypeId: TYPE_ID,
      versionId: VERSION_ID,
    },
  );
  expect(response.status).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
  // The read cancels on the chunk that crosses the ceiling, so one overflow
  // chunk is pulled but never buffered; nothing is read after it.
  expect(source.pulled()).toBe(JSON_VALUE_MAX_BYTES + 65_536);
  expect(source.cancelled()).toBe(true);
});

it('consumes one valid body exactly once', async () => {
  let forwarded: Request | null = null;
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    forwarded = input instanceof Request ? input : new Request(input);
    return jsonResponse(fieldResource);
  });
  const source = observedTextSource(JSON.stringify(validField));
  const response = await forwardContentSchemaRegistryMutation(
    postStream(source.stream, { 'if-match': '"2"' }),
    { fetch },
    {
      operationId: 'CMS-03A-02',
      contentTypeId: TYPE_ID,
      versionId: VERSION_ID,
    },
  );
  expect(response.status).toBe(201);
  expect(source.pulled()).toBe(JSON.stringify(validField).length);
  expect(source.cancelled()).toBe(false);
  let capturedBody: Request | undefined = undefined;
  const candidate: unknown = forwarded;
  if (candidate instanceof Request) capturedBody = candidate;
  expect(JSON.stringify(await capturedBody?.clone().json())).toEqual(
    JSON.stringify(validField),
  );
});

it('returns null for a native page probe whose declared body is oversize, without pulling it', async () => {
  const source = observedSource(JSON_VALUE_MAX_BYTES);
  const request = postStream(source.stream, {
    'content-length': String(JSON_VALUE_MAX_BYTES + 1),
  });
  expect(
    await contentSchemaRegistryMutationOperationFromRequest(request),
  ).toBeNull();
  expect(source.pulled()).toBe(0);
  expect(source.cancelled()).toBe(false);
});

it('parses the native page input from one bounded value', async () => {
  const bytes = new TextEncoder().encode(
    JSON.stringify({ operationId: 'CMS-03A-14', ...assignment }),
  );
  const request = post(new Uint8Array(bytes), {
    'if-match': '"2"',
  });
  const read = await readBoundedMutationBody(request);
  expect(read.ok).toBe(true);
  if (!read.ok) return;
  expect(
    (await contentSchemaRegistryMutationOperationFromJsonText(
      new TextDecoder().decode(read.bytes),
    )) ?? null,
  ).toBe('CMS-03A-14');
});
