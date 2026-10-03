/**
 * R2: admission and dependency conditions that are produced, not told.
 *  - If-Match grammar is isolated from the body-binding rule by sending a body
 *    whose expectedVersion equals the malformed header text: only the header
 *    grammar can then yield 400 (a loosened grammar would yield 422).
 *  - 503, 504 and a thrown transport failure are produced by the real
 *    production RPC adapter, not returned by a stubbed port.
 */
import { describe, expect, it } from 'vitest';

import { MAX_RATE_RESET_EPOCH_SECONDS } from './route-rate-refusal';
import {
  opFor,
  requestFor,
  type EvidenceOperationId,
} from './phase-02-slice-09-be03a-evidence-support';
import { bodyOf, composeProduction } from './phase-02-slice-09-r2-support';
import { json } from './production-test-support';

const IF_MATCH: readonly (readonly [string, EvidenceOperationId])[] = [
  ['[P2-S09-AC-292]', 'CMS-03A-09'],
  ['[P2-S09-AC-328]', 'CMS-03A-10'],
  ['[P2-S09-AC-371]', 'CMS-03A-11'],
  ['[P2-S09-AC-411]', 'CMS-03A-12'],
  ['[P2-S09-AC-480]', 'CMS-03A-14'],
  ['[P2-S09-AC-554]', 'CMS-03A-16'],
  ['[P2-S09-AC-582]', 'CMS-03A-17'],
];

const MALFORMED_IF_MATCH_TEXT = ['0', '01', '-1', '1.5', '+1', ' 1', '1e3'];

const HEADER_MESSAGE = 'A valid strong If-Match version is required.';
const cmsCalls = (
  rpcCalls: ReadonlyArray<{ rpc: string; body: Record<string, unknown> }>,
) => rpcCalls.filter((call) => call.rpc !== 'auth_rate_limit');

describe('If-Match grammar is isolated from the body binding rule', () => {
  // A valid body version with a malformed header would also trip the
  // body/header binding rule (400 too), so status alone cannot tell the two
  // apart. The envelope message does: only the header grammar says
  // "A valid strong If-Match version is required.", and a loosened grammar
  // would surface the binding message instead.
  it.each(IF_MATCH)(
    '%s %s refuses a malformed quoted version with 400 INVALID_REQUEST from the header grammar itself',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      for (const text of MALFORMED_IF_MATCH_TEXT) {
        const { send, rpcCalls } = composeProduction(op);
        const response = await send(
          requestFor(op, { headers: { 'if-match': `"${text}"` } }),
        );
        expect(response.status, `If-Match "${text}"`).toBe(400);
        const body = await bodyOf(response);
        expect(body.code).toBe('INVALID_REQUEST');
        expect(body.message, `If-Match "${text}"`).toBe(HEADER_MESSAGE);
        expect(cmsCalls(rpcCalls)).toEqual([]);
      }
    },
  );

  it.each(IF_MATCH)(
    '%s %s refuses a missing, unquoted or weak If-Match with 400 INVALID_REQUEST from the header grammar itself',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      for (const value of [null, '1', 'W/"1"']) {
        const { send, rpcCalls } = composeProduction(op);
        const response = await send(
          requestFor(op, { headers: { 'if-match': value } }),
        );
        expect(response.status).toBe(400);
        const body = await bodyOf(response);
        expect(body.code).toBe('INVALID_REQUEST');
        expect(body.message).toBe(HEADER_MESSAGE);
        expect(cmsCalls(rpcCalls)).toEqual([]);
      }
    },
  );

  it.each(IF_MATCH)(
    '%s %s accepts the exact quoted positive decimal at its boundaries and forwards it as expectedVersion',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      for (const version of ['1', '9223372036854775807']) {
        const { send, rpcCalls } = composeProduction(op);
        const response = await send(
          requestFor(op, {
            body: { ...op.body, expectedVersion: version },
            headers: { 'if-match': `"${version}"` },
          }),
        );
        expect(response.status).toBe(op.status);
        expect(cmsCalls(rpcCalls)[0]?.body.p_request).toMatchObject({
          expectedVersion: version,
        });
      }
    },
  );
});

