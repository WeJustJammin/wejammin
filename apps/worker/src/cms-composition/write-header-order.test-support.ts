import { describe, expect, it } from 'vitest';

/**
 * BE00 line 386 (step 6): "strict Zod validation of path/query/headers/body ... before resource
 * authorization"; line 387 (step 7): capability and "domain quota". BE03c 408: Idempotency-Key is
 * 8-128 printable ASCII, a 400 header refusal. BE03c 1502: parse -> authenticate -> capability.
 * A malformed Idempotency-Key or If-Match is therefore a 400 before the capability check and
 * before any user or party quota token is consumed, whatever the caller may do.
 */
export const ORIGIN = 'https://cms.example.test';
export const ID = (n: number): string =>
  `d1200000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const DIGEST = 'a'.repeat(64);

export const rate = async (input: { limit: number }) => ({
  ok: true as const,
  value: {
    allowed: true,
    limit: input.limit,
    remaining: input.limit - 1,
    resetAt: 2_000,
  },
});
export const session = (capabilities: readonly string[]) => async () => ({
  ok: true as const,
  value: {
    userId: ID(1),
    actingPartyId: ID(2),
    capabilities,
    mfaFresh: true,
  },
});

export type Probe = Readonly<{
  name: string;
  /** A request carrying `headers` over the valid ones; returns the response and spies. */
  send: (
    headers: Record<string, string | null>,
    capability: boolean,
    body?: unknown,
  ) => Promise<
    Readonly<{
      response: Response;
      rateLimit: () => number;
      port: () => number;
    }>
  >;
  /**
   * If-Match values that must be refused: a required one that is missing, weak, unquoted or
   * different from `expectedVersion`; on a first template version (`expectedVersion` null),
   * any If-Match at all.
   */
  badIfMatch: readonly (string | null)[];
}>;

export const merge = (
  base: Record<string, string>,
  over: Record<string, string | null>,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries({ ...base, ...over }).filter(
      (entry): entry is [string, string] => entry[1] !== null,
    ),
  );

const MALFORMED_KEYS: readonly (readonly [string, string | null])[] = [
  ['missing', null],
  ['shorter than 8', 'short'],
  ['longer than 128', 'k'.repeat(129)],
  ['non-printable ASCII', 'idempotency\u0001key-001'],
];

export const registerHeaderOrderTests = (probes: readonly Probe[]): void => {
  describe.each(probes)(
    '$name: header validation precedes capability and quota',
    (probe) => {
      it('a valid request reaches the port after both quota tokens', async () => {
        const sent = await probe.send({}, true);
        expect(sent.response.status).toBeLessThan(300);
        expect(sent.rateLimit()).toBe(2);
        expect(sent.port()).toBe(1);
      });

      it.each(MALFORMED_KEYS)(
        'a %s Idempotency-Key is a 400 that consumes no quota and starts no write',
        async (_name, key) => {
          const sent = await probe.send({ 'idempotency-key': key }, true);
          expect(sent.response.status).toBe(400);
          expect(((await sent.response.json()) as { code: string }).code).toBe(
            'INVALID_REQUEST',
          );
          expect(sent.rateLimit()).toBe(0);
          expect(sent.port()).toBe(0);
        },
      );

      it('a malformed Idempotency-Key from a caller without the capability is still the 400, not the 403', async () => {
        const sent = await probe.send({ 'idempotency-key': 'short' }, false);
        expect(sent.response.status).toBe(400);
        expect(sent.rateLimit()).toBe(0);
      });

      it('a valid request from a caller without the capability is still the 403 and consumes no quota', async () => {
        const sent = await probe.send({}, false);
        expect(sent.response.status).toBe(403);
        expect(sent.rateLimit()).toBe(0);
        expect(sent.port()).toBe(0);
      });

      it('a body that fails validation stays a 422 ahead of the header 400', async () => {
        const sent = await probe.send({ 'idempotency-key': 'short' }, true, {
          unexpected: true,
        });
        expect(sent.response.status).toBe(422);
        expect(sent.rateLimit()).toBe(0);
      });

      it('a malformed or non-agreeing If-Match is a 400 that consumes no quota', async () => {
        for (const value of probe.badIfMatch) {
          const sent = await probe.send({ 'if-match': value }, true);
          expect(sent.response.status, String(value)).toBe(400);
          expect(sent.rateLimit(), String(value)).toBe(0);
          expect(sent.port(), String(value)).toBe(0);
        }
      });
    },
  );
};
