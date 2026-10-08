import { describe, expect, it, vi } from 'vitest';

import {
  ENTRY_ID,
  compose,
  portInput,
} from './cms-editorial-production.test-support';
import {
  FIELD_ID,
  appendRequest,
  fetchFailing,
  historyRequest,
  postgrestRaise,
  readError,
  resolveRequest,
  restoreRequest,
  wiredApp,
} from './cms-editorial-production-app.test-support';

/**
 * BE03b lowercase SQL reason tokens through the real route -> production adapter
 * -> PostgREST error envelope chain. Only the network edge is faked, and it
 * emits exactly what PostgREST emits for `RAISE EXCEPTION '<token>' USING
 * ERRCODE = 'P0001'`: HTTP 400, `code: P0001`, the whole token as `message`.
 */

const appFailing = (response: () => Response) =>
  wiredApp(fetchFailing(response));

describe('typed 422 reason tokens (BE03b:1049-1054, :1211)', () => {
  it.each([
    'rich_text_not_canonical',
    'object_kind_unspecified',
    'object_property_invalid',
    'relation_target_unavailable',
    'taxonomy_source_unavailable',
    'media_source_unavailable',
  ])(
    '[P2-S10-AC-005] [P2-S10-AC-008] maps %s on a write to 422 VALIDATION_FAILED with reasonCode',
    async (token) => {
      const response = await appendRequest(
        appFailing(() => postgrestRaise(token)),
      );
      expect(response.status).toBe(422);
      const body = await readError(response);
      expect(body.code).toBe('VALIDATION_FAILED');
      expect(body.details.reasonCode).toBe(token);
      expect(body.message).toBe('The CMS editorial request failed validation.');
    },
  );

  it.each(['comparison_too_large', 'comparison_unavailable'])(
    '[P2-S10-AC-020] maps %s on the history read to 422 VALIDATION_FAILED with reasonCode',
    async (token) => {
      const response = await historyRequest(
        appFailing(() => postgrestRaise(token)),
      );
      expect(response.status).toBe(422);
      const body = await readError(response);
      expect(body.code).toBe('VALIDATION_FAILED');
      expect(body.details.reasonCode).toBe(token);
    },
  );
});

describe('restore 409 reason tokens (BE03b:1213, :1345)', () => {
  it.each([
    'migration_chain_mismatch',
    'migration_chain_unavailable',
    'migration_chain_incomplete',
    'template_incompatible',
  ])(
    '[P2-S10-AC-026] [P2-S10-AC-037] maps %s to 409 CONFLICT with a refresh recovery',
    async (token) => {
      const response = await restoreRequest(
        appFailing(() => postgrestRaise(token)),
      );
      expect(response.status).toBe(409);
      const body = await readError(response);
      expect(body.code).toBe('CONFLICT');
      expect(body.details).toMatchObject({
        reasonCode: token,
        conflict: 'INVALID_TRANSITION',
        recoveryAction: 'refresh',
      });
    },
  );
});

