/**
 * The committed world the Slice 10 real-route browser suites share, built
 * against the REAL local Supabase stack (the one the API Worker talks to).
 *
 * Everything but two documented envelopes comes from production code: the
 * operator-bootstrapped owner (`initialize_cms_owner`), every person
 * (`identity_create`) and the content type (CMS-03A-01 through the production
 * registry Worker app). The two direct writes are the same ones the real-API
 * gate suites make (tests/postgrest/support/cms-editorial-world.ts): the
 * 03a activation approval chain is exercised by the Slice 09 suites, so the
 * version row receives its identical terminal state with the REAL
 * registry workflow-policy member (not a stand-in), and the capability grants
 * and the confirmed membership are the production rows the grant and invitation
 * flows would write. Entries, revisions, conflicts and restores are NEVER
 * seeded: the specs make them through the browser or the first-party routes.
 *
 * Re-runnable without a reset: every principal and the content type are new on
 * each preparation, so no spec depends on a row an earlier run left behind.
 */
import { randomUUID } from 'node:crypto';

import { test } from '@playwright/test';

import {
  createCmsApp,
  draftTypeBody,
  ownerSession,
} from '../../postgrest/support/cms-app';
import {
  type CmsOwner,
  createAuthUser,
  createPerson,
  ensureCmsOwner,
  psql,
} from '../../postgrest/support/stack';
import { S10_CAPABILITIES_CLAIM, S10_PARTY_CLAIM } from './s10-session-claims';

export type S10Principal = Readonly<{
  authUserId: string;
  personId: string;
  label: string;
}>;

export type S10World = Readonly<{
  owner: CmsOwner;
  contentTypeId: string;
  contentTypeVersionId: string;
  typeLabel: string;
  /** Stable field ids of the active type (title is required). */
  fields: Readonly<{ title: string; summary: string; body: string }>;
  /** A confirmed member holding the author and editor grants (the main actor). */
  author: S10Principal;
  /** A second author in the same organization (visible, not the assignee). */
  otherAuthor: S10Principal;
  /** A confirmed member holding no CMS grant. */
  member: S10Principal;
  /** A person outside the owning organization entirely. */
  outsider: S10Principal;
}>;

const AUTHOR_CAPABILITIES = ['cms.author', 'cms.editor'] as const;

const newPerson = (label: string): S10Principal => {
  const authUserId = createAuthUser(randomUUID());
  return { authUserId, personId: createPerson(authUserId), label };
};

const confirmMembership = (owner: CmsOwner, person: S10Principal): void => {
  psql(`
    insert into identity_private.membership_tenure(
      id, organization_id, person_id, state, provenance, governance_mode,
      starts_on, accepted_at, actor_id, version)
    values (gen_random_uuid(), '${owner.organizationId}', '${person.personId}',
            'confirmed', 'invitation', 'ungoverned', current_date,
            clock_timestamp(), '${owner.personId}', 1)`);
};

const grantAuthoring = (owner: CmsOwner, person: S10Principal): void => {
  psql(`
    insert into identity_private.organization_actor_grant(
      organization_id, person_id, capability_code, valid_from, valid_through, active)
    select '${owner.organizationId}', '${person.personId}', capability,
           current_date, current_date + 30, true
      from (values ('cms.author'), ('cms.editor')) as capabilities(capability)
    on conflict (organization_id, person_id, capability_code)
    do update set active = true, valid_through = excluded.valid_through`);
};

const grantSchemaDesign = (owner: CmsOwner): void => {
  psql(`
    insert into identity_private.organization_actor_grant(
      organization_id, person_id, capability_code, valid_from, valid_through, active)
    values ('${owner.organizationId}', '${owner.personId}', 'cms.schema_designer',
            current_date, current_date + 30, true)
    on conflict (organization_id, person_id, capability_code)
    do update set active = true, valid_through = excluded.valid_through`);
};

/** The terminal state of the 03a activation chain, with the real policy member. */
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

