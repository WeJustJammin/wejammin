/**
 * R12 (AC390, CMS-03A-09): the successor request may name a workflow policy
 * member with the both-null-or-absent / both-present pair semantics. The Worker
 * admits the absent, null and present forms unchanged to the port, refuses a
 * broken pair or a malformed member before the port with a BE00 pointer, and
 * relays the database's 422 for a member outside the seeded registry.
 */
import { describe, expect, it } from 'vitest';

import {
  makeDec108Harness,
  requestFor,
  sessionResult,
  specFor,
} from './phase-02-slice-09-dec108-test-support';
import { mapRpcFailure } from './production-errors';

const PAIR =
  'workflowKey and workflowVersion must be both null or both present';
const base = {
  expectedVersion: '1',
  supportedLocales: null,
  fallbackChains: null,
  defaultTemplateVersionId: null,
  templateBindings: null,
};

type Violation = Readonly<{ path?: string; message?: string }>;

const spec = specFor('CMS-03A-09');
const send = async (body: unknown) => {
  const harness = makeDec108Harness({ session: sessionResult(spec) });
  const response = await harness.app.request(requestFor(spec, { body }));
  return { response, port: harness.ports.createSchemaSuccessor };
};
const refused = async (member: Record<string, unknown>) => {
  const { response, port } = await send({ ...base, ...member });
  expect(response.status).toBe(422);
  expect(port).not.toHaveBeenCalled();
  const body = (await response.json()) as {
    code: string;
    details: { violations?: Violation[] };
  };
  expect(body.code).toBe('VALIDATION_FAILED');
  return body.details.violations ?? [];
};

describe('CMS-03A-09 successor workflow member admission (AC390)', () => {
  it('[P2-S09-AC-390] passes the request without the workflow pair to the port unchanged', async () => {
    const { response, port } = await send(base);
    expect(response.status).toBe(201);
    expect((port?.mock.calls[0]?.[0] as { body: unknown }).body).toEqual(base);
  });

  it('[P2-S09-AC-390] passes both workflow members null and both present to the port unchanged', async () => {
    const nulls = { ...base, workflowKey: null, workflowVersion: null };
    const first = await send(nulls);
    expect(first.response.status).toBe(201);
    expect((first.port?.mock.calls[0]?.[0] as { body: unknown }).body).toEqual(
      nulls,
    );
    const replace = {
      ...base,
      workflowKey: 'cms.disclosure.policy',
      workflowVersion: '1',
    };
    const second = await send(replace);
    expect(second.response.status).toBe(201);
    expect((second.port?.mock.calls[0]?.[0] as { body: unknown }).body).toEqual(
      replace,
    );
  });

  it('[P2-S09-AC-390] refuses a workflow key without its version and a version without its key at /workflowVersion', async () => {
    expect(await refused({ workflowKey: 'editorial' })).toEqual([
      { path: '/workflowVersion', message: PAIR },
    ]);
    expect(await refused({ workflowVersion: '1' })).toEqual([
      { path: '/workflowVersion', message: PAIR },
    ]);
  });

  it('[P2-S09-AC-390] refuses a malformed workflow key or version before the port', async () => {
    expect(
      (await refused({ workflowKey: 'Editorial', workflowVersion: '1' }))
        .length,
    ).toBeGreaterThan(0);
    expect(
      (await refused({ workflowKey: 'editorial', workflowVersion: '01' }))
        .length,
    ).toBeGreaterThan(0);
  });

  it('[P2-S09-AC-390] relays the database refusal of a member outside the seeded registry as a 422 VALIDATION_FAILED', () => {
    const mapped = mapRpcFailure(400, {
      code: 'P0001',
      message: 'VALIDATION_FAILED',
    });
    expect(mapped.status).toBe(422);
    expect(mapped.code).toBe('VALIDATION_FAILED');
  });
});