const E503: readonly (readonly [string, EvidenceOperationId])[] = [
  ['[P2-S09-AC-313]', 'CMS-03A-09'],
  ['[P2-S09-AC-359]', 'CMS-03A-10'],
  ['[P2-S09-AC-401]', 'CMS-03A-11'],
  ['[P2-S09-AC-438]', 'CMS-03A-12'],
  ['[P2-S09-AC-461]', 'CMS-03A-13'],
  ['[P2-S09-AC-500]', 'CMS-03A-14'],
  ['[P2-S09-AC-542]', 'CMS-03A-15'],
  ['[P2-S09-AC-571]', 'CMS-03A-16'],
  ['[P2-S09-AC-599]', 'CMS-03A-17'],
  ['[P2-S09-AC-625]', 'CMS-03A-18'],
];

const E504: readonly (readonly [string, EvidenceOperationId])[] = [
  ['[P2-S09-AC-314]', 'CMS-03A-09'],
  ['[P2-S09-AC-360]', 'CMS-03A-10'],
  ['[P2-S09-AC-402]', 'CMS-03A-11'],
  ['[P2-S09-AC-439]', 'CMS-03A-12'],
  ['[P2-S09-AC-462]', 'CMS-03A-13'],
  ['[P2-S09-AC-501]', 'CMS-03A-14'],
  ['[P2-S09-AC-543]', 'CMS-03A-15'],
  ['[P2-S09-AC-572]', 'CMS-03A-16'],
  ['[P2-S09-AC-600]', 'CMS-03A-17'],
  ['[P2-S09-AC-626]', 'CMS-03A-18'],
];

const DEPENDENCY_DETAILS = {
  dependencyClass: 'cms_registry',
  retryable: true,
  retryAfterSeconds: 5,
};

describe('503 DEPENDENCY_UNAVAILABLE is produced by the production adapter', () => {
  it.each(E503)(
    '%s %s a transport failure of the RPC (the queue or database is unreachable) reaches the wire as 503 with only the dependency details',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const { send } = composeProduction(op, {
        cms: () => {
          throw new TypeError('connect ECONNREFUSED 10.0.0.9:5432');
        },
      });
      const response = await send();
      expect(response.status).toBe(503);
      const body = await bodyOf(response);
      expect(body.code).toBe('DEPENDENCY_UNAVAILABLE');
      expect(body.details).toEqual(DEPENDENCY_DETAILS);
      expect(response.headers.get('retry-after')).toBe('5');
      expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
    },
  );

  it.each(E503)(
    '%s %s an HTTP 503 from the RPC endpoint reaches the wire as 503 with only the dependency details',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const { send } = composeProduction(op, {
        cms: () => json({ message: 'pgmq: queue unavailable', hint: 'x' }, 503),
      });
      const response = await send();
      expect(response.status).toBe(503);
      const body = await bodyOf(response);
      expect(body.details).toEqual(DEPENDENCY_DETAILS);
      expect(JSON.stringify(body)).not.toContain('pgmq');
    },
  );
});

describe('504 DEPENDENCY_UNAVAILABLE is produced by an exceeded deadline', () => {
  it.each(E504)(
    '%s %s an RPC that outlives the registered deadline is aborted and reaches the wire as 504 with only the dependency details',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      let aborted = false;
      const { send } = composeProduction(op, {
        deadlineMs: 25,
        cms: (_rpc, _body, signal) =>
          new Promise<Response>((_resolve, reject) => {
            signal.addEventListener('abort', () => {
              aborted = true;
              reject(new DOMException('aborted', 'AbortError'));
            });
          }),
      });
      const response = await send();
      expect(response.status).toBe(504);
      const body = await bodyOf(response);
      expect(body.code).toBe('DEPENDENCY_UNAVAILABLE');
      expect(body.details).toEqual(DEPENDENCY_DETAILS);
      expect(aborted).toBe(true);
    },
  );
});

describe('429 limiter decision bounds', () => {
  it('[P2-S09-AC-311] a limiter decision whose reset cannot be rendered as an instant is refused as an invalid dependency response, never a malformed 429', async () => {
    const op = opFor('CMS-03A-09');
    const { send } = composeProduction(op, {
      rate: {
        calls: [],
        handler: () =>
          json({
            allowed: false,
            limit: 30,
            remaining: 0,
            resetAt: MAX_RATE_RESET_EPOCH_SECONDS + 1,
          }),
      },
    });
    const response = await send();
    expect(response.status).toBe(502);
    expect((await bodyOf(response)).code).toBe('DEPENDENCY_UNAVAILABLE');
  });
});
