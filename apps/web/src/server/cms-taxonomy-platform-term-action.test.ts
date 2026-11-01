import { describe, expect, it } from 'vitest';
import { forwardCmsTaxonomyTermAction } from './cms-taxonomy-platform-term-action';
import {
  ACTION_PATH,
  CSRF,
  KEY,
  SURVIVOR_ID,
  TAXONOMY_ID,
  actionRequest,
  bindingFor,
  jsonResponse,
  termActionBody,
  termResourceFixture,
} from './cms-taxonomy-platform.test-support';

const OTHER_ID = '90000000-0000-4000-8000-000000000099';
const ok = (overrides: Readonly<Record<string, unknown>> = {}, etag?: string) =>
  jsonResponse(200, termResourceFixture(overrides), {
    etag: etag ?? `"${String(overrides.version ?? '1')}"`,
  });
const run = (
  request: Request,
  taxonomyId: string | undefined,
  ...queue: (Response | Error)[]
) => {
  const binding = bindingFor(...queue);
  return {
    binding,
    done: forwardCmsTaxonomyTermAction(request, binding, taxonomyId),
  };
};
const errorOf = async (response: Response) =>
  (await response.json()) as { code: string; details: Record<string, unknown> };

describe('CMS-03C-03 term action proxy: forwarding', () => {
  it('forwards a create to the vocabulary path with only the approved headers', async () => {
    const { binding, done } = run(actionRequest(), TAXONOMY_ID, ok());
    const response = await done;
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('etag')).toBe('"1"');
    expect(await response.json()).toEqual(termResourceFixture());
    const sent = binding.requests()[0] as Request;
    expect(sent.method).toBe('POST');
    expect(sent.url).toBe(`https://platform-api.internal${ACTION_PATH}`);
    expect(sent.headers.get('cookie')).toBe(`wj_access=a; wj_csrf=${CSRF}`);
    expect(sent.headers.get('x-csrf-token')).toBe(CSRF);
    expect(sent.headers.get('idempotency-key')).toBe(KEY);
    expect(sent.headers.get('if-match')).toBe('"2"');
    expect(await sent.json()).toEqual(termActionBody());
  });

  it('re-serializes the strict body in contract order', async () => {
    const { binding, done } = run(actionRequest(), TAXONOMY_ID, ok());
    await done;
    expect(
      Object.keys(await (binding.requests()[0] as Request).json()),
    ).toEqual([
      'taxonomyId',
      'action',
      'termKey',
      'parentId',
      'survivorId',
      'labels',
      'aliases',
      'expectedVersion',
    ]);
  });
});

describe('CMS-03C-03 term action proxy: admission (nothing reaches the Worker)', () => {
  const cases: ReadonlyArray<
    readonly [string, Request, string | undefined, number, string]
  > = [
    [
      'a GET',
      actionRequest({ method: 'GET' }),
      TAXONOMY_ID,
      400,
      'INVALID_REQUEST',
    ],
    [
      'a malformed vocabulary id',
      actionRequest(),
      'not-a-uuid',
      400,
      'INVALID_REQUEST',
    ],
    ['no vocabulary id', actionRequest(), undefined, 400, 'INVALID_REQUEST'],
    [
      'a body naming another vocabulary',
      actionRequest(),
      OTHER_ID,
      400,
      'INVALID_REQUEST',
    ],
    [
      'a query string',
      actionRequest({ url: `https://app.example.test${ACTION_PATH}?x=1` }),
      TAXONOMY_ID,
      400,
      'INVALID_REQUEST',
    ],
    [
      'a cross-origin request',
      actionRequest({ headers: { origin: 'https://evil.test' } }),
      TAXONOMY_ID,
      403,
      'TAXONOMY_FORBIDDEN',
    ],
    [
      'a missing CSRF header',
      actionRequest({ headers: { 'x-csrf-token': null } }),
      TAXONOMY_ID,
      403,
      'TAXONOMY_FORBIDDEN',
    ],
    [
      'a non-JSON body',
      actionRequest({ headers: { 'content-type': 'text/plain' } }),
      TAXONOMY_ID,
      415,
      'UNSUPPORTED_MEDIA_TYPE',
    ],
    [
      'a missing Idempotency-Key',
      actionRequest({ headers: { 'idempotency-key': null } }),
      TAXONOMY_ID,
      400,
      'INVALID_REQUEST',
    ],
    [
      'a malformed JSON body',
      actionRequest({ body: '[' }),
      TAXONOMY_ID,
      400,
      'INVALID_REQUEST',
    ],
    [
      'an oversized body',
      actionRequest({ body: JSON.stringify({ x: 'y'.repeat(300_000) }) }),
      TAXONOMY_ID,
      400,
      'INVALID_REQUEST',
    ],
    [
      'a missing If-Match',
      actionRequest({ headers: { 'if-match': null } }),
      TAXONOMY_ID,
      400,
      'INVALID_REQUEST',
    ],
    [
      'an If-Match that differs from expectedVersion',
      actionRequest({ headers: { 'if-match': '"3"' } }),
      TAXONOMY_ID,
      400,
      'INVALID_REQUEST',
    ],
    [
      'a weak If-Match',
      actionRequest({ headers: { 'if-match': 'W/"2"' } }),
      TAXONOMY_ID,
      400,
      'INVALID_REQUEST',
    ],
  ];
  it.each(cases)(
    'refuses %s',
    async (_name, request, taxonomyId, status, code) => {
      const { binding, done } = run(request, taxonomyId);
      const response = await done;
      expect(response.status).toBe(status);
      expect((await errorOf(response)).code).toBe(code);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(binding.fetch).not.toHaveBeenCalled();
    },
  );

  it('is 503 with no binding', async () => {
    const response = await forwardCmsTaxonomyTermAction(
      actionRequest(),
      undefined,
      TAXONOMY_ID,
    );
    expect(response.status).toBe(503);
  });

  const refused: ReadonlyArray<
    readonly [string, Record<string, unknown>, string]
  > = [
    [
      'a term key outside the grammar',
      termActionBody({ termKey: 'Guitar' }),
      '/termKey',
    ],
    ['an unknown action', termActionBody({ action: 'delete' }), '/action'],
    [
      'a merge without a survivor',
      termActionBody({ action: 'merge' }),
      '/survivorId',
    ],
    [
      'a survivor on a create',
      termActionBody({ survivorId: SURVIVOR_ID }),
      '/survivorId',
    ],
    ['no labels', termActionBody({ labels: [] }), '/labels'],
    [
      'a label that is not NFC',
      termActionBody({ labels: [{ locale: 'en', label: 'é' }] }),
      '/labels',
    ],
    [
      'a malformed locale',
      termActionBody({ labels: [{ locale: 'e', label: 'Guitar' }] }),
      '/labels',
    ],
    ['a malformed parent', termActionBody({ parentId: 'x' }), '/parentId'],
    [
      'too many aliases',
      termActionBody({
        aliases: Array.from({ length: 65 }, (_, i) => `alias ${i}`),
      }),
      '/aliases',
    ],
  ];
  it.each(refused)(
    'answers %s with a 422 naming only the request member',
    async (_name, body, pointer) => {
      const { binding, done } = run(actionRequest({}, body), TAXONOMY_ID);
      const response = await done;
      expect(response.status).toBe(422);
      const parsed = await errorOf(response);
      expect(parsed.code).toBe('TAXONOMY_VALIDATION_FAILED');
      expect(parsed.details.violations).toContainEqual({
        path: pointer,
        code: 'invalid',
        message: 'The value is invalid.',
      });
      expect(binding.fetch).not.toHaveBeenCalled();
    },
  );
});
