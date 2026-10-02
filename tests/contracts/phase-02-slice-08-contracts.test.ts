import { describe, expect, it } from 'vitest';

import * as platformContracts from '@wejammin/contracts';

import {
  s08BulkPreviewRequest,
  s08BulkResponse,
  s08BulkTarget,
  s08DiagnosticResponse,
  s08GrantRequest,
  s08GrantResponse,
  s08ExpectedRoutes,
  s08Id,
  s08InboxItem,
  s08InboxQuery,
  s08InboxResponse,
  s08Instant,
  s08OtherId,
  s08ReadAuditRequest,
  s08RunDiagnosticRequest,
  s08SearchRequest,
  s08SearchResponse,
} from './phase-02-slice-08-contract-fixtures';

type SchemaLike = {
  parse: (input: unknown) => unknown;
  safeParse: (input: unknown) => { success: boolean };
};
type RecordLike = Record<string, unknown>;

const contracts = platformContracts as unknown as RecordLike;
const schemaExports = [
  'Cfg05b01InboxQuerySchema',
  'Cfg05b01InboxResponseSchema',
  'Cfg05b02SearchRequestSchema',
  'Cfg05b02SearchResponseSchema',
  'Cfg05b03BulkActionRequestSchema',
  'Cfg05b03BulkActionResponseSchema',
  'Cfg05b04CapabilityActionRequestSchema',
  'Cfg05b04CapabilityActionResponseSchema',
  'Cfg05b05AuditDiagnosticRequestSchema',
  'Cfg05b05AuditDiagnosticResponseSchema',
  'AdminWorkspaceEventTypeSchema',
  'AdminWorkspaceEventSchema',
  'AdminCapabilityChangedV1Schema',
  'AdminBulkChangedV1Schema',
  'QualityDiagnosticChangedV1Schema',
  'AdminWorkspaceRoutePolicySchema',
  'AdminWorkspaceRouteRegistrySchema',
  'AdminWorkspaceActiveRouteRegistrySchema',
] as const;
const valueExports = [
  'adminWorkspaceRoutePolicies',
  'activeAdminWorkspaceRoutePolicies',
  'deferredAdminWorkspaceRoutePolicies',
] as const;

const requireSchema = (name: string): SchemaLike => {
  const candidate = contracts[name] as SchemaLike | undefined;
  if (
    !candidate ||
    typeof candidate.parse !== 'function' ||
    typeof candidate.safeParse !== 'function'
  ) {
    throw new Error(`Missing required S08 contract export: ${name}`);
  }
  return candidate;
};

const requireArray = (name: string): readonly RecordLike[] => {
  const candidate = contracts[name];
  if (!Array.isArray(candidate)) {
    throw new Error(`Missing required S08 route registry export: ${name}`);
  }
  return candidate as readonly RecordLike[];
};

