import {
  CMS_SLICE_12_OPERATION_REASONS,
  cmsCompositionCatalogCode,
  cmsSlice12ReasonStatus,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { readCmsPatternLatest } from './cms-pattern-platform-latest';
import { forwardCmsPatternVersionWrite } from './cms-pattern-platform-write';
import {
  bindingFor,
  jsonResponse,
  latestRequest,
  patternApiError,
  writeRequest,
  type PatternOperationId,
} from './cms-pattern-platform.test-support';

/** Drives the same upstream answer through both operations' real proxies. */
const OPERATIONS: ReadonlyArray<
  readonly [PatternOperationId, (upstream: Response) => Promise<Response>]
> = [
  [
    'CMS-03C-12',
    (upstream) =>
      forwardCmsPatternVersionWrite(writeRequest(), bindingFor(upstream)),
  ],
  [
    'cmsPatternLatestRead',
    (upstream) =>
      readCmsPatternLatest(
        latestRequest(),
        bindingFor(upstream),
        'profile-hero',
      ),
  ],
];
const bodyOf = async (response: Response) =>
  (await response.json()) as {
    code: string;
    message: string;
    requestId: string;
    details: Record<string, unknown>;
  };

describe.each(OPERATIONS)(
  '%s upstream refusals are relayed from the composition catalog',
  (operation, run) => {
    const statuses = [400, 401, 403, 404, 415, 429, 500, 502, 503, 504].filter(
      (status) => cmsCompositionCatalogCode(operation, status) !== null,
    );
    it.each(statuses)(
      'relays a %i with the catalog code and message only',
      async (status) => {
        const base = patternApiError(operation, status);
        const upstream = jsonResponse(status, {
          ...base,
          details: {
            ...(base.details as object),
            stack: 'at secret',
            owner: 'hidden',
          },
        });
        const response = await run(upstream);
        expect(response.status).toBe(status);
        const body = await bodyOf(response);
        expect(body.code).toBe(cmsCompositionCatalogCode(operation, status));
        expect(body.requestId).toBe('0195b6f0-0000-7000-8000-000000000001');
        expect(JSON.stringify(body)).not.toMatch(/secret|hidden/u);
        expect(response.headers.get('cache-control')).toBe('no-store');
      },
    );

    it('collapses an undeclared status to a 502', async () => {
      const response = await run(jsonResponse(418, { code: 'TEAPOT' }));
      expect(response.status).toBe(502);
      expect((await bodyOf(response)).code).toBe('DEPENDENCY_UNAVAILABLE');
    });

    it.each([
      [
        'a foreign code',
        { ...patternApiError(operation, 404), code: 'TEMPLATE_NOT_FOUND' },
      ],
      [
        'a foreign message',
        {
          ...patternApiError(operation, 404),
          message: 'Template 7 of owner 9 is missing.',
        },
      ],
    ])('collapses %s to a 502', async (_name, upstream) => {
      const response = await run(jsonResponse(404, upstream));
      expect(response.status).toBe(502);
    });

    it('projects 5xx details as the retryable composition dependency class', async () => {
      for (const status of [502, 503, 504]) {
        const response = await run(
          jsonResponse(
            status,
            patternApiError(operation, status, {
              dependencyClass: 'leaky',
              retryable: false,
            }),
          ),
        );
        expect((await bodyOf(response)).details).toEqual({
          dependencyClass: 'cms_composition',
          retryable: true,
        });
      }
    });

    it('keeps only bounded 429 hints and a safe retry-after', async () => {
      const response = await run(
        jsonResponse(
          429,
          patternApiError(operation, 429, {
            retryAfterSeconds: 7,
            limit: 30,
            resetAt: '1790000000',
            bucket: 'internal',
          }),
          { 'retry-after': '7' },
        ),
      );
      expect(response.headers.get('retry-after')).toBe('7');
      expect((await bodyOf(response)).details).toEqual({
        retryAfterSeconds: 7,
        limit: 30,
        resetAt: '1790000000',
      });
      const odd = await run(
        jsonResponse(
          429,
          patternApiError(operation, 429, {
            retryAfterSeconds: -1,
            resetAt: 'tomorrow',
          }),
          {
            'retry-after': '9999999',
          },
        ),
      );
      expect((await bodyOf(odd)).details).toEqual({});
      expect(odd.headers.get('retry-after')).toBeNull();
    });

    it('relays a typed 403 only for a token of this operation at its status', async () => {
      const ok = await run(
        jsonResponse(
          403,
          patternApiError(operation, 403, {
            reasonCode: 'capability_missing',
            note: 'x',
          }),
        ),
      );
      expect((await bodyOf(ok)).details).toEqual({
        reasonCode: 'capability_missing',
      });
      const foreign = await run(
        jsonResponse(
          403,
          patternApiError(operation, 403, {
            reasonCode: 'separation_of_duties',
          }),
        ),
      );
      expect((await bodyOf(foreign)).details).toEqual({});
    });

    it('answers a reauthenticate recovery only when the Worker said so', async () => {
      const said = await run(
        jsonResponse(
          401,
          patternApiError(operation, 401, { recoveryAction: 'reauthenticate' }),
        ),
      );
      expect((await bodyOf(said)).details).toEqual({
        recoveryAction: 'reauthenticate',
      });
      const silent = await run(
        jsonResponse(
          401,
          patternApiError(operation, 401, { recoveryAction: 'step_up' }),
        ),
      );
      expect((await bodyOf(silent)).details).toEqual({});
    });
  },
);

describe('cmsPatternLatestRead declares no write status', () => {
  const run = OPERATIONS[1]![1];
  it.each([409, 422])(
    'collapses a well-formed catalog %i, which only the write declares, to a 502',
    async (status) => {
      const response = await run(
        jsonResponse(status, patternApiError('CMS-03C-12', status)),
      );
      expect(response.status).toBe(502);
      expect((await bodyOf(response)).code).toBe('DEPENDENCY_UNAVAILABLE');
    },
  );
});

describe('CMS-03C-12 typed refusals', () => {
  const run = OPERATIONS[0]![1];
  const tokens = CMS_SLICE_12_OPERATION_REASONS['CMS-03C-12'].filter(
    (token) => token !== 'capability_missing',
  );

  it.each(tokens)('relays %s only at its one status', async (token) => {
    const status = cmsSlice12ReasonStatus(token);
    const response = await run(
      jsonResponse(
        status,
        patternApiError('CMS-03C-12', status, { reasonCode: token }),
      ),
    );
    expect(response.status).toBe(status);
    const details = (await bodyOf(response)).details;
    expect(details.reasonCode).toBe(token);
    const other = status === 409 ? 422 : 409;
    const wrong = await run(
      jsonResponse(
        other,
        patternApiError('CMS-03C-12', other, { reasonCode: token }),
      ),
    );
    expect((await bodyOf(wrong)).details.reasonCode).toBeUndefined();
  });

  it('drops a token that belongs to another operation', async () => {
    const response = await run(
      jsonResponse(
        409,
        patternApiError('CMS-03C-12', 409, { reasonCode: 'review_not_open' }),
      ),
    );
    expect((await bodyOf(response)).details).toEqual({});
  });

  it('keeps the versions of a plain compare-and-set conflict and nothing else', async () => {
    const response = await run(
      jsonResponse(
        409,
        patternApiError('CMS-03C-12', 409, {
          expectedVersion: '3',
          currentVersion: '5',
          other: 'x',
        }),
      ),
    );
    expect(await bodyOf(response)).toMatchObject({
      code: 'COMPOSITION_VERSION_CONFLICT',
      details: { expectedVersion: '3', currentVersion: '5' },
    });
    const bad = await run(
      jsonResponse(
        409,
        patternApiError('CMS-03C-12', 409, { currentVersion: '05' }),
      ),
    );
    expect((await bodyOf(bad)).details).toEqual({});
    const beyond = await run(
      jsonResponse(
        409,
        patternApiError('CMS-03C-12', 409, {
          currentVersion: '9223372036854775808',
        }),
      ),
    );
    expect((await bodyOf(beyond)).details).toEqual({});
  });

  it('relays key_reserved with its request pointer and rebuilds other 422 violations to pointers only', async () => {
    const reserved = await run(
      jsonResponse(
        422,
        patternApiError('CMS-03C-12', 422, {
          reasonCode: 'key_reserved',
          violations: [
            {
              path: '/patternKey',
              code: 'key_reserved',
              message: 'The value is invalid.',
            },
          ],
        }),
      ),
    );
    expect((await bodyOf(reserved)).details).toEqual({
      reasonCode: 'key_reserved',
      violations: [
        {
          path: '/patternKey',
          code: 'key_reserved',
          message: 'The value is invalid.',
        },
      ],
    });
    const plain = await run(
      jsonResponse(
        422,
        patternApiError('CMS-03C-12', 422, {
          violations: [
            { path: '/blockTree', code: 'secret_code', message: 'leaky' },
            { path: '/internal/owner', code: 'x', message: 'y' },
          ],
        }),
      ),
    );
    expect((await bodyOf(plain)).details).toEqual({
      violations: [
        {
          path: '/blockTree',
          code: 'invalid',
          message: 'The value is invalid.',
        },
        { path: '/', code: 'invalid', message: 'The value is invalid.' },
      ],
    });
  });
});
