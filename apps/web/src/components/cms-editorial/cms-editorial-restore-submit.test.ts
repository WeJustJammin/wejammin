// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { submitCmsEditorialRestoreForm } from './cms-editorial-restore-submit';

const ENTRY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const REVISION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dd';
const CHAIN_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132de';
const CSRF_TOKEN = 'csrf-token';

const restoreForm = (
  overrides: Readonly<Record<string, string>> = {},
): HTMLFormElement => {
  const hidden = Object.entries({
    entryId: ENTRY_ID,
    revisionId: REVISION_ID,
    migrationChainId: CHAIN_ID,
    edgeCount: '4',
    availability: 'available',
    expectedVersion: '7',
    ...overrides,
  })
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${name}" value="${value}" />`,
    )
    .join('');
  const form = document.createElement('form');
  form.innerHTML = hidden;
  document.body.appendChild(form);
  return form;
};

const revisionResource = () => ({
  entryId: ENTRY_ID,
  id: '018f0c45-73fe-7dc2-9c09-68f7ecf132df',
  version: '1',
  entryVersion: '8',
  revisionNumber: '9',
  createdAt: '2026-10-05T00:00:00+00:00',
  updatedAt: '2026-10-05T00:00:00+00:00',
  locale: 'en-US',
  state: 'draft',
  schemaVersionId: '018f0c45-73fe-7dc2-9c09-68f7ecf132d0',
  templateVersionId: null,
  taxonomyVersionIds: [],
  parentRevisionIds: [],
  conflictId: null,
  contentHash: 'b'.repeat(64),
  validationState: 'valid',
});

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('submitCmsEditorialRestoreForm', () => {
  it('sends the real restore command with JSON, CSRF, idempotency, and If-Match', async () => {
    let capturedInit: RequestInit | undefined;
    const result = await submitCmsEditorialRestoreForm({
      form: restoreForm(),
      csrfToken: CSRF_TOKEN,
      documentRef: { cookie: `wj_csrf=${CSRF_TOKEN}` },
      fetcher: async (input, init) => {
        capturedInit = init;
        return new Response(JSON.stringify(revisionResource()), {
          status: 201,
          headers: {
            'content-type': 'application/json',
            location: `/api/v1/cms/entries/${ENTRY_ID}/revisions/018f0c45-73fe-7dc2-9c09-68f7ecf132df`,
            etag: '"8"',
            'cache-control': 'no-store',
          },
        });
      },
    });
    expect(result.status).toBe('created');
    if (result.status === 'created') {
      expect(result.resource.entryId).toBe(ENTRY_ID);
      expect(result.etag).toBe('"8"');
      expect(result.location).toBe(
        `/api/v1/cms/entries/${ENTRY_ID}/revisions/018f0c45-73fe-7dc2-9c09-68f7ecf132df`,
      );
    }
    const headers = new Headers(capturedInit?.headers);
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('x-csrf-token')).toBe(CSRF_TOKEN);
    expect(headers.get('if-match')).toBe('"7"');
    expect(headers.get('idempotency-key')).toBeTruthy();
    const body = JSON.parse(String(capturedInit?.body)) as Record<
      string,
      unknown
    >;
    expect(body).toEqual({
      entryId: ENTRY_ID,
      revisionId: REVISION_ID,
      migrationChainId: CHAIN_ID,
      expectedVersion: '7',
    });
  });

  it('refuses an unavailable carrier without any network call', async () => {
    const fetcher = vi.fn();
    const result = await submitCmsEditorialRestoreForm({
      form: restoreForm({ availability: 'chain_unavailable' }),
      csrfToken: CSRF_TOKEN,
      documentRef: { cookie: `wj_csrf=${CSRF_TOKEN}` },
      fetcher: fetcher as unknown as (
        input: RequestInfo | URL,
        init?: RequestInit,
      ) => Promise<Response>,
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.status).toBe('refused');
  });

  it('refuses a missing expectedVersion before any network call', async () => {
    const fetcher = vi.fn();
    const result = await submitCmsEditorialRestoreForm({
      form: restoreForm({ expectedVersion: '' }),
      csrfToken: CSRF_TOKEN,
      documentRef: { cookie: `wj_csrf=${CSRF_TOKEN}` },
      fetcher: fetcher as unknown as (
        input: RequestInfo | URL,
        init?: RequestInit,
      ) => Promise<Response>,
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.status).toBe('refused');
  });

  it('keeps the idempotency key when a 201 cannot be verified', async () => {
    const form = restoreForm();
    const result = await submitCmsEditorialRestoreForm({
      form,
      csrfToken: CSRF_TOKEN,
      documentRef: { cookie: `wj_csrf=${CSRF_TOKEN}` },
      idempotencyKey: 'restore-key-123',
      fetcher: async () =>
        new Response(JSON.stringify(revisionResource()), {
          status: 201,
          headers: {
            'content-type': 'application/json',
            location: `/api/v1/cms/entries/${ENTRY_ID}/revisions/018f0c45-73fe-7dc2-9c09-68f7ec132df`,
            etag: 'W/"8"',
            'cache-control': 'no-store',
          },
        }),
    });
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.outcomeUnknown).toBe(true);
      expect(result.idempotencyKey).toBe('restore-key-123');
      expect(form.dataset.cmsEditorialRestoreIdempotencyKey).toBe(
        'restore-key-123',
      );
    }
  });

  it('maps a typed API refusal without exposing a generic conflict', async () => {
    const result = await submitCmsEditorialRestoreForm({
      form: restoreForm(),
      csrfToken: CSRF_TOKEN,
      documentRef: { cookie: `wj_csrf=${CSRF_TOKEN}` },
      fetcher: async () =>
        new Response(
          JSON.stringify({
            code: 'FORBIDDEN',
            details: {},
            message: 'Restore capability is required.',
            requestId: '11111111-1111-4111-8111-111111111111',
          }),
          { status: 403, headers: { 'content-type': 'application/json' } },
        ),
    });
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.code).toBe('FORBIDDEN');
      expect(result.error.requestId).toBe(
        '11111111-1111-4111-8111-111111111111',
      );
      expect(result.outcomeUnknown).toBe(false);
    }
  });

  it.each([
    ['migration_chain_mismatch', 'restore plan changed'],
    ['migration_chain_unavailable', 'migration path is not available'],
    ['migration_chain_incomplete', 'migration path is incomplete'],
    ['template_incompatible', 'template that is no longer compatible'],
  ])(
    'shows fixed copy for the typed 409 %s, never the server message',
    async (reasonCode, copy) => {
      const result = await submitCmsEditorialRestoreForm({
        form: restoreForm(),
        csrfToken: CSRF_TOKEN,
        documentRef: { cookie: `wj_csrf=${CSRF_TOKEN}` },
        fetcher: async () =>
          new Response(
            JSON.stringify({
              code: 'CONFLICT',
              details: { reasonCode },
              message: 'Server text that must never be shown.',
              requestId: '11111111-1111-4111-8111-111111111111',
            }),
            { status: 409, headers: { 'content-type': 'application/json' } },
          ),
      });
      expect(result.status).toBe('error');
      if (result.status !== 'error') return;
      expect(result.error.message).toContain(copy);
      expect(result.error.message).not.toContain('Server text');
      expect(result.outcomeUnknown).toBe(false);
    },
  );

  it('never relays an upstream message or details for an untyped refusal', async () => {
    const result = await submitCmsEditorialRestoreForm({
      form: restoreForm(),
      csrfToken: CSRF_TOKEN,
      documentRef: { cookie: `wj_csrf=${CSRF_TOKEN}` },
      fetcher: async () =>
        new Response(
          JSON.stringify({
            code: 'FORBIDDEN',
            details: { internal: 'provider stack' },
            message: 'Restore capability is required for person 42.',
            requestId: '11111111-1111-4111-8111-111111111111',
          }),
          { status: 403, headers: { 'content-type': 'application/json' } },
        ),
    });
    expect(result.status).toBe('error');
    if (result.status !== 'error') return;
    expect(result.error.message).toBe(
      'You no longer have edit capability for this entry.',
    );
    expect(JSON.stringify(result.error)).not.toContain('provider stack');
    expect(JSON.stringify(result.error)).not.toContain('person 42');
  });

  it('retains a key when the command response is lost', async () => {
    const form = restoreForm();
    const result = await submitCmsEditorialRestoreForm({
      form,
      csrfToken: CSRF_TOKEN,
      documentRef: { cookie: `wj_csrf=${CSRF_TOKEN}` },
      idempotencyKey: 'restore-key-456',
      fetcher: async () => {
        throw new TypeError('network lost');
      },
    });
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.outcomeUnknown).toBe(true);
      expect(result.idempotencyKey).toBe('restore-key-456');
    }
    expect(form.dataset.cmsEditorialRestoreIdempotencyKey).toBe(
      'restore-key-456',
    );
  });
});
