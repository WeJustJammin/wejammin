import { describe, expect, it, vi } from 'vitest';

import {
  cmsEditorialBoundedRequestJson,
  cmsEditorialBoundedResponseJson,
  cmsPatternPlacementBoundedResponseJson,
} from './cms-editorial-platform-bounded';
import { forwardCmsEditorialEntryCreateMutation } from './cms-editorial-platform-mutation';
import { forwardCmsEditorialEntryDraftDetailRead } from './cms-editorial-platform-reads';

/*
 * The bounded readers decode with a fatal UTF-8 decoder. A non-fatal decode
 * would turn an invalid byte sequence into U+FFFD and let that replacement
 * character survive into a parsed draft value, so a corrupt upload could be
 * accepted as if it were a valid string. These cases pin the fatal behavior
 * directly on the readers and through the two proxies that consume them.
 */

const origin = 'https://app.example.test';
const uuid = '123e4567-e89b-42d3-a456-426614174000';
const uuid2 = '123e4567-e89b-42d3-a456-426614174001';
const hash = 'a'.repeat(64);
const instant = '2026-09-26T00:00:00Z';
const csrf = 'csrf-token-000000000001';
const idempotencyKey = 'idem-key-000000000001';

const encoder = new TextEncoder();

/*
 * Splice a raw invalid byte (0xFF never appears in valid UTF-8) into the middle
 * of a single-character-aligned anchor inside an otherwise valid JSON document,
 * producing bytes that are only decodable if the decoder is non-fatal.
 */
const malformedUtf8 = (json: string, anchor: string): ArrayBuffer => {
  const at = json.indexOf(anchor);
  if (at < 0) throw new Error('anchor missing from fixture');
  const bytes = new Uint8Array([
    ...encoder.encode(json.slice(0, at)),
    ...encoder.encode('Hel'),
    0xff,
    ...encoder.encode('lo'),
    ...encoder.encode(json.slice(at + anchor.length)),
  ]);
  return bytes.buffer as ArrayBuffer;
};

const policy = {
  key: 'editorial.standard',
  version: '1',
  policyHash: hash,
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  requiredCapabilities: [],
  approvalEvidenceHash: hash,
} as const;

const createRequest = (title: string) => ({
  contentTypeId: uuid,
  contentTypeVersionId: uuid2,
  locale: 'en-US',
  changedPaths: [`/fields/${uuid2}`],
  values: { [uuid2]: { title } },
  schemaArtifact: {
    id: uuid,
    contentTypeVersionId: uuid2,
    artifactHash: hash,
    compilerVersion: '1.0.0',
    zodContractRef: '03a.content-type-version.v1',
  },
  validatorRefs: [{ key: 'sanitize.rich_text', version: '3' }],
  workflowPolicy: policy,
  activationEvidence: policy,
});

const validCreateBody = JSON.stringify(createRequest('Hello'));

const validCreateResource = {
  entry: { id: uuid, version: '1', createdAt: instant, updatedAt: instant },
  revision: { id: uuid2, version: '1', createdAt: instant, updatedAt: instant },
  revisionNumber: '1',
  lifecycle: 'active',
  state: 'draft',
  locale: 'en-US',
  contentHash: hash,
  validationState: 'valid',
} as const;

const draftDetailBody = JSON.stringify({
  entry: { id: uuid, version: '1', createdAt: instant, updatedAt: instant },
  revision: { id: uuid2, version: '1', createdAt: instant, updatedAt: instant },
  lifecycle: 'active',
  state: 'draft',
  locale: 'en-US',
  contentHash: hash,
  validationState: 'valid',
  fields: [
    {
      fieldId: uuid,
      fieldDefinitionId: uuid2,
      locale: 'en-US',
      value: 'Hello',
      provenance: 'authored',
      valueHash: null,
    },
  ],
  relations: [],
});

const jsonResponse = (body: unknown, init: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });

