import { describe, expect, it, vi } from 'vitest';

import {
  environment,
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
} from './cms-editorial-production.test-support';
import { createProductionCmsPatternInstanceDependencies } from './cms-composition-production-pattern';
import type { CmsPatternInstancePortInput } from './cms-composition/pattern-instance-routes';

/**
 * CMS-03C-02 production adapter: the Slice 12 reason tokens the promoted producer
 * (`cms_insert_pattern_instance`, migrations 20261014110000-110400) raises map to the typed catalog
 * refusals (BE03c 1304: one lowercase `details.reasonCode`, one status per token, on the catalog code
 * of that status), never to the scrubbed 500 of an unmapped message (BE03c 1298-1302).
 */
const revisionId = 'd2000000-0000-4000-8000-000000000011';
const patternId = 'd2000000-0000-4000-8000-000000000012';
const input = (): CmsPatternInstancePortInput => ({
  operationId: 'CMS-03C-02',
  request: new Request(
    'https://api.example.test/api/v1/cms/compositions/pattern-instances',
    { headers: { 'x-correlation-id': REQUEST_ID } },
  ),
  requestId: REQUEST_ID,
  session: {
    userId: USER_ID,
    actingPartyId: PARTY_ID,
    capabilities: ['cms.author'],
    mfaFresh: false,
  },
  body: {
    revisionId,
    patternId,
    patternVersion: 1,
    linkMode: 'linked',
    slotPath: '/primary',
    overrides: {},
    expectedVersion: '1',
  },
  idempotencyKey: 'pattern-command-0001',
  ifMatch: '1',
});
/** A PostgREST answer to a platform raise: P0001, the token as the whole message, a pointer DETAIL. */
const raised = (message: string, status = 400, detail: unknown = null) =>
  Response.json(
    { code: 'P0001', message, details: detail, hint: null },
    { status },
  );
const run = async (response: Response) =>
  createProductionCmsPatternInstanceDependencies({
    environment,
    fetchImpl: vi.fn(async () => response) as typeof fetch,
    humanOrigins: ['https://cms.example.test'],
    resolveSession: async () => ({ ok: true, value: input().session }),
  }).insertPattern(input(), new AbortController().signal);

const TYPED = [
  ['capability_missing', 403, 'COMPOSITION_FORBIDDEN'],
  ['revision_not_editable', 409, 'COMPOSITION_VERSION_CONFLICT'],
  ['pattern_cycle', 409, 'COMPOSITION_VERSION_CONFLICT'],
  ['block_registry_digest_mismatch', 409, 'COMPOSITION_VERSION_CONFLICT'],
  ['pattern_version_not_active', 422, 'COMPOSITION_VALIDATION_FAILED'],
  ['pattern_incompatible', 422, 'COMPOSITION_VALIDATION_FAILED'],
  ['nested_pattern_not_active', 422, 'COMPOSITION_VALIDATION_FAILED'],
] as const;

