/**
 * BE03a CMS-03A-09..18 request-admission evidence: path identifiers, mutation
 * and read headers. Each case drives the real Hono app and real admission
 * pipeline; only the dependency ports are faked and must stay uncalled for
 * every refusal.
 */
import { describe, expect, it } from 'vitest';

import {
  calledPorts,
  harnessFor,
  opFor,
  requestFor,
  type EvidenceOperationId,
} from './phase-02-slice-09-be03a-evidence-support';

type Case = readonly [marker: string, operationId: EvidenceOperationId];
type PathCase = readonly [
  marker: string,
  operationId: EvidenceOperationId,
  param: string,
];

const expectInvalidRequest = async (response: Response): Promise<void> => {
  expect(response.status).toBe(400);
  const body = (await response.json()) as Record<string, unknown>;
  expect(body.code).toBe('INVALID_REQUEST');
};

const PATH_CASES: readonly PathCase[] = [
  ['[P2-S09-AC-288]', 'CMS-03A-09', 'contentTypeId'],
  ['[P2-S09-AC-289]', 'CMS-03A-09', 'versionId'],
  ['[P2-S09-AC-324]', 'CMS-03A-10', 'contentTypeId'],
  ['[P2-S09-AC-325]', 'CMS-03A-10', 'versionId'],
  ['[P2-S09-AC-367]', 'CMS-03A-11', 'contentTypeId'],
  ['[P2-S09-AC-368]', 'CMS-03A-11', 'versionId'],
  ['[P2-S09-AC-408]', 'CMS-03A-12', 'reviewId'],
  ['[P2-S09-AC-443]', 'CMS-03A-13', 'reviewId'],
  ['[P2-S09-AC-477]', 'CMS-03A-14', 'reviewId'],
  ['[P2-S09-AC-549]', 'CMS-03A-16', 'grantId'],
  ['[P2-S09-AC-578]', 'CMS-03A-17', 'grantId'],
];

const IDEM_MISSING: readonly Case[] = [
  ['[P2-S09-AC-290]', 'CMS-03A-09'],
  ['[P2-S09-AC-326]', 'CMS-03A-10'],
  ['[P2-S09-AC-369]', 'CMS-03A-11'],
  ['[P2-S09-AC-409]', 'CMS-03A-12'],
  ['[P2-S09-AC-478]', 'CMS-03A-14'],
  ['[P2-S09-AC-515]', 'CMS-03A-15'],
  ['[P2-S09-AC-552]', 'CMS-03A-16'],
  ['[P2-S09-AC-580]', 'CMS-03A-17'],
];

const IDEM_INVALID: readonly Case[] = [
  ['[P2-S09-AC-291]', 'CMS-03A-09'],
  ['[P2-S09-AC-327]', 'CMS-03A-10'],
  ['[P2-S09-AC-370]', 'CMS-03A-11'],
  ['[P2-S09-AC-410]', 'CMS-03A-12'],
  ['[P2-S09-AC-479]', 'CMS-03A-14'],
  ['[P2-S09-AC-516]', 'CMS-03A-15'],
  ['[P2-S09-AC-553]', 'CMS-03A-16'],
  ['[P2-S09-AC-581]', 'CMS-03A-17'],
];

const IF_MATCH: readonly Case[] = [
  ['[P2-S09-AC-292]', 'CMS-03A-09'],
  ['[P2-S09-AC-328]', 'CMS-03A-10'],
  ['[P2-S09-AC-371]', 'CMS-03A-11'],
  ['[P2-S09-AC-411]', 'CMS-03A-12'],
  ['[P2-S09-AC-480]', 'CMS-03A-14'],
  ['[P2-S09-AC-554]', 'CMS-03A-16'],
  ['[P2-S09-AC-582]', 'CMS-03A-17'],
];

const READ_HEADERS: readonly Case[] = [
  ['[P2-S09-AC-444]', 'CMS-03A-13'],
  ['[P2-S09-AC-612]', 'CMS-03A-18'],
];

/** 8-128 printable ASCII: 7 and 129 characters, a control byte and non-ASCII. */
const BAD_KEYS: readonly string[] = [
  'a'.repeat(7),
  'a'.repeat(129),
  'cms-key\u0007-0001',
  'cms-clé-00001',
  'cms-key\u007f-00001',
];
const GOOD_KEYS: readonly string[] = [
  'a'.repeat(8),
  'a'.repeat(128),
  'cms~key!#$%&()*+,-./:;<=>?@[]^_{|}0',
];

