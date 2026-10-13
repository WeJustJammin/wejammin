/**
 * Slice 12 real composition for CMS-03C-04 (`POST /api/v1/cms/entries/{entryId}/locales/{locale}/
 * variants`): browser request -> first-party web proxy -> private binding -> production Hono Worker ->
 * production RPC adapter -> Kong -> PostgREST -> the newest SQL. The entries come from the real
 * CMS-03B-10 chain; the only supplied seams are the verified session and an always-allow rate
 * limiter, so every status below is what the database decided.
 *
 * Commits fixtures (isolated CMS owners, an active two-locale content type, entries): run right
 * after `pnpm db:reset`, and reset again afterwards.
 */
import { randomUUID } from 'node:crypto';

import { LocaleVariantResourceSchema } from '@wejammin/contracts';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  type CompositionStack,
  type StackResponse,
  createCompositionStack,
} from './support/phase-02-slice-12-composition-stack';
import {
  type LocaleEntry,
  type LocaleWorld,
  prepareLocaleWorld,
  seedLocaleEntry,
} from './support/phase-02-slice-12-locale-world';
import { psql } from './support/stack';

let world: LocaleWorld;
let foreign: LocaleWorld;
let stack: CompositionStack;
const session = (
  w: LocaleWorld,
  capabilities: readonly string[] = ['cms.author'],
) => ({
  userId: w.owner.authUserId,
  actingPartyId: w.owner.organizationId,
  capabilities,
  mfaFresh: false,
});

beforeAll(async () => {
  world = await prepareLocaleWorld();
  foreign = await prepareLocaleWorld();
  stack = createCompositionStack(session(world));
});

const bodyFor = (
  entry: LocaleEntry,
  over: Readonly<Record<string, unknown>> = {},
) => ({
  entryId: entry.entryId,
  locale: 'fr-FR',
  sourceRevisionId: entry.sourceRevisionId,
  fields: [{ fieldId: world.titleFieldId, value: 'Titre traduit' }],
  fallbackChain: ['en-US'],
  noFallbackFieldIds: [],
  sourceHash: entry.sourceHash,
  expectedVersion: entry.version,
  ...over,
});
const author = (
  entry: LocaleEntry,
  over: Readonly<Record<string, unknown>> = {},
  write: { idempotencyKey?: string; ifMatch?: string } = {},
  locale = 'fr-FR',
) =>
  stack.authorLocale(entry.entryId, locale, bodyFor(entry, over), {
    ifMatch: entry.version,
    ...write,
  });
const q = (sql: string): string => psql(sql);
const variants = (entryId: string): number =>
  Number(
    q(
      `select count(*) from platform_private.cms_locale_variants where entry_id = '${entryId}'`,
    ),
  );
const entryVersion = (entryId: string): string =>
  q(
    `select version from platform_private.cms_content_entries where id = '${entryId}'`,
  );
const refusal = (response: StackResponse) => ({
  status: response.status,
  body: { ...response.body, requestId: 'request-id' },
});

