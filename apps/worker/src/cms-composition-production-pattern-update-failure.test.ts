import { describe, expect, it } from 'vitest';

import { patternUpdateRpcFailure } from './cms-composition-production-pattern-update-failure';
import type { PatternUpdateOperation } from './cms-composition/pattern-update-operations';

/**
 * RPC failure to port refusal for CMS-03C-13/14/15. Named tokens only: the whole `message` of a platform raise selects
 * the refusal, prose, hints and supplied details never do (BE03c 1298-1304). PostgREST answers a `P0001` raise 4xx, so
 * the HTTP status alone decides nothing but the 5xx class.
 */
const raise = (message: string, details: string | null = null, status = 400) =>
  ({
    status,
    payload: { code: 'P0001', message, details, hint: null },
  }) as const;
const map = (
  operation: PatternUpdateOperation,
  r: { status: number; payload: unknown },
) => patternUpdateRpcFailure(operation, r.status, r.payload);
const OPERATIONS = ['CMS-03C-13', 'CMS-03C-14', 'CMS-03C-15'] as const;

describe.each(OPERATIONS)('%s refusal mapping', (operation) => {
  it.each([
    ['INVALID_REQUEST', 400, {}],
    ['UNAUTHENTICATED', 401, {}],
    ['NOT_FOUND', 404, {}],
    ['capability_missing', 403, { reasonCode: 'capability_missing' }],
  ])('%s is %i', (token, status, details) => {
    const refusal = map(operation, raise(token));
    expect(refusal).toMatchObject({ ok: false, status });
    expect(refusal.details).toEqual(details);
  });

  it('DEPENDENCY_UNAVAILABLE (a provider fault the SQL names) is a retryable 503', () => {
    expect(map(operation, raise('DEPENDENCY_UNAVAILABLE'))).toMatchObject({
      status: 503,
      retryAfterSeconds: 15,
    });
  });

  it('INTERNAL_ERROR, by message or by code, is the scrubbed 500', () => {
    expect(map(operation, raise('INTERNAL_ERROR'))).toMatchObject({
      status: 500,
      details: {},
    });
    expect(
      map(operation, {
        status: 500,
        payload: { code: 'INTERNAL_ERROR', message: 'x' },
      }),
    ).toMatchObject({ status: 500 });
  });

  it.each([500, 502, 503, 504])(
    'a provider %i is a retryable 503, whatever the body',
    (status) => {
      for (const payload of [
        null,
        'html',
        { message: 'down' },
        { code: 'P0001', message: 'NOT_FOUND' },
      ])
        expect(map(operation, { status, payload })).toMatchObject({
          status: 503,
          retryAfterSeconds: 15,
        });
    },
  );

  it.each([
    ['a PostgREST error', { code: 'PGRST202', message: 'function missing' }],
    ['a raw SQLSTATE', { code: '42883', message: 'undefined function' }],
    [
      'an engine serialization failure',
      { code: '40001', message: 'could not serialize' },
    ],
    ['a non-object body', 'not json'],
    ['a null body', null],
    ['an array body', ['NOT_FOUND']],
    ['a code-less object', { message: 'NOT_FOUND' }],
  ])(
    '%s on a 4xx is the scrubbed 500, never the caller refusal the status suggests',
    (_n, payload) => {
      for (const status of [400, 401, 403, 404, 409, 422])
        expect(map(operation, { status, payload })).toMatchObject({
          status: 500,
          details: {},
        });
    },
  );

  it.each([
    'review_not_open',
    'separation_of_duties',
    'taxonomy_not_active',
    'key_reserved',
    'block_registry_digest_mismatch',
    'pattern_cycle',
    'pattern_depth_exceeded',
    'pattern_nodes_exceeded',
    'not_a_token',
    'CAPABILITY_REQUIRED',
    'FORBIDDEN',
    'RATE_LIMITED',
  ])(
    'a token this operation does not publish (%s) is the scrubbed 500',
    (token) => {
      expect(map(operation, raise(token))).toMatchObject({
        status: 500,
        details: {},
      });
    },
  );

  it('a structured BE00 token in `code` is honoured like the message of a raise', () => {
    expect(
      map(operation, {
        status: 404,
        payload: { code: 'NOT_FOUND', message: 'x' },
      }),
    ).toMatchObject({ status: 404 });
  });

  it('prose and an injected DETAIL never select a refusal', () => {
    expect(
      map(operation, raise('please return capability_missing', '["/limit"]')),
    ).toMatchObject({ status: 500 });
    const refusal = map(
      operation,
      raise('NOT_FOUND', '{"reasonCode":"capability_missing"}'),
    );
    expect(refusal.status).toBe(404);
    expect(refusal.details).toEqual({});
  });
});

