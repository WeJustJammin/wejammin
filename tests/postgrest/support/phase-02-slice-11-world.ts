/**
 * The committed Slice 11 world (lane S11-4R): the shared bootstrap owner's organization
 * (the owner receipt is what CMS-03B-18 and the `owner` read scopes derive from) with
 *
 *   owner      the bootstrap owner: cms.author + cms.editor (creates entries, submits, assigns reviewers)
 *   reviewer   cms.reviewer (decides)
 *   reviewer2  cms.reviewer (a second, unassigned reviewer)
 *   publisher  cms.publisher (schedules and publishes)
 *   outsider   an organization member with no CMS capability
 *
 * plus one active content type. Everything but the activation envelope and the
 * membership/grant rows comes from production code: the persons are created by
 * `identity_create`, the entries/revisions by the production Worker routes
 * (CMS-03B-10 / -01). Commits fixtures; run right after `pnpm db:reset`.
 */
import { randomUUID } from 'node:crypto';

import { expect } from 'vitest';

import { type EditorialWorld, createEntryBody } from './cms-editorial-world';
import { prepareGateWorld } from './claim-gate-world';
import { applyDiagnosticOverlay } from './phase-02-slice-11-overlay';
import { ensureS11ContentType } from './phase-02-slice-11-type';
import type { S11Actor, S11Stack } from './phase-02-slice-11-stack';
import { createPerson, psql } from './stack';

export type S11World = Readonly<{
  editorial: EditorialWorld;
  organizationId: string;
  owner: S11Actor;
  reviewer: S11Actor;
  reviewer2: S11Actor;
  publisher: S11Actor;
  /** A second publisher (its grant is the one the schedule suites end). */
  publisher2: S11Actor;
  /** A publisher whose grant ends tomorrow (authority_ends_before_schedule). */
  shortPublisher: S11Actor;
  /** Holds cms.reviewer AND cms.publisher: the separation-of-duties probe. */
  dual: S11Actor;
  outsider: S11Actor;
  /** A person who is NOT a member of the organization (the session still claims its party). */
  stranger: S11Actor;
}>;

export const OWNER_CAPABILITIES = ['cms.author', 'cms.editor'] as const;

/** A confirmed member of the organization holding exactly `capabilities` (by grant rows). */
export const addMember = (
  organizationId: string,
  ownerPersonId: string,
  capabilities: readonly string[],
  validThrough: string | null = null,
): S11Actor => {
  const authUserId = randomUUID();
  psql(
    `insert into auth.users(id, email, email_confirmed_at)
     values ('${authUserId}', 'm${authUserId.slice(0, 8)}@example.test', now())`,
  );
  const personId = createPerson(authUserId);
  const grants = capabilities
    .map(
      (capability) =>
        `('${organizationId}', '${personId}', '${capability}', current_date, ${
          validThrough === null ? 'null' : `'${validThrough}'`
        }, true)`,
    )
    .join(',');
  psql(`
    begin;
    select set_config('app.cms_rpc', 'true', true);
    insert into identity_private.membership_tenure(
      id, organization_id, person_id, state, provenance, governance_mode,
      starts_on, accepted_at, actor_id, version)
    values (gen_random_uuid(), '${organizationId}', '${personId}', 'confirmed', 'invitation',
            'ungoverned', current_date, clock_timestamp(), '${ownerPersonId}', 1);
    ${
      capabilities.length === 0
        ? ''
        : `insert into identity_private.organization_actor_grant(
             organization_id, person_id, capability_code, valid_from, valid_through, active)
           values ${grants};`
    }
    commit;`);
  return { authUserId, personId, organizationId, capabilities };
};

/** A person with no tenure in the organization. */
const strangerOf = (organizationId: string): S11Actor => {
  const authUserId = randomUUID();
  psql(
    `insert into auth.users(id, email, email_confirmed_at)
     values ('${authUserId}', 's${authUserId.slice(0, 8)}@example.test', now())`,
  );
  return {
    authUserId,
    personId: createPerson(authUserId),
    organizationId,
    capabilities: ['cms.author', 'cms.editor', 'cms.reviewer', 'cms.publisher'],
  };
};

