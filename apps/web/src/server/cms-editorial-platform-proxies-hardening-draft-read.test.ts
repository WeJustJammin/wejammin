import { describe, expect, it } from 'vitest';

import { forwardCmsEditorialEntryDraftDetailRead } from './cms-editorial-platform-reads';
import {
  bindingWith,
  draftDetailEtag,
  draftDetailWith,
  get,
  jsonResponse,
  maxBodyBytes,
  observedStream,
  oversizeStreamTotal,
  streamedResponse,
  uuid,
} from './cms-editorial-platform-proxies-hardening-test-support';

/*
 * Hardening for the CMS-03B-11 protected draft read: a 200 refused without a
 * canonical strong ETag or over the cap. Base cases live in
 * cms-editorial-platform-proxies.test.ts.
 */

describe('cms-editorial draft-detail proxy ETag gate (CMS-03B-11)', () => {
  it('refuses a 200 with a weak ETag so it can never anchor a write', async () => {
    const response = await forwardCmsEditorialEntryDraftDetailRead(
      get(),
      bindingWith(async () =>
        jsonResponse(draftDetailWith('v'), {
          status: 200,
          headers: { etag: 'W/"7"' },
        }),
      ),
      uuid,
    );
    expect(response.status).toBe(502);
  });

  it('refuses a 200 with no ETag at all', async () => {
    const response = await forwardCmsEditorialEntryDraftDetailRead(
      get(),
      bindingWith(async () =>
        jsonResponse(draftDetailWith('v'), { status: 200 }),
      ),
      uuid,
    );
    expect(response.status).toBe(502);
  });

  it('refuses a 200 whose ETag is not a canonical strong validator', async () => {
    for (const etag of ['"0"', '7', '"01"', 'W/"7"']) {
      const response = await forwardCmsEditorialEntryDraftDetailRead(
        get(),
        bindingWith(async () =>
          jsonResponse(draftDetailWith('v'), {
            status: 200,
            headers: { etag },
          }),
        ),
        uuid,
      );
      expect([etag, response.status]).toEqual([etag, 502]);
    }
  });

  it('preserves the canonical entry-and-revision ETag verbatim', async () => {
    const response = await forwardCmsEditorialEntryDraftDetailRead(
      get(),
      bindingWith(async () =>
        jsonResponse(draftDetailWith('v'), {
          status: 200,
          headers: { etag: draftDetailEtag },
        }),
      ),
      uuid,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe(draftDetailEtag);
  });
});

describe('cms-editorial draft-detail proxy bounded body (CMS-03B-11)', () => {
  it('refuses an oversize declared 200 body', async () => {
    const response = await forwardCmsEditorialEntryDraftDetailRead(
      get(),
      bindingWith(async () =>
        streamedResponse(observedStream(16).stream, {
          etag: draftDetailEtag,
          'content-length': String(maxBodyBytes + 1),
        }),
      ),
      uuid,
    );
    expect(response.status).toBe(502);
  });

  it('refuses an oversize streaming 200 body and cancels the source', async () => {
    const source = observedStream(oversizeStreamTotal);
    const response = await forwardCmsEditorialEntryDraftDetailRead(
      get(),
      bindingWith(async () =>
        streamedResponse(source.stream, { etag: draftDetailEtag }),
      ),
      uuid,
    );
    expect(response.status).toBe(502);
    expect(source.wasCancelled()).toBe(true);
  });

  it('forwards the query verbatim without normalizing it', async () => {
    let forwarded: Request | null = null;
    const response = await forwardCmsEditorialEntryDraftDetailRead(
      get('?locale=en-US&unknownKey=1'),
      bindingWith(async (input) => {
        forwarded = input as Request;
        return jsonResponse(draftDetailWith('v'), {
          status: 200,
          headers: { etag: draftDetailEtag },
        });
      }),
      uuid,
    );
    expect(response.status).toBe(200);
    const sent = forwarded as Request | null;
    expect(sent === null ? null : new URL(sent.url).search).toBe(
      '?locale=en-US&unknownKey=1',
    );
  });
});