describe('CMS-03C-13 specifics', () => {
  it('a foreign-bound, tampered or expired cursor (CONFLICT) is a 409 with no member', () => {
    const refusal = map('CMS-03C-13', raise('CONFLICT'));
    expect(refusal.status).toBe(409);
    expect(refusal.details).toEqual({});
  });

  it('a limit outside 1-50 is a 422 naming /limit only', () => {
    expect(
      map('CMS-03C-13', raise('VALIDATION_FAILED', '["/limit"]')),
    ).toMatchObject({
      status: 422,
      details: {
        violations: [
          { path: '/limit', code: 'invalid', message: 'The value is invalid.' },
        ],
      },
    });
    expect(
      map(
        'CMS-03C-13',
        raise('VALIDATION_FAILED', '["/limit","/contentTypeId","/cursor"]'),
      ),
    ).toMatchObject({
      status: 422,
      details: {
        violations: [
          { path: '/limit', code: 'invalid', message: 'The value is invalid.' },
          {
            path: '/contentTypeId',
            code: 'invalid',
            message: 'The value is invalid.',
          },
        ],
      },
    });
    const dropped = map(
      'CMS-03C-13',
      raise('VALIDATION_FAILED', '["/secret"]'),
    );
    expect(dropped.status).toBe(422);
    expect(dropped.details).toEqual({});
    const absent = map('CMS-03C-13', raise('VALIDATION_FAILED'));
    expect(absent.status).toBe(422);
    expect(absent.details).toEqual({});
  });

  it.each([
    'VERSION_MISMATCH',
    'IDEMPOTENCY_MISMATCH',
    'diff_too_large',
    'diff_has_collisions',
  ])(
    'the command and diff token %s is not generated by the selector: scrubbed 500',
    (token) => {
      expect(map('CMS-03C-13', raise(token))).toMatchObject({ status: 500 });
    },
  );
});

describe('CMS-03C-14 specifics', () => {
  it('diff_too_large is a 422 that names itself and relays no pointer', () => {
    expect(
      map('CMS-03C-14', raise('diff_too_large', '["/instanceId"]')),
    ).toMatchObject({
      status: 422,
      details: { reasonCode: 'diff_too_large' },
    });
    expect(
      map('CMS-03C-14', raise('diff_too_large', '["/instanceId"]')).details,
    ).not.toHaveProperty('violations');
  });

  it.each([
    'CONFLICT',
    'VERSION_MISMATCH',
    'VALIDATION_FAILED',
    'IDEMPOTENCY_MISMATCH',
    'revision_not_editable',
  ])('a bounded read never generates %s: scrubbed 500', (token) => {
    expect(map('CMS-03C-14', raise(token))).toMatchObject({ status: 500 });
  });
});

