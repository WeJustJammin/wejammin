import { vi } from 'vitest';

export const origin = 'https://app.example.test';
export const uuid = '123e4567-e89b-42d3-a456-426614174000';
export const uuid2 = '123e4567-e89b-42d3-a456-426614174001';
export const hash = 'a'.repeat(64);
export const draftDetailEtag = '"' + uuid + ':1:' + uuid2 + ':1:' + hash + '"';
export const instant = '2026-09-26T00:00:00Z';
export const csrf = 'csrf-token-000000000001';
export const idempotencyKey = 'idem-key-000000000001';
export const maxBodyBytes = 262_144;
/* Past the cap so the source stays open until the cancel lands. */
export const oversizeStreamTotal = maxBodyBytes * 4;

export type Handler = (input: Request) => Promise<Response>;

export const bindingWith = (handler: Handler): { fetch: Handler } => ({
  fetch: vi.fn(handler),
});

const createHeaders = (extra: Record<string, string> = {}) => ({
  cookie: 'wj_csrf=' + csrf,
  'x-csrf-token': csrf,
  'idempotency-key': idempotencyKey,
  'content-type': 'application/json',
  ...extra,
});

export const post = (
  body: BodyInit,
  extra: Record<string, string> = {},
): Request =>
  new Request(origin + '/app/cms-content-modeling/entries/new', {
    method: 'POST',
    body,
    headers: createHeaders(extra),
  });

export const postStream = (
  body: ReadableStream<Uint8Array>,
  extra: Record<string, string> = {},
): Request =>
  new Request(origin + '/app/cms-content-modeling/entries/new', {
    method: 'POST',
    body,
    duplex: 'half',
    headers: createHeaders(extra),
  } as unknown as RequestInit);

export const get = (query = ''): Request =>
  new Request(origin + '/app/cms-content-modeling/entries/' + uuid + query, {
    method: 'GET',
  });

export const repetitiveBytes = (total: number): Uint8Array =>
  new Uint8Array(total).fill(0x20);

/*
 * A closed source sized by byte count. An unbounded reader drains it to its end
 * so `wasCancelled()` stays false; only an early abandon cancels it. Chunks are
 * produced on demand from `pull`: a `start`-based source would close the whole
 * body before the first read resolves, making the cancellation unreachable.
 */
export const observedStream = (
  total: number,
): {
  readonly stream: ReadableStream<Uint8Array>;
  readonly wasCancelled: () => boolean;
} => {
  let cancelled = false;
  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= total) {
        controller.close();
        return;
      }
      const size = Math.min(total - sent, 65_536);
      controller.enqueue(repetitiveBytes(size));
      sent += size;
    },
    cancel() {
      cancelled = true;
    },
  });
  return { stream, wasCancelled: () => cancelled };
};

export const policy = {
  key: 'editorial.standard',
  version: '1',
  policyHash: hash,
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  requiredCapabilities: [],
  approvalEvidenceHash: hash,
} as const;

export const createRequest = (title: string) => ({
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

export const validCreateBody = JSON.stringify(createRequest('Hello'));

/** A create body padded by `pad` characters but still schema-valid. */
export const paddedCreateBody = (pad: number): string =>
  JSON.stringify(createRequest('Hello' + 'x'.repeat(pad)));

export const validCreateResource = {
  entry: { id: uuid, version: '1', createdAt: instant, updatedAt: instant },
  revision: { id: uuid2, version: '1', createdAt: instant, updatedAt: instant },
  revisionNumber: '1',
  lifecycle: 'active',
  state: 'draft',
  locale: 'en-US',
  contentHash: hash,
  validationState: 'valid',
} as const;

export const draftDetailWith = (value: string) => ({
  entry: { id: uuid, version: '1', createdAt: instant, updatedAt: instant },
  revision: { id: uuid2, version: '1', createdAt: instant, updatedAt: instant },
  revisionNumber: '1',
  lifecycle: 'active',
  state: 'draft',
  locale: 'en-US',
  contentHash: hash,
  schemaVersionId: uuid2,
  validationState: 'valid',
  openConflict: null,
  fields: [
    {
      fieldId: uuid,
      fieldDefinitionId: uuid2,
      locale: 'en-US',
      value,
      provenance: 'authored',
      valueHash: null,
    },
  ],
  relations: [],
});

export const jsonResponse = (body: unknown, init: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      etag: '"1"',
      ...(init.headers ?? {}),
    },
  });

export const streamedResponse = (
  stream: ReadableStream<Uint8Array>,
  headers: Record<string, string>,
): Response =>
  new Response(stream, {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  });

export const errorCode = async (response: Response): Promise<unknown> =>
  ((await response.json()) as { code?: unknown }).code;
