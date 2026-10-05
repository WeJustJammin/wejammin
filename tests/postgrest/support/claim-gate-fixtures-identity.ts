/**
 * Valid arguments for the typed-argument identity and membership functions
 * (caller resolved by `identity_auth_user`, which reads only the token subject).
 */
import { id, type FixtureTable } from './claim-gate-fixtures-types';

const PERSON_NOT_FOUND = '400:PERSON_NOT_FOUND';

export const IDENTITY_FIXTURES: FixtureTable = {
  identity_alias_create: {
    request: {
      p_display_name: 'Gate Probe',
      p_handle: 'gate-probe',
      p_public_link_state: 'unlinked',
    },
    real: PERSON_NOT_FOUND,
  },
  identity_alias_patch: {
    request: {
      p_alias_id: id(60),
      p_display_name: 'Gate Probe',
      p_public_link_state: 'unlinked',
      p_expected_version: 1,
    },
    real: PERSON_NOT_FOUND,
  },
  identity_alias_retire: {
    request: { p_alias_id: id(60), p_expected_version: 1 },
    real: PERSON_NOT_FOUND,
  },
  identity_context_bind: {
    request: {
      p_context_id: id(61),
      p_deliberate_confirmation: true,
      p_client_binding_id: 'tab:api-gate-probe',
    },
    real: PERSON_NOT_FOUND,
  },
  identity_contexts_read: { request: {}, real: PERSON_NOT_FOUND },
  identity_create: { request: {}, real: '400:INVALID_REQUEST' },
  identity_facet_add: {
    request: { p_facet_code: 'musician' },
    real: PERSON_NOT_FOUND,
  },
  identity_facet_remove: {
    request: { p_facet_code: 'musician', p_expected_version: 1 },
    real: PERSON_NOT_FOUND,
  },
  identity_handle_change: {
    request: {
      p_alias_id: id(60),
      p_handle: 'gate-probe-2',
      p_expected_version: 1,
    },
    real: PERSON_NOT_FOUND,
  },
  identity_memberships_read: {
    request: { p_organization_id: id(62), p_cursor: null, p_limit: 25 },
    real: PERSON_NOT_FOUND,
  },
  identity_person_read: { request: {}, real: PERSON_NOT_FOUND },
  identity_transfer_accept: {
    request: { p_offer_id: id(63), p_expected_version: 1 },
    real: PERSON_NOT_FOUND,
  },
  identity_transfer_decline: {
    request: { p_offer_id: id(63), p_expected_version: 1 },
    real: PERSON_NOT_FOUND,
  },
  identity_transfer_offer_create: {
    request: { p_alias_id: id(60), p_recipient_person_id: id(64) },
    real: PERSON_NOT_FOUND,
  },
  rpc_accept_or_end_membership: {
    request: {
      p_tenure_id: id(65),
      p_action: 'accept',
      p_expected_version: 1,
      p_terms_version_id: id(66),
      p_ends_on: null,
      p_counterpart_confirmation_id: null,
      p_reason_code: null,
      p_terms_hash: null,
    },
    real: PERSON_NOT_FOUND,
  },
  rpc_add_capacity_period: {
    request: {
      p_tenure_id: id(65),
      p_capacity: 'member',
      p_starts_on: '2026-10-04',
      p_ends_on: null,
      p_expected_version: 1,
    },
    real: PERSON_NOT_FOUND,
  },
  rpc_assert_membership: {
    request: {
      p_organization_id: id(62),
      p_person_id: id(64),
      p_starts_on: '2026-10-04',
      p_ends_on: null,
      p_evidence_ref: id(67),
      p_expected_version: 1,
    },
    real: PERSON_NOT_FOUND,
  },
  rpc_change_organization_type: {
    request: {
      p_organization_id: id(62),
      p_type_code: 'venue',
      p_action: 'add',
      p_expected_version: 1,
    },
    real: PERSON_NOT_FOUND,
  },
  rpc_create_organization: {
    request: { p_mode: 'standard', p_type_codes: ['venue'] },
    real: PERSON_NOT_FOUND,
  },
  rpc_invite_membership: {
    request: {
      p_organization_id: id(62),
      p_person_id: id(64),
      p_starts_on: '2026-10-04',
      p_terms_version_id: id(66),
      p_capacity: 'member',
      p_invite_expires_at: '2030-01-01T00:00:00.000Z',
      p_governance_mode: null,
      p_expected_version: null,
    },
    real: PERSON_NOT_FOUND,
  },
};

/** The one public read: anonymous callers are served, and the token subject only widens the answer. */
export const PUBLIC_FIXTURES: FixtureTable = {
  identity_organization_read: {
    request: { p_organization_id: id(62) },
    real: '400:NOT_FOUND',
  },
};
