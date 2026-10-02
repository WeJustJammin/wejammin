/**
 * R2: BE00 error-details allowlists for CMS-03A-09..18 on the wire.
 *   400 / 422 -> { violations?: FieldViolation[] } only
 *   409       -> { expectedVersion?, currentVersion? } only (BE03a error matrix)
 * Two kinds of proof per status: a port that returns hostile details through
 * the real route (mapping), and the same hostile DETAIL raised by the database
 * through the real production RPC adapter and the real route (production).
 * The database raising the code at all is proven by the pgTAP files named at
 * each describe block.
 */
import { describe, expect, it } from 'vitest';

import { REQUEST_ID, error } from './phase-02-slice-09-test-values';
import {
  harnessFor,
  opFor,
  requestFor,
  type EvidenceOperationId,
} from './phase-02-slice-09-be03a-evidence-support';
import {
  bodyOf,
  composeProduction,
  raised,
} from './phase-02-slice-09-r2-support';

type Case = readonly [marker: string, operationId: EvidenceOperationId];

const E400: readonly Case[] = [
  ['[P2-S09-AC-304]', 'CMS-03A-09'],
  ['[P2-S09-AC-350]', 'CMS-03A-10'],
  ['[P2-S09-AC-392]', 'CMS-03A-11'],
  ['[P2-S09-AC-429]', 'CMS-03A-12'],
  ['[P2-S09-AC-455]', 'CMS-03A-13'],
  ['[P2-S09-AC-491]', 'CMS-03A-14'],
  ['[P2-S09-AC-533]', 'CMS-03A-15'],
  ['[P2-S09-AC-562]', 'CMS-03A-16'],
  ['[P2-S09-AC-590]', 'CMS-03A-17'],
  ['[P2-S09-AC-619]', 'CMS-03A-18'],
];
const E409: readonly Case[] = [
  ['[P2-S09-AC-308]', 'CMS-03A-09'],
  ['[P2-S09-AC-354]', 'CMS-03A-10'],
  ['[P2-S09-AC-396]', 'CMS-03A-11'],
  ['[P2-S09-AC-433]', 'CMS-03A-12'],
  ['[P2-S09-AC-495]', 'CMS-03A-14'],
  ['[P2-S09-AC-537]', 'CMS-03A-15'],
  ['[P2-S09-AC-566]', 'CMS-03A-16'],
  ['[P2-S09-AC-594]', 'CMS-03A-17'],
];
const E422: readonly Case[] = [
  ['[P2-S09-AC-310]', 'CMS-03A-09'],
  ['[P2-S09-AC-356]', 'CMS-03A-10'],
  ['[P2-S09-AC-398]', 'CMS-03A-11'],
  ['[P2-S09-AC-435]', 'CMS-03A-12'],
  ['[P2-S09-AC-497]', 'CMS-03A-14'],
  ['[P2-S09-AC-539]', 'CMS-03A-15'],
  ['[P2-S09-AC-568]', 'CMS-03A-16'],
  ['[P2-S09-AC-596]', 'CMS-03A-17'],
  ['[P2-S09-AC-622]', 'CMS-03A-18'],
];

/** Every key a hostile or careless producer might add next to the allowlist. */
const LEAK = {
  expectedVersion: '1',
  currentVersion: '2',
  reason: 'private reviewer note',
  reasonCode: 'POLICY_PREDICATE',
  recoveryAction: 'step_up',
  ownerPersonId: 'leak',
  sql: 'select 1',
  secret: 'x',
};
const VIOLATION = { pointer: '/validThrough', message: 'must be set' };
const WIRE_VIOLATION = { pointer: '/validThrough', message: 'must be set' };

const rowWithLeak = { ...VIOLATION, sql: 'drop table', extra: 1 };

const portDetails = (status: 400 | 409 | 422) =>
  error(
    status,
    status === 409
      ? 'CONFLICT'
      : status === 422
        ? 'VALIDATION_FAILED'
        : 'INVALID_REQUEST',
    'Refused.',
    { ...LEAK, violations: [rowWithLeak] },
  );

