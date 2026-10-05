/**
 * Unified harness for the BE03a CMS-03A-09..18 acceptance-evidence suites.
 * It delegates to the DEC-108 (09-14) and grant (15-18) harnesses so every
 * evidence test drives the real Hono app, the real admission pipeline and the
 * real response mapping; only the dependency ports are faked.
 */
import {
  makeDec108Harness,
  requestFor as reviewRequestFor,
  sessionFor as reviewSessionFor,
  OPERATIONS as REVIEW_OPERATIONS,
} from './phase-02-slice-09-dec108-test-support';
import {
  GRANT_OPERATIONS,
  grantRequestFor,
  makeGrantHarness,
  ownerSession,
} from './phase-02-slice-09-grants-test-support';
import { ok } from './phase-02-slice-09-test-values';
import type {
  ContentSchemaRegistryResult,
  ContentSchemaRegistrySession,
} from './index';

export type EvidenceOperationId =
  | (typeof REVIEW_OPERATIONS)[number]['operationId']
  | (typeof GRANT_OPERATIONS)[number]['operationId'];

export type EvidenceOp = Readonly<{
  operationId: EvidenceOperationId;
  portName: string;
  method: 'GET' | 'POST';
  path: string;
  pathParams: Readonly<Record<string, string>>;
  body: Readonly<Record<string, unknown>> | undefined;
  output: unknown;
  status: number;
  ifMatch: boolean;
  stepUp: boolean;
  rateClass: string;
  limit: number;
  partyLimit: number;
  family: 'review' | 'grant';
}>;

export const EVIDENCE_OPS: readonly EvidenceOp[] = [
  ...REVIEW_OPERATIONS.map((spec) => ({ ...spec, family: 'review' as const })),
  ...GRANT_OPERATIONS.map((spec) => ({ ...spec, family: 'grant' as const })),
];

export const opFor = (operationId: EvidenceOperationId): EvidenceOp => {
  const found = EVIDENCE_OPS.find((op) => op.operationId === operationId);
  if (found === undefined) throw new Error(`Unknown operation ${operationId}`);
  return found;
};

type RateDecision = Readonly<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}>;

export type EvidenceHarnessOptions = Readonly<{
  session?: ContentSchemaRegistryResult<ContentSchemaRegistrySession>;
  rate?: ContentSchemaRegistryResult<RateDecision>;
  port?: ContentSchemaRegistryResult<unknown>;
}>;

export const harnessFor = (
  op: EvidenceOp,
  options: EvidenceHarnessOptions = {},
) =>
  op.family === 'review'
    ? makeDec108Harness({
        ...options,
        session: options.session ?? ok(reviewSessionFor(op as never)),
      })
    : makeGrantHarness(options);

export const requestFor = (
  op: EvidenceOp,
  options: Readonly<{
    headers?: Readonly<Record<string, string | null>>;
    body?: unknown;
    path?: string;
  }> = {},
): Request =>
  op.family === 'review'
    ? reviewRequestFor(op as never, options)
    : grantRequestFor(op as never, options);

export const sessionFor = (
  op: EvidenceOp,
  overrides: Partial<ContentSchemaRegistrySession> = {},
): ContentSchemaRegistrySession =>
  op.family === 'review'
    ? reviewSessionFor(op as never, overrides)
    : ownerSession(overrides);

export const calledPorts = (
  ports: Record<string, { mock: { calls: unknown[] } }>,
): number =>
  Object.values(ports).reduce((sum, port) => sum + port.mock.calls.length, 0);

export const ALL_IDS: readonly EvidenceOperationId[] = EVIDENCE_OPS.map(
  (op) => op.operationId,
);

export const bodyWith = (
  base: Readonly<Record<string, unknown>> | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> => {
  const next: Record<string, unknown> = { ...base, ...patch };
  for (const key of Object.keys(next))
    if (next[key] === undefined) delete next[key];
  return next;
};

/** Send the operation's default request with a body patch (undefined deletes). */
export const sendPatched = async (
  operationId: EvidenceOperationId,
  patch: Record<string, unknown>,
) => {
  const op = opFor(operationId);
  const harness = harnessFor(op);
  const body = bodyWith(op.body, patch);
  const ifMatch =
    typeof body.expectedVersion === 'string' ? body.expectedVersion : '1';
  const response = await harness.app.request(
    requestFor(op, {
      body,
      headers: op.ifMatch ? { 'if-match': `"${ifMatch}"` } : {},
    }),
  );
  return { op, harness, body, response };
};
