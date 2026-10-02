import type {
  ContentSchemaRegistryOperationId,
  ContentSchemaRegistryPortInput,
  ContentSchemaRegistryResult,
} from './types';

/**
 * BE03a "Observability": labelled lifecycle counters for the review,
 * assignment, grant and dry-run commands. Each metric is one entry of the
 * telemetry `metrics` map keyed `name{label="value",...}` with labels in
 * alphabetical order. Label values come only from closed sets, never from
 * request text, and never include a reviewer, grantor or subject identifier.
 */
const DECISIONS: ReadonlySet<string> = new Set(['approve', 'reject']);
const RISK_CLASSES: ReadonlySet<string> = new Set(['ordinary', 'protected']);
const CLASSIFICATIONS: ReadonlySet<string> = new Set([
  'additive',
  'conditional',
  'breaking',
]);
const DRY_RUN_STATES: ReadonlySet<string> = new Set([
  'queued',
  'running',
  'completed',
  'failed',
]);
const ASSIGNMENT_ACTIONS: ReadonlySet<string> = new Set(['create', 'revoke']);
const GRANT_ACTIONS: Readonly<Partial<Record<string, string>>> = {
  'CMS-03A-15': 'granted',
  'CMS-03A-16': 'renewed',
  'CMS-03A-17': 'revoked',
};

const metricKey = (
  name: string,
  labels: Readonly<Record<string, string>>,
): string =>
  `${name}{${Object.keys(labels)
    .sort()
    .map((key) => `${key}="${labels[key]}"`)
    .join(',')}}`;

const outcomeFor = (result: ContentSchemaRegistryResult<unknown>): string => {
  if (result.ok) return 'success';
  if (result.status === 401 || result.status === 403 || result.status === 404)
    return 'denied';
  return result.status === 409 ? 'conflict' : 'failed';
};

const text = (value: unknown, key: string): string | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const found = (value as Record<string, unknown>)[key];
  return typeof found === 'string' ? found : undefined;
};

const member = (
  allowed: ReadonlySet<string>,
  value: string | undefined,
): string | undefined =>
  value !== undefined && allowed.has(value) ? value : undefined;

export const lifecycleMetrics = (
  operationId: ContentSchemaRegistryOperationId,
  input: ContentSchemaRegistryPortInput,
  result: ContentSchemaRegistryResult<unknown>,
  nowMs: number,
): Readonly<Record<string, number>> => {
  const value = result.ok ? result.value : undefined;
  if (operationId === 'CMS-03A-10' && result.ok) {
    const state = member(DRY_RUN_STATES, text(value, 'state'));
    const classification = member(
      CLASSIFICATIONS,
      text(value, 'classification'),
    );
    return state !== undefined && classification !== undefined
      ? {
          [metricKey('cms_schema_dry_run_total', { classification, state })]: 1,
        }
      : {};
  }
  if (operationId === 'CMS-03A-11' && result.ok) {
    const riskClass = member(RISK_CLASSES, text(value, 'riskClass'));
    return riskClass === undefined
      ? {}
      : { [metricKey('cms_schema_review_pending_total', { riskClass })]: 1 };
  }
  if (operationId === 'CMS-03A-12' && result.ok) {
    const decision = member(DECISIONS, text(value, 'decision'));
    return decision === undefined
      ? {}
      : { [metricKey('cms_schema_review_decision_total', { decision })]: 1 };
  }
  if (operationId === 'CMS-03A-13' && result.ok) {
    const submittedAt = Date.parse(text(value, 'submittedAt') ?? '');
    return text(value, 'state') === 'open' && Number.isFinite(submittedAt)
      ? { cms_schema_review_age: Math.max(0, (nowMs - submittedAt) / 1000) }
      : {};
  }
  if (operationId === 'CMS-03A-14') {
    const action = member(ASSIGNMENT_ACTIONS, text(input.body, 'action'));
    return action === undefined
      ? {}
      : {
          [metricKey('cms_schema_review_assignment_total', {
            action,
            outcome: outcomeFor(result),
          })]: 1,
        };
  }
  const grantAction = GRANT_ACTIONS[operationId];
  if (grantAction !== undefined)
    return {
      [metricKey('cms_capability_grant_total', {
        action: grantAction,
        outcome: outcomeFor(result),
      })]: 1,
    };
  return {};
};
