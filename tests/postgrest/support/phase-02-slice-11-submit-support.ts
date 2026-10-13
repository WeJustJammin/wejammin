/** API05/06 proof helpers; no fixture changes to shared policy or settings. */
import { createHash, randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { EditorialReviewResourceSchema } from '@wejammin/contracts';
import {
  EFFECT_TABLES,
  type EffectSnapshot,
  expectSafeEqual,
  expectStatus,
  expectUnchanged,
  snapshotDigest,
} from './phase-02-slice-11-assert';
import { readWorkflow } from './phase-02-slice-11-flow';
import type { S11Actor, S11Rpc, S11Stack } from './phase-02-slice-11-stack';
import { type S11World, seedDraft } from './phase-02-slice-11-world';
import {
  expectFrozenSubmission,
  expectSubmissionEvidence,
} from './phase-02-slice-11-submit-policy-support';

export const SUBMIT_CATEGORIES = [
  'contract',
  'schema',
  'template',
  'block',
  'pattern',
  'taxonomy',
  'settings',
  'relation',
  'privacy',
  'security',
  'accessibility',
  'media',
  'route',
  'locale',
  'migration',
  'domain_binding',
  'revocation',
] as const;

export const submitFixture = async (stack: S11Stack, world: S11World) => {
  const draft = await seedDraft(stack, world, 'Submission contract');
  const workflow = await readWorkflow(stack, draft.entryId);
  if (workflow.preparation === null)
    throw new Error('fresh draft has no preparation');
  return {
    draft,
    preparation: workflow.preparation,
    path: `/api/v1/cms/entries/${draft.entryId}/reviews`,
    body: {
      entryId: draft.entryId,
      revisionId: draft.revisionId,
      frozenHash: workflow.preparation.frozenHash,
      dependencyManifest: workflow.preparation.dependencyManifest,
    },
  };
};

/** All 14 groups are checked, including unchanged hashes at unchanged counts. */
export const expectCommandEffects = (
  before: EffectSnapshot,
  changes: Readonly<Record<string, number>>,
): EffectSnapshot => {
  const after = snapshotDigest();
  expect(
    Object.keys(changes).every((table) =>
      EFFECT_TABLES.includes(table as (typeof EFFECT_TABLES)[number]),
    ),
  ).toBe(true);
  for (const table of EFFECT_TABLES) {
    if (!Object.hasOwn(changes, table)) {
      expect(after[table], `${table} unchanged`).toBe(before[table]);
    } else {
      const count = (snapshot: EffectSnapshot): number =>
        Number(snapshot[table]?.split(':')[0]);
      expect(count(after) - count(before), `${table} row delta`).toBe(
        changes[table],
      );
      expect(after[table] !== before[table], `${table} full row changed`).toBe(
        true,
      );
    }
  }
  return after;
};

export const SUBMIT_EFFECTS = {
  'platform_private.cms_editorial_reviews': 1,
  'platform_private.cms_editorial_review_dependencies': 2,
  'platform_private.cms_command_accessibility_evidence': 1,
  'platform_private.idempotency_records': 1,
  'platform_private.outbox_events': 1,
  'audit_private.audit_events': 1,
} as const;

/** Session derivation is independently restated, never imported from production. */
export const expectCommandIdentity = (
  rpc: S11Rpc | undefined,
  actor: S11Actor,
  requestId: string,
  correlationId: string,
  steppedUp: boolean,
): void => {
  expect(rpc !== undefined, 'command reached the genuine RPC').toBe(true);
  const context = rpc?.request.context as Record<string, unknown> | undefined;
  const hex = createHash('sha256')
    .update(`s11-session:${actor.authUserId}`)
    .digest('hex');
  const sessionId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  expectSafeEqual(
    Object.keys(context ?? {}).sort(),
    [
      'authUserId',
      'sessionId',
      'actorPersonId',
      'actingPartyId',
      'stepUpVerified',
      'requestId',
      'correlationId',
      ...(steppedUp ? ['stepUpAt'] : []),
    ].sort(),
    'exact server context keys',
  );
  expectSafeEqual(
    { ...context, ...(steppedUp ? { stepUpAt: undefined } : {}) },
    {
      authUserId: actor.authUserId,
      sessionId,
      actorPersonId: actor.personId,
      actingPartyId: actor.organizationId,
      stepUpVerified: steppedUp,
      requestId,
      correlationId,
      ...(steppedUp ? { stepUpAt: undefined } : {}),
    },
    'actual RPC authority and correlation context',
  );
  if (steppedUp) {
    const age = Date.now() - Date.parse(String(context?.stepUpAt));
    expect(age >= -30_000 && age <= 600_000, 'real fresh proof instant').toBe(
      true,
    );
  }
};

export const submitAndReplay = async (stack: S11Stack, world: S11World) => {
  const fixture = await submitFixture(stack, world);
  const key = `submit-proof-${randomUUID()}`;
  const requestId = randomUUID();
  const correlationId = randomUUID();
  const options = {
    body: fixture.body,
    ifMatch: fixture.draft.entryVersion,
    idempotencyKey: key,
    headers: { 'x-request-id': requestId, 'x-correlation-id': correlationId },
  };
  const before = snapshotDigest();
  stack.clearRpcs();
  const response = await stack.post(fixture.path, options);
  expectStatus(response, 201);
  const review = EditorialReviewResourceSchema.parse(response.body);
  expectFrozenSubmission(fixture, review);
  const after = expectCommandEffects(before, SUBMIT_EFFECTS);
  expectCommandIdentity(
    stack.rpcs().find((rpc) => rpc.rpc === 'cms_submit_review'),
    world.owner,
    requestId,
    correlationId,
    false,
  );
  expect(response.headers.get('x-request-id')).toBe(requestId);
  const firstEvidence = stack
    .rpcs()
    .find((rpc) => rpc.rpc === 'cms_submit_review')?.request.evidence;
  expectSubmissionEvidence(
    fixture,
    review,
    world,
    correlationId,
    firstEvidence,
  );
  stack.clearRpcs();
  const replay = await stack.post(fixture.path, {
    ...options,
    headers: { 'x-request-id': randomUUID(), 'x-correlation-id': randomUUID() },
  });
  expectStatus(replay, 201);
  EditorialReviewResourceSchema.parse(replay.body);
  expectSafeEqual(
    replay.body,
    response.body,
    'completed replay returns original strict resource',
  );
  const rpc = stack.rpcs().find((call) => call.rpc === 'cms_submit_review');
  expect(rpc?.replayHeader).toBe('true');
  expectSafeEqual(
    Object.keys(rpc?.request.evidence as object).sort(),
    Object.keys(firstEvidence as object).sort(),
    'new proof retains exact evidence shape',
  );
  expect(
    (rpc?.request.evidence as { evaluatedAt: string }).evaluatedAt !==
      (firstEvidence as { evaluatedAt: string }).evaluatedAt,
    'production rebuilt fresh server evidence on replay',
  ).toBe(true);
  expectUnchanged(
    after,
    snapshotDigest(),
    'submit replay changes none of 14 groups',
  );
  return { ...fixture, review, key, after };
};