describe('CMS-03C-02 production adapter Slice 12 reason tokens', () => {
  it.each(TYPED)(
    'maps the producer raise %s to %i %s carrying exactly its reasonCode',
    async (token, status, code) => {
      const result = await run(
        raised(token, 400, '["/revisionId","/secret-pointer"]'),
      );
      expect(result).toMatchObject({ ok: false, status, code });
      expect((result as { details?: unknown }).details).toEqual({
        reasonCode: token,
      });
      expect(JSON.stringify(result)).not.toContain('secret-pointer');
    },
  );

  it.each(['/roots', '/patternVersion'])(
    'DEC-210 maps block_rules_violated to the typed 422 naming itself and its %s pointer',
    async (pointer) => {
      const result = await run(
        raised('block_rules_violated', 400, JSON.stringify([pointer])),
      );
      expect(result).toMatchObject({
        ok: false,
        status: 422,
        code: 'COMPOSITION_VALIDATION_FAILED',
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

  it.each([
    ['a foreign pointer', '["/secret-pointer"]'],
    ['an update pointer', '["/instances/0/choices"]'],
    ['a null DETAIL', null],
  ])(
    'DEC-210 block_rules_violated keeps its reasonCode and drops %s',
    async (_label, detail) => {
      const result = await run(raised('block_rules_violated', 400, detail));
      expect(result).toMatchObject({
        ok: false,
        status: 422,
        details: { reasonCode: 'block_rules_violated' },
      });
      expect(
        (result as { details: Record<string, unknown> }).details,
      ).not.toHaveProperty('violations');
      expect(JSON.stringify(result)).not.toContain('secret-pointer');
    },
  );

  it('keeps the stale-CAS 409 with its version pair and no reason token', async () => {
    const result = await run(
      raised(
        'VERSION_MISMATCH',
        400,
        '{"expectedVersion":"1","currentVersion":"4"}',
      ),
    );
    expect(result).toMatchObject({
      ok: false,
      status: 409,
      code: 'COMPOSITION_VERSION_CONFLICT',
    });
    expect(
      (result as { details?: Record<string, unknown> }).details,
    ).not.toHaveProperty('reasonCode');
  });

  it.each(['pattern_depth_exceeded', 'pattern_nodes_exceeded'] as const)(
    'maps the producer guard %s to the typed 422 at the producer pointer, never a scrubbed 500 (BE03c 378)',
    async (token) => {
      // BE03c 378: placement graph validation (max protected depth/nodes) is 409/422 on CMS-03C-02.
      // BE03c 1304 and the operation list name no reasonCode for it here, so none is invented: the
      // catalog code carries the producer's `/patternId` pointer as a bounded violation.
      const result = await run(raised(token, 400, '["/patternId"]'));
      expect(result).toMatchObject({
        ok: false,
        status: 422,
        code: 'COMPOSITION_VALIDATION_FAILED',
        details: {
          violations: [
            {
              path: '/patternId',
              code: 'invalid',
              message: 'The value is invalid.',
            },
          ],
        },
      });
      expect(result as { details: object }).not.toHaveProperty(
        'details.reasonCode',
      );
    },
  );

  it.each([
    ['a different safe pointer', '["/secret-pointer"]'],
    ['two safe pointers', '["/revisionId","/secret-pointer"]'],
    ['a null DETAIL', null],
    ['an absent DETAIL', undefined],
  ])(
    'hardcodes /patternId on the depth/nodes 422 and never copies %s from DETAIL (review-hardening-3 finding 1)',
    async (_label, detail) => {
      for (const token of [
        'pattern_depth_exceeded',
        'pattern_nodes_exceeded',
      ]) {
        const result = await run(raised(token, 400, detail));
        expect(result).toMatchObject({
          ok: false,
          status: 422,
          code: 'COMPOSITION_VALIDATION_FAILED',
          details: {
            violations: [
              {
                path: '/patternId',
                code: 'invalid',
                message: 'The value is invalid.',
              },
            ],
          },
        });
        expect(JSON.stringify(result)).not.toContain('secret-pointer');
        expect(JSON.stringify(result)).not.toContain('/revisionId');
      }
    },
  );

  it('does not relay an unsafe producer pointer on the depth/nodes 422', async () => {
    const result = await run(
      raised('pattern_nodes_exceeded', 400, '["not a pointer","/patternId"]'),
    );
    expect(JSON.stringify(result)).not.toContain('not a pointer');
    expect(result).toMatchObject({ ok: false, status: 422 });
  });

  it('refuses a token CMS-03C-02 does not publish as the scrubbed 500 (BE03c 1304 per-operation list)', async () => {
    for (const token of [
      'review_not_open',
      'locale_limit_reached',
      'separation_of_duties',
      'diff_too_large',
      'not_a_token',
    ]) {
      const result = await run(raised(token));
      expect(result).toMatchObject({ ok: false, status: 500, details: {} });
    }
  });

  it('lets only a P0001 whole-message raise select a token, never prose or a hint', async () => {
    for (const body of [
      { code: 'P0001', message: 'revision_not_editable: private', hint: null },
      { code: 'P0001', message: 'private', hint: 'revision_not_editable' },
      { code: 'OTHER', message: 'revision_not_editable' },
      { code: 'revision_not_editable', message: 'private' },
    ]) {
      const result = await run(Response.json(body, { status: 400 }));
      expect(result).toMatchObject({ ok: false, status: 500 });
      expect(JSON.stringify(result)).not.toContain('revision_not_editable');
    }
  });

  it('keeps a 5xx raise a 503 even when its message is a token', async () => {
    expect(await run(raised('revision_not_editable', 500))).toMatchObject({
      ok: false,
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  });
});
