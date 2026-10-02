/**
 * The Worker's admission tables must agree with the contract route policy for
 * every operation, so a policy change cannot silently diverge from admission.
 */
import { describe, expect, it } from 'vitest';

import { contentSchemaRegistryRoutePolicies } from '@wejammin/contracts';

import { parseMutationHeaders, requireCapability } from './admission';
import type {
  ContentSchemaRegistryOperationId,
  ContentSchemaRegistrySession,
} from './types';

const UNIVERSE = [
  'cms.schema_designer',
  'cms.schema_registry.read',
  'cms.schema_review',
  'cms.schema_review.assign',
  'cms.author',
  'release.block_registry.write',
] as const;

const sessionHolding = (
  capabilities: readonly string[],
): ContentSchemaRegistrySession => ({
  userId: '10000000-0000-4000-8000-000000000001',
  actingPartyId: null,
  capabilities,
  mfaFresh: true,
});

const humanPolicies = contentSchemaRegistryRoutePolicies.filter(
  (policy) => policy.audience === 'browser',
);

describe('admission capability table versus the route policy', () => {
  it.each(humanPolicies.filter((policy) => policy.auth !== 'cms_owner'))(
    '$operationId admits exactly the capabilities its policy lists',
    (policy) => {
      const listed: readonly string[] =
        'capabilities' in policy ? policy.capabilities : [policy.capability];
      for (const capability of UNIVERSE) {
        const admitted =
          requireCapability(
            sessionHolding([capability]),
            policy.operationId,
          ) === null;
        expect(admitted, `${policy.operationId} with ${capability}`).toBe(
          listed.includes(capability),
        );
      }
    },
  );

  it.each(humanPolicies.filter((policy) => policy.auth === 'cms_owner'))(
    '$operationId carries no capability key: admission opens for any session and the RPC derives the owner',
    (policy) => {
      expect(requireCapability(sessionHolding([]), policy.operationId)).toBe(
        null,
      );
      expect('capability' in policy).toBe(false);
    },
  );

  it('fails closed for an operation with no mapped capability', () => {
    expect(
      requireCapability(
        sessionHolding(UNIVERSE),
        'CMS-03A-05' as ContentSchemaRegistryOperationId,
      ),
    ).toMatchObject({ ok: false, status: 403 });
  });
});

describe('mutation header admission versus the route policy', () => {
  it.each(
    contentSchemaRegistryRoutePolicies.filter((p) => p.method === 'POST'),
  )('$operationId requires If-Match exactly when its policy does', (policy) => {
    const headers = (ifMatch: string | null): Request =>
      new Request('https://api.example.test/x', {
        method: 'POST',
        headers: {
          'idempotency-key': 'cms-parity-key-001',
          ...(ifMatch === null ? {} : { 'if-match': ifMatch }),
        },
      });
    const withTag = parseMutationHeaders(headers('"1"'), policy.operationId);
    const withoutTag = parseMutationHeaders(headers(null), policy.operationId);
    expect(withTag.ok).toBe(policy.ifMatch === 'required');
    expect(withoutTag.ok).toBe(policy.ifMatch !== 'required');
  });
});
