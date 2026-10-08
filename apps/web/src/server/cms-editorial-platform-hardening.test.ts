import { describe, expect, it, vi } from 'vitest';

import {
  HOSTILE,
  READS,
  WRITES,
  apiError,
  bindingWith,
  bodyOf,
  requestId,
  type Proxy,
  uuid2,
  validCreateBody,
  write,
} from './cms-editorial-platform-hardening.test-support';
import { forwardCmsEditorialEntryCreateMutation } from './cms-editorial-platform-mutation';

/**
 * Codex review M2: an upstream error is rebuilt from the closed BE03b detail
 * vocabulary, per operation, and the create proxy refuses valid JSON under
 * another media type (AC049).
 */

describe('upstream errors are rebuilt, never relayed (Codex review M2)', () => {
  it.each(WRITES)(
    '$name: a 409 keeps only the closed conflict details and a canonical message',
    async ({ call }) => {
      const response = await call(
        bindingWith(async () =>
          apiError(409, 'CONFLICT', {
            conflict: 'VERSION_MISMATCH',
            recoveryAction: 'reload',
            expectedVersion: '1',
            currentVersion: '2',
            tenantId: 'acme-secret',
            sql: HOSTILE,
            reasonCode: 'private_reason',
          }),
        ),
      );
      expect(response.status).toBe(409);
      const text = await response.clone().text();
      expect(text).not.toContain('acme-secret');
      expect(text).not.toContain('SQLSTATE');
      const body = await bodyOf(response);
      expect(body.message).toBe(
        'The entry changed. Review the current version before retrying.',
      );
      expect(body.details).toEqual({
        conflict: 'VERSION_MISMATCH',
        recoveryAction: 'reload',
        expectedVersion: '1',
        currentVersion: '2',
      });
      expect(body.requestId).toBe(requestId);
    },
  );

  it.each(READS)(
    '$name: a 403 keeps only a registered reason and a canonical message',
    async ({ call }) => {
      const response = await call(
        bindingWith(async () =>
          apiError(403, 'FORBIDDEN', {
            reasonCode: 'CAPABILITY_REQUIRED',
            ownerId: 'acme-secret',
          }),
        ),
      );
      expect(response.status).toBe(403);
      const body = await bodyOf(response);
      expect(body.message).toBe('You do not have permission for this entry.');
      expect(body.details).toEqual({ reasonCode: 'CAPABILITY_REQUIRED' });
      const unregistered = await call(
        bindingWith(async () =>
          apiError(403, 'FORBIDDEN', { reasonCode: 'policy predicate' }),
        ),
      );
      expect((await bodyOf(unregistered)).details).toEqual({});
    },
  );

  it('typed reasons are per operation: restore owns the migration 409s, a value write owns the value 422s', async () => {
    const restore = WRITES[3] as Proxy;
    const create = WRITES[0] as Proxy;
    const history = READS[1] as Proxy;
    const migration = await restore.call(
      bindingWith(async () =>
        apiError(409, 'CONFLICT', { reasonCode: 'migration_chain_mismatch' }),
      ),
    );
    expect((await bodyOf(migration)).details).toEqual({
      reasonCode: 'migration_chain_mismatch',
    });
    const wrongOwner = await restore.call(
      bindingWith(async () =>
        apiError(422, 'VALIDATION_FAILED', {
          reasonCode: 'rich_text_not_canonical',
        }),
      ),
    );
    expect((await bodyOf(wrongOwner)).details).toEqual({});
    const value = await create.call(
      bindingWith(async () =>
        apiError(422, 'VALIDATION_FAILED', {
          reasonCode: 'object_property_invalid',
          violations: [
            { path: `/fields/${uuid2}`, code: 'object_property_invalid' },
            { path: 'not a pointer', code: 'Bad Code', secret: 'leak' },
          ],
        }),
      ),
    );
    expect((await bodyOf(value)).details).toEqual({
      reasonCode: 'object_property_invalid',
      violations: [
        {
          path: `/fields/${uuid2}`,
          code: 'object_property_invalid',
          message: 'The value is invalid.',
        },
        { path: '/', code: 'invalid', message: 'The value is invalid.' },
      ],
    });
    const comparison = await history.call(
      bindingWith(async () =>
        apiError(422, 'VALIDATION_FAILED', {
          reasonCode: 'comparison_too_large',
        }),
      ),
    );
    expect((await bodyOf(comparison)).details).toEqual({
      reasonCode: 'comparison_too_large',
    });
    const createWrong = await create.call(
      bindingWith(async () =>
        apiError(409, 'CONFLICT', { reasonCode: 'migration_chain_mismatch' }),
      ),
    );
    expect((await bodyOf(createWrong)).details).toEqual({});
  });

  it('projects each status from the closed vocabulary only', async () => {
    const create = WRITES[0] as Proxy;
    const cases: readonly [number, string, Record<string, unknown>, unknown][] =
      [
        [404, 'NOT_FOUND', { reasonCode: 'x', ownerId: 'leak' }, {}],
        [500, 'INTERNAL_ERROR', { sql: HOSTILE }, {}],
        [
          401,
          'UNAUTHENTICATED',
          { recoveryAction: 'reauthenticate', session: 'leak' },
          { recoveryAction: 'reauthenticate' },
        ],
        [
          429,
          'RATE_LIMITED',
          { limit: 120, resetAt: '1760000000', retryAfterSeconds: 9, ip: '1' },
          { limit: 120, resetAt: '1760000000', retryAfterSeconds: 9 },
        ],
        [
          503,
          'DEPENDENCY_UNAVAILABLE',
          { dependencyClass: 'cms_editorial', retryable: true, host: 'db' },
          { dependencyClass: 'cms_editorial', retryable: true },
        ],
        [
          503,
          'DEPENDENCY_UNAVAILABLE',
          { dependencyClass: 'supabase-prod-eu-1', retryable: true },
          { retryable: true },
        ],
      ];
    for (const [status, code, details, expected] of cases) {
      const response = await create.call(
        bindingWith(async () => apiError(status, code, details)),
      );
      expect(response.status).toBe(status);
      const body = await bodyOf(response);
      expect(body.details).toEqual(expected);
      expect(body.message).not.toContain('SQLSTATE');
    }
  });
});

describe('create proxy media type', () => {
  it('[P2-S10-AC-049] refuses valid JSON sent as text/plain before the Worker can see it', async () => {
    const fetch = vi.fn(async () => apiError(500, 'INTERNAL_ERROR'));
    const response = await forwardCmsEditorialEntryCreateMutation(
      write('/api/v1/cms/entries', validCreateBody, {
        'content-type': 'text/plain',
      }),
      { fetch },
    );
    expect(response.status).toBe(415);
    expect(fetch).not.toHaveBeenCalled();
    expect((await bodyOf(response)).code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });
});
