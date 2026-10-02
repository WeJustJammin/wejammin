export const s08Id = '018f2f72-4b5a-7c9d-8e1f-123456789abc';
export const s08OtherId = '018f2f72-4b5a-7c9d-8e1f-123456789abd';
export const s08Instant = '2026-09-02T03:00:00.000Z';
export const s08Later = '2026-09-03T03:00:00.000Z';
export const s08Hash = 'a'.repeat(64);

export const s08InboxItem = {
  taskId: s08Id,
  sourceType: 'content.entry',
  sourceId: s08OtherId,
  sourceVersion: '2',
  taskClass: 'approval',
  requiredCapability: 'content.publish',
  assigneePersonId: s08Id,
  dueAt: s08Later,
  severity: 'warning',
  freshnessAt: s08Instant,
  freshness: 'partial',
  state: 'assigned',
  sourceStatus: 'awaiting_review',
  canAct: true,
} as const;

export const s08InboxQuery = {
  cursor: null,
  limit: 25,
  taskClasses: ['approval'],
  states: ['open'],
  staleAfter: s08Instant,
} as const;

export const s08InboxResponse = {
  items: [s08InboxItem],
  nextCursor: null,
  aggregateFreshness: 'partial',
  partialSources: ['content'],
  generatedAt: s08Instant,
} as const;

export const s08SearchRequest = {
  entityType: 'content',
  fields: ['title', 'state'],
  filters: [{ field: 'state', operator: 'equals', value: 'published' }],
  sort: [{ field: 'updated_at', direction: 'desc' }],
  snippet: false,
  minCount: 0,
  cursor: null,
  limit: 25,
} as const;

export const s08SearchResponse = {
  entityType: 'content',
  results: [
    {
      entityId: s08Id,
      entityVersion: '2',
      fields: { title: 'Approved entry', state: 'published' },
      snippet: null,
      authorized: true,
    },
  ],
  count: null,
  countState: 'suppressed',
  nextCursor: null,
  freshnessAt: s08Instant,
  freshness: 'healthy',
} as const;

export const s08BulkTarget = {
  targetType: 'content.entry',
  targetId: s08Id,
  expectedVersion: '2',
} as const;

export const s08BulkPreviewRequest = {
  action: 'preview',
  commandKey: 'content.publish',
  commandVersion: '1',
  targets: [s08BulkTarget],
  manifestHash: s08Hash,
  dryRunId: null,
  reason: 'Review the exact target manifest.',
} as const;

export const s08BulkResponse = {
  bulkOperationId: s08OtherId,
  commandKey: 'content.publish',
  commandVersion: '1',
  manifestHash: s08Hash,
  state: 'dry_run',
  targetCount: 1,
  successCount: 0,
  failureCount: 0,
  skippedCount: 0,
  cursor: 0,
  itemResults: [
    {
      targetId: s08Id,
      targetType: 'content.entry',
      expectedVersion: '2',
      state: 'pending',
      attemptCount: 0,
      errorCode: null,
    },
  ],
  outboxEventId: null,
} as const;

export const s08GrantRequest = {
  action: 'create',
  grantId: null,
  expectedVersion: null,
  subjectPersonId: s08Id,
  capabilityKey: 'content.publish',
  resourceType: 'content.entry',
  resourceId: s08OtherId,
  scope: { actingPartyId: s08Id },
  actions: ['content.publish'],
  startsAt: s08Instant,
  endsAt: s08Later,
  reason: 'Bounded editorial review.',
  approverPersonId: null,
  purposeGrant: false,
  stepUpToken: 'step-up-token-that-is-long-enough',
} as const;

export const s08GrantResponse = {
  grantId: s08OtherId,
  subjectPersonId: s08Id,
  capabilityKey: 'content.publish',
  resourceType: 'content.entry',
  resourceId: s08OtherId,
  state: 'active',
  startsAt: s08Instant,
  endsAt: s08Later,
  version: '1',
  notificationTaskId: null,
  outboxEventId: s08Id,
} as const;

export const s08ReadAuditRequest = {
  action: 'read_audit',
  targetType: 'content.entry',
  targetId: s08Id,
  targetVersion: '2',
  auditLinkId: s08OtherId,
  diagnosticDefinitionKey: null,
  diagnosticDefinitionVersion: null,
  input: null,
  expectedFreshnessAt: null,
  reason: 'Inspect the immutable audit link.',
} as const;

export const s08RunDiagnosticRequest = {
  ...s08ReadAuditRequest,
  action: 'run_diagnostic',
  auditLinkId: null,
  diagnosticDefinitionKey: 'content.health',
  diagnosticDefinitionVersion: '1',
  input: { check: 'references' },
} as const;

export const s08DiagnosticResponse = {
  action: 'run_diagnostic',
  auditLinkId: null,
  diagnosticRunId: s08OtherId,
  targetType: 'content.entry',
  targetId: s08Id,
  targetVersion: '2',
  state: 'unknown',
  freshnessAt: null,
  evidenceRef: null,
  resultCodes: [],
  outboxEventId: null,
} as const;

export const s08ExpectedRoutes = [
  {
    operationId: 'CFG-05B-01',
    active: true,
    method: 'GET',
    path: '/api/v1/admin/inbox',
    requestSchema: 'Cfg05b01InboxQuerySchema',
    successSchema: 'Cfg05b01InboxResponseSchema',
    auth: 'session',
    timeoutMs: 8_000,
    idempotency: 'none',
    ifMatch: 'none',
  },
  {
    operationId: 'CFG-05B-02',
    active: false,
    method: 'POST',
    path: '/api/v1/admin/search',
    requestSchema: 'Cfg05b02SearchRequestSchema',
    successSchema: 'Cfg05b02SearchResponseSchema',
    auth: 'session',
    timeoutMs: 8_000,
    idempotency: 'required',
    ifMatch: 'none',
  },
  {
    operationId: 'CFG-05B-03',
    active: false,
    method: 'POST',
    path: '/api/v1/admin/bulk-operations',
    requestSchema: 'Cfg05b03BulkActionRequestSchema',
    successSchema: 'Cfg05b03BulkActionResponseSchema',
    auth: 'session',
    timeoutMs: 15_000,
    idempotency: 'required',
    ifMatch: 'required',
  },
  {
    operationId: 'CFG-05B-04',
    active: true,
    method: 'POST',
    path: '/api/v1/admin/capability-grants/actions',
    requestSchema: 'Cfg05b04CapabilityActionRequestSchema',
    successSchema: 'Cfg05b04CapabilityActionResponseSchema',
    auth: 'session',
    timeoutMs: 15_000,
    idempotency: 'required',
    ifMatch: 'required',
  },
  {
    operationId: 'CFG-05B-05',
    active: true,
    method: 'POST',
    path: '/api/v1/admin/audit-diagnostics/actions',
    requestSchema: 'Cfg05b05AuditDiagnosticRequestSchema',
    successSchema: 'Cfg05b05AuditDiagnosticResponseSchema',
    auth: 'session',
    timeoutMs: 15_000,
    idempotency: 'required',
    ifMatch: 'required',
  },
  {
    operationId: 'CFG-05B-06',
    active: true,
    method: 'POST',
    path: '/api/v1/admin/identity/mfa-factor-resets',
    requestSchema: 'Cfg05b06MfaFactorResetRequestSchema',
    successSchema: 'Cfg05b06MfaFactorResetResponseSchema',
    auth: 'session',
    timeoutMs: 15_000,
    idempotency: 'required',
    ifMatch: 'none',
  },
] as const;
