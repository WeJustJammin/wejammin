/**
 * Preconditions of the Slice 12 governed-review real-route spec, made through the same chain the
 * browser uses (web proxy -> private binding -> production Worker -> production RPC adapter ->
 * Kong -> PostgREST -> SQL), on the Slice 10 world. The subject is a vocabulary (taxonomy)
 * version: it needs the least to exist (no block registry, no content binding) and it is
 * reviewed through the same CMS-03C-06..10 commands as a template or a pattern. Nothing is
 * seeded by a direct write except the owner's own capability grant (the receipt owner holds no
 * CMS grant by default).
 */
import { randomUUID } from 'node:crypto';

import { API_URL, mintJwt, psql } from '../../postgrest/support/stack';
import type { S10Client } from './s10-real-api';
import type { S10Principal, S10World } from './s10-real-world';
import { prepareS10World } from './s10-real-world';
import type { S11Actor } from './s11-real-browser';
import { ownerPrincipal, provisionMember } from './s11-real-world';

export const GOVERNED_REVIEWS_API = '/api/v1/cms/governed-reviews';
export const TAXONOMY_VERSIONS_API = '/api/v1/cms/taxonomies/versions';
export const REVIEW_PAGE = (reviewId: string): string =>
  `/app/cms-content-modeling/definition-reviews/${reviewId}`;
export const TAXONOMY_PAGE = (taxonomyId: string): string =>
  `/app/cms-content-modeling/taxonomies/${taxonomyId}`;

export type GovernedCast = Readonly<{
  world: S10World;
  /** Holds `cms.taxonomy_curator`: defines and submits a vocabulary. */
  curator: S11Actor;
  /** Holds `cms.reviewer`: records the decision. */
  reviewer: S11Actor;
  /** The receipt owner: assigns the reviewer and activates, schedules and retires. */
  owner: S11Actor;
}>;

const actor = (
  principal: S10Principal,
  capabilities: readonly string[],
): S11Actor => ({ principal, capabilities });

/** The owner holds the subject-kind capability the activation command checks. */
const grantOwner = (world: S10World, capabilities: readonly string[]): void => {
  psql(`
    insert into identity_private.organization_actor_grant(
      organization_id, person_id, capability_code, valid_from, valid_through, active)
    select '${world.owner.organizationId}', '${world.owner.personId}', capability,
           current_date, current_date + 400, true
      from (values ${capabilities.map((capability) => `('${capability}')`).join(', ')}) as capabilities(capability)
    on conflict (organization_id, person_id, capability_code)
    do update set active = true, valid_through = excluded.valid_through`);
};

/**
 * The person selects the organization as the acting context, through the real producer
 * (`identity_context_bind`, authenticated as that person): the database then holds the active
 * binding the owner's registry reads are bound to. A session names it as `actingContextId`.
 */
const bindActingContext = async (
  world: S10World,
  person: S10Principal,
): Promise<string> => {
  const clientBindingId = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const token = mintJwt({
    role: 'authenticated',
    sub: person.authUserId,
    session_id: randomUUID(),
    iss: `${API_URL}/auth/v1`,
    aud: 'authenticated',
    iat: now,
    aal: 'aal1',
    amr: [],
  });
  const response = await fetch(`${API_URL}/rest/v1/rpc/identity_context_bind`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'accept-profile': 'platform_api',
      'content-profile': 'platform_api',
      'content-type': 'application/json',
      'x-client-binding-id': clientBindingId,
      'idempotency-key': randomUUID(),
    },
    body: JSON.stringify({
      p_context_id: world.owner.organizationId,
      p_deliberate_confirmation: true,
      p_client_binding_id: clientBindingId,
    }),
  });
  const body = (await response.json()) as { bindingId?: unknown };
  if (response.status !== 200 || typeof body.bindingId !== 'string')
    throw new Error(
      `identity_context_bind refused: ${String(response.status)} ${JSON.stringify(body)}`,
    );
  return body.bindingId;
};

export const prepareGovernedCast = async (): Promise<GovernedCast> => {
  const world = await prepareS10World();
  grantOwner(world, ['cms.taxonomy_curator']);
  return {
    world,
    curator: actor(
      provisionMember(world, 's12-curator', ['cms.taxonomy_curator'], 400),
      ['cms.taxonomy_curator'],
    ),
    reviewer: actor(
      provisionMember(world, 's12-reviewer', ['cms.reviewer'], 400),
      ['cms.reviewer'],
    ),
    owner: {
      ...actor(ownerPrincipal(world), ['cms.taxonomy_curator']),
      actingContextId: await bindActingContext(world, {
        authUserId: world.owner.authUserId,
        personId: world.owner.personId,
        label: 'owner',
      }),
    },
  };
};

