/**
 * BE03a: the request-body expectedVersion is the same positive decimal as the
 * exact strong If-Match. A body that disagrees with its header is a malformed
 * request (400 INVALID_REQUEST) and never reaches a port; the Worker must not
 * silently substitute one for the other.
 */
import { describe, expect, it } from 'vitest';

import {
  calledPorts,
  harnessFor,
  opFor,
  requestFor,
  type EvidenceOperationId,
} from './phase-02-slice-09-be03a-evidence-support';

const CASES: readonly (readonly [string, EvidenceOperationId])[] = [
  ['[P2-S09-AC-287]', 'CMS-03A-09'],
  ['[P2-S09-AC-318]', 'CMS-03A-10'],
  ['[P2-S09-AC-364]', 'CMS-03A-11'],
  ['[P2-S09-AC-406]', 'CMS-03A-12'],
  ['[P2-S09-AC-467]', 'CMS-03A-14'],
  ['[P2-S09-AC-548]', 'CMS-03A-16'],
  ['[P2-S09-AC-577]', 'CMS-03A-17'],
];

describe('BE03a expectedVersion equals the strong If-Match', () => {
  it.each(CASES)(
    '%s %s refuses a body expectedVersion that differs from If-Match with 400 INVALID_REQUEST and forwards an equal pair',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      for (const [bodyVersion, header] of [
        ['1', '"2"'],
        ['2', '"1"'],
        ['10', '"1"'],
        ['1', '"10"'],
      ] as const) {
        const harness = harnessFor(op);
        const response = await harness.app.request(
          requestFor(op, {
            body: { ...op.body, expectedVersion: bodyVersion },
            headers: { 'if-match': header },
          }),
        );
        expect(response.status).toBe(400);
        const payload = (await response.json()) as Record<string, unknown>;
        expect(payload.code).toBe('INVALID_REQUEST');
        expect(payload.details).toEqual({});
        expect(calledPorts(harness.ports)).toBe(0);
      }
      for (const version of ['1', '7', '9223372036854775807']) {
        const harness = harnessFor(op);
        const response = await harness.app.request(
          requestFor(op, {
            body: { ...op.body, expectedVersion: version },
            headers: { 'if-match': `"${version}"` },
          }),
        );
        expect(response.status).toBe(op.status);
        expect(harness.ports[op.portName]).toHaveBeenCalledWith(
          expect.objectContaining({ ifMatch: version }),
          expect.any(AbortSignal),
        );
      }
    },
  );
});
