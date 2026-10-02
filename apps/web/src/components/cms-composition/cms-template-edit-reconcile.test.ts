import { describe, expect, it, vi } from 'vitest';

import { readLatestCmsTemplateVersion } from './cms-template-edit-reconcile';

const TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const TEMPLATE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
const detail = {
  id: TEMPLATE_ID,
  version: '3',
  templateVersion: 3,
  contentHash: 'a'.repeat(64),
  createdAt: '2026-09-27T12:00:00.000Z',
  updatedAt: '2026-09-27T13:00:00.000Z',
  state: 'draft',
  templateKey: 'release-note',
  compatibleTypeIds: [TYPE_ID],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  blockRegistryDigest: 'a'.repeat(64),
  slots: [],
  bindings: {},
  locale: 'en-US',
  audience: 'public',
};

describe('CMS-11 canonical reconciliation read', () => {
  it('reads only the same-origin protected latest version and checks identity and ETag', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(detail, { status: 200, headers: { etag: '"3"' } }),
      );
    expect(await readLatestCmsTemplateVersion('release-note', fetcher)).toEqual(
      {
        kind: 'loaded',
        detail,
      },
    );
    const [path, init] = fetcher.mock.calls[0]!;
    expect(path).toBe('/api/v1/cms/templates/release-note');
    expect(init?.method).toBe('GET');
    expect(init?.credentials).toBe('same-origin');
    expect(init?.cache).toBe('no-store');
    expect(new Headers(init?.headers).has('idempotency-key')).toBe(false);
  });

  it('fails closed on an invalid version, mismatched ETag, or denied read', async () => {
    const wrong = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(detail, { status: 200, headers: { etag: '"2"' } }),
      );
    expect(await readLatestCmsTemplateVersion('release-note', wrong)).toEqual({
      kind: 'unavailable',
    });
    const denied = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ private: 'error' }, { status: 403 }));
    expect(await readLatestCmsTemplateVersion('release-note', denied)).toEqual({
      kind: 'rejected',
      status: 403,
    });
    expect(await readLatestCmsTemplateVersion('../other', denied)).toEqual({
      kind: 'unavailable',
    });
    expect(denied).toHaveBeenCalledOnce();
  });
});