describe('BE03a 400 INVALID_REQUEST details allowlist', () => {
  it.each(E400)(
    '%s %s a port 400 carries only violations, never version, reason or policy details',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const harness = harnessFor(op, { port: portDetails(400) });
      const response = await harness.app.request(requestFor(op));
      expect(response.status).toBe(400);
      const body = await bodyOf(response);
      expect(body.requestId).toBe(REQUEST_ID);
      expect(body.details).toEqual({ violations: [WIRE_VIOLATION] });
    },
  );

  // pgTAP: the database raises INVALID_REQUEST for a rejected payload shape in
  // supabase/tests/phase_02_slice_09_dec108_*.sql and ..._grant_*.sql.
  it.each(E400)(
    '%s %s the database INVALID_REQUEST with a hostile DETAIL reaches the wire with only violations',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const { send } = composeProduction(op, {
        cms: () =>
          raised(
            'INVALID_REQUEST',
            JSON.stringify({ ...LEAK, violations: [rowWithLeak] }),
          ),
      });
      const response = await send();
      expect(response.status).toBe(400);
      expect((await bodyOf(response)).details).toEqual({
        violations: [WIRE_VIOLATION],
      });
    },
  );

  it.each(E400)(
    '%s %s a malformed path, header or body is refused at admission with 400 and no details',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const malformed: Array<Parameters<typeof requestFor>[1]> = [
        op.method === 'GET'
          ? { headers: { 'if-match': '"1"' } }
          : { headers: { 'idempotency-key': 'short' } },
      ];
      if (Object.keys(op.pathParams).length > 0)
        malformed.push({
          path: op.path.replace(/[0-9a-f-]{36}/u, 'not-a-uuid'),
        });
      for (const variant of malformed) {
        const harness = harnessFor(op);
        const response = await harness.app.request(requestFor(op, variant));
        expect(response.status).toBe(400);
        const body = await bodyOf(response);
        expect(body.code).toBe('INVALID_REQUEST');
        expect(body.details).toEqual({});
        expect(harness.ports[op.portName]).not.toHaveBeenCalled();
      }
    },
  );

  it('[P2-S09-AC-304] [P2-S09-AC-392] [P2-S09-AC-429] [P2-S09-AC-491] [P2-S09-AC-533] [P2-S09-AC-562] [P2-S09-AC-590] [P2-S09-AC-350] a body that is not JSON is refused at admission with 400 and no details', async () => {
    for (const operationId of [
      'CMS-03A-09',
      'CMS-03A-10',
      'CMS-03A-11',
      'CMS-03A-12',
      'CMS-03A-14',
      'CMS-03A-15',
      'CMS-03A-16',
      'CMS-03A-17',
    ] as const) {
      const op = opFor(operationId);
      const harness = harnessFor(op);
      const request = new Request(requestFor(op).url, {
        method: 'POST',
        headers: requestFor(op).headers,
        body: '{not json',
      });
      const response = await harness.app.request(request);
      expect(response.status).toBe(400);
      expect((await bodyOf(response)).details).toEqual({});
      expect(harness.ports[op.portName]).not.toHaveBeenCalled();
    }
  });

  it('[P2-S09-AC-619] CMS-03A-18 a malformed query is refused at admission with 400 and a pointer to the failing parameter only', async () => {
    const op = opFor('CMS-03A-18');
    const harness = harnessFor(op);
    const response = await harness.app.request(
      requestFor(op, { path: `${op.path}?limit=0` }),
    );
    expect(response.status).toBe(400);
    const details = (await bodyOf(response)).details;
    expect(Object.keys(details)).toEqual(['violations']);
    expect(details.violations).toEqual([
      {
        pointer: '/limit',
        code: 'too_small',
        message: 'The value is invalid.',
      },
    ]);
    expect(harness.ports[op.portName]).not.toHaveBeenCalled();
  });
});

describe('BE03a 409 CONFLICT details allowlist', () => {
  it.each(E409)(
    '%s %s a port 409 carries only the version details, never reason, violations or policy details',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const harness = harnessFor(op, { port: portDetails(409) });
      const response = await harness.app.request(requestFor(op));
      expect(response.status).toBe(409);
      expect((await bodyOf(response)).details).toEqual({
        expectedVersion: '1',
        currentVersion: '2',
      });
    },
  );

  // pgTAP: `raise exception 'CONFLICT'` is asserted for stale versions and
  // idempotency mismatches in supabase/tests/phase_02_slice_09_dec108_*.sql
  // and phase_02_slice_09_grant_*.sql. The database raises it with no DETAIL
  // (or a bare machine token such as MIGRATION_SOURCE_DRIFT).
  it.each(E409)(
    '%s %s the database CONFLICT with no DETAIL reaches the wire as 409 with empty details',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const { send } = composeProduction(op, { cms: () => raised('CONFLICT') });
      const response = await send();
      expect(response.status).toBe(409);
      expect((await bodyOf(response)).details).toEqual({});
    },
  );

  it.each(E409)(
    '%s %s a hostile JSON DETAIL on the database CONFLICT keeps only the version details and drops reason',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const { send } = composeProduction(op, {
        cms: () =>
          raised(
            'CONFLICT',
            JSON.stringify({ ...LEAK, violations: [rowWithLeak] }),
          ),
      });
      const response = await send();
      expect(response.status).toBe(409);
      const details = (await bodyOf(response)).details;
      expect(details).toEqual({
        expectedVersion: '1',
        currentVersion: '2',
      });
      expect(JSON.stringify(details)).not.toContain('private reviewer note');
    },
  );
});

describe('BE03a 422 VALIDATION_FAILED details allowlist', () => {
  it.each(E422)(
    '%s %s a port 422 carries only violations, never version, reason or policy details',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const harness = harnessFor(op, { port: portDetails(422) });
      const response = await harness.app.request(requestFor(op));
      expect(response.status).toBe(422);
      expect((await bodyOf(response)).details).toEqual({
        violations: [WIRE_VIOLATION],
      });
    },
  );

  // pgTAP: supabase/tests/phase_02_slice_09_od4_locale_config.sql proves the
  // database raises VALIDATION_FAILED with a violations DETAIL for an invalid
  // clone or definition locale configuration.
  it.each(E422)(
    '%s %s the database VALIDATION_FAILED with a hostile DETAIL reaches the wire with only violations',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const { send } = composeProduction(op, {
        cms: () =>
          raised(
            'VALIDATION_FAILED',
            JSON.stringify({ ...LEAK, violations: [rowWithLeak] }),
          ),
      });
      const response = await send();
      expect(response.status).toBe(422);
      expect((await bodyOf(response)).details).toEqual({
        violations: [WIRE_VIOLATION],
      });
    },
  );

  it.each(E422.filter(([, id]) => opFor(id).method === 'POST'))(
    '%s %s an unknown request key is refused at admission with 422 and a violation pointing at that key',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const harness = harnessFor(op);
      const response = await harness.app.request(
        requestFor(op, { body: { ...op.body, callerOwned: 1 } }),
      );
      expect(response.status).toBe(422);
      expect((await bodyOf(response)).details).toEqual({
        violations: [
          {
            pointer: '/callerOwned',
            code: 'unrecognized_keys',
            message: 'The value is invalid.',
          },
        ],
      });
      expect(harness.ports[op.portName]).not.toHaveBeenCalled();
    },
  );
});
