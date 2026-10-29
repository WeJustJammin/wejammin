/**
 * Preconditions of the Slice 12 wave-5 page-level real-route specs (definition pages, protected
 * decision path, definition journeys), made through the same chain the browser uses and layered
 * on the Slice 10 / Slice 12 governed worlds:
 *
 *  - a template designer (`cms.template_designer`) and a registered pattern block, so a pattern
 *    version can be SAVED through CMS-03C-12 and its page opened at /patterns/:patternKey;
 *  - a PROTECTED content type (the DEC-110 `cms.disclosure.policy` workflow policy, two decisions,
 *    a `cms.reviewer.policy` specialist slot) and a vocabulary version bound to it, so a review of
 *    that vocabulary is `protected` (BE03c governed policy basis, 20261013300300 line 301);
 *  - two reviewers: the base slot (`cms.reviewer`) and the specialist (`cms.reviewer` plus
 *    `cms.reviewer.policy`).
 *
 * Nothing is seeded by a direct write except the two documented envelopes the Slice 10 world also
 * writes (the activation terminal state of the 03a chain with the REAL policy member, and the
 * capability grants / confirmed memberships `provisionMember` writes). This directory is not
 * type-checked by `pnpm type-check`.
 */
import { randomUUID } from 'node:crypto';

import {
  createCmsApp,
  draftTypeBody,
  ownerSession,
} from '../../postgrest/support/cms-app';
import {
  LATENCY_BLOCK_KEY,
  LATENCY_BLOCK_VERSION,
  registerLatencyBlock,
} from '../../postgrest/support/phase-02-slice-12-latency-blocks';
import { psql } from '../../postgrest/support/stack';
import type { S10Client } from './s10-real-api';
import type { S10World } from './s10-real-world';
import type { S11Actor } from './s11-real-browser';
import {
  TAXONOMY_VERSIONS_API,
  type DefinedTaxonomy,
} from './s12-governed-world';
import { provisionMember } from './s11-real-world';

export const PATTERN_VERSIONS_API = '/api/v1/cms/patterns/versions';
export const PATTERN_PAGE = (patternKey: string): string =>
  `/app/cms-content-modeling/patterns/${patternKey}`;
export const PATTERN_NEW_PAGE = '/app/cms-content-modeling/patterns/new';
export const TAXONOMY_NEW_PAGE = '/app/cms-content-modeling/taxonomies/new';
export const COMPOSITION_PAGE = (entryId: string): string =>
  `/app/cms-content-modeling/entries/${entryId}/composition`;

const GRANT_DAYS = 400;

/** A confirmed member holding `cms.template_designer`: defines patterns and templates. */
export const provisionDesigner = (world: S10World): S11Actor => ({
  principal: provisionMember(
    world,
    's12-pw5-designer',
    ['cms.template_designer'],
    GRANT_DAYS,
  ),
  capabilities: ['cms.template_designer'],
});

/** The base-slot reviewer of a protected review: `cms.reviewer` only. */
export const provisionBaseReviewer = (world: S10World): S11Actor => ({
  principal: provisionMember(
    world,
    's12-pw5-base-reviewer',
    ['cms.reviewer'],
    GRANT_DAYS,
  ),
  capabilities: ['cms.reviewer'],
});

/** The specialist of a protected review: holds `cms.reviewer` and the policy slot `cms.reviewer.policy`. */
export const provisionSpecialistReviewer = (world: S10World): S11Actor => ({
  principal: provisionMember(
    world,
    's12-pw5-specialist',
    ['cms.reviewer', 'cms.reviewer.policy'],
    GRANT_DAYS,
  ),
  capabilities: ['cms.reviewer', 'cms.reviewer.policy'],
});

export type DefinedPatternVersion = Readonly<{
  patternKey: string;
  patternId: string;
  versionId: string;
  contentHash: string;
  version: string;
}>;

/** One root node of the registered pattern block: the smallest tree CMS-03C-12 accepts. */
const singleRoot = (title: string) => [
  {
    kind: 'block',
    key: 'root1',
    blockKey: LATENCY_BLOCK_KEY,
    blockVersion: LATENCY_BLOCK_VERSION,
    props: { title },
    children: [],
  },
];

/**
 * CMS-03C-12 as a template designer: a first `draft` version of a new pattern lineage over the
 * suite's active content type. The block is registered once per database through the production
 * signed release route (the same helper the latency suites use).
 */
export const definePatternViaApi = async (
  designer: S10Client,
  world: S10World,
  title = 'pw5 pattern',
): Promise<DefinedPatternVersion> => {
  await registerLatencyBlock(world.owner);
  // CMS-03C-12 key grammar: ^[a-z][a-z0-9-]{1,63}$ (hyphens, no underscore).
  const patternKey = `s12-pw5-${randomUUID().slice(0, 8).replaceAll('-', '')}`;
  const created = await designer.post(PATTERN_VERSIONS_API, {
    patternKey,
    compatibleTypeIds: [world.contentTypeId],
    blockTree: singleRoot(title),
    expectedVersion: null,
  });
  if (created.status !== 201)
    throw new Error(`CMS-03C-12 refused: ${created.status} ${created.text}`);
  return {
    patternKey,
    patternId: String(created.body.patternId),
    versionId: String(created.body.id),
    contentHash: String(created.body.contentHash),
    version: String(created.body.version),
  };
};

