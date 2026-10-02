import type { ContentSchemaRegistryOperationalSnapshot } from '@wejammin/observability/content-schema-registry-alerts';

type ProviderEvent = Readonly<{ source?: unknown }>;

type SnapshotInput = Readonly<{
  database: Readonly<{
    activationBlockedMs?: number;
    outboxAgeMs?: number;
    reviewOpenAgeMs?: number;
  }>;
  dlqDepth?: number;
  events: readonly ProviderEvent[];
  now: number;
}>;

type StructuredEvent = Readonly<{
  attempt?: number;
  durationMs?: number;
  errorCode?: string;
  eventName?: string;
  metrics?: unknown;
  operation?: unknown;
  outcome?: string;
  retryable?: boolean;
  timestamp?: string;
}>;

const MIGRATION_DLQ_TOTAL = 'cms.migration.dlq.total' as const;

/**
 * BE03a Observability denial families. A denial is a protected command whose
 * response is 401, 403 or 404 (the `denied` outcome label of the lifecycle
 * counters). A refused command rolls back its transaction, so denials are
 * counted from the command telemetry events, never from database rows.
 */
const DENIAL_STATUSES: ReadonlySet<number> = new Set([401, 403, 404]);
const DENIAL_FAMILIES = {
  decision: ['CMS-03A-12'],
  assignment: ['CMS-03A-14'],
  capabilityGrant: ['CMS-03A-15', 'CMS-03A-16', 'CMS-03A-17'],
} as const;

const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const structured = (event: ProviderEvent): StructuredEvent | undefined =>
  record(event.source) as StructuredEvent | undefined;

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const timestamp = (event: StructuredEvent): number | undefined => {
  if (typeof event.timestamp !== 'string') return undefined;
  const value = Date.parse(event.timestamp);
  return Number.isFinite(value) ? value : undefined;
};

const percentile = (
  events: readonly StructuredEvent[],
  eventName: string,
  quantile: number,
): number | undefined => {
  const values = events
    .filter(
      (event) => event.eventName === eventName && finite(event.durationMs),
    )
    .map((event) => event.durationMs as number)
    .sort((left, right) => left - right);
  if (values.length === 0) return undefined;
  return values[Math.max(0, Math.ceil(values.length * quantile) - 1)];
};

const count = (
  events: readonly StructuredEvent[],
  predicate: (event: StructuredEvent) => boolean,
): number => events.filter(predicate).length;

const errorIncludes = (event: StructuredEvent, value: string): boolean =>
  typeof event.errorCode === 'string' && event.errorCode.includes(value);

const migrationDlqTotal = (
  events: readonly StructuredEvent[],
): number | undefined => {
  const migrations = events.filter(
    (event) => event.eventName === 'cms.registry.migration',
  );
  if (migrations.length === 0) return undefined;

  let total = 0;
  for (const event of migrations) {
    const metrics = record(event.metrics);
    const value = metrics?.[MIGRATION_DLQ_TOTAL];
    if (!finite(value)) return undefined;
    total += value;
  }
  return total;
};

const denialCount = (
  events: readonly StructuredEvent[],
  operationIds: readonly string[],
): number =>
  count(events, (event) => {
    if (event.eventName !== 'cms.registry.command') return false;
    if (typeof event.operation !== 'string') return false;
    const operation = event.operation;
    if (!operationIds.some((id) => operation === `cms.registry.${id}`))
      return false;
    const status = record(event.metrics)?.request_status;
    return typeof status === 'number' && DENIAL_STATUSES.has(status);
  });

export const buildContentSchemaRegistryOperationalSnapshot = (
  input: SnapshotInput,
): ContentSchemaRegistryOperationalSnapshot => {
  const all = input.events
    .map(structured)
    .filter((event): event is StructuredEvent => event !== undefined);
  const day = all.filter((event) => {
    const at = timestamp(event);
    return at !== undefined && at >= input.now - 86_400_000 && at <= input.now;
  });

  const current = day.filter((event) => {
    const at = timestamp(event);
    return at !== undefined && at >= input.now - 300_000;
  });
  const baseline = day.filter((event) => {
    const at = timestamp(event);
    return (
      at !== undefined && at >= input.now - 600_000 && at < input.now - 300_000
    );
  });
  const commands = current.filter(
    (event) => event.eventName === 'cms.registry.command',
  );
  const conflicts = count(commands, (event) =>
    errorIncludes(event, 'CONFLICT'),
  );
  const queueAttempts = count(
    day,
    (event) => event.eventName === 'cms.registry.queue_attempt',
  );
  const dlqTransitions = migrationDlqTotal(day);
  const retryAttempts = current
    .filter(
      (event) =>
        event.eventName === 'cms.registry.migration' && finite(event.attempt),
    )
    .map((event) => event.attempt as number);
  const commandP95Ms = percentile(current, 'cms.registry.command', 0.95);
  const protectedRpcP95Ms = percentile(current, 'cms.registry.rpc', 0.95);
  const acceptanceP99Ms = percentile(current, 'cms.registry.acceptance', 0.99);
  const queueFirstAttemptP95Ms = percentile(
    current.filter((event) => event.attempt === 1),
    'cms.registry.queue_attempt',
    0.95,
  );

  return {
    ...(finite(input.database.activationBlockedMs)
      ? { activationBlockedMs: input.database.activationBlockedMs }
      : {}),
    ...(retryAttempts.length > 0
      ? { migrationRetryCount: Math.max(...retryAttempts) }
      : {}),
    ...(finite(input.database.reviewOpenAgeMs)
      ? { reviewOpenAgeMs: input.database.reviewOpenAgeMs }
      : {}),
    decisionDenialRate: denialCount(current, DENIAL_FAMILIES.decision),
    decisionDenialBaseline: denialCount(baseline, DENIAL_FAMILIES.decision),
    assignmentDenialRate: denialCount(current, DENIAL_FAMILIES.assignment),
    assignmentDenialBaseline: denialCount(baseline, DENIAL_FAMILIES.assignment),
    capabilityGrantDenialRate: denialCount(
      current,
      DENIAL_FAMILIES.capabilityGrant,
    ),
    capabilityGrantDenialBaseline: denialCount(
      baseline,
      DENIAL_FAMILIES.capabilityGrant,
    ),
    nonceRejectionRate: count(current, (event) =>
      errorIncludes(event, 'NONCE'),
    ),
    nonceRejectionBaseline: count(baseline, (event) =>
      errorIncludes(event, 'NONCE'),
    ),
    ...(finite(input.dlqDepth) ? { dlqDepth: input.dlqDepth } : {}),
    ...(finite(input.database.outboxAgeMs)
      ? { outboxAgeMs: input.database.outboxAgeMs }
      : {}),
    ...(commands.length > 0
      ? { conflictRate: conflicts / commands.length }
      : {}),
    conflictWindowMs: 300_000,
    unknownEventVersions: count(current, (event) =>
      errorIncludes(event, 'UNKNOWN_EVENT_VERSION'),
    ),
    ...(commandP95Ms === undefined ? {} : { commandP95Ms }),
    ...(protectedRpcP95Ms === undefined ? {} : { protectedRpcP95Ms }),
    ...(acceptanceP99Ms === undefined ? {} : { acceptanceP99Ms }),
    ...(queueFirstAttemptP95Ms === undefined ? {} : { queueFirstAttemptP95Ms }),
    ...(queueAttempts > 0 && dlqTransitions !== undefined
      ? { dailyDlqRate: dlqTransitions / queueAttempts }
      : {}),
  };
};