const field = (
  key: string,
  kind: string,
  label: string,
  order: number,
  required: boolean,
) => ({
  stableFieldId: randomUUID(),
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

const requireStack = (): void => {
  try {
    if (psql('select 1') !== '1') throw new Error('unexpected answer');
  } catch (error) {
    throw new Error(
      'The S10 real-route suite needs the local Supabase stack at the newest migrations: pnpm db:start && pnpm db:reset.',
      { cause: error },
    );
  }
};

/**
 * The running harness must have been launched with the stack up: an absent
 * editorial dependency leaves the routes unregistered (404), and a spec that ran
 * against it would only ever fail with a misleading status. Unauthenticated, a
 * configured route is a 401.
 */
const requireConfiguredEditorialRoute = async (): Promise<void> => {
  const baseURL = test.info().project.use.baseURL;
  if (baseURL === undefined) throw new Error('baseURL is not configured');
  const response = await fetch(
    `${baseURL}/api/v1/cms/entries/authoring-context`,
    { redirect: 'manual' },
  );
  if (response.status !== 401)
    throw new Error(
      `The real-route API Worker was launched without the Supabase stack (the unauthenticated editorial read answered ${String(response.status)}, expected 401). Start the stack, then restart the harness: pnpm db:start && pnpm db:reset.`,
    );
};

const prepare = async (): Promise<S10World> => {
  requireStack();
  await requireConfiguredEditorialRoute();
  // The signed history and list cursors need their Vault key before any list or
  // history read reaches the caller check (a test key, as in the gate suites).
  psql(`select vault.create_secret(repeat('a1', 32), 'cms_editorial_history_cursor_active',
          'real-route suite key') where not exists (
          select 1 from vault.secrets where name = 'cms_editorial_history_cursor_active')`);
  const owner = ensureCmsOwner();
  grantSchemaDesign(owner);
  const registry = createCmsApp(
    ownerSession(owner.authUserId, owner.organizationId, [
      'cms.schema_designer',
    ]),
  );
  const typeKey = `s10_e2e_${randomUUID().slice(0, 8).replaceAll('-', '')}`;
  const base = draftTypeBody(typeKey);
  const title = field('title', 'short_text', 'Title', 0, true);
  const summary = field('summary', 'long_text', 'Summary', 1, false);
  const body = field('body', 'rich_text', 'Body', 2, false);
  const created = await registry.send('POST', '/api/v1/cms/content-types', {
    body: { ...base, fields: [title, summary, body] },
  });
  if (created.status !== 201)
    throw new Error(
      `CMS-03A-01 refused the suite content type: ${created.status} ${JSON.stringify(created.body)}`,
    );
  const contentTypeId = String(created.body.contentTypeId);
  const contentTypeVersionId = String(created.body.id);
  activate(contentTypeId, contentTypeVersionId);

  const author = newPerson('author');
  const otherAuthor = newPerson('other-author');
  const member = newPerson('member-without-grant');
  const outsider = newPerson('outsider');
  for (const person of [author, otherAuthor]) {
    confirmMembership(owner, person);
    grantAuthoring(owner, person);
  }
  confirmMembership(owner, member);
  return {
    owner,
    contentTypeId,
    contentTypeVersionId,
    typeLabel: String(base.label),
    fields: {
      title: title.stableFieldId,
      summary: summary.stableFieldId,
      body: body.stableFieldId,
    },
    author,
    otherAuthor,
    member,
    outsider,
  };
};

/**
 * A new author in the owning organization: a person (identity_create), a
 * confirmed membership and the author/editor grants. A spec that counts or
 * orders its own entries provisions one so no other spec's rows are in its list.
 */
export const provisionAuthor = (
  current: S10World,
  label: string,
): S10Principal => {
  const person = newPerson(label);
  confirmMembership(current.owner, person);
  grantAuthoring(current.owner, person);
  return person;
};

let world: Promise<S10World> | null = null;

/** Prepare once per worker process; every call returns the same world. */
export const prepareS10World = (): Promise<S10World> => {
  world ??= prepare();
  return world;
};

/**
 * Session options for `authenticateLocalSession`: the signed cookie names the
 * principal and the acting party. The capability claim is what the Worker
 * admits at the route; whether the person may act is the database's decision,
 * so the no-grant member and the outsider carry the author claim on purpose.
 */
export const s10Session = (
  current: S10World,
  principal: S10Principal,
  sessionNumber = 1,
): Readonly<{
  userId: string;
  sessionId: string;
  csrfToken: string;
  claims: Readonly<Record<string, unknown>>;
}> => ({
  userId: principal.authUserId,
  // Session ids are `80000000-0000-4000-8000-<12 hex>`: the principal and the
  // session number are encoded so two sessions of one person differ.
  sessionId: `80000000-0000-4000-8000-${principal.authUserId.slice(0, 8)}${sessionNumber.toString(16).padStart(4, '0')}`,
  csrfToken: `s10-csrf-${principal.label}-${String(sessionNumber)}`,
  claims: {
    [S10_PARTY_CLAIM]: current.owner.organizationId,
    [S10_CAPABILITIES_CLAIM]: AUTHOR_CAPABILITIES,
  },
});

/** Row counts of every durable effect for one entry (the evidence of "exactly once"). */
export const effectCounts = (
  entryId: string,
): Readonly<{
  entries: number;
  revisions: number;
  audit: number;
  outbox: number;
  conflicts: number;
  openConflicts: number;
}> => {
  const [entries, revisions, audit, outbox, conflicts, openConflicts] = psql(`
    select (select count(*) from platform_private.cms_content_entries where id = '${entryId}'),
           (select count(*) from platform_private.cms_entry_revisions where entry_id = '${entryId}'),
           (select count(*) from audit_private.audit_events where target_id = '${entryId}'),
           (select count(*) from platform_private.outbox_events where aggregate_id = '${entryId}'),
           (select count(*) from platform_private.cms_conflict_records where entry_id = '${entryId}'),
           (select count(*) from platform_private.cms_conflict_records where entry_id = '${entryId}' and state = 'open')`)
    .split('|')
    .map(Number);
  return {
    entries: entries ?? 0,
    revisions: revisions ?? 0,
    audit: audit ?? 0,
    outbox: outbox ?? 0,
    conflicts: conflicts ?? 0,
    openConflicts: openConflicts ?? 0,
  };
};

export type RevisionLineage = Readonly<{
  number: string;
  id: string;
  /** The ordered `parent_revision_ids` the database stored for the revision. */
  parents: readonly string[];
}>;

/** The stored lineage of every revision of one entry (the truth a result panel states). */
export const revisionLineage = (entryId: string): readonly RevisionLineage[] =>
  psql(`
    select revision_number, id, parent_revision_ids::text
      from platform_private.cms_entry_revisions
     where entry_id = '${entryId}' order by revision_number`)
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => {
      const [number = '', id = '', parents = '[]'] = line.split('|');
      return { number, id, parents: JSON.parse(parents) as string[] };
    });
