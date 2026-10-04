/** Valid requests for the `cfg_*`, `rpc_cfg_*` and `admin_*` functions (caller resolved by `cfg_actor`). */
import {
  FUTURE,
  HEX64,
  IDEMPOTENCY_KEY,
  NOW,
  id,
  type FixtureTable,
  type GateFixture,
} from './claim-gate-fixtures-types';

const cfgChangeAction: GateFixture = {
  request: {
    reviewId: id(20),
    action: 'approve',
    expectedReviewVersion: '1',
    candidateHash: HEX64,
    approvalReason: 'api gate probe',
    idempotencyKey: IDEMPOTENCY_KEY,
  },
  real: '400:FORBIDDEN',
};

const cfgProposeChange: GateFixture = {
  request: {
    definitionId: id(21),
    scopeType: 'user',
    scopeId: id(22),
    environment: 'staging',
    typedValue: { value: true },
    interval: { effectiveFrom: NOW, effectiveTo: FUTURE },
    expectedDefinitionVersion: '1',
    impactManifest: {},
    rollbackCandidate: null,
    reason: 'api gate probe',
    consumerKeys: ['api.gate'],
    idempotencyKey: IDEMPOTENCY_KEY,
  },
  real: '400:FORBIDDEN',
};

const cfgResolve: GateFixture = {
  request: {
    key: 'api.gate.probe',
    consumerKey: 'api.gate',
    supportedDefinitionVersions: ['1'],
  },
  real: '400:FORBIDDEN',
};

export const ADMIN_FIXTURES: FixtureTable = {
  admin_audit_diagnostic: {
    request: {
      action: 'read_audit',
      targetType: 'party',
      targetId: id(23),
      targetVersion: '1',
      auditLinkId: id(24),
      diagnosticDefinitionKey: 'api.gate',
      diagnosticDefinitionVersion: '1',
      input: {},
      expectedFreshnessAt: NOW,
      reason: 'api gate probe',
      idempotencyKey: IDEMPOTENCY_KEY,
      ifMatch: '1',
    },
    real: '400:FORBIDDEN',
  },
  admin_capability_action: {
    request: {
      action: 'create',
      grantId: null,
      expectedVersion: null,
      subjectPersonId: id(6),
      capabilityKey: 'admin.capability.grant',
      resourceType: 'party',
      resourceId: id(25),
      scope: {},
      actions: ['read'],
      startsAt: NOW,
      endsAt: FUTURE,
      reason: 'api gate probe',
      approverPersonId: id(26),
      purposeGrant: null,
      stepUpToken: null,
      idempotencyKey: IDEMPOTENCY_KEY,
      ifMatch: null,
    },
    real: '400:FORBIDDEN',
  },
  admin_context_capabilities: { request: {}, real: '400:FORBIDDEN' },
  admin_inbox: {
    request: {
      cursor: null,
      limit: 25,
      taskClasses: null,
      states: null,
      staleAfter: null,
    },
    real: '400:FORBIDDEN',
  },
  admin_mfa_factor_reset: {
    request: {
      targetPersonId: id(6),
      reason: 'api gate probe',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: '400:FORBIDDEN',
  },
  admin_mfa_factor_reset_settle: {
    request: { resetId: id(27), outcomes: [] },
    real: '400:FORBIDDEN',
  },
  cfg_change_action: cfgChangeAction,
  cfg_propose_change: cfgProposeChange,
  cfg_resolve_effective_value: cfgResolve,
  rpc_cfg_change_action: cfgChangeAction,
  rpc_cfg_propose_change: cfgProposeChange,
  rpc_cfg_resolve_effective_value: cfgResolve,
};
