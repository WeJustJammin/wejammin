/**
 * AC527 (orchestrator ruling): CMS-03A-15 for an existing active aggregate is a 409
 * CONFLICT that carries `details.recoveryAction: 'renew'`.
 *
 * The database signals the case with DETAIL ACTIVE_GRANT_EXISTS (migration
 * 20261003140000). The production adapter keeps that distinction on the internal
 * result, the closed recovery lookup answers `renew` for it and for no other
 * conflict, and the wire stays the ordinary BE00 CONFLICT / INVALID_TRANSITION with
 * no database text.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  createContentSchemaRegistryApp,
  createProductionContentSchemaRegistryDependencies,
} from './index';
import { mapRpcFailure } from './production-errors';
import { safeDetails } from './route-response-details';
import type {
  ContentSchemaRegistryError,
  ContentSchemaRegistryPortInput,
} from './types';
import { lifecycleMetrics } from './route-lifecycle-metrics';
import {
  REQUEST_ID,
  json,
  options,
  requestContext,
} from './production-test-support';
import { SUBJECT_PERSON_ID } from './phase-02-slice-09-grants-test-support';

const ACTIVE_PAYLOAD = {
  code: 'P0001',
  message: 'CONFLICT',
  details: 'ACTIVE_GRANT_EXISTS',
  hint: null,
} as const;

const HUMAN_ORIGIN = 'https://cms.example.test';
const GRANT_BODY = {
  subjectPersonId: SUBJECT_PERSON_ID,
  capability: 'cms.author',
  validThrough: '2026-10-08',
};

const grantViaProductionApp = async (
  rpcRaises: Record<string, unknown>,
): Promise<Response> => {
  const fetchImpl = vi.fn<typeof fetch>(async () => json(rpcRaises, 400));
  const dependencies = createProductionContentSchemaRegistryDependencies(
    options(fetchImpl, {
      humanOrigins: [HUMAN_ORIGIN],
      now: () => Date.parse('2026-09-02T12:00:00.000Z'),
      resolveRequestContext: vi.fn(async () => requestContext),
    }),
  );
  const response = await createContentSchemaRegistryApp(dependencies).request(
    new Request('https://api.example.test/api/v1/cms/capability-grants', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: HUMAN_ORIGIN,
        'idempotency-key': 'cms-grant-renew-key-0001',
        'x-request-id': REQUEST_ID,
      },
      body: JSON.stringify(GRANT_BODY),
    }),
  );
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  return response;
};

describe('AC527 existing active aggregate directs the owner to renew', () => {
  it('[P2-S09-AC-527] a database CONFLICT whose detail is ACTIVE_GRANT_EXISTS keeps the existing aggregate on the 409 result', () => {
    expect(mapRpcFailure(400, ACTIVE_PAYLOAD)).toMatchObject({
      ok: false,
      status: 409,
      code: 'ACTIVE_GRANT_CONFLICT',
    });
    // The detail only marks a CONFLICT: it never turns another refusal into one, and a
    // detail-free conflict stays an ordinary state conflict.
    expect(
      mapRpcFailure(400, { ...ACTIVE_PAYLOAD, message: 'FORBIDDEN' }),
    ).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(
      mapRpcFailure(400, { ...ACTIVE_PAYLOAD, details: null }),
    ).toMatchObject({ status: 409, code: 'CONFLICT' });
  });

  it('[P2-S09-AC-527] the closed recovery lookup answers renew for that conflict only', () => {
    const active = mapRpcFailure(
      400,
      ACTIVE_PAYLOAD,
    ) as ContentSchemaRegistryError;
    expect(safeDetails(active, 'CMS-03A-15')).toEqual({
      conflict: 'INVALID_TRANSITION',
      recoveryAction: 'renew',
    });
    const plain = mapRpcFailure(400, {
      ...ACTIVE_PAYLOAD,
      details: null,
    }) as ContentSchemaRegistryError;
    expect(safeDetails(plain, 'CMS-03A-15')).toEqual({
      conflict: 'INVALID_TRANSITION',
      recoveryAction: 'refresh',
    });
    const mismatch = mapRpcFailure(400, {
      ...ACTIVE_PAYLOAD,
      message: 'IDEMPOTENCY_MISMATCH',
      details: null,
    }) as ContentSchemaRegistryError;
    expect(safeDetails(mismatch, 'CMS-03A-15')).toEqual({
      conflict: 'IDEMPOTENCY_MISMATCH',
      recoveryAction: 'use_new_idempotency_key',
    });
  });

  it('[P2-S09-AC-527] a producer-supplied renew is never trusted: only the registered database signal selects it', () => {
    const forged: ContentSchemaRegistryError = {
      ok: false,
      status: 409,
      code: 'CONFLICT',
      message: 'x',
      details: { recoveryAction: 'renew' },
    } as ContentSchemaRegistryError;
    expect(safeDetails(forged, 'CMS-03A-15')).toEqual({
      conflict: 'INVALID_TRANSITION',
      recoveryAction: 'refresh',
    });
  });

  it('[P2-S09-AC-527] CMS-03A-15 through the production adapter answers 409 CONFLICT { conflict: INVALID_TRANSITION, recoveryAction: renew } with no database text', async () => {
    const response = await grantViaProductionApp(ACTIVE_PAYLOAD);
    expect(response.status).toBe(409);
    const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({
      code: 'CONFLICT',
      details: { conflict: 'INVALID_TRANSITION', recoveryAction: 'renew' },
    });
    expect(text).not.toContain('ACTIVE_GRANT_EXISTS');
    const plain = await grantViaProductionApp({
      ...ACTIVE_PAYLOAD,
      details: null,
    });
    expect(plain.status).toBe(409);
    expect(JSON.parse(await plain.text())).toMatchObject({
      details: { conflict: 'INVALID_TRANSITION', recoveryAction: 'refresh' },
    });
  });

  it('[P2-S09-AC-527] the grant telemetry still counts it as a conflict outcome of the grant action', () => {
    const active = mapRpcFailure(400, ACTIVE_PAYLOAD);
    expect(
      lifecycleMetrics(
        'CMS-03A-15',
        {} as unknown as ContentSchemaRegistryPortInput,
        active,
        0,
      ),
    ).toEqual({
      'cms_capability_grant_total{action="granted",outcome="conflict"}': 1,
    });
  });
});