/**
 * The terminal state of the 03a activation chain for the protected type, with the REAL
 * `cms.disclosure.policy` registry member (two decisions, `cms.reviewer.policy` slot). It is the
 * twin of the Slice 10 world's `activate`, which uses the `editorial` member.
 */
const activateWithPolicy = (
  typeId: string,
  versionId: string,
  policyKey: string,
): void => {
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
      from (select platform_private.cms_workflow_policy_member('${policyKey}', 1) as m) member
     where version_row.id = '${versionId}';
    update platform_private.cms_content_types
       set state = 'active', version = version + 1, updated_at = clock_timestamp()
     where id = '${typeId}';
    commit;`);
};

/** An active content type under the PROTECTED disclosure workflow policy; returns its type key. */
export const createProtectedType = async (world: S10World): Promise<string> => {
  const registry = createCmsApp(
    ownerSession(world.owner.authUserId, world.owner.organizationId, [
      'cms.schema_designer',
    ]),
  );
  const typeKey = `s12_prot_${randomUUID().slice(0, 8).replaceAll('-', '')}`;
  const created = await registry.send('POST', '/api/v1/cms/content-types', {
    body: {
      ...draftTypeBody(typeKey),
      workflowKey: 'cms.disclosure.policy',
      workflowVersion: '1',
    },
  });
  if (created.status !== 201)
    throw new Error(
      `CMS-03A-01 refused the protected type: ${created.status} ${JSON.stringify(created.body)}`,
    );
  activateWithPolicy(
    String(created.body.contentTypeId),
    String(created.body.id),
    'cms.disclosure.policy',
  );
  return typeKey;
};

/** CMS-03C-16 as the curator: a first `draft` vocabulary version bound to the named content type key. */
export const defineTaxonomyForTypeViaApi = async (
  curator: S10Client,
  typeKey: string,
): Promise<DefinedTaxonomy & { taxonomyKey: string }> => {
  const taxonomyKey = `s12-prot-${randomUUID().slice(0, 8).replaceAll('-', '')}`;
  const created = await curator.post(TAXONOMY_VERSIONS_API, {
    taxonomyKey,
    shape: 'flat',
    allowedTypeKeys: [typeKey],
    allowedFieldKeys: ['title'],
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
    version: String(created.body.version),
  };
};

/**
 * Whatever the browser or the API sent over the wire must never carry a diff value, a canonical
 * id or a person id in a URL (AC-273 "no ... canonical id or person id in the URL"). Returns the
 * ids to look for: the person, the review, the lineage and version ids.
 */
export const forbiddenInUrls = (
  ids: readonly (string | undefined)[],
): readonly string[] =>
  ids.filter((value): value is string => value !== undefined && value !== '');

/**
 * An active content type whose active version supports `en-US` (source) and `fr-FR` (fallback chain `["en-US"]`) with a
 * localized required `title`: the recipe of `tests/postgrest/support/phase-02-slice-12-locale-world.ts`, made through the
 * production registry app, with the Slice 10 world's activation envelope (the `editorial` policy member). Returns the
 * suite world with the localized type in place of the plain one, so `seedEntry` creates entries of it.
 */
export const localizedWorld = async (world: S10World): Promise<S10World> => {
  const registry = createCmsApp(
    ownerSession(world.owner.authUserId, world.owner.organizationId, [
      'cms.schema_designer',
    ]),
  );
  const titleFieldId = randomUUID();
  const typeKey = `s12_loc_${randomUUID().slice(0, 8).replaceAll('-', '')}`;
  const created = await registry.send('POST', '/api/v1/cms/content-types', {
    body: {
      ...draftTypeBody(typeKey),
      supportedLocales: ['en-US', 'fr-FR'],
      fallbackChains: { 'fr-FR': ['en-US'] },
      fields: [
        {
          stableFieldId: titleFieldId,
          key: 'title',
          kind: 'short_text',
          constraints: {},
          required: true,
          validatorKey: null,
          validatorVersion: null,
          defaultMode: 'none',
          localizationMode: 'localized',
          editorConfig: { label: 'Title', order: 0 },
          lifecycle: 'active',
        },
      ],
    },
  });
  if (created.status !== 201)
    throw new Error(
      `CMS-03A-01 refused the localized type: ${created.status} ${JSON.stringify(created.body)}`,
    );
  const contentTypeId = String(created.body.contentTypeId);
  const contentTypeVersionId = String(created.body.id);
  activateWithPolicy(contentTypeId, contentTypeVersionId, 'editorial');
  return {
    ...world,
    contentTypeId,
    contentTypeVersionId,
    fields: { title: titleFieldId, summary: randomUUID(), body: randomUUID() },
  };
};

export const LOCALE_PAGE = (entryId: string, locale: string): string =>
  `/app/cms-content-modeling/entries/${entryId}/locales/${locale}`;