describe('CMS-03C-04 author a locale variant through the real stack', () => {
  it('[P2-S12-AC-054] [P2-S12-AC-056] a variant is a strict 201 draft with the aggregate ETag, an immutable target revision, one audit and one outbox event', async () => {
    const entry = await seedLocaleEntry(world, 'Source title');
    const response = await author(entry);
    expect(response.status, response.text).toBe(201);
    const resource = LocaleVariantResourceSchema.parse(response.body);
    expect(resource).toMatchObject({
      state: 'draft',
      version: '1',
      entryId: entry.entryId,
      locale: 'fr-FR',
      sourceRevisionId: entry.sourceRevisionId,
      fallbackChain: ['en-US'],
      noFallbackFieldIds: [],
    });
    expect(response.headers.get('etag')).toBe(`"${Number(entry.version) + 1}"`);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(variants(entry.entryId)).toBe(1);
    expect(entryVersion(entry.entryId)).toBe(String(Number(entry.version) + 1));
    expect(
      q(`select locale || '|' || state || '|' || version || '|' || (parent_revision_ids ? '${entry.sourceRevisionId}')::text
           from platform_private.cms_entry_revisions where id = '${resource.revisionId}'`),
    ).toBe('fr-FR|draft|1|true');
    // No text is borrowed from another locale: only the submitted field exists on the new revision.
    expect(
      q(`select field_id from platform_private.cms_entry_field_values
          where revision_id = '${resource.revisionId}'`),
    ).toBe(world.titleFieldId);
    expect(
      Number(
        q(`select count(*) from audit_private.audit_events
            where action = 'cms.locale.variant.author' and target_id = '${resource.id}'`),
      ),
    ).toBe(1);
    expect(
      Number(
        q(`select count(*) from platform_private.outbox_events
            where event_type = 'cms.localization.changed.v1' and aggregate_id = '${entry.entryId}'`),
      ),
    ).toBe(1);
  });

  it('[P2-S12-AC-056] an exact replay, also after a lost response, returns the stored 201 and adds nothing; a changed body under the same key is 409', async () => {
    const entry = await seedLocaleEntry(world, 'Replay source');
    const idempotencyKey = `locale-${randomUUID()}`;
    stack.loseNextResponse();
    const lost = await author(entry, {}, { idempotencyKey });
    expect(lost.status).toBe(503);
    expect(variants(entry.entryId)).toBe(1);
    const replay = await author(entry, {}, { idempotencyKey });
    expect(replay.status, replay.text).toBe(201);
    const again = await author(entry, {}, { idempotencyKey });
    expect(again.body).toEqual(replay.body);
    expect(variants(entry.entryId)).toBe(1);
    expect(entryVersion(entry.entryId)).toBe(String(Number(entry.version) + 1));
    const changed = await author(
      entry,
      { fields: [{ fieldId: world.titleFieldId, value: 'Autre titre' }] },
      { idempotencyKey },
    );
    expect(changed.status, changed.text).toBe(409);
    expect(changed.body.code).toBe('LOCALE_VERSION_CONFLICT');
    expect(variants(entry.entryId)).toBe(1);
  });

  it('[P2-S12-AC-056] a stale entry version, a stale source hash and a fallback chain that differs from the active one are 409 and write nothing', async () => {
    const entry = await seedLocaleEntry(world, 'Conflict source');
    const stale = await author(
      entry,
      { expectedVersion: String(Number(entry.version) + 5) },
      { ifMatch: String(Number(entry.version) + 5) },
    );
    expect(stale.status, stale.text).toBe(409);
    expect(stale.body).toMatchObject({ code: 'LOCALE_VERSION_CONFLICT' });
    const hash = await author(entry, { sourceHash: 'f'.repeat(64) });
    expect(hash.status, hash.text).toBe(409);
    expect(hash.body.code).toBe('LOCALE_VERSION_CONFLICT');
    const chain = await author(entry, { fallbackChain: [] });
    expect(chain.status, chain.text).toBe(409);
    expect(chain.body).toMatchObject({
      code: 'LOCALE_VERSION_CONFLICT',
      details: {
        reasonCode: 'FALLBACK_CHAIN_MISMATCH',
        activeFallbackChain: ['en-US'],
      },
    });
    expect(variants(entry.entryId)).toBe(0);
    expect(entryVersion(entry.entryId)).toBe(entry.version);
  });

  it('[P2-S12-AC-055] [P2-S12-AC-056] a locale the active version does not support, an unlocalized field and an invalid value are 422 and write nothing', async () => {
    const entry = await seedLocaleEntry(world, 'Validation source');
    const unsupported = await author(entry, { locale: 'de-DE' }, {}, 'de-DE');
    expect(unsupported.status, unsupported.text).toBe(422);
    expect(unsupported.body.code).toBe('LOCALE_VALIDATION_FAILED');
    const unlocalized = await author(entry, {
      fields: [{ fieldId: world.noteFieldId, value: 'Note' }],
    });
    expect(unlocalized.status, unlocalized.text).toBe(422);
    expect(unlocalized.body.code).toBe('LOCALE_VALIDATION_FAILED');
    const invalid = await author(entry, {
      fields: [{ fieldId: world.titleFieldId, value: 5 }],
    });
    expect(invalid.status, invalid.text).toBe(422);
    const unknown = await author(entry, {
      fields: [{ fieldId: randomUUID(), value: 'x' }],
    });
    expect(unknown.status, unknown.text).toBe(422);
    expect(variants(entry.entryId)).toBe(0);
  });

  it('[P2-S12-AC-055] an absent source revision and an entry another owner holds are the same 404 LOCALE_SOURCE_NOT_FOUND', async () => {
    const entry = await seedLocaleEntry(world, 'Concealed source');
    stack.clearObserved();
    const absentRevision = await author(entry, {
      sourceRevisionId: randomUUID(),
    });
    expect(absentRevision.status, absentRevision.text).toBe(404);
    expect(absentRevision.body).toMatchObject({
      code: 'LOCALE_SOURCE_NOT_FOUND',
      details: {},
    });
    const foreignEntry = await seedLocaleEntry(foreign, 'Foreign source');
    const absentEntry = await author({ ...entry, entryId: randomUUID() });
    const heldByOther = await author({
      ...entry,
      entryId: foreignEntry.entryId,
    });
    expect(absentEntry.status, absentEntry.text).toBe(404);
    expect(heldByOther.status, heldByOther.text).toBe(404);
    expect(refusal(heldByOther)).toEqual(refusal(absentEntry));
    expect(variants(entry.entryId)).toBe(0);
    expect(variants(foreignEntry.entryId)).toBe(0);
  });

  it('[P2-S12-AC-055] no session is 401, no author capability is 403 before the database, a revoked database grant is 403 from the database, and none writes', async () => {
    const entry = await seedLocaleEntry(world, 'Authority source');
    stack.as(null);
    const anonymous = await author(entry);
    expect(anonymous.status, anonymous.text).toBe(401);
    expect(anonymous.body).toMatchObject({
      code: 'UNAUTHENTICATED',
      details: { recoveryAction: 'reauthenticate' },
    });
    stack.as(session(world, []));
    stack.clearObserved();
    const noCapability = await author(entry);
    expect(noCapability.status, noCapability.text).toBe(403);
    expect(noCapability.body).toMatchObject({
      code: 'LOCALE_FORBIDDEN',
      details: { reasonCode: 'CAPABILITY_REQUIRED' },
    });
    expect(stack.observed()).toEqual([]);
    stack.as(session(world));
    q(`update identity_private.organization_actor_grant set active = false
        where organization_id = '${world.owner.organizationId}'
          and capability_code in ('cms.author', 'cms.editor')`);
    try {
      stack.clearObserved();
      const revoked = await author(entry);
      expect(revoked.status, revoked.text).toBe(403);
      expect(revoked.body).toMatchObject({ code: 'LOCALE_FORBIDDEN' });
      expect(
        stack
          .observed()
          .filter((rpc) => rpc.rpc === 'cms_author_locale_variant')
          .map((rpc) => rpc.message),
      ).toEqual(['FORBIDDEN']);
    } finally {
      q(`update identity_private.organization_actor_grant set active = true
          where organization_id = '${world.owner.organizationId}'
            and capability_code in ('cms.author', 'cms.editor')`);
    }
    expect(variants(entry.entryId)).toBe(0);
  });

  it('[P2-S12-AC-057] a dependency that never answers is 503 DEPENDENCY_UNAVAILABLE and writes nothing', async () => {
    const entry = await seedLocaleEntry(world, 'Outage source');
    stack.failNextRpc();
    const response = await author(entry);
    expect(response.status, response.text).toBe(503);
    expect(response.body).toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
      message:
        'DEPENDENCY_UNAVAILABLE: locale operation rejected or unavailable.',
    });
    expect(variants(entry.entryId)).toBe(0);
  });
});
