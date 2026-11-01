/**
 * The committed world the Slice 12 CMS-03C-04 suite shares: an ISOLATED CMS owner, ONE active content
 * type whose active version supports `en-US` (source) and `fr-FR` (chain `["en-US"]`) with a localized
 * `title` and an unlocalized `note`, and entries created through the real CMS-03B-10 chain.
 *
 * Everything but the activation envelope comes from production code: the draft is created by the
 * production registry app (CMS-03A-01) and the entry by the production editorial Worker; the version
 * row receives the same terminal state the Slice 10 world gives it (the activation approval chain is
 * proved by the Slice 09 suites).
 */
import { randomUUID } from 'node:crypto';

import { expect } from 'vitest';

import { createCmsApp, draftTypeBody, ownerSession } from './cms-app';
import { type EditorialWorld, createEntryBody } from './cms-editorial-world';
import { createEditorialStack } from './cms-editorial-stack';
import { createIsolatedCmsOwner } from './cms-isolated-owner';
import { type CmsOwner, psql } from './stack';

export type LocaleWorld = EditorialWorld &
  Readonly<{
    noteFieldId: string;
  }>;

export const prepareLocaleWorld = async (
  owner: CmsOwner = createIsolatedCmsOwner(),
): Promise<LocaleWorld> => {
  const titleFieldId = randomUUID();
  const noteFieldId = randomUUID();
  const registry = createCmsApp(
    ownerSession(owner.authUserId, owner.organizationId, [
      'cms.schema_designer',
    ]),
  );
  const typeKey = `s12_${randomUUID().slice(0, 8).replaceAll('-', '')}`;
  const base = draftTypeBody(typeKey);
  const field = (
    stableFieldId: string,
    key: string,
    localizationMode: 'localized' | 'none',
    order: number,
    required: boolean,
  ) => ({
    stableFieldId,
    key,
    kind: 'short_text',
    constraints: {},
    required,
    validatorKey: null,
    validatorVersion: null,
    defaultMode: 'none',
    localizationMode,
    editorConfig: { label: key, order },
    lifecycle: 'active',
  });
  const created = await registry.send('POST', '/api/v1/cms/content-types', {
    body: {
      ...base,
      supportedLocales: ['en-US', 'fr-FR'],
      fallbackChains: { 'fr-FR': ['en-US'] },
      fields: [
        field(titleFieldId, 'title', 'localized', 0, true),
        field(noteFieldId, 'note', 'none', 1, false),
      ],
    },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const contentTypeId = String(created.body.contentTypeId);
  const contentTypeVersionId = String(created.body.id);
  psql(`
    begin;
    select set_config('app.cms_rpc', 'true', true);
    update platform_private.cms_content_type_versions version_row
       set state = 'active',
           version = version_row.version + 1,
           activation_workflow_policy_key = member.m->>'key',
           activation_workflow_policy_version = (member.m->>'version')::bigint,
           activation_workflow_policy_hash = member.m->>'policyHash',
           activation_required_decision_count = (member.m->>'requiredDecisionCount')::integer,
           activation_required_capabilities = member.m->'requiredCapabilities',
           activation_approval_evidence_hash = repeat('b', 64),
           updated_at = clock_timestamp()
      from (select platform_private.cms_workflow_policy_member('editorial', 1) as m) member
     where version_row.id = '${contentTypeVersionId}';
    update platform_private.cms_content_types
       set state = 'active', version = version + 1, updated_at = clock_timestamp()
     where id = '${contentTypeId}';
    commit;`);
  // The editorial grants the entry chain needs (the isolated owner already holds them).
  return {
    owner,
    contentTypeId,
    contentTypeVersionId,
    titleFieldId,
    noteFieldId,
  };
};

export type LocaleEntry = Readonly<{
  entryId: string;
  sourceRevisionId: string;
  sourceHash: string;
  /** The entry aggregate version the caller read (the strong If-Match). */
  version: string;
}>;

/** Creates one entry (version 1, `en-US` source revision) through the real editorial chain. */
export const seedLocaleEntry = async (
  world: LocaleWorld,
  title: string,
): Promise<LocaleEntry> => {
  const editorial = createEditorialStack({
    userId: world.owner.authUserId,
    actingPartyId: world.owner.organizationId,
    capabilities: ['cms.author', 'cms.editor'],
    mfaFresh: false,
  });
  const context = await editorial.authoringContext();
  expect(context.status, context.text).toBe(200);
  const type = (
    context.body.creatableTypes as readonly Record<string, unknown>[]
  ).find(
    (candidate) =>
      candidate.contentTypeVersionId === world.contentTypeVersionId,
  ) as Record<string, unknown>;
  expect(type, context.text).toBeDefined();
  const response = await editorial.create(createEntryBody(world, title, type));
  expect(response.status, response.text).toBe(201);
  const entryId = (response.body.entry as { id: string }).id;
  const sourceRevisionId = (response.body.revision as { id: string }).id;
  const [sourceHash = '', version = ''] = psql(`
    select btrim(revision.payload_hash::text) || '|' || entry.version
      from platform_private.cms_entry_revisions revision
      join platform_private.cms_content_entries entry on entry.id = revision.entry_id
     where revision.id = '${sourceRevisionId}'`).split('|');
  return { entryId, sourceRevisionId, sourceHash, version };
};