describe('BE03a path identifiers are UUIDs refused before any existence check', () => {
  it.each(PATH_CASES)(
    '%s %s path parameter %s is a UUID and a malformed value is 400 INVALID_REQUEST with no session or port work',
    async (_marker, operationId, param) => {
      const op = opFor(operationId);
      const value = op.pathParams[param] as string;
      expect(op.path).toContain(value);
      for (const bad of ['not-a-uuid', value.slice(0, -1), `${value}0`, '']) {
        const harness = harnessFor(op);
        const response = await harness.app.request(
          requestFor(op, { path: op.path.replace(value, bad) }),
        );
        // An empty segment names no registered route, so it is the router's
        // 404 NOT_FOUND; every non-empty malformed segment is 400.
        if (bad === '') {
          expect(response.status).toBe(404);
          expect(((await response.json()) as { code: string }).code).toBe(
            'NOT_FOUND',
          );
        } else await expectInvalidRequest(response);
        expect(calledPorts(harness.ports)).toBe(0);
      }
      const accepted = harnessFor(op);
      const ok = await accepted.app.request(requestFor(op));
      expect(ok.status).toBe(op.status);
      expect(accepted.ports[op.portName]).toHaveBeenCalledTimes(1);
    },
  );
});

describe('BE03a Idempotency-Key admission', () => {
  it.each(IDEM_MISSING)(
    '%s %s requires an Idempotency-Key header and rejects a missing key with 400 INVALID_REQUEST',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const harness = harnessFor(op);
      const response = await harness.app.request(
        requestFor(op, { headers: { 'idempotency-key': null } }),
      );
      await expectInvalidRequest(response);
      expect(calledPorts(harness.ports)).toBe(0);
    },
  );

  it.each(IDEM_INVALID)(
    '%s %s accepts an Idempotency-Key only as 8-128 printable ASCII characters and rejects any other value with 400 INVALID_REQUEST',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      for (const key of BAD_KEYS) {
        const harness = harnessFor(op);
        const response = await harness.app.request(
          requestFor(op, { headers: { 'idempotency-key': key } }),
        );
        await expectInvalidRequest(response);
        expect(calledPorts(harness.ports)).toBe(0);
      }
      for (const key of GOOD_KEYS) {
        const harness = harnessFor(op);
        const response = await harness.app.request(
          requestFor(op, { headers: { 'idempotency-key': key } }),
        );
        expect(response.status).toBe(op.status);
        expect(harness.ports[op.portName]).toHaveBeenCalledWith(
          expect.objectContaining({ idempotencyKey: key }),
          expect.any(AbortSignal),
        );
      }
    },
  );
});

describe('BE03a If-Match admission', () => {
  it.each(IF_MATCH)(
    '%s %s requires If-Match as an exact quoted positive decimal version and rejects a missing or malformed value with 400 INVALID_REQUEST',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      for (const value of [
        null,
        '1',
        'W/"1"',
        '"0"',
        '"01"',
        '"-1"',
        '"1.5"',
      ]) {
        const harness = harnessFor(op);
        const response = await harness.app.request(
          requestFor(op, { headers: { 'if-match': value } }),
        );
        await expectInvalidRequest(response);
        expect(calledPorts(harness.ports)).toBe(0);
      }
      for (const value of ['"1"', '"42"', '"9223372036854775807"']) {
        const harness = harnessFor(op);
        const response = await harness.app.request(
          requestFor(op, {
            headers: { 'if-match': value },
            body: { ...op.body, expectedVersion: value.slice(1, -1) },
          }),
        );
        expect(response.status).toBe(op.status);
        expect(harness.ports[op.portName]).toHaveBeenCalledWith(
          expect.objectContaining({ ifMatch: value.slice(1, -1) }),
          expect.any(AbortSignal),
        );
      }
    },
  );

  it('[P2-S09-AC-517] CMS-03A-15 carries no If-Match header because it creates a new aggregate or re-establishes a revoked one', async () => {
    const op = opFor('CMS-03A-15');
    expect(op.ifMatch).toBe(false);
    const withHeader = harnessFor(op);
    await expectInvalidRequest(
      await withHeader.app.request(
        requestFor(op, { headers: { 'if-match': '"1"' } }),
      ),
    );
    expect(calledPorts(withHeader.ports)).toBe(0);
    const without = harnessFor(op);
    const response = await without.app.request(requestFor(op));
    expect(response.status).toBe(201);
    const input = without.ports[op.portName]?.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(input).not.toHaveProperty('ifMatch');
  });
});

describe('BE03a protected reads reject mutation-only headers', () => {
  it.each(READ_HEADERS)(
    '%s %s rejects an Idempotency-Key header and an If-Match header with 400 INVALID_REQUEST because it is a read',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      for (const headers of [
        { 'idempotency-key': 'cms-evidence-key-001' },
        { 'if-match': '"1"' },
        { 'idempotency-key': 'cms-evidence-key-001', 'if-match': '"1"' },
      ]) {
        const harness = harnessFor(op);
        await expectInvalidRequest(
          await harness.app.request(requestFor(op, { headers })),
        );
        expect(calledPorts(harness.ports)).toBe(0);
      }
      const clean = harnessFor(op);
      expect((await clean.app.request(requestFor(op))).status).toBe(200);
    },
  );
});
