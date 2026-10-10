import {
  assignmentId,
  decisionBody,
  entryId,
  hash,
  hash2,
  idempotencyKey,
  partyId,
  publicationBody,
  publicationVersionId,
  reviewId,
  reviewerPersonId,
  revisionId,
  scheduleBody,
  scheduleId,
  schemaId,
  templateId,
  userId,
} from './workflow-fixtures.test-support';
import {
  CONTENT_SECRET_REASON,
  DEPENDENCY_HASH,
  PII_EMAIL,
  UPSTREAM_TEXT,
  type OperationCase,
  type Scenario,
} from './workflow-telemetry-redaction.test-support';

/*
 * The scenarios of the CMS-03B-06, CMS-03B-07 and CMS-03B-09 redaction suite:
 * one accepted command, every admission refusal that is reachable without a
 * port, and the port refusals the operation can publish.
 */

/** A port refusal: status, code and the machine details the port carries. */
const refused = (
  title: string,
  status: number,
  code: string,
  details?: Record<string, unknown>,
): Scenario => ({
  title,
  status,
  refusal: { status, code, ...(details === undefined ? {} : { details }) },
});

const separationOfDuties = refused(
  'a separation_of_duties refusal',
  403,
  'FORBIDDEN',
  { reasonCode: 'separation_of_duties' },
);

const versionSetStale = refused('a stale version set', 409, 'CONFLICT', {
  reasonCode: 'version_set_stale',
});

const dependencyChanged = (title: string): Scenario =>
  refused(title, 409, 'CONFLICT', {
    reasonCode: 'dependency_changed',
    dependencyHash: DEPENDENCY_HASH,
  });

const internalFailure = refused('an internal failure', 500, 'INTERNAL_ERROR');

/** The refusals reached before any port runs. */
const admissionRefusals: readonly Scenario[] = [
  { title: 'a stale MFA', status: 401, options: { mfaFresh: false } },
  {
    title: 'an unauthenticated caller',
    status: 401,
    options: { unauthenticated: true },
  },
  {
    title: 'a rate-limited caller',
    status: 429,
    options: { rateAllowed: false },
  },
  {
    title: 'an unknown request member carrying PII',
    status: 422,
    body: { email: PII_EMAIL },
  },
];

const failedPreflight = (
  entries: readonly Record<string, unknown>[],
): Scenario =>
  refused('a failed preflight', 422, 'VALIDATION_FAILED', {
    reasonCode: 'preflight_failed',
    preflight: entries,
  });

/** Values that identify a record, a person or caller content, for every operation. */
const commonSecrets = [
  ['session user id', userId],
  ['acting party id', partyId],
  ['idempotency key', idempotencyKey],
  ['entry id', entryId],
  ['revision id', revisionId],
  ['review id', reviewId],
  ['upstream text', UPSTREAM_TEXT],
  ['PII email', PII_EMAIL],
  ['dependency hash of a refusal', DEPENDENCY_HASH],
  ['hash', hash],
  ['hash2', hash2],
] as const satisfies ReadonlyArray<readonly [string, string]>;

export const cases: readonly OperationCase[] = [
  {
    operationId: 'CMS-03B-06',
    path: `/api/v1/cms/reviews/${reviewId}/decision`,
    body: { ...decisionBody, reason: CONTENT_SECRET_REASON },
    port: 'recordDecision',
    phase: null,
    secrets: [
      ...commonSecrets,
      ['decision reason', CONTENT_SECRET_REASON],
      ['decision reason sentence', 'after the legal call'],
      ['assignment id', assignmentId],
      ['reviewer person id', reviewerPersonId],
    ],
    scenarios: [
      { title: 'an approval', status: 200 },
      {
        title: 'a rejection',
        status: 200,
        body: { decision: 'reject', reason: CONTENT_SECRET_REASON },
      },
      ...admissionRefusals,
      separationOfDuties,
      dependencyChanged('a committed invalidation (dependency_changed)'),
      refused('a duplicate decision', 409, 'CONFLICT', {
        reasonCode: 'duplicate_decision',
      }),
      refused('a stale review version', 409, 'CONFLICT', {
        conflict: 'VERSION_MISMATCH',
        recoveryAction: 'reload',
        expectedVersion: '2',
        currentVersion: '3',
      }),
      refused('an unavailable dependency', 503, 'DEPENDENCY_UNAVAILABLE', {
        dependencyClass: 'cms_editorial',
      }),
      internalFailure,
    ],
  },
  {
    operationId: 'CMS-03B-07',
    path: '/api/v1/cms/publication-schedules',
    body: scheduleBody,
    port: 'schedulePublication',
    phase: 'schedule',
    secrets: [
      ...commonSecrets,
      ['schedule id', scheduleId],
      ['local date-time', scheduleBody.localDateTime],
      ['timezone', scheduleBody.timezone],
      ['resolved UTC instant', scheduleBody.resolvedUtc],
      ['tzdb version', scheduleBody.tzdbVersion],
      ['audience', scheduleBody.audience],
      ['version-set schema id', schemaId],
      ['version-set template id', templateId],
    ],
    scenarios: [
      { title: 'an accepted schedule', status: 202 },
      ...admissionRefusals,
      separationOfDuties,
      refused(
        'a publisher authority ending before the instant',
        422,
        'VALIDATION_FAILED',
        { reasonCode: 'authority_ends_before_schedule' },
      ),
      failedPreflight([
        {
          category: 'contract',
          outcome: 'failed',
          reasonCode: 'value_invalid',
        },
        { category: 'schema', outcome: 'passed', reasonCode: null },
      ]),
      versionSetStale,
      refused(
        'an unavailable preflight provider',
        503,
        'DEPENDENCY_UNAVAILABLE',
        {
          dependencyClass: 'preflight',
          retryable: true,
        },
      ),
      internalFailure,
    ],
  },
  {
    operationId: 'CMS-03B-09',
    path: '/api/v1/cms/publications',
    body: publicationBody,
    port: 'publishRevision',
    phase: 'publish',
    secrets: [
      ...commonSecrets,
      ['publication id', scheduleId],
      ['publication version id', publicationVersionId],
      ['audience', publicationBody.audience],
      ['version-set schema id', schemaId],
      ['version-set template id', templateId],
    ],
    scenarios: [
      { title: 'an accepted publication', status: 202 },
      ...admissionRefusals,
      separationOfDuties,
      refused('a lineage conflict (publication_conflict)', 409, 'CONFLICT', {
        reasonCode: 'publication_conflict',
      }),
      versionSetStale,
      dependencyChanged('a changed dependency'),
      failedPreflight([
        {
          category: 'accessibility',
          outcome: 'failed',
          reasonCode: 'blocking_finding',
        },
      ]),
      refused('an unavailable projection', 503, 'DEPENDENCY_UNAVAILABLE', {
        dependencyClass: 'cms_editorial',
      }),
      internalFailure,
    ],
  },
];
