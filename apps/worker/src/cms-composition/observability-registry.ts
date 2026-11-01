import {
  CMS_CANONICAL_DOMAINS,
  CMS_GOVERNED_SCHEDULE_BLOCK_REASONS,
  CMS_GOVERNED_SUBJECT_KINDS,
  CMS_LOCALE_NO_FALLBACK_REASONS,
  GovernedInvalidatedReasonSchema,
} from '@wejammin/contracts';

/*
 * BE03c Observability (Slice 12): the metric registry. One executable form of sixteen metrics and their labels:
 * the twelve Slice 12 metrics of the Observability list, `cms_locale_stale_total` (named in the same section; DEC-208
 * drops its `locale` label), `cms_no_fallback_block_total{reason}` (P2-S12-AC-051), the DEC-208 gauge
 * `cms_locale_stale_legal_fields` and the DEC-219 counter `cms_locale_observability_read_failed_total`. "Labels never carry an id, label
 * text, locale text, hash or person": every label value set below is a closed vocabulary owned by the
 * contracts (or, for `outcome`, by the shared route outcome mapper), so no value can come from request text.
 * Descendant of the Slice 11 `CMS_SLICE_11_METRICS` registry; it lives in the Worker because the contracts
 * package is frozen for this slice.
 */

/** The closed request outcome every route metric shares (`metricOutcome` in `cms-editorial/route-telemetry`). */
export const CMS_REQUEST_OUTCOMES = [
  'success',
  'rate_limited',
  'denied',
  'conflict',
  'invalid',
  'failed',
] as const;

/** The outcome of one scheduled execution, as the activation sweep reports it (`error` is a thrown tick). */
const EXECUTION_OUTCOMES = [
  'completed',
  'blocked',
  'failed_retryable',
  'already_completed',
  'error',
] as const;

type LabelValues = Readonly<Record<string, readonly string[]>>;

export const CMS_SLICE_12_METRICS = {
  cms_governed_review_total: {
    subject_kind: [...CMS_GOVERNED_SUBJECT_KINDS],
    outcome: [...CMS_REQUEST_OUTCOMES],
  },
  cms_governed_decision_total: {
    decision: ['approve', 'reject'],
    outcome: [...CMS_REQUEST_OUTCOMES],
  },
  cms_governed_activation_total: {
    // `unknown` until a verified success names the subject (the route) is the route's own closed fallback.
    subject_kind: [...CMS_GOVERNED_SUBJECT_KINDS, 'unknown'],
    action: ['activate', 'schedule', 'retire'],
    outcome: [...CMS_REQUEST_OUTCOMES, ...EXECUTION_OUTCOMES],
  },
  cms_governed_review_invalidated_total: {
    reason: [...GovernedInvalidatedReasonSchema.options],
  },
  cms_governed_schedule_blocked_total: {
    reason: [...CMS_GOVERNED_SCHEDULE_BLOCK_REASONS],
  },
  cms_pattern_linked_update_pending_total: {},
  cms_pattern_update_total: {
    action: ['accept', 'detach'],
    outcome: [...CMS_REQUEST_OUTCOMES],
  },
  cms_canonical_match_total: {
    domain: [...CMS_CANONICAL_DOMAINS],
    // `no_match` is the clean pass inside the database; the Worker only ever sees a refusal.
    outcome: ['match', 'source_unavailable'],
  },
  cms_canonical_source_unavailable_total: {
    domain: [...CMS_CANONICAL_DOMAINS],
  },
  cms_related_target_ineligible_total: {},
  cms_locale_fanout_total: {},
  // DEC-208 / DEC-213: counts stale fields at append, read from the database each scheduled tick (no `locale` label).
  cms_locale_stale_total: {},
  cms_locale_limit_reached_total: {},
  cms_no_fallback_block_total: {
    reason: [...CMS_LOCALE_NO_FALLBACK_REASONS],
  },
  // DEC-208 gauge: stale no_fallback fields on current locale variants, sampled every tick; the alert input.
  cms_locale_stale_legal_fields: {},
  // DEC-220: one per failed, timed-out or malformed locale observability read; each also raises `locale_observability_unavailable`.
  cms_locale_observability_read_failed_total: {},
} as const satisfies Readonly<Record<string, LabelValues>>;

export type CmsSlice12MetricName = keyof typeof CMS_SLICE_12_METRICS;

/**
 * Metrics the spec names whose event happens in a consumer that does not exist yet, with the exact seam that is
 * missing. (`cms_locale_fanout_total` and `cms_locale_stale_total` left this list when DEC-208 / DEC-213 gave
 * them a source: the per-minute database-side read in `locale-observability.ts`; `cms_pattern_linked_update_pending_total`
 * left it when the `cms.pattern.linked_update_scan` job landed in `linked-scan/job.ts`, which increments it by the
 * `pending_diff` rows each run appended, P2-S12-AC-212.) None is emitted from here; inventing a path from a
 * database-internal event to a Worker counter would be a decision the spec does not make.
 */
