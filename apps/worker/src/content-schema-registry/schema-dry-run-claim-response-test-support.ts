import type { CmsSchemaDryRunClaimResponse } from './schema-dry-run-claim-response';

export const IDS = {
  job: '11111111-1111-4111-8111-111111111111',
  event: '22222222-2222-4222-8222-222222222222',
  owner: '33333333-3333-4333-8333-333333333333',
  report: '44444444-4444-4444-8444-444444444444',
  plan: '55555555-5555-4555-8555-555555555555',
  contentType: '66666666-6666-4666-8666-666666666666',
  source: '77777777-7777-4777-8777-777777777777',
  target: '88888888-8888-4888-8888-888888888888',
  other: '99999999-9999-4999-8999-999999999999',
};
type Changes = {
  [K in keyof CmsSchemaDryRunClaimResponse]?: Partial<
    CmsSchemaDryRunClaimResponse[K]
  >;
};

// Controlled schema values only: no persisted report or SQL eligibility proof.
export const responseFixture = (
  changes: Changes = {},
): CmsSchemaDryRunClaimResponse => ({
  job: {
    id: IDS.job,
    type: 'cms.schema.dry_run',
    version: '9007199254740997',
    actingPartyId: IDS.owner,
    originatingEventId: IDS.event,
    ...changes.job,
  },
  requestedEvent: {
    eventId: IDS.event,
    eventType: 'job.requested',
    schemaVersion: 1,
    aggregateType: 'job',
    aggregateId: IDS.job,
    aggregateVersion: '9007199254740993',
    correlationId: IDS.other,
    causationId: null,
    ...changes.requestedEvent,
  },
  report: {
    id: IDS.report,
    jobId: IDS.job,
    planId: IDS.plan,
    ownerId: IDS.owner,
    contentTypeId: IDS.contentType,
    sourceVersionId: IDS.source,
    targetVersionId: IDS.target,
    ...changes.report,
  },
  candidate: {
    id: IDS.target,
    ownerId: IDS.owner,
    contentTypeId: IDS.contentType,
    supersedesId: IDS.source,
    dryRunId: IDS.report,
    ...changes.candidate,
  },
  planScope: { ownerId: IDS.owner, dryRunId: IDS.report, ...changes.planScope },
  plan: {
    id: IDS.plan,
    contentTypeId: IDS.contentType,
    fromVersionId: IDS.source,
    toVersionId: IDS.target,
    state: 'verifying',
    version: '13',
    cursor: '2',
    progress: 0.5,
    sourceCount: '2',
    targetCount: '2',
    rowErrorCount: '0',
    migratedCount: '2',
    failedCount: '0',
    classification: 'additive',
    transformKey: null,
    transformVersion: null,
    compilerHash: 'a'.repeat(64),
    sourceHash: 'b'.repeat(64),
    targetHash: 'c'.repeat(64),
    activeVersionId: IDS.source,
    leaseOwner: null,
    leaseToken: null,
    leaseExpiresAt: null,
    ...changes.plan,
  },
});

export const firstFixture = (
  plan: Changes['plan'] = {},
): CmsSchemaDryRunClaimResponse =>
  responseFixture({
    report: { sourceVersionId: null },
    candidate: { supersedesId: null },
    plan: {
      fromVersionId: null,
      activeVersionId: null,
      state: 'draft',
      sourceHash: '0'.repeat(64),
      cursor: '0',
      sourceCount: '0',
      targetCount: '0',
      rowErrorCount: '0',
      migratedCount: '0',
      failedCount: '0',
      ...plan,
    },
  });