describe('cms-editorial bounded reader UTF-8 strictness', () => {
  it('refuses an inbound request whose bytes are not valid UTF-8', async () => {
    const request = new Request(
      origin + '/app/cms-content-modeling/entries/new',
      {
        method: 'POST',
        body: malformedUtf8(validCreateBody, 'Hello'),
        headers: { 'content-type': 'application/json' },
      },
    );
    const read = await cmsEditorialBoundedRequestJson(request);
    expect(read.ok).toBe(false);
  });

  it('refuses an upstream body whose bytes are not valid UTF-8', async () => {
    const response = new Response(malformedUtf8(draftDetailBody, 'Hello'), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    const read = await cmsEditorialBoundedResponseJson(response);
    expect(read.ok).toBe(false);
  });

  it('still decodes valid multi-byte UTF-8 without loss', async () => {
    const title = 'Héllo — 😀 🎵';
    const request = new Request(
      origin + '/app/cms-content-modeling/entries/new',
      {
        method: 'POST',
        body: JSON.stringify({ title }),
        headers: { 'content-type': 'application/json' },
      },
    );
    const read = await cmsEditorialBoundedRequestJson(request);
    expect(read.ok).toBe(true);
    const value = read.ok ? (read.value as { title?: unknown }).title : null;
    expect(value).toBe(title);
  });
});

describe('cms-editorial proxies refuse malformed UTF-8', () => {
  it('refuses a create whose body carries an invalid UTF-8 byte', async () => {
    const handler = vi.fn(async () =>
      jsonResponse(validCreateResource, {
        status: 201,
        headers: { location: '/api/v1/cms/entries/' + uuid },
      }),
    );
    const response = await forwardCmsEditorialEntryCreateMutation(
      new Request(origin + '/app/cms-content-modeling/entries/new', {
        method: 'POST',
        body: malformedUtf8(validCreateBody, 'Hello'),
        headers: {
          cookie: 'wj_csrf=' + csrf,
          'x-csrf-token': csrf,
          'idempotency-key': idempotencyKey,
          'content-type': 'application/json',
        },
      }),
      { fetch: handler },
    );
    expect(response.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it('refuses a draft-detail 200 whose body carries an invalid UTF-8 byte', async () => {
    const response = await forwardCmsEditorialEntryDraftDetailRead(
      new Request(origin + '/app/cms-content-modeling/entries/' + uuid, {
        method: 'GET',
      }),
      {
        fetch: async () =>
          new Response(malformedUtf8(draftDetailBody, 'Hello'), {
            status: 200,
            headers: { 'content-type': 'application/json', etag: '"7"' },
          }),
      },
      uuid,
    );
    expect(response.status).toBe(502);
  });
});

/*
 * DEC-188/DEC-189: the CMS-03C-02 success reader is the one response ceiling
 * exception at 1 MiB. It shares the ordinary reader's fatal UTF-8 decode and
 * over-cap refusal/cancel, and leaves the ordinary response reader at 256 KiB.
 */
const streamOf = (chunks: readonly Uint8Array[], contentLength?: number) => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  const headers = new Headers({ 'content-type': 'application/json' });
  if (contentLength !== undefined)
    headers.set('content-length', String(contentLength));
  return new Response(body, { status: 200, headers });
};

const paddedJson = (totalBytes: number): Uint8Array[] => {
  const enc = new TextEncoder();
  const prefix = '{"pad":"';
  const suffix = '"}';
  return [
    enc.encode(prefix),
    enc.encode('x'.repeat(totalBytes - prefix.length - suffix.length)),
    enc.encode(suffix),
  ];
};

describe('cmsPatternPlacementBoundedResponseJson budget', () => {
  it('accepts exactly 1 MiB and refuses one byte over', async () => {
    const exact = await cmsPatternPlacementBoundedResponseJson(
      streamOf(paddedJson(1_048_576)),
    );
    expect(exact.ok).toBe(true);
    const over = await cmsPatternPlacementBoundedResponseJson(
      streamOf(paddedJson(1_048_577)),
    );
    expect(over.ok).toBe(false);
  });

  it('refuses a declared length over the budget and cancels an over-cap stream', async () => {
    const declared = await cmsPatternPlacementBoundedResponseJson(
      streamOf(paddedJson(64), 1_048_577),
    );
    expect(declared.ok).toBe(false);
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"pad":"'));
        controller.enqueue(new Uint8Array(1_048_600));
      },
      cancel() {
        cancelled = true;
      },
    });
    const streamed = await cmsPatternPlacementBoundedResponseJson(
      new Response(body, { status: 200 }),
    );
    expect(streamed.ok).toBe(false);
    expect(cancelled).toBe(true);
  });

  it('decodes fatal UTF-8 and leaves the ordinary response reader at 256 KiB', async () => {
    const bad = new Response(new Uint8Array([0x7b, 0x22, 0xff, 0x22, 0x7d]), {
      status: 200,
    });
    expect((await cmsPatternPlacementBoundedResponseJson(bad)).ok).toBe(false);
    const within = new Response(JSON.stringify({ ok: true }), { status: 200 });
    expect((await cmsEditorialBoundedResponseJson(within)).ok).toBe(true);
    const over = new Response(new Uint8Array(262_145), { status: 200 });
    expect((await cmsEditorialBoundedResponseJson(over)).ok).toBe(false);
  });
});
