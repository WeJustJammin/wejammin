/**
 * R2: a request-schema validation message and pointer reach the client exactly
 * as BE03a specifies. Every case sends a real request through the real Hono
 * app and admission pipeline and reads the 422 `details.violations` off the
 * wire; the port is never reached.
 */
import { describe, expect, it } from 'vitest';

import {
  harnessFor,
  opFor,
  requestFor,
  type EvidenceOperationId,
} from './phase-02-slice-09-be03a-evidence-support';
import { bodyOf } from './phase-02-slice-09-r2-support';

const violationsFor = async (
  operationId: EvidenceOperationId,
  body: Record<string, unknown>,
  headers: Record<string, string | null> = {},
) => {
  const op = opFor(operationId);
  const harness = harnessFor(op);
  const response = await harness.app.request(requestFor(op, { body, headers }));
  expect(response.status).toBe(422);
  const parsed = await bodyOf(response);
  expect(parsed.code).toBe('VALIDATION_FAILED');
  expect(harness.ports[op.portName]).not.toHaveBeenCalled();
  return parsed.details.violations;
};

const grant = (over: Record<string, unknown>) => ({
  ...(opFor('CMS-03A-15').body as Record<string, unknown>),
  ...over,
});

describe('R2 validation messages and pointers on the wire', () => {
  it('[P2-S09-AC-518] CMS-03A-15 reports exactly the message "not a real calendar date" at /validThrough for 2026-02-30', async () => {
    expect(
      await violationsFor('CMS-03A-15', grant({ validThrough: '2026-02-30' })),
    ).toEqual([{ path: '/validThrough', message: 'not a real calendar date' }]);
  });

  it('[P2-S09-AC-518] CMS-03A-15 reports the same message for a non-calendar day in a 31-day month position (2026-04-31)', async () => {
    expect(
      await violationsFor('CMS-03A-15', grant({ validThrough: '2026-04-31' })),
    ).toEqual([{ path: '/validThrough', message: 'not a real calendar date' }]);
  });

  it('[P2-S09-AC-518] CMS-03A-16 reports the message at /validThrough for a renewal with a non-calendar date', async () => {
    const op = opFor('CMS-03A-16');
    expect(
      await violationsFor('CMS-03A-16', {
        ...(op.body as Record<string, unknown>),
        validThrough: '2026-02-30',
      }),
    ).toEqual([{ path: '/validThrough', message: 'not a real calendar date' }]);
  });

  it('[P2-S09-AC-518] a text that is not a YYYY-MM-DD date reports the lowercase constraint code utc_date_invalid', async () => {
    expect(
      await violationsFor('CMS-03A-15', grant({ validThrough: 'tomorrow' })),
    ).toContainEqual({
      path: '/validThrough',
      code: 'utc_date_invalid',
      message: 'The value is invalid.',
    });
  });

  it('[P2-S09-AC-329] CMS-03A-10 reports exactly the transform pair message at /transformVersion', async () => {
    expect(
      await violationsFor('CMS-03A-10', {
        expectedVersion: '1',
        transformKey: 'a.b',
        transformVersion: null,
      }),
    ).toEqual([
      {
        path: '/transformVersion',
        message: 'transform key and version must be both null or both present',
      },
    ]);
  });

  it('[P2-S09-AC-310] CMS-03A-09 reports the exact OD-4 pair message at /fallbackChains when only one of the pair is given', async () => {
    expect(
      await violationsFor('CMS-03A-09', {
        expectedVersion: '1',
        supportedLocales: ['en-US'],
        fallbackChains: null,
        defaultTemplateVersionId: null,
        templateBindings: null,
      }),
    ).toEqual([
      {
        path: '/fallbackChains',
        message:
          'supportedLocales and fallbackChains must be both null or both present',
      },
    ]);
  });

  it('[P2-S09-AC-310] zod text that could echo caller input never reaches the client: a wrong-typed value reports a closed zod code and the generic message', async () => {
    expect(
      await violationsFor(
        'CMS-03A-15',
        grant({ subjectPersonId: 'SECRET-TOKEN-123' }),
      ),
    ).toEqual([
      {
        path: '/subjectPersonId',
        code: expect.stringMatching(/^[a-z][a-z0-9_]*$/u),
        message: 'The value is invalid.',
      },
    ]);
  });

  it('[P2-S09-AC-310] an unknown key never echoes its value and is addressed by its own pointer', async () => {
    const violations = await violationsFor(
      'CMS-03A-15',
      grant({ callerOwned: 'SECRET-VALUE-456' }),
    );
    expect(violations).toEqual([
      {
        path: '/callerOwned',
        code: 'unrecognized_keys',
        message: 'The value is invalid.',
      },
    ]);
    expect(JSON.stringify(violations)).not.toContain('SECRET-VALUE-456');
  });
});
