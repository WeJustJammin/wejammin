/**
 * Valid requests for the profile and claim functions.
 *
 * The claim functions (`rpc_start_claim` ...) run `profile_prepare_request`,
 * which turns `context.actorPersonId` into the trusted actor for a service-role
 * caller and otherwise falls back to `identity_auth_user()` (the token subject,
 * which a service-role token does not carry), so an empty context is refused
 * with UNAUTHENTICATED. The five profile mutators accept no `context` member at
 * all (their allow-list rejects it) and read only the token subject.
 */
import {
  IDEMPOTENCY_KEY,
  id,
  type FixtureTable,
} from './claim-gate-fixtures-types';

export const PROFILE_CLAIM_FIXTURES: FixtureTable = {
  rpc_read_claim: { request: { claimId: id(80) }, real: '400:NOT_FOUND' },
  rpc_start_claim: {
    request: {
      targetPartyId: id(81),
      claimKind: 'self',
      expectedVersion: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: '400:NOT_FOUND',
  },
  rpc_dispatch_invitation: {
    request: {
      shadowId: id(82),
      contactRouteId: id(83),
      trigger: 'manual',
      attesterPersonId: id(84),
      expectedVersion: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: '400:VALIDATION_FAILED',
  },
  rpc_match_shadow: {
    request: {
      partyId: id(81),
      sourceDomain: 'catalogue',
      sourceEntityId: id(85),
      sourceVersion: '1',
      roleCode: 'performer',
      instrumentCode: 'guitar',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: '400:FORBIDDEN',
  },
  rpc_issue_claim_challenge: {
    request: {
      claimId: id(80),
      method: 'email',
      routeId: id(86),
      attesterPersonId: id(84),
      expectedVersion: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: '400:VALIDATION_FAILED',
  },
  rpc_convert_claim: {
    request: {
      claimId: id(80),
      reasonCode: 'claim_conversion',
      expectedVersion: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: '400:STEP_UP_REQUIRED',
  },
  rpc_submit_claim_proof: {
    request: {
      claimId: id(80),
      kind: 'code',
      challengeId: id(87),
      code: '123456',
      providerEventId: null,
      tier: 'provisional',
      evidenceRef: null,
      attesterPersonIds: [],
      reasonCode: null,
      expectedVersion: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: '400:VALIDATION_FAILED',
  },
};

/** Token-subject-only mutators: no `context` member is accepted. */
export const PROFILE_SUBJECT_FIXTURES: FixtureTable = {
  rpc_profile_emphasis: {
    request: {
      partyId: id(81),
      surface: 'public',
      defaultFilter: {},
      orderedRefs: [],
      expectedVersion: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: '400:PERSON_NOT_FOUND',
  },
  rpc_profile_section: {
    request: {
      partyId: id(81),
      sectionCode: 'now',
      blocks: [],
      state: 'draft',
      clientReason: 'api gate probe',
      expectedVersion: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: '400:PERSON_NOT_FOUND',
  },
  rpc_profile_reel_create: {
    request: {
      partyId: id(81),
      creditId: id(88),
      mediaId: id(89),
      rightsId: id(90),
      expectedVersion: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: '400:PERSON_NOT_FOUND',
  },
  rpc_profile_reel_patch: {
    request: {
      id: id(91),
      partyId: id(81),
      expectedVersion: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: '400:PERSON_NOT_FOUND',
  },
  rpc_profile_reel_takedown: {
    request: {
      id: id(91),
      partyId: id(81),
      expectedVersion: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: '400:PERSON_NOT_FOUND',
  },
};