describe('conflict and state tokens', () => {
  it('[P2-S10-AC-014] maps INVALID_TRANSITION (closed conflict) to 409, never a user-blamed 400', async () => {
    const response = await resolveRequest(
      appFailing(() => postgrestRaise('INVALID_TRANSITION')),
    );
    expect(response.status).toBe(409);
    const body = await readError(response);
    expect(body.code).toBe('CONFLICT');
    expect(body.details).toMatchObject({
      conflict: 'INVALID_TRANSITION',
      recoveryAction: 'refresh',
    });
  });

  it('[P2-S10-AC-025] [P2-S10-AC-026] maps a stale restore CAS (SQLSTATE 40001 VERSION_MISMATCH) to 409, not a retryable 503', async () => {
    const response = await restoreRequest(
      appFailing(() => postgrestRaise('VERSION_MISMATCH', '40001', 500)),
    );
    expect(response.status).toBe(409);
    expect(response.headers.get('retry-after')).toBeNull();
    const body = await readError(response);
    expect(body.code).toBe('CONFLICT');
    expect(body.details).toMatchObject({
      conflict: 'VERSION_MISMATCH',
      recoveryAction: 'reload',
    });
  });

  it('[P2-S10-AC-008] [P2-S10-AC-051] maps STALE_EDIT_PRESENCE (SQLSTATE 40001) to a 409 version conflict', async () => {
    const response = await appendRequest(
      appFailing(() => postgrestRaise('STALE_EDIT_PRESENCE', '40001', 500)),
    );
    expect(response.status).toBe(409);
    const body = await readError(response);
    expect(body.details).toMatchObject({
      conflict: 'VERSION_MISMATCH',
      recoveryAction: 'reload',
    });
  });

  it('[P2-S10-AC-008] maps INTERNAL_ERROR to a scrubbed 500, never a user-blamed 400', async () => {
    const response = await appendRequest(
      appFailing(() =>
        postgrestRaise('INTERNAL_ERROR', 'P0001', 400, {
          details: 'private SQL detail tenant=secret',
        }),
      ),
    );
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain('private');
    expect(text).not.toContain('secret');
    const body = JSON.parse(text) as { code: string; details: unknown };
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.details).toEqual({});
  });

  it('refuses an unregistered P0001 message as a scrubbed 500 rather than blaming the caller', async () => {
    const response = await appendRequest(
      appFailing(() => postgrestRaise('some_future_reason')),
    );
    expect(response.status).toBe(500);
    expect((await readError(response)).details).toEqual({});
  });
});

describe('whole-token, case-sensitive matching only', () => {
  it.each([
    ['prefixed prose', 'x comparison_too_large y'],
    ['upper case', 'COMPARISON_TOO_LARGE'],
    ['trailing prose', 'rich_text_not_canonical: /fields/x'],
  ])('does not adopt a token from %s', async (_label, message) => {
    const response = await appendRequest(
      appFailing(() => postgrestRaise(message)),
    );
    expect(response.status).toBe(500);
    const body = await readError(response);
    expect(body.details).toEqual({});
  });

  it('does not adopt a lowercase reason from a foreign SQLSTATE', async () => {
    const response = await appendRequest(
      appFailing(() => postgrestRaise('rich_text_not_canonical', '23505', 409)),
    );
    const body = await readError(response);
    expect(body.details.reasonCode).toBeUndefined();
  });

  it('never lets the DETAIL or HINT text pick a reason', async () => {
    const response = await appendRequest(
      appFailing(() =>
        postgrestRaise('VALIDATION_FAILED', 'P0001', 400, {
          details: 'object_property_invalid',
          hint: 'media_source_unavailable',
        }),
      ),
    );
    expect(response.status).toBe(422);
    expect((await readError(response)).details.reasonCode).toBeUndefined();
  });
});

describe('bounded violation pointers supplied by SQL DETAIL', () => {
  const pointers = (list: readonly string[]) => JSON.stringify(list);

  it('projects safe JSON pointers into details.violations with the typed reason as code', async () => {
    const response = await appendRequest(
      appFailing(() =>
        postgrestRaise('object_property_invalid', 'P0001', 400, {
          details: pointers([`/fields/${FIELD_ID}`, `/fields/${FIELD_ID}/x`]),
        }),
      ),
    );
    expect(response.status).toBe(422);
    const body = await readError(response);
    expect(body.details.violations).toEqual([
      {
        path: `/fields/${FIELD_ID}`,
        code: 'object_property_invalid',
        message: 'The value is invalid.',
      },
      {
        path: `/fields/${FIELD_ID}/x`,
        code: 'object_property_invalid',
        message: 'The value is invalid.',
      },
    ]);
  });

  it('uses code invalid for a bare VALIDATION_FAILED and drops unsafe or non-pointer entries', async () => {
    const response = await appendRequest(
      appFailing(() =>
        postgrestRaise('VALIDATION_FAILED', 'P0001', 400, {
          details: pointers([
            `/fields/${FIELD_ID}`,
            'not a pointer',
            '/fields/<script>',
            `/${'a'.repeat(300)}`,
            '/fields/ok\u0000bad',
          ]),
        }),
      ),
    );
    const body = await readError(response);
    expect(body.details.violations).toEqual([
      {
        path: `/fields/${FIELD_ID}`,
        code: 'invalid',
        message: 'The value is invalid.',
      },
    ]);
  });

  it('caps the pointers at 50 and ignores DETAIL that is not a JSON array of strings', async () => {
    const many = Array.from({ length: 80 }, (_v, index) => `/fields/f${index}`);
    const capped = await appendRequest(
      appFailing(() =>
        postgrestRaise('VALIDATION_FAILED', 'P0001', 400, {
          details: pointers(many),
        }),
      ),
    );
    expect(
      (await readError(capped)).details.violations as readonly unknown[],
    ).toHaveLength(50);
    for (const detail of ['{"a":1}', 'plain prose', '[1,2]', '']) {
      const response = await appendRequest(
        appFailing(() =>
          postgrestRaise('VALIDATION_FAILED', 'P0001', 400, {
            details: detail,
          }),
        ),
      );
      expect((await readError(response)).details.violations).toBeUndefined();
    }
  });
});

