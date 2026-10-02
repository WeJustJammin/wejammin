import { describe, expect, it, vi } from 'vitest';

import {
  isAuthoritativeContentSchemaRegistryMutationResponse,
  reconcileContentSchemaRegistryMutation,
} from './content-schema-registry-runtime-mutation-reconciliation';

/**
 * BE03a success statuses for the DEC-108 commands: CMS-03A-09/-11/-12 return
 * 201, CMS-03A-10 returns 202 (queued job, never a result) and CMS-03A-14
 * returns 201 for create and 200 for revoke. The native-form reconciliation
 * boundary must treat exactly those as authoritative so a committed command is
 * never announced as "still being reconciled" or blindly resent.
 */

const ACTION = '/app/cms-content-modeling/schema-reviews/review-id';

const jsonResponse = (status: number): Response =>
  new Response('{}', {
    status,
    headers: { 'content-type': 'application/json' },
  });

const authoritative = (operationId: string, response: Response) =>
  isAuthoritativeContentSchemaRegistryMutationResponse(
    ACTION,
    operationId,
    response,
  );

describe('[DEC-108] authoritative mutation responses', () => {
  it.each([
    ['CMS-03A-09', 201],
    ['CMS-03A-10', 202],
    ['CMS-03A-11', 201],
    ['CMS-03A-12', 201],
    ['CMS-03A-14', 201],
    ['CMS-03A-14', 200],
  ] as const)('%s accepts %i as a committed outcome', async (op, status) => {
    await expect(authoritative(op, jsonResponse(status))).resolves.toBe(true);
  });

  const committedStatus = {
    'CMS-03A-09': 201,
    'CMS-03A-10': 202,
    'CMS-03A-11': 201,
    'CMS-03A-12': 201,
    'CMS-03A-14': 201,
  } as const;

  it.each([
    ['CMS-03A-09', 200],
    ['CMS-03A-09', 202],
    ['CMS-03A-10', 200],
    ['CMS-03A-10', 201],
    ['CMS-03A-11', 202],
    ['CMS-03A-12', 200],
    ['CMS-03A-14', 202],
  ] as const)('%s refuses %i as non-authoritative', async (op, status) => {
    // Control: the operation's own success status is authoritative, so the
    // refusal below is about the status and not an unregistered operation.
    await expect(
      authoritative(op, jsonResponse(committedStatus[op])),
    ).resolves.toBe(true);
    await expect(authoritative(op, jsonResponse(status))).resolves.toBe(false);
  });

  it.each([
    'CMS-03A-09',
    'CMS-03A-10',
    'CMS-03A-11',
    'CMS-03A-12',
    'CMS-03A-14',
  ])(
    '%s accepts the committed 303 redirect to a same-origin page',
    async (op) => {
      await expect(
        authoritative(
          op,
          new Response(null, {
            status: 303,
            headers: { location: '/app/cms-content-modeling/next' },
          }),
        ),
      ).resolves.toBe(true);
    },
  );

  it('refuses a cross-origin redirect for a DEC-108 command', async () => {
    await expect(
      authoritative(
        'CMS-03A-12',
        new Response(null, {
          status: 303,
          headers: { location: '/app/cms-content-modeling/next' },
        }),
      ),
    ).resolves.toBe(true);
    await expect(
      authoritative(
        'CMS-03A-12',
        new Response(null, {
          status: 303,
          headers: { location: 'https://evil.test/' },
        }),
      ),
    ).resolves.toBe(false);
  });
});

describe('[DEC-108] same-key replay of an ambiguous command', () => {
  it.each([
    'CMS-03A-09',
    'CMS-03A-10',
    'CMS-03A-11',
    'CMS-03A-12',
    'CMS-03A-14',
  ])(
    '%s replays the exact form once under the same idempotency key',
    async (op) => {
      const form = new FormData();
      form.set('operationId', op);
      form.set('idempotency-key', 'cms-schema-key-12345');
      const fetcher = vi.fn(
        async () =>
          new Response(null, {
            status: 303,
            headers: { location: '/app/cms-content-modeling/next' },
          }),
      );
      const result = await reconcileContentSchemaRegistryMutation(
        fetcher,
        ACTION,
        op,
        form,
        'cms-schema-key-12345',
      );
      expect(result.outcome).toBe('committed');
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
});