export const CMS_SLICE_12_UNEMITTED_METRICS: readonly Readonly<{
  metric: string;
  missing: string;
}>[] = [];

const KEY =
  /^([a-z][a-z0-9_]*)(?:\{([a-z][a-z0-9_]*="[^"{},]*"(?:,[a-z][a-z0-9_]*="[^"{},]*")*)\})?$/u;

/** True when `key` is a registered metric whose labels are exactly the registered ones with closed values. */
export const metricKeyConforms = (key: string): boolean => {
  const match = KEY.exec(key);
  if (match === null) return false;
  const registry: Readonly<Record<string, LabelValues>> = CMS_SLICE_12_METRICS;
  const labels = registry[match[1] as string];
  if (labels === undefined) return false;
  const pairs = (match[2] ?? '')
    .split(',')
    .filter((pair) => pair !== '')
    .map((pair) => /^([a-z0-9_]+)="(.*)"$/u.exec(pair) as RegExpExecArray);
  const names = pairs.map((pair) => pair[1] as string).sort();
  if (names.join(',') !== Object.keys(labels).sort().join(',')) return false;
  return pairs.every((pair) =>
    (labels[pair[1] as string] as readonly string[]).includes(
      pair[2] as string,
    ),
  );
};

/** The only `attributes` members a Slice 12 request log line may carry: closed codes and the runbook name. */
export const CMS_COMPOSITION_LOG_ATTRIBUTES: readonly string[] = [
  'actor_class',
  'status',
  'runbook',
];

/**
 * BE03c Observability: "Traces cover validation -> principal/assignment -> registry/projection refetch ->
 * idempotency -> RPC/SQL -> audit/outbox -> consumer refetch." One entry per stage, in the spec order, with
 * the step name its request event lists and the seam that observes it:
 * - `route`: every request enters it (the admission pipeline);
 * - `port`: the Worker seam is really called (session resolver, fresh-context re-proof, command or read port);
 * - `sql_commit`: PostgreSQL audit and outbox are written in the command's transaction (audit failure rolls
 *   the command back), so a command answered below 400 is the Worker-visible proof the stage ran;
 * - `consumer`: the queue consumers (`governed-recheck`) reread the committed event, not a request.
 */
export const CMS_COMPOSITION_TRACE_STAGES = [
  {
    stage: 'validation',
    step: 'cms.composition.validation',
    observedBy: 'route',
  },
  {
    stage: 'principal_assignment',
    step: 'cms.composition.principal',
    observedBy: 'port',
  },
  {
    stage: 'registry_refetch',
    step: 'cms.composition.refetch',
    observedBy: 'port',
  },
  {
    stage: 'idempotency',
    step: 'cms.composition.idempotency',
    observedBy: 'port',
  },
  { stage: 'rpc', step: 'cms.composition.rpc', observedBy: 'port' },
  {
    stage: 'audit_outbox',
    step: 'cms.composition.audit_outbox',
    observedBy: 'sql_commit',
  },
  {
    stage: 'consumer_refetch',
    step: 'cms.composition.consumer_refetch',
    observedBy: 'consumer',
  },
] as const;

export type CmsCompositionTraceStage =
  (typeof CMS_COMPOSITION_TRACE_STAGES)[number]['stage'];

/**
 * The members a Slice 12 structured log line may carry: the BE03c key set (operation, request id, trace and
 * correlation id, actor/acting-context class, safe aggregate id/hash and version, outcome, error code,
 * duration, dependency class, retryability) plus the logger envelope and the closed attribute and metric maps.
 * Content, locale text, labels, target names, tokens, raw rules and capability graphs have no member.
 */
export const CMS_COMPOSITION_LOG_FIELDS: readonly string[] = [
  'actingContextClass',
  'actorClass',
  'attributes',
  'correlationId',
  'dependency',
  'durationMs',
  'entityIdHash',
  'entityType',
  'entityVersion',
  'environment',
  'errorCode',
  'eventName',
  'metrics',
  'operation',
  'outcome',
  'release',
  'requestId',
  'retryable',
  'service',
  'severity',
  'timestamp',
  'traceId',
  'traceSteps',
];

/** The step name a stage's request or consumer event lists. */
export const traceStepOf = (stage: CmsCompositionTraceStage): string =>
  CMS_COMPOSITION_TRACE_STAGES.find((entry) => entry.stage === stage)!.step;

/** A fresh, mutable list of the step names of `stages`, for a consumer event's `traceSteps` member. */
export const traceStepsOf = (
  ...stages: readonly CmsCompositionTraceStage[]
): string[] => stages.map(traceStepOf);
