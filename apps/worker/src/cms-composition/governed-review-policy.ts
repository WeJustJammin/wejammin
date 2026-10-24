/**
 * The Worker policy of the governed-review routes CMS-03C-06, -07, -08, -10 and
 * -11 (BE03c rows 168-173). `governed-review-registry.test.ts` pins method, path,
 * quota, deadline, step-up, CSRF, idempotency and If-Match to the frozen registry
 * row, `capabilities` to the registry list (CMS-03C-08, -10 and -11 deliberately
 * keep no Worker gate: the database resolves the scope), `declared` to the
 * generated OpenAPI status sets and `pointers` to the request-schema members, so a
 * change in any of them fails a test instead of silently diverging. CMS-03C-09 (row 171) is the
 * activation, scheduling and retirement command.
 */

export type GovernedOperation =
  | 'CMS-03C-06'
  | 'CMS-03C-07'
  | 'CMS-03C-08'
  | 'CMS-03C-09'
  | 'CMS-03C-10'
  | 'CMS-03C-11';

export type GovernedHttpStatus =
  400 | 401 | 403 | 404 | 409 | 415 | 422 | 429 | 500 | 502 | 503 | 504;

export type GovernedRateClass =
  | 'cms-governed-review-write'
  | 'cms-governed-decision'
  | 'cms-governed-assignment'
  | 'cms-governed-activation'
  | 'cms-governed-review-read';

export type GovernedPolicy = Readonly<{
  method: 'GET' | 'POST';
  honoPath: string;
  rateClass: GovernedRateClass;
  userLimit: number;
  partyLimit: number;
  windowSeconds: 60;
  deadlineMs: number;
  /** Unconditional recent MFA (BE03c 216): 401 `STEP_UP_REQUIRED` before any quota. */
  stepUp: boolean;
  ifMatch: boolean;
  /** Coarse any-of Worker gate. Empty: the database resolves the scope (403/404). */
  capabilities: readonly string[];
  /** CMS-03C-06 only: the owner party is the subject scope, so no party is a 403. */
  requiresParty: boolean;
  /** The HTTP statuses the operation documents (OpenAPI); any other becomes 500. */
  declared: ReadonlySet<GovernedHttpStatus>;
  rpc: string;
  /** Telemetry `operation` name. */
  event: string;
  /** Request pointers a validation failure may name; anything else is attacker text. */
  pointers: ReadonlySet<string>;
}>;

const ALL: readonly GovernedHttpStatus[] = [
  400, 401, 403, 404, 409, 415, 422, 429, 500, 502, 503, 504,
];
const set = <T>(values: readonly T[]): ReadonlySet<T> => new Set(values);
const pointers = (...members: string[]): ReadonlySet<string> =>
  set(members.map((member) => `/${member}`));

const COMMAND = {
  method: 'POST',
  windowSeconds: 60,
  deadlineMs: 15_000,
  declared: set(ALL),
} as const;
const READ = {
  method: 'GET',
  honoPath: '',
  rateClass: 'cms-governed-review-read',
  userLimit: 300,
  partyLimit: 600,
  windowSeconds: 60,
  deadlineMs: 8_000,
  stepUp: false,
  ifMatch: false,
  capabilities: [],
  requiresParty: false,
} as const;

export const GOVERNED_POLICIES: Readonly<
  Record<GovernedOperation, GovernedPolicy>
> = {
  'CMS-03C-06': {
    ...COMMAND,
    honoPath: '/api/v1/cms/governed-reviews',
    rateClass: 'cms-governed-review-write',
    userLimit: 30,
    partyLimit: 60,
    stepUp: false,
    ifMatch: false,
    capabilities: ['cms.template_designer', 'cms.taxonomy_curator'],
    requiresParty: true,
    rpc: 'cms_submit_governed_review',
    event: 'cms.composition.governed_review.submit',
    pointers: pointers('subjectKind', 'subjectId', 'subjectHash'),
  },
  'CMS-03C-07': {
    ...COMMAND,
    honoPath: '/api/v1/cms/governed-reviews/:reviewId/decision',
    rateClass: 'cms-governed-decision',
    userLimit: 30,
    partyLimit: 60,
    stepUp: true,
    ifMatch: true,
    capabilities: ['cms.reviewer'],
    requiresParty: false,
    rpc: 'cms_record_governed_decision',
    event: 'cms.composition.governed_review.decide',
    pointers: pointers('reviewId', 'decision', 'reason', 'expectedVersion'),
  },
  'CMS-03C-08': {
    ...COMMAND,
    honoPath: '/api/v1/cms/governed-reviews/:reviewId/assignments',
    rateClass: 'cms-governed-assignment',
    userLimit: 10,
    partyLimit: 20,
    stepUp: true,
    ifMatch: true,
    // `cms.definition_review.assign` is derived from the owner receipt and is never a
    // session capability (BE03c 170), so the database alone decides 403 vs 404.
    capabilities: [],
    requiresParty: false,
    rpc: 'cms_assign_governed_reviewer',
    event: 'cms.composition.governed_review.assign',
    pointers: pointers(
      'action',
      'expectedVersion',
      'reviewerPersonId',
      'expiresAt',
      'assignmentId',
      'reason',
    ),
  },
  'CMS-03C-09': {
    ...COMMAND,
    honoPath: '/api/v1/cms/governed-reviews/:reviewId/activation',
    rateClass: 'cms-governed-activation',
    userLimit: 20,
    partyLimit: 40,
    stepUp: true,
    ifMatch: true,
    // Registry `any_of`: the owner capability of the subject kind. The kind itself is the
    // database's decision (a Worker check would turn the hidden-review 404 into a 403).
    capabilities: ['cms.template_designer', 'cms.taxonomy_curator'],
    requiresParty: false,
    rpc: 'cms_activate_governed_subject',
    event: 'cms.composition.governed_review.activate',
    pointers: new Set([
      ...pointers('action', 'expectedVersion', 'activateAt', 'reason'),
      ...pointers(
        'activateAt/localDateTime',
        'activateAt/timezone',
        'activateAt/resolvedUtc',
        'activateAt/tzdbVersion',
        'activateAt/disambiguation',
      ),
    ]),
  },
  'CMS-03C-10': {
    ...READ,
    honoPath: '/api/v1/cms/governed-reviews/:reviewId',
    rpc: 'cms_get_governed_review',
    event: 'cms.composition.governed_review.detail',
    declared: set([400, 401, 403, 404, 415, 429, 500, 502, 503, 504]),
    pointers: pointers(),
  },
  'CMS-03C-11': {
    ...READ,
    honoPath: '/api/v1/cms/governed-reviews',
    rpc: 'cms_list_governed_reviews',
    event: 'cms.composition.governed_review.queue',
    declared: set([400, 401, 409, 415, 422, 429, 500, 502, 503, 504]),
    pointers: pointers('cursor', 'limit', 'scope', 'state', 'subjectKind'),
  },
};

export const policyOf = (operation: GovernedOperation): GovernedPolicy =>
  GOVERNED_POLICIES[operation];