export const LEVELS = [
  {
    level: 'outer',
    keys: ['job', 'requestedEvent', 'report', 'candidate', 'planScope', 'plan'],
  },
  {
    level: 'job',
    keys: ['id', 'type', 'version', 'actingPartyId', 'originatingEventId'],
  },
  {
    level: 'requestedEvent',
    keys: [
      'eventId',
      'eventType',
      'schemaVersion',
      'aggregateType',
      'aggregateId',
      'aggregateVersion',
      'correlationId',
      'causationId',
    ],
  },
  {
    level: 'report',
    keys: [
      'id',
      'jobId',
      'planId',
      'ownerId',
      'contentTypeId',
      'sourceVersionId',
      'targetVersionId',
    ],
  },
  {
    level: 'candidate',
    keys: ['id', 'ownerId', 'contentTypeId', 'supersedesId', 'dryRunId'],
  },
  { level: 'planScope', keys: ['ownerId', 'dryRunId'] },
  {
    level: 'plan',
    keys: [
      'id',
      'contentTypeId',
      'fromVersionId',
      'toVersionId',
      'state',
      'version',
      'cursor',
      'progress',
      'sourceCount',
      'targetCount',
      'rowErrorCount',
      'migratedCount',
      'failedCount',
      'classification',
      'transformKey',
      'transformVersion',
      'compilerHash',
      'sourceHash',
      'targetHash',
      'activeVersionId',
      'leaseOwner',
      'leaseToken',
      'leaseExpiresAt',
    ],
  },
] as const;
export type Level = (typeof LEVELS)[number]['level'];
export const levelRecord = (
  value: CmsSchemaDryRunClaimResponse,
  level: Level,
): Record<string, unknown> => ({
  ...(level === 'outer' ? value : value[level]),
});
export const replaceLevel = (
  value: CmsSchemaDryRunClaimResponse,
  level: Level,
  replacement: unknown,
): unknown =>
  level === 'outer' ? replacement : { ...value, [level]: replacement };

// Descriptor/prototype snapshots retain hidden and inherited shape evidence.
export const snapshot = (value: unknown): unknown => {
  if (typeof value !== 'object' || value === null) return value;
  return {
    prototype: Object.getPrototypeOf(value),
    properties: Reflect.ownKeys(value).map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined)
        throw new Error('Missing fixture descriptor');
      return [key, { ...descriptor, value: snapshot(descriptor.value) }];
    }),
  };
};

export const BINDINGS: readonly { path: string; changes: Changes }[] = [
  {
    path: 'job.originatingEventId',
    changes: { job: { originatingEventId: IDS.other } },
  },
  {
    path: 'requestedEvent.aggregateId',
    changes: { requestedEvent: { aggregateId: IDS.other } },
  },
  { path: 'report.jobId', changes: { report: { jobId: IDS.other } } },
  { path: 'report.planId', changes: { report: { planId: IDS.other } } },
  { path: 'report.ownerId', changes: { report: { ownerId: IDS.other } } },
  { path: 'candidate.ownerId', changes: { candidate: { ownerId: IDS.other } } },
  { path: 'planScope.ownerId', changes: { planScope: { ownerId: IDS.other } } },
  {
    path: 'report.contentTypeId',
    changes: { report: { contentTypeId: IDS.other } },
  },
  {
    path: 'candidate.contentTypeId',
    changes: { candidate: { contentTypeId: IDS.other } },
  },
  {
    path: 'report.targetVersionId',
    changes: { report: { targetVersionId: IDS.other } },
  },
  {
    path: 'candidate.id',
    changes: {
      candidate: { id: IDS.other },
      report: { targetVersionId: IDS.other },
    },
  },
  {
    path: 'report.sourceVersionId',
    changes: { report: { sourceVersionId: IDS.other } },
  },
  {
    path: 'candidate.supersedesId',
    changes: {
      candidate: { supersedesId: IDS.other },
      report: { sourceVersionId: IDS.other },
    },
  },
  {
    path: 'candidate.dryRunId',
    changes: { candidate: { dryRunId: IDS.other } },
  },
  {
    path: 'planScope.dryRunId',
    changes: { planScope: { dryRunId: IDS.other } },
  },
];
