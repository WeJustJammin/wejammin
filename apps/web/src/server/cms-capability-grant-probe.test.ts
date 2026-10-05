import { describe, expect, it } from 'vitest';

import {
  grantBinding,
  grantPageRequest,
} from './cms-capability-grant-context.test-support';
import {
  cmsCapabilityGrantIdFromRequest,
  probeCmsCapabilityGrantOwner,
} from './cms-capability-grant-platform-api';

/**
 * The registry shell shows the grant console entry only to the receipt-derived
 * owner. The probe is a one-row CMS-03A-18 read: a 2xx is the only proof, and
 * every other outcome (including a thrown binding) hides the entry quietly.
 */

describe('[DEC-119] owner navigation probe', () => {
  it('[P2-S09-AC-992] is true for an upstream 2xx and reads exactly one row with no filters', async () => {
    const bound = grantBinding();
    const owner = await probeCmsCapabilityGrantOwner(
      grantPageRequest(),
      bound.binding,
    );
    expect(owner).toBe(true);
    const url = new URL(bound.requests[0]?.url ?? '');
    expect(url.pathname).toBe('/api/v1/cms/capability-grants');
    expect([...url.searchParams.keys()]).toStrictEqual(['limit']);
    expect(url.searchParams.get('limit')).toBe('1');
  });

  it.each([401, 403, 404, 429, 503])(
    'is false for upstream %i',
    async (status) => {
      const bound = grantBinding({ status, errorCode: 'X' });
      expect(
        await probeCmsCapabilityGrantOwner(grantPageRequest(), bound.binding),
      ).toBe(false);
    },
  );

  it('is false when the binding throws or is missing', async () => {
    expect(
      await probeCmsCapabilityGrantOwner(
        grantPageRequest(),
        grantBinding({ throws: true }).binding,
      ),
    ).toBe(false);
    expect(
      await probeCmsCapabilityGrantOwner(grantPageRequest(), undefined),
    ).toBe(false);
  });

  it('does not call the platform without a session cookie', async () => {
    const bound = grantBinding();
    expect(
      await probeCmsCapabilityGrantOwner(
        grantPageRequest({ cookie: null }),
        bound.binding,
      ),
    ).toBe(false);
    expect(bound.fetch).not.toHaveBeenCalled();
  });

  it('is false for a 2xx whose body is not a grant list', async () => {
    const bound = grantBinding({ body: { items: 'nope' } });
    expect(
      await probeCmsCapabilityGrantOwner(grantPageRequest(), bound.binding),
    ).toBe(false);
  });
});

describe('[DEC-119] native grant id transport', () => {
  const form = (fields: Record<string, string>): Request =>
    new Request('https://app.test/app/cms-content-modeling/capability-grants', {
      method: 'POST',
      // A native form post names its origin; a request that cannot be shown to
      // be same-origin is refused before its body is read (BE00 step 2).
      headers: { origin: 'https://app.test' },
      body: new URLSearchParams(fields),
    });

  it('reads the row id from a native form and nothing else', async () => {
    expect(
      await cmsCapabilityGrantIdFromRequest(form({ grantId: 'abc', x: 'y' })),
    ).toBe('abc');
    expect(
      await cmsCapabilityGrantIdFromRequest(form({ x: 'y' })),
    ).toBeUndefined();
  });

  it('is undefined for a body that is not a form', async () => {
    const json = new Request('https://app.test/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"grantId":"abc"}',
    });
    expect(await cmsCapabilityGrantIdFromRequest(json)).toBeUndefined();
  });
});