/** The key of the suite's content type, which the vocabulary's allowlist names. */
const typeKeyOf = (world: S10World): string =>
  psql(
    `select type_key from platform_private.cms_content_types where id = '${world.contentTypeId}'`,
  );

export type DefinedTaxonomy = Readonly<{
  versionId: string;
  taxonomyId: string;
  contentHash: string;
  version: string;
}>;

/**
 * CMS-03A-15 as the receipt owner (fresh step-up, binding-bound): the owner issues the reviewer's
 * `cms.reviewer` grant. The reviewer-options list reads THESE aggregates
 * (`platform_private.cms_capability_grants`, scoped to the owner's acting party); a direct write
 * to the identity actor-grant table, which is what `provisionMember` does, is invisible to it.
 */
export const grantReviewerViaApi = async (
  owner: S10Client,
  reviewerPersonId: string,
): Promise<{ status: number; text: string }> => {
  const through = new Date(Date.now() + 60 * 24 * 3_600_000)
    .toISOString()
    .slice(0, 10);
  const granted = await owner.post('/api/v1/cms/capability-grants', {
    subjectPersonId: reviewerPersonId,
    capability: 'cms.reviewer',
    validThrough: through,
  });
  return { status: granted.status, text: granted.text };
};

/** CMS-03C-16 as the curator: a first `draft` version of a new vocabulary. */
export const defineTaxonomyViaApi = async (
  curator: S10Client,
  world: S10World,
): Promise<DefinedTaxonomy> => {
  const created = await curator.post(TAXONOMY_VERSIONS_API, {
    // CMS-03C-16 key grammar: ^[a-z][a-z0-9-]{1,63}$ (hyphens, no underscore).
    taxonomyKey: `s12-gov-${randomUUID().slice(0, 8).replaceAll('-', '')}`,
    shape: 'flat',
    allowedTypeKeys: [typeKeyOf(world)],
    allowedFieldKeys: ['title'],
    canonicalOverlapDomains: [],
    expectedVersion: null,
  });
  if (created.status !== 201)
    throw new Error(`CMS-03C-16 refused: ${created.status} ${created.text}`);
  return {
    versionId: String(created.body.id),
    taxonomyId: String(created.body.taxonomyId),
    contentHash: String(created.body.contentHash),
    version: String(created.body.version),
  };
};

export type OpenReview = Readonly<{ reviewId: string; reviewVersion: string }>;

/** CMS-03C-06 as the curator. */
export const submitGovernedViaApi = async (
  curator: S10Client,
  subject: DefinedTaxonomy,
): Promise<OpenReview> => {
  const submitted = await curator.post(GOVERNED_REVIEWS_API, {
    subjectKind: 'taxonomy_version',
    subjectId: subject.versionId,
    subjectHash: subject.contentHash,
  });
  if (submitted.status !== 201)
    throw new Error(
      `CMS-03C-06 refused: ${submitted.status} ${submitted.text}`,
    );
  return {
    reviewId: String(submitted.body.id),
    reviewVersion: String(submitted.body.version),
  };
};

/** CMS-03C-08 create as the receipt owner (fresh step-up). */
export const assignGovernedViaApi = async (
  owner: S10Client,
  review: OpenReview,
  reviewerPersonId: string,
): Promise<{ status: number; text: string; reviewVersion: string }> => {
  const assigned = await owner.post(
    `${GOVERNED_REVIEWS_API}/${review.reviewId}/assignments`,
    {
      action: 'create',
      reviewerPersonId,
      expiresAt: new Date(Date.now() + 3 * 24 * 3_600_000).toISOString(),
      expectedVersion: review.reviewVersion,
    },
    { ifMatch: review.reviewVersion },
  );
  return {
    status: assigned.status,
    text: assigned.text,
    reviewVersion: review.reviewVersion,
  };
};

/** CMS-03C-10 as a caller: the review's current version and state. */
export const readGovernedReview = async (
  client: S10Client,
  reviewId: string,
): Promise<{ version: string; state: string; text: string }> => {
  const read = await client.get(`${GOVERNED_REVIEWS_API}/${reviewId}`);
  return {
    version: String(read.body.version ?? ''),
    state: String(read.body.state ?? ''),
    text: read.text,
  };
};

/** Rows the database holds for one review (the evidence of "exactly once"). */
export const governedEffects = (
  reviewId: string,
): Readonly<{ decisions: number; assignments: number }> => {
  const [decisions, assignments] = psql(`
    select (select count(*) from platform_private.cms_governed_review_decisions where review_id = '${reviewId}'),
           (select count(*) from platform_private.cms_governed_review_assignments where review_id = '${reviewId}')`)
    .split('|')
    .map(Number);
  return { decisions: decisions ?? 0, assignments: assignments ?? 0 };
};
