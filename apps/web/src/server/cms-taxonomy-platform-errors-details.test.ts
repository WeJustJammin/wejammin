import { describe, expect, it } from 'vitest';
import { relayTaxonomyError } from './cms-taxonomy-platform-errors';
import {
  TAXONOMY_ID,
  jsonResponse,
  readRequest,
  taxonomyApiError,
  VERSIONS_PATH,
  type TaxonomyOperationId,
} from './cms-taxonomy-platform.test-support';

const request = readRequest(VERSIONS_PATH);
const relay = (
  operation: TaxonomyOperationId,
  status: number,
  details: Readonly<Record<string, unknown>> = {},
  headers: Readonly<Record<string, string>> = {},
) =>
  relayTaxonomyError(
    request,
    jsonResponse(status, taxonomyApiError(operation, status, details), headers),
    operation,
  );
const detailsOf = async (response: Response) =>
  ((await response.json()) as { details: Record<string, unknown> }).details;

describe('taxonomy relay: violations, rate hints, dependency, session', () => {
  it('rebuilds a 422 from the operation pointers; an attacker path becomes /', async () => {
    const violation = (path: string) => ({
      path,
      code: 'bad',
      message: 'Echoed text',
    });
    expect(
      await detailsOf(
        await relay('CMS-03C-16', 422, {
          violations: [
            violation('/allowedFieldKeys'),
            violation('/shape'),
            violation('/etc/passwd'),
            violation('/shape'),
          ],
        }),
      ),
    ).toEqual({
      violations: [
        { path: '/shape', code: 'invalid', message: 'The value is invalid.' },
        {
          path: '/allowedFieldKeys',
          code: 'invalid',
          message: 'The value is invalid.',
        },
        { path: '/', code: 'invalid', message: 'The value is invalid.' },
      ],
    });
  });

  it('knows the term-action and selector pointers', async () => {
    const v = (path: string) => ({ path, code: 'bad', message: 'm' });
    const paths = async (op: TaxonomyOperationId, list: string[]) =>
      (
        (await detailsOf(await relay(op, 422, { violations: list.map(v) })))
          .violations as { path: string }[]
      ).map((e) => e.path);
    expect(await paths('CMS-03C-03', ['/survivorId', '/termKey'])).toEqual([
      '/termKey',
      '/survivorId',
    ]);
    expect(
      await paths('CMS-03C-17', ['/locale', '/typeKey', '/fieldKey', '/shape']),
    ).toEqual(['/typeKey', '/fieldKey', '/locale', '/']);
  });

  it('drops violations that are not a list', async () => {
    expect(
      await detailsOf(await relay('CMS-03C-16', 422, { violations: 'x' })),
    ).toEqual({});
  });

  it('relays bounded rate hints and a valid reset instant only', async () => {
    const details = await detailsOf(
      await relay('CMS-03C-03', 429, {
        retryAfterSeconds: 12,
        limit: 30,
        resetAt: '1760000000',
        junk: 1,
      }),
    );
    expect(details).toMatchObject({ retryAfterSeconds: 12, limit: 30 });
    expect(Object.keys(details).sort()).not.toContain('junk');
    expect(
      await detailsOf(
        await relay('CMS-03C-03', 429, { retryAfterSeconds: -1, limit: 1.5 }),
      ),
    ).toEqual({});
  });

  it('publishes the dependency member on 502, 503 and 504 whatever the upstream said', async () => {
    for (const status of [502, 503, 504])
      expect(
        await detailsOf(
          await relay('CMS-03C-16', status, {
            retryable: false,
            dependencyClass: 'x',
          }),
        ),
      ).toEqual({ dependencyClass: 'cms_composition', retryable: true });
  });

  it('publishes the reauthenticate recovery on a 401 only when the upstream named it', async () => {
    expect(
      await detailsOf(
        await relay('CMS-03C-16', 401, { recoveryAction: 'reauthenticate' }),
      ),
    ).toEqual({ recoveryAction: 'reauthenticate' });
    expect(
      await detailsOf(
        await relay('CMS-03C-16', 401, {
          recoveryAction: 'step_up',
          allowedMethods: ['totp'],
        }),
      ),
    ).toEqual({});
  });

  it('publishes the media hint on a 415', async () => {
    expect(await detailsOf(await relay('CMS-03C-16', 415))).toEqual({
      allowedMediaTypes: ['application/json'],
    });
  });
});

