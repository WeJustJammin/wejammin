/**
 * Slice 10 evidence lane EA (AC-008, AC-014, AC-020, AC-026): the COMPLETE declared database token
 * catalog of CMS-03B-01, -02, -03 and -04 (BE03b error matrix and DEC-139..146) is mapped by the
 * PRODUCTION Hono app and RPC adapter to its typed BE00 ApiError: status, closed code, the closed
 * conflict kind and recovery action, the typed reason code and retry hint, with nothing the
 * dependency says echoed. One table row per (operation, token), so a token that is added, dropped
 * or remapped for one operation changes exactly that operation's row.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  FIELD,
  LEAK,
  OPERATIONS,
  type Operation,
  build,
  read,
  rpcError,
  send,
} from './support/ev-ea-editorial-app';

type Expectation = Readonly<{
  token: string;
  status: number;
  code: string;
  details?: Readonly<Record<string, unknown>>;
  retryable?: boolean;
}>;

const COMMON: readonly Expectation[] = [
  {
    token: 'UNAUTHENTICATED',
    status: 401,
    code: 'UNAUTHENTICATED',
    details: { recoveryAction: 'reauthenticate' },
  },
  { token: 'FORBIDDEN', status: 403, code: 'FORBIDDEN' },
  { token: 'NOT_FOUND', status: 404, code: 'NOT_FOUND' },
  { token: 'RATE_LIMITED', status: 429, code: 'RATE_LIMITED' },
  {
    token: 'DEPENDENCY_UNAVAILABLE',
    status: 503,
    code: 'DEPENDENCY_UNAVAILABLE',
    retryable: true,
  },
  { token: 'INTERNAL_ERROR', status: 500, code: 'INTERNAL_ERROR' },
  { token: 'INVALID_REQUEST', status: 400, code: 'INVALID_REQUEST' },
  { token: 'VALIDATION_FAILED', status: 422, code: 'VALIDATION_FAILED' },
];

const WRITE_CONFLICTS: readonly Expectation[] = [
  {
    token: 'VERSION_MISMATCH',
    status: 409,
    code: 'CONFLICT',
    details: { conflict: 'VERSION_MISMATCH', recoveryAction: 'reload' },
  },
  {
    token: 'IDEMPOTENCY_MISMATCH',
    status: 409,
    code: 'CONFLICT',
    details: {
      conflict: 'IDEMPOTENCY_MISMATCH',
      recoveryAction: 'use_new_idempotency_key',
    },
  },
  {
    token: 'INVALID_TRANSITION',
    status: 409,
    code: 'CONFLICT',
    details: { conflict: 'INVALID_TRANSITION', recoveryAction: 'refresh' },
  },
  { token: 'CONFLICT', status: 409, code: 'CONFLICT' },
];

const RESTORE_REASONS: readonly Expectation[] = [
  'migration_chain_incomplete',
  'migration_chain_mismatch',
  'migration_chain_unavailable',
  'template_incompatible',
].map((token) => ({
  token,
  status: 409,
  code: 'CONFLICT',
  details: { reasonCode: token, recoveryAction: 'refresh' },
}));

/** BE03b:1519 typed 422 reasons: the lowercase token is the whole P0001 message. */
const VALUE_REASONS: readonly Expectation[] = [
  'rich_text_not_canonical',
  'object_kind_unspecified',
  'object_property_invalid',
  'relation_target_unavailable',
  'taxonomy_source_unavailable',
  'media_source_unavailable',
].map((token) => ({
  token,
  status: 422,
  code: 'VALIDATION_FAILED',
  details: { reasonCode: token },
}));

const READ_REFUSALS: readonly Expectation[] = [
  'comparison_too_large',
  'comparison_unavailable',
].map((token) => ({
  token,
  status: 422,
  code: 'VALIDATION_FAILED',
  details: { reasonCode: token },
}));

const catalog = (operation: Operation): readonly Expectation[] => {
  if (operation.id === 'CMS-03B-03') return [...COMMON, ...READ_REFUSALS];
  if (operation.id === 'CMS-03B-04')
    return [
      ...COMMON,
      ...WRITE_CONFLICTS,
      ...VALUE_REASONS,
      ...RESTORE_REASONS,
    ];
  return [...COMMON, ...WRITE_CONFLICTS, ...VALUE_REASONS];
};

describe.each(OPERATIONS)('$id declared token catalog', (operation) => {
  it.each(catalog(operation))(
    `${operation.id} maps the database token $token to $status $code`,
    async (expected) => {
      const fetchImpl = vi.fn(async () => rpcError(expected.token));
      const response = await send(
        build(fetchImpl as unknown as typeof fetch),
        operation,
      );
      expect(response.status).toBe(expected.status);
      const body = await read(response);
      expect(body.code).toBe(expected.code);
      if (expected.details !== undefined)
        expect(body.details).toMatchObject(expected.details);
      if (expected.retryable === true)
        expect(response.headers.get('x-cms-editorial-retryable')).toBe('true');
      expect(JSON.stringify(body)).not.toContain(LEAK);
      expect(body.requestId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    },
  );

  if (operation.id !== 'CMS-03B-03')
    it.each(VALUE_REASONS)(
      `${operation.id} publishes the field pointer of the typed value reason $token as one violation carrying that reason`,
      async (expected) => {
        const fetchImpl = vi.fn(
          async () =>
            new Response(
              JSON.stringify({
                code: 'P0001',
                message: expected.token,
                details: JSON.stringify([`/fields/${FIELD}`, 'not a pointer']),
                hint: null,
              }),
              { status: 400, headers: { 'content-type': 'application/json' } },
            ),
        );
        const response = await send(
          build(fetchImpl as unknown as typeof fetch),
          operation,
        );
        expect(response.status).toBe(422);
        const body = await read(response);
        expect(body.details.reasonCode).toBe(expected.token);
        expect(body.details.violations).toEqual([
          {
            path: `/fields/${FIELD}`,
            code: expected.token,
            message: 'The value is invalid.',
          },
        ]);
        expect(JSON.stringify(body)).not.toContain('not a pointer');
      },
    );

  it(`${operation.id} drops a reason code and a recovery action that the registered vocabulary does not contain`, async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            code: 'P0001',
            message: 'VALIDATION_FAILED',
            details: JSON.stringify({
              reasonCode: 'invented_reason',
              recoveryAction: 'wipe_everything',
              leak: LEAK,
            }),
            hint: null,
          }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
    );
    const response = await send(
      build(fetchImpl as unknown as typeof fetch),
      operation,
    );
    const text = await response.text();
    expect(text).not.toContain('invented_reason');
    expect(text).not.toContain('wipe_everything');
    expect(text).not.toContain(LEAK);
  });
});
