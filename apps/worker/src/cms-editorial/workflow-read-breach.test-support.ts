import { ApiErrorSchema } from '@wejammin/contracts';
import { expect } from 'vitest';

import { instant } from './workflow-fixtures.test-support';
import {
  getJson,
  workflowHarness,
  type WorkflowPortName,
} from './workflow-harness.test-support';

/*
 * Shared driver of the response-bound breach suites (P2-S11-AC-050, AC-053,
 * AC-056, AC-059 and the CMS-03B-17 page bounds): a dependency answer that
 * breaks the response bounds of CMS-03B-15, -16 or -17 is refused and never
 * served. The suites derive each payload from the accepted fixture so it breaks
 * exactly the member it names, ask the strict contract which member that is, and
 * require the route to answer a safe, fixed body (no payload text, no validator)
 * with the response-bound status.
 *
 * OWNER RULING PENDING: BE03b lines 290 and 292 and AC-050/053/056 say 422, and
 * BE00 line 590 and every shipped route say 502 BAD_GATEWAY. The status the
 * routes answer today is 502. It is written once, here, so the ruling flips this
 * one token (and selects the matching row of ENVELOPE) for every suite.
 */
export const RESPONSE_BOUND_STATUS: 502 | 422 = 502;

/** What the ruled status publishes: its code and the retryability header. */
const ENVELOPE = {
  502: { code: 'BAD_GATEWAY', retryable: 'false' },
  422: { code: 'VALIDATION_FAILED', retryable: null },
} as const;

export type BreachPort = Extract<
  WorkflowPortName,
  'getEntryWorkflow' | 'getEditorialReview' | 'listEditorialReviews'
>;

export type BreachSchema = Readonly<{
  safeParse: (value: unknown) => {
    success: boolean;
    error?: { issues: readonly { path: readonly PropertyKey[] }[] };
  };
}>;

/**
 * A named payload and the members it breaks, as dotted path prefixes. The first
 * is the member the case is about; a later one is a member the same defect
 * necessarily breaks too (a manifest and the version set projected from it).
 */
export type Breach = readonly [
  name: string,
  payload: unknown,
  at: readonly (readonly string[])[],
];

/** The dotted members (`'preparation.versionSet'`) a breach is expected to break. */
export const at = (
  ...members: readonly string[]
): readonly (readonly string[])[] => members.map((member) => member.split('.'));

/** The `it.each` rows of a breach list. */
export const breachRows = (breaches: readonly Breach[]) =>
  breaches.map((breach) => [breach[0], breach] as const);

/** A canonical lowercase UUID; ascending in `index` (bytewise order). */
export const uuid = (index: number): string =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

/** `instant` moved back by `seconds`, in the RFC 3339 form the contracts accept. */
export const instantBefore = (seconds: number): string =>
  new Date(Date.parse(instant) - seconds * 1000)
    .toISOString()
    .replace('.000Z', 'Z');

/** Every string of a payload long enough to identify it (ids, hashes, labels). */
const identifying = (value: unknown): string[] =>
  typeof value === 'string'
    ? value.length >= 12
      ? [value]
      : []
    : value !== null && typeof value === 'object'
      ? Object.values(value).flatMap(identifying)
      : [];

/** The members of `payload` the contract rejects (empty when it is accepted). */
const rejectedAt = (schema: BreachSchema, payload: unknown): string[][] =>
  (schema.safeParse(payload).error?.issues ?? []).map((issue) =>
    issue.path.map(String),
  );

const serve = (port: BreachPort, payload: unknown) =>
  workflowHarness({
    port: { [port]: async () => ({ ok: true as const, value: payload }) },
  });

/** Assert the payload breaks exactly `at`, then that the route refuses it unserved. */
export const expectRefused = async (
  port: BreachPort,
  schema: BreachSchema,
  path: string,
  [, payload, at]: Breach,
): Promise<void> => {
  const issues = rejectedAt(schema, payload);
  const within = (issue: string[], prefix: readonly string[]) =>
    prefix.every((segment, index) => issue[index] === segment);
  // The strict contract names the member this case is about, and no other.
  expect(issues.some((issue) => within(issue, at[0]!))).toBe(true);
  for (const issue of issues)
    expect(
      at.some((prefix) => within(issue, prefix)),
      issue.join('.'),
    ).toBe(true);

  const { app, ports, telemetry } = serve(port, payload);
  const response = await getJson(app, path);
  const text = await response.text();
  await Promise.resolve();
  const envelope = ENVELOPE[RESPONSE_BOUND_STATUS];

  expect(ports[port]).toHaveBeenCalledTimes(1);
  expect(response.status).toBe(RESPONSE_BOUND_STATUS);
  expect(response.headers.get('etag')).toBeNull();
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('x-cms-editorial-retryable')).toBe(
    envelope.retryable,
  );
  expect(ApiErrorSchema.parse(JSON.parse(text)).code).toBe(envelope.code);
  const served = identifying(payload);
  expect(served.length).toBeGreaterThan(0);
  for (const leaf of served) expect(text).not.toContain(leaf);
  for (const member of ['preparation', 'decisions', 'items', 'assignments'])
    expect(text).not.toContain(`"${member}"`);

  const event = telemetry.mock.calls[0]![0] as {
    status: number;
    errorCode?: string;
    metrics?: Record<string, number>;
  };
  expect(event).toMatchObject({
    status: RESPONSE_BOUND_STATUS,
    errorCode: envelope.code,
  });
  // A refused payload is never counted as returned, nor as a served preflight.
  expect(
    Object.keys(event.metrics ?? {}).filter(
      (key) => key.includes('_returned') || key.startsWith('cms_preflight'),
    ),
  ).toEqual([]);
};

/** The same route accepts the payload (the bound is inclusive, not off by one). */
export const expectServed = async (
  port: BreachPort,
  schema: BreachSchema,
  path: string,
  payload: unknown,
): Promise<void> => {
  expect(rejectedAt(schema, payload)).toEqual([]);
  const response = await getJson(serve(port, payload).app, path);
  expect(response.status).toBe(200);
  expect(response.headers.get('etag')).toMatch(/^"[^"]+"$/u);
};
