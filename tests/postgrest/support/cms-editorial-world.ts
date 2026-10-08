/**
 * The committed world the Slice 10 editorial composition suites share: the
 * operator-bootstrapped CMS owner, an author/editor grant for that owner, and
 * ONE content type whose version is genuinely active.
 *
 * Everything but the activation envelope comes from production code: the draft
 * is created by the production registry app (CMS-03A-01) and the capability
 * grants are the production grant rows. The 03a activation approval chain is
 * exercised by the Slice 09 suites, so the version row receives the identical
 * terminal state directly, but with the REAL workflow-policy member the
 * production registry seeds (not a stand-in): the real editorial policy
 * projection (`cms_editorial_workflow_policy_evidence`) therefore resolves
 * without any function being replaced, and the author-facing CMS-03B-14
 * projection round-trips into CMS-03B-10.
 *
 * Commits fixtures; run right after `pnpm db:reset` (and reset afterwards).
 */
import { randomUUID } from 'node:crypto';

import { expect } from 'vitest';

import { createCmsApp, draftTypeBody, ownerSession } from './cms-app';
import { prepareGateWorld } from './claim-gate-world';
import { type CmsOwner, psql } from './stack';

export type EditorialWorld = Readonly<{
  owner: CmsOwner;
  contentTypeId: string;
  contentTypeVersionId: string;
  titleFieldId: string;
}>;

const grantAuthoring = (owner: CmsOwner): void => {
  psql(`
    insert into identity_private.organization_actor_grant(
      organization_id, person_id, capability_code, valid_from, valid_through, active)
    select '${owner.organizationId}', '${owner.personId}', capability,
           current_date, current_date + 30, true
      from (values ('cms.author'), ('cms.editor'), ('cms.schema_designer'))
           as capabilities(capability)
    on conflict (organization_id, person_id, capability_code)
    do update set active = true, valid_through = excluded.valid_through`);
};

const activate = (typeId: string, versionId: string): void => {
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
     where version_row.id = '${versionId}';
    update platform_private.cms_content_types
       set state = 'active', version = version + 1, updated_at = clock_timestamp()
     where id = '${typeId}';
    commit;`);
};

/**
 * `owner` defaults to the run-wide shared bootstrap owner. A suite that commits content types of
 * its own passes an isolated owner (`createIsolatedCmsOwner`) so its rows are never visible to the
 * shared owner's reads.
 */
export const prepareEditorialWorld = async (
  isolatedOwner?: CmsOwner,
): Promise<EditorialWorld> => {
  const gate = prepareGateWorld();
  const owner = isolatedOwner ?? gate.owner;
  grantAuthoring(owner);
  const registry = createCmsApp(
    ownerSession(owner.authUserId, owner.organizationId, [
      'cms.schema_designer',
    ]),
  );
  const created = await registry.send('POST', '/api/v1/cms/content-types', {
    body: draftTypeBody(`s10_${randomUUID().slice(0, 8).replaceAll('-', '')}`),
  });
  expect(created.status).toBe(201);
  const contentTypeId = String(created.body.contentTypeId);
  const contentTypeVersionId = String(created.body.id);
  activate(contentTypeId, contentTypeVersionId);
  const titleFieldId = psql(`
    select stable_field_id from platform_private.cms_field_definition_versions
     where content_type_version_id = '${contentTypeVersionId}' and field_key = 'title'`);
  // The projection reads under row security, so it resolves only inside an RPC
  // context; this proves the REAL registry policy now backs the activation.
  expect(
    psql(`begin;
      select set_config('app.cms_rpc', 'true', true) \\gset
      select platform_private.cms_editorial_workflow_policy_evidence('${contentTypeVersionId}') is not null;
      rollback;`)
      .split('\n')
      .at(-1),
  ).toBe('t');
  return { owner, contentTypeId, contentTypeVersionId, titleFieldId };
};

/** Row counts of every durable effect a command writes for one entry. */
export const effectCounts = (
  entryId: string,
): Readonly<{
  entries: number;
  revisions: number;
  audit: number;
  outbox: number;
  conflicts: number;
}> => {
  const [entries, revisions, audit, outbox, conflicts] = psql(`
    select (select count(*) from platform_private.cms_content_entries where id = '${entryId}'),
           (select count(*) from platform_private.cms_entry_revisions where entry_id = '${entryId}'),
           (select count(*) from audit_private.audit_events where target_id = '${entryId}'),
           (select count(*) from platform_private.outbox_events where aggregate_id = '${entryId}'),
           (select count(*) from platform_private.cms_conflict_records where entry_id = '${entryId}')`)
    .split('|')
    .map(Number);
  return {
    entries: entries ?? 0,
    revisions: revisions ?? 0,
    audit: audit ?? 0,
    outbox: outbox ?? 0,
    conflicts: conflicts ?? 0,
  };
};

/** The verified author/editor session of the world's owner. */
export const authorSession = (
  world: EditorialWorld,
): Readonly<{
  userId: string;
  actingPartyId: string;
  capabilities: readonly string[];
  mfaFresh: boolean;
}> => ({
  userId: world.owner.authUserId,
  actingPartyId: world.owner.organizationId,
  capabilities: ['cms.author', 'cms.editor'],
  mfaFresh: false,
});

/** A CMS-03B-10 body built from a CMS-03B-14 creatable-type projection. */
export const createEntryBody = (
  world: EditorialWorld,
  title: string,
  type: Readonly<Record<string, unknown>>,
) => ({
  contentTypeId: type.contentTypeId,
  contentTypeVersionId: type.contentTypeVersionId,
  locale: 'en-US',
  changedPaths: [`/fields/${world.titleFieldId}`],
  values: { [world.titleFieldId]: title },
  schemaArtifact: type.schemaArtifact,
  validatorRefs: type.validatorRefs,
  workflowPolicy: type.workflowPolicy,
  activationEvidence: type.activationEvidence,
});

/** A CMS-03B-01 body: one title change from `baseRevision` at `expectedVersion`. */
export const appendEntryBody = (
  world: EditorialWorld,
  entryId: string,
  title: string,
  baseRevision: string,
  expectedVersion: string,
) => ({
  entryId,
  baseRevision,
  changedPaths: [`/fields/${world.titleFieldId}`],
  values: { [world.titleFieldId]: title },
  locale: 'en-US',
  expectedVersion,
});

/** Outbox events of one entry grouped by event type (the evidence a command emits). */
export const outboxByType = (
  entryId: string,
): Readonly<Record<string, number>> =>
  Object.fromEntries(
    psql(`
      select event_type, count(*) from platform_private.outbox_events
       where aggregate_id = '${entryId}' group by event_type order by 1`)
      .split('\n')
      .filter((line) => line !== '')
      .map((line) => {
        const [type = '', count = '0'] = line.split('|');
        return [type, Number(count)];
      }),
  );