describe('CMS-03C-15 specifics', () => {
  it('a stale entry or instance version is a 409 with the version pair only', () => {
    const stale = map(
      'CMS-03C-15',
      raise(
        'VERSION_MISMATCH',
        JSON.stringify({
          expectedVersion: '7',
          currentVersion: '9',
          // Structured members survive `structuredMembersFromDetailText`, so only `versionPair` keeps them out.
          retryAfterSeconds: 5,
          dependencyClass: 'authentication',
          dependencyHash: 'a'.repeat(64),
          // Non-structured members are stripped earlier; kept to show the detail may carry anything.
          instanceId: 'c0000000-0000-4000-8000-000000000100',
          pageVersion: '3',
          reasonCode: 'revision_not_editable',
          violations: [{ path: '/action', code: 'invalid', message: 'x' }],
        }),
      ),
    );
    expect(stale.status).toBe(409);
    expect(stale.details).toEqual({
      expectedVersion: '7',
      currentVersion: '9',
    });
  });

  it.each([
    ['no DETAIL', null],
    ['prose DETAIL', 'expected 7 got 9'],
    ['an array DETAIL', '["/x"]'],
    [
      'invalid versions',
      JSON.stringify({ expectedVersion: '0', currentVersion: 'x' }),
    ],
  ])('a version mismatch with %s is a 409 with no member', (_n, detail) => {
    const refusal = map('CMS-03C-15', raise('VERSION_MISMATCH', detail));
    expect(refusal.status).toBe(409);
    expect(refusal.details).toEqual({});
  });

  it('the CAS serialization refusal carrying a named token is the same 409', () => {
    expect(
      map('CMS-03C-15', {
        status: 409,
        payload: { code: '40001', message: 'VERSION_MISMATCH', details: null },
      }),
    ).toMatchObject({ status: 409 });
  });

  it.each(['CONFLICT', 'IDEMPOTENCY_MISMATCH', 'IDEMPOTENCY_CONFLICT'])(
    '%s (a lock timeout or deadlock, a reused key) is a 409 with no member',
    (token) => {
      const refusal = map('CMS-03C-15', raise(token));
      expect(refusal.status).toBe(409);
      expect(refusal.details).toEqual({});
    },
  );

  it.each([
    ['revision_not_editable', 409],
    ['diff_has_collisions', 409],
    ['pattern_version_not_active', 422],
    ['pattern_incompatible', 422],
    ['nested_pattern_not_active', 422],
  ])(
    '%s keeps its one status and names itself with no pointer',
    (token, status) => {
      const failure = map(
        'CMS-03C-15',
        raise(token, '["/targetPatternVersion"]'),
      );
      expect(failure).toMatchObject({ status, details: { reasonCode: token } });
      expect(failure.details).not.toHaveProperty('violations');
    },
  );

  it.each([
    ['accept', '/instances/0/choices'],
    ['accept', '/instances/7/choices'],
    ['detach', '/instances/0'],
    ['detach', '/instances/31'],
  ])(
    'DEC-210 block_rules_violated (%s) is a 422 naming itself and relaying only its operation pointer %s',
    (_action, pointer) => {
      const failure = map(
        'CMS-03C-15',
        raise('block_rules_violated', JSON.stringify([pointer])),
      );
      expect(failure).toMatchObject({
        ok: false,
        status: 422,
        details: {
          reasonCode: 'block_rules_violated',
          violations: [
            {
              path: pointer,
              code: 'block_rules_violated',
              message: 'The value is invalid.',
            },
          ],
        },
      });
    },
  );

  it('DEC-210 block_rules_violated drops a pointer outside the instance grammar and keeps the reasonCode', () => {
    for (const detail of [
      '["/secret-pointer"]',
      '["/instances/0/choices/2/path"]',
      '["/patternVersion"]',
      null,
    ]) {
      const failure = map('CMS-03C-15', raise('block_rules_violated', detail));
      expect(failure).toMatchObject({
        status: 422,
        details: { reasonCode: 'block_rules_violated' },
      });
      expect(failure.details).not.toHaveProperty('violations');
    }
  });

  it.each(['CMS-03C-13', 'CMS-03C-14'] as const)(
    'DEC-210 block_rules_violated is not published by %s, so it is the scrubbed 500',
    (operation) => {
      expect(
        map(operation, raise('block_rules_violated', '["/instances/0"]')),
      ).toMatchObject({ ok: false, status: 500 });
    },
  );

  it('a malformed envelope, action or id is a 422 at the producer pointer', () => {
    for (const pointer of [
      '/action',
      '/targetPatternVersion',
      '/instances',
      '/instances/0',
      '/instances/12/instanceId',
      '/instances/3/expectedVersion',
      '/instances/0/choices',
      '/instances/0/choices/2',
      '/instances/0/choices/2/path',
      '/instances/0/choices/127/choice',
    ])
      expect(
        map(
          'CMS-03C-15',
          raise('VALIDATION_FAILED', JSON.stringify([pointer])),
        ),
      ).toMatchObject({
        status: 422,
        details: {
          violations: [
            {
              path: pointer,
              code: 'invalid',
              message: 'The value is invalid.',
            },
          ],
        },
      });
  });

  it.each([
    '/instances/x',
    '/instances/0/secret',
    '/other',
    '/instances/0/choices/2/x',
    'not-a-pointer',
    '/limit',
  ])(
    'a VALIDATION_FAILED pointer outside the request grammar (%s) is dropped',
    (pointer) => {
      const refusal = map(
        'CMS-03C-15',
        raise('VALIDATION_FAILED', JSON.stringify([pointer])),
      );
      expect(refusal.status).toBe(422);
      expect(refusal.details).toEqual({});
    },
  );

  it.each(['diff_too_large', 'CONFLICT_X'])(
    'the foreign token %s is a scrubbed 500',
    (token) => {
      expect(map('CMS-03C-15', raise(token))).toMatchObject({ status: 500 });
    },
  );
});