describe('taxonomy relay: integrity of the relayed error', () => {
  it('collapses an undeclared status of the operation to a local 502', async () => {
    const response = await relay('cmsTaxonomyVersionsRead', 409);
    expect(response.status).toBe(502);
    expect(((await response.json()) as { code: string }).code).toBe(
      'DEPENDENCY_UNAVAILABLE',
    );
    expect((await relay('cmsTaxonomyTermsRead', 422)).status).toBe(502);
    expect((await relay('cmsTaxonomyTermsRead', 409)).status).toBe(409);
    expect((await relay('CMS-03C-17', 422)).status).toBe(422);
  });

  it('collapses a wrong code, a wrong message, a non-ApiError and a non-JSON body to a local 502', async () => {
    const good = taxonomyApiError('CMS-03C-16', 404);
    for (const body of [
      { ...good, code: 'TEMPLATE_NOT_FOUND' },
      { ...good, message: 'The taxonomy secret-id was not found.' },
      { ...good, extra: true },
      { nope: true },
    ]) {
      const response = await relayTaxonomyError(
        request,
        jsonResponse(404, body),
        'CMS-03C-16',
      );
      expect(response.status).toBe(502);
    }
    expect(
      (
        await relayTaxonomyError(
          request,
          new Response('nope', { status: 404 }),
          'CMS-03C-16',
        )
      ).status,
    ).toBe(502);
  });

  it('collapses the composition catalog code of the same status to a local 502', async () => {
    const composition = {
      code: 'COMPOSITION_NOT_FOUND',
      message:
        'COMPOSITION_NOT_FOUND: composition operation rejected or unavailable.',
      details: {},
      requestId: taxonomyApiError('CMS-03C-16', 404).requestId,
    };
    expect(
      (
        await relayTaxonomyError(
          request,
          jsonResponse(404, composition),
          'CMS-03C-16',
        )
      ).status,
    ).toBe(502);
  });

  it('strips the headers a refusal must not carry', async () => {
    const response = await relay(
      'CMS-03C-16',
      404,
      {},
      {
        location: '/x',
        etag: '"1"',
        'ratelimit-limit': '5',
        'retry-after': '5',
        'x-internal': 'secret',
      },
    );
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('etag')).toBeNull();
    expect(response.headers.get('ratelimit-limit')).toBeNull();
    expect(response.headers.get('retry-after')).toBeNull();
    expect(response.headers.get('x-internal')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toBe(
      taxonomyApiError('CMS-03C-16', 404).requestId,
    );
  });

  it('keeps a well-formed Retry-After on a 429 and drops a malformed one', async () => {
    expect(
      (
        await relay(
          'CMS-03C-16',
          429,
          {},
          { 'retry-after': '7', 'ratelimit-limit': '5' },
        )
      ).headers.get('retry-after'),
    ).toBe('7');
    expect(
      (
        await relay('CMS-03C-16', 429, {}, { 'retry-after': 'soon' })
      ).headers.get('retry-after'),
    ).toBeNull();
    expect(
      (
        await relay('CMS-03C-16', 429, {}, { 'ratelimit-limit': '5' })
      ).headers.get('ratelimit-limit'),
    ).toBe('5');
  });

  it('names no vocabulary id anywhere', async () => {
    const response = await relay('CMS-03C-03', 404);
    expect(JSON.stringify(await response.json())).not.toContain(TAXONOMY_ID);
  });
});
