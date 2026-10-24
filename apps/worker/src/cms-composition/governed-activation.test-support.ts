import {
  CMS_TZDB_VERSION,
  GovernedActivationApiRequestSchema,
  GovernedActivationResourceSchema,
  type GovernedActivationResource,
} from '@wejammin/contracts';

import { authenticationSession } from '../cms-editorial-production-session-test-support';
import {
  FRESH_STEP_UP,
  governedHarness,
  jsonReply,
  KEY,
  ORIGIN,
  PATH,
  REQUEST_ID,
  REVIEW_ID,
} from './governed-review-ops.test-support';
import {
  designerSession,
  LINEAGE_ID,
  SUBJECT_ID,
} from './governed-review-submit.test-support';

export { KEY, REVIEW_ID };

/** CMS-03C-09 fixtures: the review is approved at version 3 (the If-Match operand). */
export const NOW_MS = Date.parse('2026-10-14T00:00:01Z');
/** One second old at `NOW_MS`: inside the DEC-111 window. */
export const FRESH_AT_NOW = '2026-10-14T00:00:00.000Z';

type Init = { headers?: Record<string, string | null>; raw?: string };

export const activationPath = (reviewId = REVIEW_ID): string =>
  `https://api.example.test${PATH}/${reviewId}/activation`;

/** 09:30 on the day the US fall-back clocks change is unique: EST, UTC-5. */
export const scheduleAt = (overrides: Record<string, unknown> = {}) => ({
  localDateTime: '2026-11-01T09:30:00',
  timezone: 'America/New_York',
  resolvedUtc: '2026-11-01T14:30:00Z',
  tzdbVersion: CMS_TZDB_VERSION,
  disambiguation: 'none',
  ...overrides,
});
export const activateBody = (overrides: Record<string, unknown> = {}) => ({
  action: 'activate',
  expectedVersion: '3',
  ...overrides,
});
export const scheduleBody = (overrides: Record<string, unknown> = {}) => ({
  action: 'schedule',
  expectedVersion: '3',
  activateAt: scheduleAt(),
  ...overrides,
});
export const retireBody = (overrides: Record<string, unknown> = {}) => ({
  action: 'retire',
  expectedVersion: '3',
  ...overrides,
});

export const activationRequest = (
  body: unknown = activateBody(),
  init: Init = {},
  url = activationPath(),
): Request => {
  const headers = new Headers({
    origin: ORIGIN,
    'x-request-id': REQUEST_ID,
    'content-type': 'application/json',
    'idempotency-key': KEY,
    'if-match': '"3"',
  });
  for (const [name, value] of Object.entries(init.headers ?? {}))
    if (value === null) headers.delete(name);
    else headers.set(name, value);
  return new Request(url, {
    method: 'POST',
    headers,
    body: init.raw ?? JSON.stringify(body),
  });
};

/** Fixtures are asserted against the frozen transport schema, never trusted blindly. */
export const assertActivationContract = (body: unknown): void => {
  const parsed = GovernedActivationApiRequestSchema.safeParse({
    reviewId: REVIEW_ID,
    headers: {
      contentType: 'application/json',
      idempotencyKey: KEY,
      ifMatch: '"3"',
    },
    body,
  });
  if (!parsed.success) throw new Error('activation fixture violates contract');
};

/** The state an immediate activation leaves: review CAS + 1, subject active, one event; version 2 superseded version 1 (DEC-191). */
export const activatedResource = (
  overrides: Record<string, unknown> = {},
): GovernedActivationResource =>
  GovernedActivationResourceSchema.parse({
    reviewId: REVIEW_ID,
    reviewVersion: '4',
    subjectKind: 'template_version',
    subjectId: SUBJECT_ID,
    lineageId: LINEAGE_ID,
    subjectVersion: 2,
    supersededVersion: 1,
    action: 'activate',
    subjectState: 'active',
    activatedAt: '2026-10-14T00:00:02Z',
    scheduledForUtc: null,
    eventType: 'cms.template.activated.v1',
    ...overrides,
  });
/** A scheduled acceptance leaves the review version unchanged and emits no event. */
export const scheduledResource = (
  overrides: Record<string, unknown> = {},
): GovernedActivationResource =>
  activatedResource({
    reviewVersion: '3',
    supersededVersion: null,
    action: 'schedule',
    subjectState: 'scheduled',
    activatedAt: null,
    scheduledForUtc: '2026-11-01T14:30:00Z',
    eventType: null,
    ...overrides,
  });
/** A retirement advances the review version by one, like an activation (root ruling on DEC-190), and emits the subject-kind event. */
export const retiredResource = (
  overrides: Record<string, unknown> = {},
): GovernedActivationResource =>
  activatedResource({
    reviewVersion: '4',
    supersededVersion: null,
    action: 'retire',
    subjectState: 'retired',
    ...overrides,
  });

type HarnessOptions = Parameters<typeof governedHarness>[0];

/** A designer with a fresh MFA proof; the clock is 1970 (no schedule time rules involved). */
export const activationHarness = (
  options: HarnessOptions = {},
  reply: () => Promise<Response> = () => jsonReply(activatedResource()),
) =>
  governedHarness({
    session: designerSession,
    stepUpAt: FRESH_STEP_UP,
    reply,
    ...options,
  });

/**
 * The same with the clock at `NOW_MS`, so the real pinned Time authority sees a real horizon. The
 * session fixture is re-dated: its default one expired in September.
 */
export const scheduleHarness = (
  options: HarnessOptions = {},
  reply: () => Promise<Response> = () => jsonReply(scheduledResource()),
) => {
  const session = options.session ?? designerSession;
  const stepUpAt = 'stepUpAt' in options ? options.stepUpAt : FRESH_AT_NOW;
  return governedHarness({
    session,
    authority: {
      auth: {
        resolveSession: async () => ({
          ok: true as const,
          value: authenticationSession({
            authUserId: session.userId,
            actingPartyId: session.actingPartyId,
            stepUpAt: stepUpAt ?? null,
            expiresAt: '2026-10-14T01:00:00.000Z',
          }),
        }),
      },
      resolveCapabilities: session.capabilities,
    },
    reply,
    ...options,
    tuning: { now: () => NOW_MS, ...options.tuning },
  });
};

/** The `p_request` of the first RPC call. */
export const wireRequest = (
  harness: ReturnType<typeof governedHarness>,
  call = 0,
): Record<string, unknown> =>
  (
    JSON.parse(String(harness.fetchImpl.mock.calls[call]?.[1]?.body)) as {
      p_request: Record<string, unknown>;
    }
  ).p_request;