describe('CMS-03B-01 refusals of an unreadable baseRevision and a non-active entry (BE03b validation matrix)', () => {
  it('[P2-S10-AC-029] maps a well-formed but unreadable baseRevision (SQL VALIDATION_FAILED at /baseRevision) to a 422 naming that pointer', async () => {
    const response = await appendRequest(
      appFailing(() =>
        postgrestRaise('VALIDATION_FAILED', 'P0001', 400, {
          details: JSON.stringify(['/baseRevision']),
        }),
      ),
    );
    expect(response.status).toBe(422);
    const body = await readError(response);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.message).toBe('The CMS editorial request failed validation.');
    expect(body.details.violations).toEqual([
      {
        path: '/baseRevision',
        code: 'invalid',
        message: 'The value is invalid.',
      },
    ]);
  });

  it('[P2-S10-AC-028] maps the SQL NOT_FOUND of an entry that is not active to the policy-safe 404 with no details', async () => {
    const response = await appendRequest(
      appFailing(() => postgrestRaise('NOT_FOUND')),
    );
    expect(response.status).toBe(404);
    const body = await readError(response);
    expect(body.code).toBe('NOT_FOUND');
    expect(body.details).toEqual({});
  });
});

describe('adapter-local refusals publish pointer objects', () => {
  it('reports a caller-supplied authority key from the production port as a safe /key pointer', async () => {
    const fetchImpl = vi.fn();
    const result = await compose(
      fetchImpl as unknown as typeof fetch,
    ).ports.appendRevision(
      portInput({
        body: {
          entryId: ENTRY_ID,
          baseRevision: '1',
          changedPaths: [`/fields/${FIELD_ID}`],
          values: { [FIELD_ID]: 'Hello' },
          locale: 'en-US',
          expectedVersion: '1',
          ownerId: 'private-owner',
        },
      }),
      new AbortController().signal,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      status: 422,
      details: {
        reasonCode: 'caller_authority_rejected',
        violations: [
          {
            path: '/ownerId',
            code: 'caller_authority_rejected',
            message: 'The value is invalid.',
          },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toContain('private-owner');
  });

  it('[P2-S10-AC-004] refuses a body expectedVersion that disagrees with If-Match instead of overwriting it', async () => {
    const fetchImpl = vi.fn();
    const result = await compose(
      fetchImpl as unknown as typeof fetch,
    ).ports.appendRevision(
      portInput({
        ifMatch: '7',
        body: {
          entryId: ENTRY_ID,
          baseRevision: '1',
          changedPaths: [`/fields/${FIELD_ID}`],
          values: { [FIELD_ID]: 'Hello' },
          locale: 'en-US',
          expectedVersion: '3',
        },
      }),
      new AbortController().signal,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      status: 422,
      details: {
        reasonCode: 'expected_version_mismatch',
        violations: [{ path: '/expectedVersion', code: 'mismatch' }],
      },
    });
  });
});