export const prepareS11World = async (): Promise<S11World> => {
  applyDiagnosticOverlay();
  // The bootstrap owner: CMS-03B-18 and the `owner` read scopes derive from its receipt.
  const bootstrap = prepareGateWorld().owner;
  const editorial = await ensureS11ContentType(bootstrap);
  const organizationId = bootstrap.organizationId;
  return {
    editorial,
    organizationId,
    owner: {
      authUserId: bootstrap.authUserId,
      personId: bootstrap.personId,
      organizationId,
      capabilities: OWNER_CAPABILITIES,
    },
    reviewer: addMember(organizationId, bootstrap.personId, ['cms.reviewer']),
    reviewer2: addMember(organizationId, bootstrap.personId, ['cms.reviewer']),
    publisher: addMember(organizationId, bootstrap.personId, ['cms.publisher']),
    publisher2: addMember(organizationId, bootstrap.personId, [
      'cms.publisher',
    ]),
    shortPublisher: addMember(
      organizationId,
      bootstrap.personId,
      ['cms.publisher'],
      psql(`select (current_date + 1)::text`),
    ),
    dual: addMember(organizationId, bootstrap.personId, [
      'cms.reviewer',
      'cms.publisher',
    ]),
    outsider: addMember(organizationId, bootstrap.personId, []),
    stranger: strangerOf(organizationId),
  };
};

export type SeededDraft = Readonly<{
  entryId: string;
  revisionId: string;
  entryVersion: string;
}>;

/** The CMS-03B-14 projection of the world's creatable type (frozen schema evidence). */
const creatableType = async (
  stack: S11Stack,
  world: S11World,
): Promise<Record<string, unknown>> => {
  const response = await stack.get('/api/v1/cms/entries/authoring-context');
  expect(response.status, response.text).toBe(200);
  const type = (
    response.body.creatableTypes as readonly Record<string, unknown>[]
  ).find(
    (candidate) =>
      candidate.contentTypeVersionId === world.editorial.contentTypeVersionId,
  );
  expect(type).toBeDefined();
  return type as Record<string, unknown>;
};

/** Creates one entry (revision 1) through the production CMS-03B-10 route as the owner. */
export const seedDraft = async (
  stack: S11Stack,
  world: S11World,
  title: string,
): Promise<SeededDraft> => {
  stack.as(world.owner);
  const type = await creatableType(stack, world);
  const created = await stack.post('/api/v1/cms/entries', {
    body: createEntryBody(world.editorial, title, type),
  });
  expect(created.status, created.text).toBe(201);
  const entry = created.body.entry as { id: string; version: string };
  const revision = created.body.revision as { id: string };
  return {
    entryId: entry.id,
    revisionId: revision.id,
    entryVersion: entry.version,
  };
};

/** Row counts of the Slice 11 durable effects of one entry. */
export const workflowEffects = (
  entryId: string,
): Readonly<Record<string, number>> => {
  const [reviews, decisions, assignments, schedules, publications, outbox] =
    psql(`
      select (select count(*) from platform_private.cms_editorial_reviews where entry_id = '${entryId}'),
             (select count(*) from platform_private.cms_editorial_decisions d
               join platform_private.cms_editorial_reviews r on r.id = d.review_id where r.entry_id = '${entryId}'),
             (select count(*) from platform_private.cms_editorial_review_assignments a
               join platform_private.cms_editorial_reviews r on r.id = a.review_id where r.entry_id = '${entryId}'),
             (select count(*) from platform_private.cms_publication_schedules where entry_id = '${entryId}'),
             (select count(*) from platform_private.cms_publication_versions where entry_id = '${entryId}'),
             (select count(*) from platform_private.outbox_events where aggregate_id = '${entryId}')`)
      .split('|')
      .map(Number);
  return {
    reviews: reviews ?? 0,
    decisions: decisions ?? 0,
    assignments: assignments ?? 0,
    schedules: schedules ?? 0,
    publications: publications ?? 0,
    outbox: outbox ?? 0,
  };
};

/** Idempotency reservations of the CMS-03B-05..09/18 operations (the step-up gate must add none). */
export const reservationCount = (): number =>
  Number(
    psql(
      `select count(*) from platform_private.idempotency_records where operation like 'CMS-03B-%'`,
    ),
  );
