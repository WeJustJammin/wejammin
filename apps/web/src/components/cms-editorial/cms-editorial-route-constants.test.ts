import { cmsEditorialRoutePolicies } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { CMS_EDITORIAL_ENTRY_CREATE_ROUTE } from './cms-editorial-entry-create';
import { CMS_EDITORIAL_ENTRY_DRAFT_DETAIL_ROUTE } from './cms-editorial-entry-draft-detail';

/**
 * AC-060 closeout ("leave no unresolved implementation boundary or undocumented
 * drift"): the browser-side description of the create and draft-detail routes
 * states what is IMPLEMENTED, and cannot drift from the registered route policy
 * it describes. It used to carry a `blocker` and a status claiming the create
 * policy evidence was unavailable and the editor loader unwired, while the
 * create form and the editor are wired (CMS-03B-14 supplies the evidence).
 */

const policy = (operationId: string) => {
  const found = cmsEditorialRoutePolicies.find(
    (row) => row.operationId === operationId,
  );
  if (found === undefined) throw new Error(`no policy for ${operationId}`);
  return found;
};

describe('the browser route descriptions equal the registered route policy', () => {
  it.each([
    ['CMS-03B-10', CMS_EDITORIAL_ENTRY_CREATE_ROUTE],
    ['CMS-03B-11', CMS_EDITORIAL_ENTRY_DRAFT_DETAIL_ROUTE],
  ] as const)('%s', (operationId, route) => {
    const row = policy(operationId);
    expect(route.operationId).toBe(operationId);
    expect(route.method).toBe(row.method);
    expect(route.path).toBe(row.path);
    expect(route.successStatus).toBe(row.successStatus);
    expect(route.idempotencyRequired).toBe(row.idempotency === 'required');
    expect(route.ifMatchRequired).toBe(row.ifMatch !== 'none');
    expect(route.locationRequired).toBe(row.location === 'required');
    expect(route.etag).toBe(row.etag);
    expect(route.cacheControl).toBe(row.cacheControl);
  });

  it('states no open blocker, unavailable status or unwired loader', () => {
    for (const route of [
      CMS_EDITORIAL_ENTRY_CREATE_ROUTE,
      CMS_EDITORIAL_ENTRY_DRAFT_DETAIL_ROUTE,
    ])
      expect(JSON.stringify(route)).not.toMatch(
        /blocker|unavailable|unwired|unverified|not implemented/iu,
      );
  });

  it('create is a human form without If-Match; draft detail is a protected read-only GET', () => {
    expect(CMS_EDITORIAL_ENTRY_CREATE_ROUTE.browserPolicy).toBe('human-form');
    expect(CMS_EDITORIAL_ENTRY_DRAFT_DETAIL_ROUTE.browserPolicy).toBe(
      'protected-read-only',
    );
  });
});
