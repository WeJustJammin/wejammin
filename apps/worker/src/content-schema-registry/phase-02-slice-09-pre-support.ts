/**
 * Shared harness helpers for the pre-amendment (A01-A08) acceptance-evidence
 * suites. Every helper drives the real Hono app, the real admission pipeline and
 * the real response mapping; only the dependency ports are faked.
 */
import { expect } from 'vitest';

import {
  jsonRequest,
  makeHarness,
  mutationPath,
  releaseRequest,
  type Harness,
} from './phase-02-slice-09-worker-test-support';
import { REQUEST_ID } from './phase-02-slice-09-test-values';

export type HumanCase = Readonly<{
  operationId: 'CMS-03A-01' | 'CMS-03A-02' | 'CMS-03A-03' | 'CMS-03A-04';
  path: string;
  port:
    | 'createTypeDraft'
    | 'addFieldDefinition'
    | 'bindRelation'
    | 'activateSchema';
  ifMatch: boolean;
}>;

export const HUMAN_CASES: readonly HumanCase[] = [
  {
    operationId: 'CMS-03A-01',
    path: '/api/v1/cms/content-types',
    port: 'createTypeDraft',
    ifMatch: false,
  },
  {
    operationId: 'CMS-03A-02',
    path: mutationPath.field,
    port: 'addFieldDefinition',
    ifMatch: true,
  },
  {
    operationId: 'CMS-03A-03',
    path: mutationPath.relation,
    port: 'bindRelation',
    ifMatch: true,
  },
  {
    operationId: 'CMS-03A-04',
    path: mutationPath.activate,
    port: 'activateSchema',
    ifMatch: true,
  },
];

export const humanCase = (operationId: HumanCase['operationId']): HumanCase => {
  const found = HUMAN_CASES.find((c) => c.operationId === operationId);
  if (found === undefined) throw new Error(`unknown ${operationId}`);
  return found;
};

export const sendHuman = (
  harness: Harness,
  operationId: HumanCase['operationId'],
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> => {
  const spec = humanCase(operationId);
  return Promise.resolve(
    harness.app.request(
      jsonRequest(spec.path, body, {
        ...(spec.ifMatch ? { 'if-match': '"1"' } : {}),
        ...headers,
      }),
    ),
  );
};

export type ErrorBody = Readonly<{
  code: string;
  message: string;
  requestId: string;
  details: Readonly<Record<string, unknown>> & {
    violations?: readonly { path?: string; message?: string; code?: string }[];
  };
}>;

export const bodyOf = async (response: Response): Promise<ErrorBody> =>
  (await response.json()) as ErrorBody;

/** The request is refused as 422 VALIDATION_FAILED before authority and the port. */
export const expectInvalid = async (
  harness: Harness,
  operationId: HumanCase['operationId'],
  body: unknown,
  pathPrefix?: string,
): Promise<void> => {
  const response = await sendHuman(harness, operationId, body);
  expect(response.status).toBe(422);
  const parsed = await bodyOf(response);
  expect(parsed.code).toBe('VALIDATION_FAILED');
  expect(parsed.requestId).toBe(REQUEST_ID);
  const paths = (parsed.details.violations ?? []).map((v) => v.path ?? '');
  expect(paths.length).toBeGreaterThan(0);
  if (pathPrefix !== undefined)
    expect(
      paths.some((p) => p === pathPrefix || p.startsWith(`${pathPrefix}/`)),
    ).toBe(true);
  expect(harness.resolveSession).not.toHaveBeenCalled();
  expect(harness.ports[humanCase(operationId).port]).not.toHaveBeenCalled();
};

/** The request is accepted: 2xx, port called once with the parsed body. */
export const expectAccepted = async (
  harness: Harness,
  operationId: HumanCase['operationId'],
  body: unknown,
): Promise<Record<string, unknown>> => {
  const response = await sendHuman(harness, operationId, body);
  expect([200, 201, 202]).toContain(response.status);
  const port = harness.ports[humanCase(operationId).port];
  expect(port).toHaveBeenCalledTimes(1);
  const input = port?.mock.calls[0]?.[0] as { body: Record<string, unknown> };
  return input.body;
};

/** Fresh harness per case so call counts never leak between rows. */
export const freshInvalid = (
  operationId: HumanCase['operationId'],
  body: unknown,
  pathPrefix?: string,
): Promise<void> => expectInvalid(makeHarness(), operationId, body, pathPrefix);

export const freshAccepted = (
  operationId: HumanCase['operationId'],
  body: unknown,
): Promise<Record<string, unknown>> =>
  expectAccepted(makeHarness(), operationId, body);

export { jsonRequest, makeHarness, mutationPath, releaseRequest };
export type { Harness };
