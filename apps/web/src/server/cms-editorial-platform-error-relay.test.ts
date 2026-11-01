import {
  ApiErrorSchema,
  editorialDraftDetailErrors,
  editorialEntryCreateErrors,
  editorialRevisionErrors,
  editorialRevisionHistoryErrors,
  editorialConflictResolutionErrors,
  editorialRestoreErrors,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { cmsEditorialForwardedError } from './cms-editorial-platform-bounded';
import { forwardCmsEditorialEntryDraftDetailRead } from './cms-editorial-platform-reads';
import { cmsEditorialLocalError } from './cms-editorial-platform-shared';

const request = new Request('https://app.example.test/api/v1/cms/entries');
const entryId = '123e4567-e89b-42d3-a456-426614174000';
const requestId = '123e4567-e89b-42d3-a456-426614174001';

const upstreamError = (status: number, code: string): Response =>
  Response.json(
    {
      code,
      message: 'Upstream diagnostic that must not survive a mismatch.',
      details: {},
      requestId,
    },
    {
      status,
      headers: { 'cache-control': 'public, max-age=3600' },
    },
  );

const errorBody = async (response: Response) =>
  ApiErrorSchema.parse(await response.json());

describe('CMS editorial first-party error relay (BE03b)', () => {
  const mutationMaps = [
    editorialEntryCreateErrors,
    editorialRevisionErrors,
    editorialConflictResolutionErrors,
    editorialRestoreErrors,
  ] as const;

  it.each(mutationMaps)(
    'replaces a contradictory 403 code with a local, no-store denial',
    async (allowedErrors) => {
      const response = await cmsEditorialForwardedError(
        request,
        upstreamError(403, 'INTERNAL_ERROR'),
        allowedErrors,
      );
      expect(response.status).toBe(403);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const body = await errorBody(response);
      expect(body.code).toBe('FORBIDDEN');
      expect(body.message).toBe('You do not have permission for this entry.');
      expect(JSON.stringify(body)).not.toContain('Upstream diagnostic');
    },
  );

  it('preserves a genuine registered history conflict', async () => {
    const response = await cmsEditorialForwardedError(
      request,
      upstreamError(409, 'CONFLICT'),
      editorialRevisionHistoryErrors,
    );
    expect(response.status).toBe(409);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await errorBody(response)).code).toBe('CONFLICT');
  });

  it('refuses an unregistered status even when the envelope parses', async () => {
    const response = await cmsEditorialForwardedError(
      request,
      upstreamError(418, 'CONFLICT'),
      editorialRevisionErrors,
    );
    expect(response.status).toBe(502);
    expect((await errorBody(response)).code).toBe('DEPENDENCY_UNAVAILABLE');
  });

  it('does not relay a history-only conflict from the draft-detail route', async () => {
    const response = await forwardCmsEditorialEntryDraftDetailRead(
      new Request(`https://app.example.test/api/v1/cms/entries/${entryId}`),
      { fetch: async () => upstreamError(409, 'CONFLICT') },
      entryId,
    );
    expect(response.status).toBe(502);
    expect((await errorBody(response)).code).toBe('DEPENDENCY_UNAVAILABLE');
  });

  it('accepts the draft-detail denial declared by its own error map', async () => {
    const response = await cmsEditorialForwardedError(
      request,
      upstreamError(404, 'NOT_FOUND'),
      editorialDraftDetailErrors,
    );
    expect(response.status).toBe(404);
    expect((await errorBody(response)).code).toBe('NOT_FOUND');
  });

  it('relays an upstream 502 DEPENDENCY_UNAVAILABLE with its fixed invalid-data copy and allowlisted details (BE00:172)', async () => {
    for (const allowedErrors of [
      ...mutationMaps,
      editorialDraftDetailErrors,
      editorialRevisionHistoryErrors,
    ]) {
      const response = await cmsEditorialForwardedError(
        request,
        Response.json(
          {
            code: 'DEPENDENCY_UNAVAILABLE',
            message: 'provider-x said: connection reset',
            details: {
              dependencyClass: 'cms_editorial',
              retryable: true,
              vendor: 'provider-x',
            },
            requestId,
          },
          { status: 502 },
        ),
        allowedErrors,
      );
      expect(response.status).toBe(502);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await errorBody(response)).toEqual({
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'The entry service returned invalid data.',
        details: { dependencyClass: 'cms_editorial', retryable: true },
        requestId,
      });
    }
  });

  it('keeps the 503 copy and refuses 502 on a code the route does not declare for it', async () => {
    const unavailable = await cmsEditorialForwardedError(
      request,
      upstreamError(503, 'DEPENDENCY_UNAVAILABLE'),
      editorialRevisionErrors,
    );
    expect(unavailable.status).toBe(503);
    expect((await errorBody(unavailable)).message).toBe(
      'The entry service is temporarily unavailable.',
    );
    // BE00 defines no BAD_GATEWAY: an upstream that still names it is not a
    // declared (code, status) pair and collapses to the local safe 502.
    const retired = await cmsEditorialForwardedError(
      request,
      upstreamError(502, 'BAD_GATEWAY'),
      editorialRevisionErrors,
    );
    expect(retired.status).toBe(502);
    expect(await errorBody(retired)).toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'The entry service returned invalid data.',
      details: { dependencyClass: 'cms_editorial', retryable: true },
    });
  });

  it('answers a local 502 as DEPENDENCY_UNAVAILABLE with the retryable cms_editorial dependency, and 503 and 504 as before', async () => {
    expect(await errorBody(cmsEditorialLocalError(request, 502))).toMatchObject(
      {
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'The entry service returned invalid data.',
        details: { dependencyClass: 'cms_editorial', retryable: true },
      },
    );
    const unavailable = await errorBody(cmsEditorialLocalError(request, 503));
    expect(unavailable.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(unavailable.message).toBe(
      'The entry service is temporarily unavailable.',
    );
    expect(unavailable.details).toEqual({});
    const timeout = await errorBody(cmsEditorialLocalError(request, 504));
    expect(timeout.code).toBe('GATEWAY_TIMEOUT');
    expect(timeout.message).toBe('The entry service did not respond in time.');
    expect(timeout.details).toEqual({});
  });
});
