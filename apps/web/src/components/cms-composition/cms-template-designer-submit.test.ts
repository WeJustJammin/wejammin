import { describe, expect, it, vi } from 'vitest';

import {
  submitCmsTemplateDraft,
  submitCmsTemplateSuccessorDraft,
  type CmsTemplateSubmitResult,
} from './cms-template-designer-submit';

const TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const TEMPLATE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
const HASH = 'a'.repeat(64);
const body = {
  templateKey: 'release-note',
  compatibleTypeIds: [TYPE_ID],
  slots: [],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  bindings: {},
  locale: 'en-US',
  audience: 'public',
  expectedVersion: null,
};
const resource = {
  id: TEMPLATE_ID,
  version: '1',
  contentHash: HASH,
  createdAt: '2026-09-27T12:00:00.000Z',
  updatedAt: '2026-09-27T12:00:00.000Z',
  state: 'draft',
  templateKey: 'release-note',
  templateVersion: 1,
  compatibleTypeIds: [TYPE_ID],
  reservedRegions: body.reservedRegions,
  blockRegistryDigest: HASH,
};
const apiError = (code: string) => ({
  code,
  message: 'Private provider detail must not reach the form.',
  requestId: '50000000-0000-4000-8000-000000000005',
  details: {},
});

describe('CMS-11 first-party draft submission', () => {
  it('posts a validated create with CSRF and stable idempotency, then accepts only an authoritative resource', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(resource, {
        status: 201,
        headers: { etag: '"1"' },
      }),
    );
    const result = await submitCmsTemplateDraft(
      body,
      'csrf-token',
      'draft-attempt-001',
      fetcher,
    );
    expect(result).toEqual({ kind: 'created', resource });
    expect(fetcher).toHaveBeenCalledOnce();
    const [path, init] = fetcher.mock.calls[0]!;
    expect(path).toBe('/api/v1/cms/templates/versions');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('same-origin');
    expect(new Headers(init?.headers).get('x-csrf-token')).toBe('csrf-token');
    expect(new Headers(init?.headers).get('idempotency-key')).toBe(
      'draft-attempt-001',
    );
    expect(new Headers(init?.headers).has('if-match')).toBe(false);
    expect(JSON.parse(String(init?.body))).toEqual(body);
  });

  it('keeps conflicts distinct from an unknown outcome and scrubs provider text', async () => {
    const conflict = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(apiError('TEMPLATE_VERSION_CONFLICT'), { status: 409 }),
      );
    expect(
      await submitCmsTemplateDraft(
        body,
        'csrf-token',
        'draft-attempt-001',
        conflict,
      ),
    ).toEqual({ kind: 'conflict', status: 409 });

    const failed = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('offline'));
    const result: CmsTemplateSubmitResult = await submitCmsTemplateDraft(
      body,
      'csrf-token',
      'draft-attempt-001',
      failed,
    );
    expect(result).toEqual({ kind: 'uncertain' });
  });

  it.each([
    { name: 'missing BE00 fields', value: { message: 'private' } },
    { name: 'wrong operation code', value: apiError('TEMPLATE_NOT_FOUND') },
    {
      name: 'malformed request id',
      value: { ...apiError('TEMPLATE_VERSION_CONFLICT'), requestId: 'private' },
    },
  ])('does not invent a conflict from $name', async ({ value }) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(value, { status: 409 }));
    expect(
      await submitCmsTemplateDraft(
        body,
        'csrf-token',
        'draft-attempt-001',
        fetcher,
      ),
    ).toEqual({ kind: 'uncertain' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('does not invent a conflict from non-JSON error media', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('private upstream response', { status: 409 }),
      );
    expect(
      await submitCmsTemplateDraft(
        body,
        'csrf-token',
        'draft-attempt-001',
        fetcher,
      ),
    ).toEqual({ kind: 'uncertain' });
  });

  it('does not map a malformed denial to a confirmed capability failure', async () => {
    const malformed = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ private: true }, { status: 403 }));
    expect(
      await submitCmsTemplateDraft(
        body,
        'csrf-token',
        'draft-attempt-001',
        malformed,
      ),
    ).toEqual({ kind: 'uncertain' });
    const valid = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(apiError('TEMPLATE_FORBIDDEN'), { status: 403 }),
      );
    expect(
      await submitCmsTemplateDraft(
        body,
        'csrf-token',
        'draft-attempt-001',
        valid,
      ),
    ).toEqual({ kind: 'rejected', status: 403 });
  });

  it.each([
    [400, 'INVALID_REQUEST'],
    [401, 'UNAUTHENTICATED'],
    [403, 'TEMPLATE_FORBIDDEN'],
    [404, 'TEMPLATE_NOT_FOUND'],
    [415, 'UNSUPPORTED_MEDIA_TYPE'],
    [422, 'TEMPLATE_VALIDATION_FAILED'],
    [500, 'INTERNAL_ERROR'],
    [502, 'DEPENDENCY_INVALID_RESPONSE'],
    [503, 'DEPENDENCY_UNAVAILABLE'],
    [504, 'DEPENDENCY_DEADLINE_EXCEEDED'],
  ])('accepts only BE03c %i %s as a typed refusal', async (status, code) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(apiError(code), { status }));
    expect(
      await submitCmsTemplateDraft(
        body,
        'csrf-token',
        'draft-attempt-001',
        fetcher,
      ),
    ).toEqual({ kind: 'rejected', status });
  });

  it('carries only matching BE00 Retry-After seconds for a typed 429', async () => {
    const valid = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(
          { ...apiError('RATE_LIMITED'), details: { retryAfterSeconds: 2 } },
          { status: 429, headers: { 'retry-after': '2' } },
        ),
      );
    expect(
      await submitCmsTemplateDraft(
        body,
        'csrf-token',
        'draft-attempt-001',
        valid,
      ),
    ).toEqual({ kind: 'rejected', status: 429, retryAfterSeconds: 2 });

    const mismatch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(
          { ...apiError('RATE_LIMITED'), details: { retryAfterSeconds: 3 } },
          { status: 429, headers: { 'retry-after': '2' } },
        ),
      );
    expect(
      await submitCmsTemplateDraft(
        body,
        'csrf-token',
        'draft-attempt-001',
        mismatch,
      ),
    ).toEqual({ kind: 'uncertain' });
  });

  it('does not present a malformed success response as a created draft', async () => {
    const malformed = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ id: TEMPLATE_ID }, { status: 201 }));
    expect(
      await submitCmsTemplateDraft(
        body,
        'csrf-token',
        'draft-attempt-001',
        malformed,
      ),
    ).toEqual({ kind: 'uncertain' });
  });

  it('posts a successor with exact strong If-Match and accepts only a newer authoritative draft', async () => {
    const successor = { ...body, expectedVersion: '2' };
    const latest = { ...resource, version: '3', templateVersion: 3 };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(latest, {
        status: 201,
        headers: { etag: '"3"' },
      }),
    );
    expect(
      await submitCmsTemplateSuccessorDraft(
        successor,
        'csrf-token',
        'successor-attempt-001',
        fetcher,
      ),
    ).toEqual({ kind: 'created', resource: latest });
    const [, init] = fetcher.mock.calls[0]!;
    expect(new Headers(init?.headers).get('if-match')).toBe('"2"');
    expect(JSON.parse(String(init?.body)).expectedVersion).toBe('2');
  });

  it('does not treat an unchanged version or invalid edit body as a saved successor', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        { ...resource, version: '2', templateVersion: 2 },
        {
          status: 201,
          headers: { etag: '"2"' },
        },
      ),
    );
    expect(
      await submitCmsTemplateSuccessorDraft(
        { ...body, expectedVersion: '2' },
        'csrf-token',
        'successor-attempt-001',
        fetcher,
      ),
    ).toEqual({ kind: 'uncertain' });
    expect(
      await submitCmsTemplateSuccessorDraft(
        body,
        'csrf-token',
        'successor-attempt-001',
        fetcher,
      ),
    ).toEqual({ kind: 'rejected', status: 422 });
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
