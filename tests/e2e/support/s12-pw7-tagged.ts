/**
 * Fixtures of the Slice 12 wave-7 term-merge and template journeys: a content type with a `taxonomy` field, a vocabulary
 * whose allowlist names it, an entry carrying a term assignment, and a template version. Same conventions as
 * `s12-pw7-world.ts`; not type-checked by `pnpm type-check`.
 */
import { randomUUID } from 'node:crypto';

import {
  createCmsApp,
  draftTypeBody,
  ownerSession,
} from '../../postgrest/support/cms-app';
import {
  ENTRIES_API,
  createBody,
  readCreatableType,
  type S10Client,
  type SeededEntry,
} from './s10-real-api';
import type { S10World } from './s10-real-world';
import { TAXONOMY_VERSIONS_API } from './s12-governed-world';
import { activateWithPolicy } from './s12-pw7-world';

export type TaggedWorld = S10World &
  Readonly<{
    /** The `taxonomy` field of the type (key `tags`). */
    tagsFieldId: string;
    typeKey: string;
  }>;

/**
 * An active content type with the required `title` and an optional `tags` field of kind `taxonomy`, so an entry can carry
 * a term assignment. Returned in place of the suite world's plain type (the same recipe as `mixedLocaleWorld`).
 */
export const taggedWorld = async (world: S10World): Promise<TaggedWorld> => {
  const registry = createCmsApp(
    ownerSession(world.owner.authUserId, world.owner.organizationId, [
      'cms.schema_designer',
    ]),
  );
  const titleFieldId = randomUUID();
  const tagsFieldId = randomUUID();
  const typeKey = `s12_tag_${randomUUID().slice(0, 8).replaceAll('-', '')}`;
  const field = (
    stableFieldId: string,
    key: string,
    kind: string,
    label: string,
    required: boolean,
    order: number,
  ) => ({
    stableFieldId,
    key,
    kind,
    constraints: {},
    required,
    validatorKey: null,
    validatorVersion: null,
    defaultMode: 'none',
    localizationMode: 'none',
    editorConfig: { label, order },
    lifecycle: 'active',
  });
  const created = await registry.send('POST', '/api/v1/cms/content-types', {
    body: {
      ...draftTypeBody(typeKey),
      fields: [
        field(titleFieldId, 'title', 'short_text', 'Title', true, 0),
        field(tagsFieldId, 'tags', 'taxonomy', 'Tags', false, 1),
      ],
    },
  });
  if (created.status !== 201)
    throw new Error(
      `CMS-03A-01 refused the tagged type: ${created.status} ${JSON.stringify(created.body)}`,
    );
  const contentTypeId = String(created.body.contentTypeId);
  const contentTypeVersionId = String(created.body.id);
  activateWithPolicy(contentTypeId, contentTypeVersionId, 'editorial');
  return {
    ...world,
    contentTypeId,
    contentTypeVersionId,
    fields: { title: titleFieldId, summary: randomUUID(), body: randomUUID() },
    tagsFieldId,
    typeKey,
  };
};

/** CMS-03C-16 as the curator: a first `draft` flat vocabulary whose allowlist names the type and its `tags` field. */
export const defineTagsVocabularyViaApi = async (
  curator: S10Client,
  typeKey: string,
): Promise<
  Readonly<{
    versionId: string;
    taxonomyId: string;
    contentHash: string;
    taxonomyKey: string;
  }>
> => {
  const taxonomyKey = `s12-tags-${randomUUID().slice(0, 8).replaceAll('-', '')}`;
  const created = await curator.post(TAXONOMY_VERSIONS_API, {
    taxonomyKey,
    shape: 'flat',
    allowedTypeKeys: [typeKey],
    allowedFieldKeys: ['tags'],
    canonicalOverlapDomains: [],
    expectedVersion: null,
  });
  if (created.status !== 201)
    throw new Error(`CMS-03C-16 refused: ${created.status} ${created.text}`);
  return {
    taxonomyKey,
    versionId: String(created.body.id),
    taxonomyId: String(created.body.taxonomyId),
    contentHash: String(created.body.contentHash),
  };
};

/** CMS-03B-10 through the real chain: an entry whose `tags` field names `termId` (the term assignment is committed). */
export const seedTaggedEntry = async (
  author: S10Client,
  world: TaggedWorld,
  title: string,
  termId: string,
): Promise<SeededEntry> => {
  const type = await readCreatableType(author, world);
  const created = await author.post(
    ENTRIES_API,
    createBody(world, type, {
      [world.fields.title]: title,
      [world.tagsFieldId]: { termIds: [termId] },
    }),
  );
  if (created.status !== 201)
    throw new Error(`CMS-03B-10 refused: ${created.status} ${created.text}`);
  const entry = created.body.entry as { id: string; version: string };
  const revision = created.body.revision as { id: string };
  return {
    entryId: entry.id,
    firstRevisionId: revision.id,
    version: entry.version,
    revision: String(created.body.revisionNumber),
  };
};

export const TEMPLATE_VERSIONS_API = '/api/v1/cms/templates/versions';
const REGIONS = ['header', 'now', 'record', 'detail', 'provenance'];

export type DefinedTemplate = Readonly<{
  templateKey: string;
  versionId: string;
  contentHash: string;
}>;

/** CMS-03C-01 as a template designer: a first `draft` version of a new template over the suite's content type. */
export const defineTemplateViaApi = async (
  designer: S10Client,
  world: S10World,
): Promise<DefinedTemplate> => {
  const templateKey = `s12-tpl-${randomUUID().slice(0, 8).replaceAll('-', '')}`;
  const created = await designer.post(TEMPLATE_VERSIONS_API, {
    templateKey,
    compatibleTypeIds: [world.contentTypeId],
    slots: [],
    reservedRegions: REGIONS,
    bindings: {},
    locale: 'en-US',
    audience: 'public',
    expectedVersion: null,
  });
  if (created.status !== 201)
    throw new Error(`CMS-03C-01 refused: ${created.status} ${created.text}`);
  return {
    templateKey,
    versionId: String(created.body.id),
    contentHash: String(created.body.contentHash),
  };
};
