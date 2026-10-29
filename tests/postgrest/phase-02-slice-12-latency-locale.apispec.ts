/**
 * Slice 12 real-stack latency, part 3: CMS-03C-04 at the 128-locale-field bound (BE03c: "128 locale fields meet the Tier 2
 * p95 < 1,200 ms"). Browser request -> first-party web proxy -> production Worker route -> production RPC adapter -> Kong ->
 * PostgREST -> the newest SQL, over the world of `supabase/tests/phase_02_slice_12_locale_perf/001-bench.sqlinc`: an active type
 * with 64 localized and 64 no_fallback short_text fields, an entry created by the production CMS-03B-10 chain with 128 values,
 * and an `fr-FR` variant translating all 128 fields. The write is timed 24 times after 3 discarded warm-ups (p95 over at least
 * twenty samples); every sample must be a 201.
 *
 *   CMS-03C-04  Tier 2  p95 < 1,200 ms   P2-S12-AC-056, AC-279
 *
 * Commits fixtures; run right after `pnpm db:reset`, and reset again afterwards. Not run by the author of this file.
 */
import { randomUUID } from 'node:crypto';

import { LocaleVariantResourceSchema } from '@wejammin/contracts';
import { beforeAll, describe, expect, it } from 'vitest';

import { createCmsApp, ownerSession } from './support/cms-app';
import { draftTypeBody } from './support/cms-app';
import { createEditorialStack } from './support/cms-editorial-stack';
import { createIsolatedCmsOwner } from './support/cms-isolated-owner';
import {
  type Measurement,
  measure,
} from './support/phase-02-slice-11-latency-stats';
import {
  type CompositionStack,
  createCompositionStack,
  designerSession,
} from './support/phase-02-slice-12-composition-stack';
import { type CmsOwner, psql } from './support/stack';

const RUN = { samples: 24, warmups: 3 } as const;
const TIER_2_P95_MS = 1_200;
const WRITE_DEADLINE_MS = 15_000;
const FIELDS = 128;

let owner: CmsOwner;
let stack: CompositionStack;
let entryId = '';
let sourceRevisionId = '';
let sourceHash = '';
const fieldIds = Array.from({ length: FIELDS }, () => randomUUID());
const noFallback = fieldIds.slice(FIELDS / 2);
const measurements: Measurement[] = [];

const entryVersion = (): string =>
  psql(
    `select version from platform_private.cms_content_entries where id = '${entryId}'`,
  );

beforeAll(async () => {
  owner = createIsolatedCmsOwner();
  const registry = createCmsApp(
    ownerSession(owner.authUserId, owner.organizationId, [
      'cms.schema_designer',
    ]),
  );
  const typeKey = `s12_${randomUUID().slice(0, 8).replaceAll('-', '')}`;
  const created = await registry.send('POST', '/api/v1/cms/content-types', {
    body: {
      ...draftTypeBody(typeKey),
      supportedLocales: ['en-US', 'fr-FR'],
      fallbackChains: { 'fr-FR': ['en-US'] },
      fields: fieldIds.map((stableFieldId, index) => ({
        stableFieldId,
        key: `f${String(index + 1).padStart(3, '0')}`,
        kind: 'short_text',
        constraints: {},
        required: false,
        validatorKey: null,
        validatorVersion: null,
        defaultMode: 'none',
        localizationMode: index < FIELDS / 2 ? 'localized' : 'no_fallback',
        editorConfig: { label: `Field ${index + 1}`, order: index },
        lifecycle: 'active',
      })),
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
  const editorial = createEditorialStack({
    userId: owner.authUserId,
    actingPartyId: owner.organizationId,
    capabilities: ['cms.author', 'cms.editor'],
    mfaFresh: false,
  });
  const context = await editorial.authoringContext();
  expect(context.status, context.text).toBe(200);
  const type = (
    context.body.creatableTypes as readonly Record<string, unknown>[]
  ).find(
    (candidate) => candidate.contentTypeVersionId === contentTypeVersionId,
  );
  expect(type, context.text).toBeDefined();
  const entry = await editorial.create({
    contentTypeId: type?.contentTypeId,
    contentTypeVersionId: type?.contentTypeVersionId,
    locale: 'en-US',
    changedPaths: fieldIds.map((id) => `/fields/${id}`),
    values: Object.fromEntries(
      fieldIds.map((id, index) => [id, `Source ${index + 1}`]),
    ),
    schemaArtifact: type?.schemaArtifact,
    validatorRefs: type?.validatorRefs,
    workflowPolicy: type?.workflowPolicy,
    activationEvidence: type?.activationEvidence,
  });
  expect(entry.status, entry.text).toBe(201);
  entryId = (entry.body.entry as { id: string }).id;
  sourceRevisionId = (entry.body.revision as { id: string }).id;
  sourceHash = psql(
    `select btrim(payload_hash::text) from platform_private.cms_entry_revisions where id = '${sourceRevisionId}'`,
  );
  stack = createCompositionStack(designerSession(owner, ['cms.author']));
}, 600_000);

describe('Slice 12 locale latency through the real stack', () => {
  it('[CMS-03C-04] writing a 128-field fr-FR variant: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-056] [P2-S12-AC-279]', async () => {
    let run = 0;
    let version = entryVersion();
    const first = await stack.authorLocale(entryId, 'fr-FR', body(0, version), {
      ifMatch: version,
    });
    expect(first.status, first.text).toBe(201);
    expect(
      LocaleVariantResourceSchema.parse(first.body).noFallbackFieldIds,
    ).toHaveLength(FIELDS / 2);
    version = entryVersion();
    const result = await measure(
      'locale_write128',
      () => {
        run += 1;
        return stack.authorLocale(entryId, 'fr-FR', body(run, version), {
          ifMatch: version,
        });
      },
      (answer) => {
        expect(answer.status, answer.text.slice(0, 300)).toBe(201);
        version = entryVersion();
      },
      RUN,
    );
    measurements.push(result);
    expect(result.p95).toBeLessThan(TIER_2_P95_MS);
    for (const elapsed of [...result.warmups, ...result.samples])
      expect(elapsed).toBeLessThan(WRITE_DEADLINE_MS);
  }, 600_000);
});

/** All 128 fields translated; `salt` makes every write a new draft version. */
const body = (salt: number, version: string) => ({
  entryId,
  locale: 'fr-FR',
  sourceRevisionId,
  fields: fieldIds.map((fieldId, index) => ({
    fieldId,
    value: `Traduit ${index + 1} / ${salt}`,
  })),
  fallbackChain: ['en-US'],
  noFallbackFieldIds: noFallback,
  sourceHash,
  expectedVersion: version,
});
