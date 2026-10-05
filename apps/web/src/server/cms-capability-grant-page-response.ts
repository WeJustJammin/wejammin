import type { CmsCapabilityGrantResult } from './cms-capability-grant-context';

/**
 * The owner console refuses every non-owner with a bare, uncacheable status
 * and no console markup (FE03 conditional-rendering matrix: not-rendered).
 * Both the page route and its test use this one mapping, so what the test
 * proves is what the production route returns.
 */
export type CmsCapabilityGrantRefusal = Extract<
  CmsCapabilityGrantResult,
  { readonly kind: 'forbidden' | 'not_found' }
>;

export const isCmsCapabilityGrantRefusal = (
  result: CmsCapabilityGrantResult,
): result is CmsCapabilityGrantRefusal =>
  result.kind === 'forbidden' || result.kind === 'not_found';

export const cmsCapabilityGrantRefusalResponse = (
  result: CmsCapabilityGrantRefusal,
): Response =>
  result.kind === 'not_found'
    ? new Response('Not found', {
        status: 404,
        headers: { 'cache-control': 'no-store' },
      })
    : new Response('Forbidden', {
        status: 403,
        headers: { 'cache-control': 'no-store' },
      });

/**
 * The "CMS access" navigation entry is shown solely to the receipt-derived
 * owner: the registry page must be the owner variant and the one-row
 * CMS-03A-18 ownership probe must have succeeded.
 */
export const cmsAccessNavigationVisible = (
  registryVariant: string,
  ownerProbeSucceeded: boolean,
): boolean => registryVariant === 'ownerFull' && ownerProbeSucceeded;
