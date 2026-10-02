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
    expect((await errorBody(response)).code).toBe('BAD_GATEWAY');
  });

  it('does not relay a history-only conflict from the draft-detail route', async () => {
    const response = await forwardCmsEditorialEntryDraftDetailRead(
      new Request(`https://app.example.test/api/v1/cms/entries/${entryId}`),
      { fetch: async () => upstreamError(409, 'CONFLICT') },
      entryId,
    );
    expect(response.status).toBe(502);
    expect((await errorBody(response)).code).toBe('BAD_GATEWAY');
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
});
