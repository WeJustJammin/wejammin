/**
 * Real-person success controls: for these entries a caller who really is a
 * person (the CMS owner) gets a success through the same gate, so a gate that
 * refuses everyone (the SEC-1 failure mode) cannot pass on refusals alone.
 * Every other entry's control is the function's own next-step error
 * (`fixture.real`), because a success needs domain rows the suite does not own.
 */
import type { CmsOwner } from './stack';

export type SuccessControl = Readonly<{
  /** `user`: the owner's own token; `service`: the Worker credential naming the owner. */
  caller: 'user' | 'service';
  /** Context for the request (omitted for typed-argument functions). */
  context?: (owner: CmsOwner) => Record<string, unknown>;
  /** Arguments or request members replacing the fixture's request. */
  request?: (owner: CmsOwner) => Record<string, unknown>;
}>;

const inOrganization = (owner: CmsOwner): Record<string, unknown> => ({
  authUserId: owner.authUserId,
  actingPartyId: owner.organizationId,
});
const asPerson = (owner: CmsOwner): Record<string, unknown> => ({
  authUserId: owner.authUserId,
  actingPartyId: owner.personId,
});

export const SUCCESS_CONTROLS: Readonly<Record<string, SuccessControl>> = {
  admin_context_capabilities: { caller: 'service', context: asPerson },
  admin_inbox: { caller: 'service', context: asPerson },
  cms_list_content_types: { caller: 'user', context: inOrganization },
  identity_contexts_read: { caller: 'user' },
  identity_memberships_read: {
    caller: 'user',
    request: (owner) => ({
      p_organization_id: owner.organizationId,
      p_cursor: null,
      p_limit: 25,
    }),
  },
  identity_organization_read: {
    caller: 'user',
    request: (owner) => ({ p_organization_id: owner.organizationId }),
  },
  identity_person_read: { caller: 'user' },
};