describe('Phase 2 Slice 08 strict admin operation contracts', () => {
  it('[P2-S08-AC-006, P2-S08-AC-012, P2-S08-AC-018] exposes all CFG-05B schemas', () => {
    const missingSchemas = schemaExports.filter((name) => {
      const candidate = contracts[name] as SchemaLike | undefined;
      return (
        !candidate ||
        typeof candidate.parse !== 'function' ||
        typeof candidate.safeParse !== 'function'
      );
    });
    const missingValues = valueExports.filter(
      (name) => !Array.isArray(contracts[name]),
    );
    expect([...missingSchemas, ...missingValues]).toEqual([]);
  });

  it('[P2-S08-AC-006 through P2-S08-AC-011] keeps CFG-05B-01 inbox strict', () => {
    const query = requireSchema('Cfg05b01InboxQuerySchema');
    const response = requireSchema('Cfg05b01InboxResponseSchema');
    expect(query.safeParse(s08InboxQuery).success).toBe(true);
    expect(query.safeParse({ ...s08InboxQuery, unknown: true }).success).toBe(
      false,
    );
    expect(query.safeParse({ ...s08InboxQuery, limit: 0 }).success).toBe(false);
    expect(
      query.safeParse({ ...s08InboxQuery, states: ['bogus'] }).success,
    ).toBe(false);
    expect(response.safeParse(s08InboxResponse).success).toBe(true);
    expect(
      response.safeParse({ ...s08InboxResponse, protectedTitle: 'hidden' })
        .success,
    ).toBe(false);
    expect(
      response.safeParse({
        ...s08InboxResponse,
        items: [{ ...s08InboxItem, unknown: true }],
      }).success,
    ).toBe(false);
    expect(
      response.safeParse({
        ...s08InboxResponse,
        aggregateFreshness: 'unknown',
        items: [{ ...s08InboxItem, freshness: 'unknown', state: 'unknown' }],
      }).success,
    ).toBe(true);
  });

  it('[P2-S08-AC-006 through P2-S08-AC-011, P2-S08-AC-037] keeps CFG-05B-02 search strict and count-safe', () => {
    const request = requireSchema('Cfg05b02SearchRequestSchema');
    const response = requireSchema('Cfg05b02SearchResponseSchema');
    expect(request.safeParse(s08SearchRequest).success).toBe(true);
    expect(
      request.safeParse({ ...s08SearchRequest, sql: 'select 1' }).success,
    ).toBe(false);
    expect(
      request.safeParse({
        ...s08SearchRequest,
        filters: [{ ...s08SearchRequest.filters[0], operator: 'raw_sql' }],
      }).success,
    ).toBe(false);
    expect(
      request.safeParse({
        ...s08SearchRequest,
        fields: Array.from({ length: 25 }, (_, index) => `field_${index}`),
      }).success,
    ).toBe(false);
    expect(response.safeParse(s08SearchResponse).success).toBe(true);
    expect(
      response.safeParse({
        ...s08SearchResponse,
        results: [{ ...s08SearchResponse.results[0], authorized: false }],
      }).success,
    ).toBe(false);
    expect(
      response.safeParse({
        ...s08SearchResponse,
        results: [{ ...s08SearchResponse.results[0], secret: 'nope' }],
      }).success,
    ).toBe(false);
    expect(
      response.safeParse({
        ...s08SearchResponse,
        count: 0,
        countState: 'exact',
      }).success,
    ).toBe(true);
  });

  it('[P2-S08-AC-006 through P2-S08-AC-011, P2-S08-AC-038] binds CFG-05B-03 to an exact manifest', () => {
    const request = requireSchema('Cfg05b03BulkActionRequestSchema');
    const response = requireSchema('Cfg05b03BulkActionResponseSchema');
    expect(request.safeParse(s08BulkPreviewRequest).success).toBe(true);
    expect(
      request.safeParse({
        ...s08BulkPreviewRequest,
        targets: [s08BulkTarget, s08BulkTarget],
      }).success,
    ).toBe(false);
    expect(
      request.safeParse({ ...s08BulkPreviewRequest, dryRunId: s08OtherId })
        .success,
    ).toBe(false);
    expect(
      request.safeParse({
        ...s08BulkPreviewRequest,
        action: 'run',
        dryRunId: null,
      }).success,
    ).toBe(false);
    expect(
      request.safeParse({
        ...s08BulkPreviewRequest,
        manifestHash: 'not-a-hash',
      }).success,
    ).toBe(false);
    expect(response.safeParse(s08BulkResponse).success).toBe(true);
    expect(
      response.safeParse({
        ...s08BulkResponse,
        itemResults: [{ ...s08BulkResponse.itemResults[0], unexpected: true }],
      }).success,
    ).toBe(false);
  });

  it('[P2-S08-AC-012 through P2-S08-AC-017] keeps CFG-05B-04 grants least-privilege and strict', () => {
    const request = requireSchema('Cfg05b04CapabilityActionRequestSchema');
    const response = requireSchema('Cfg05b04CapabilityActionResponseSchema');
    expect(request.safeParse(s08GrantRequest).success).toBe(true);
    expect(
      request.safeParse({ ...s08GrantRequest, actions: ['content.*'] }).success,
    ).toBe(false);
    expect(
      request.safeParse({ ...s08GrantRequest, endsAt: s08Instant }).success,
    ).toBe(false);
    expect(
      request.safeParse({
        ...s08GrantRequest,
        purposeGrant: true,
        actions: ['grant'],
      }).success,
    ).toBe(false);
    expect(
      request.safeParse({ ...s08GrantRequest, action: 'revoke', grantId: null })
        .success,
    ).toBe(false);
    expect(
      request.safeParse({ ...s08GrantRequest, unknown: 'caller-authority' })
        .success,
    ).toBe(false);
    expect(response.safeParse(s08GrantResponse).success).toBe(true);
    expect(
      response.safeParse({ ...s08GrantResponse, scope: { secret: true } })
        .success,
    ).toBe(false);
  });

  it('[P2-S08-AC-018 through P2-S08-AC-023] keeps CFG-05B-05 audit and diagnostic strict', () => {
    const request = requireSchema('Cfg05b05AuditDiagnosticRequestSchema');
    const response = requireSchema('Cfg05b05AuditDiagnosticResponseSchema');
    expect(request.safeParse(s08ReadAuditRequest).success).toBe(true);
    expect(request.safeParse(s08RunDiagnosticRequest).success).toBe(true);
    expect(
      request.safeParse({ ...s08ReadAuditRequest, auditLinkId: null }).success,
    ).toBe(false);
    expect(
      request.safeParse({
        ...s08RunDiagnosticRequest,
        diagnosticDefinitionVersion: null,
      }).success,
    ).toBe(false);
    expect(
      request.safeParse({ ...s08RunDiagnosticRequest, unknown: true }).success,
    ).toBe(false);
    expect(response.safeParse(s08DiagnosticResponse).success).toBe(true);
    expect(
      response.safeParse({ ...s08DiagnosticResponse, state: 'healthy' })
        .success,
    ).toBe(true);
    expect(
      response.safeParse({ ...s08DiagnosticResponse, evidence: 'secret bytes' })
        .success,
    ).toBe(false);
  });

  it('[P2-S08-AC-006, P2-S08-AC-012, P2-S08-AC-018] emits identifier-only admin events', () => {
    const eventType = requireSchema('AdminWorkspaceEventTypeSchema');
    const event = requireSchema('AdminWorkspaceEventSchema');
    const payloads = [
      [
        'AdminCapabilityChangedV1Schema',
        'admin.capability.changed.v1',
        {
          grantId: s08Id,
          subjectPersonId: s08OtherId,
        },
      ],
      [
        'AdminBulkChangedV1Schema',
        'admin.bulk.changed.v1',
        {
          bulkOperationId: s08Id,
        },
      ],
      [
        'QualityDiagnosticChangedV1Schema',
        'quality.diagnostic.changed.v1',
        {
          diagnosticRunId: s08Id,
        },
      ],
    ] as const;
    for (const [schemaName, eventName, payload] of payloads) {
      expect(eventType.safeParse(eventName).success).toBe(true);
      expect(requireSchema(schemaName).safeParse(payload).success).toBe(true);
      expect(
        requireSchema(schemaName).safeParse({ ...payload, secret: 'nope' })
          .success,
      ).toBe(false);
      const envelope = {
        eventId: s08Id,
        eventType: eventName,
        occurredAt: s08Instant,
        requestId: s08OtherId,
        correlationId: s08Id,
        actorRef: s08Id,
        aggregateId: s08Id,
        aggregateVersion: '1',
        payload,
      };
      expect(event.safeParse(envelope).success).toBe(true);
      expect(event.safeParse({ ...envelope, unknown: true }).success).toBe(
        false,
      );
      expect(
        event.safeParse({
          ...envelope,
          payload: { ...payload, secret: 'nope' },
        }).success,
      ).toBe(false);
    }
  });

  it('[P2-S08-AC-006, P2-S08-AC-012, P2-S08-AC-018] mounts only 01, 04, 05, 06, and 07', () => {
    const policy = requireSchema('AdminWorkspaceRoutePolicySchema');
    const registry = requireSchema('AdminWorkspaceRouteRegistrySchema');
    const activeRegistry = requireSchema(
      'AdminWorkspaceActiveRouteRegistrySchema',
    );
    const routes = requireArray('adminWorkspaceRoutePolicies');
    const active = requireArray('activeAdminWorkspaceRoutePolicies');
    const deferred = requireArray('deferredAdminWorkspaceRoutePolicies');
    expect(routes).toHaveLength(7);
    expect(routes.map((route) => route.operationId)).toEqual(
      s08ExpectedRoutes.map(({ operationId }) => operationId),
    );
    for (const expectedRoute of s08ExpectedRoutes) {
      expect(routes).toContainEqual(expect.objectContaining(expectedRoute));
    }
    expect(active.map((route) => route.operationId)).toEqual([
      'CFG-05B-01',
      'CFG-05B-04',
      'CFG-05B-05',
      'CFG-05B-06',
      'CFG-05B-07',
    ]);
    expect(deferred.map((route) => route.operationId)).toEqual([
      'CFG-05B-02',
      'CFG-05B-03',
    ]);
    expect(active.every((route) => route.active)).toBe(true);
    expect(deferred.every((route) => !route.active)).toBe(true);
    expect(registry.safeParse(routes).success).toBe(true);
    expect(activeRegistry.safeParse(active).success).toBe(true);
    expect(activeRegistry.safeParse([...active, deferred[0]]).success).toBe(
      false,
    );
    expect(policy.safeParse({ ...routes[0], unknown: true }).success).toBe(
      false,
    );
  });
});
