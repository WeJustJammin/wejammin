/** Fixture and requests for the static-authored, runtime-UNRUN CMS-03C-06 race. */
import { randomUUID } from 'node:crypto';

import { queryScript, queryValue } from './governed-authority-execution.mjs';
import { buildSourceFixture } from './governed-authority-fixture.mjs';
import { jsonb, sql } from './governed-authority-processes.mjs';

/** Worker transport claims carry the human actor; the command actually switches database role. */
export const actorSettings = (ids) => `select
  set_config('request.jwt.claims', ${sql(JSON.stringify({ role: 'service_role', sub: ids.auth }))}, true),
  set_config('app.auth_user_id', ${sql(ids.auth)}, true),
  set_config('app.actor_auth_user_id', ${sql(ids.auth)}, true),
  set_config('app.actor_person_id', ${sql(ids.person)}, true),
  set_config('app.acting_party_id', ${sql(ids.org)}, true),
  set_config('app.acting_context_id', ${sql(ids.binding)}, true);`;

const context = (ids) => ({
  actingPartyId: ids.org,
  actingContextId: ids.binding,
  correlationId: randomUUID(),
});

/**
 * CMS-03A-15 grants need the recent binding-bound MFA proof (`cms_review_binding` with
 * p_recent): context.stepUpVerified true and a context.stepUpAt inside -30 s..600 s, the
 * same proof the chain-kit and review-kit contexts carry. The governed submit and template
 * commands take no step-up, so only the grant command uses this context.
 */
const stepUpContext = (ids) => ({
  ...context(ids),
  stepUpVerified: true,
  stepUpAt: new Date(Date.now() - 60_000).toISOString(),
});

export const nextKey = (label) => `s12govrace-${label}-${randomUUID()}`;

export const submitRequest = (ids, subjectId, subjectHash, label) => ({
  subjectKind: 'template_version',
  subjectId,
  subjectHash,
  idempotencyKey: nextKey(label),
  context: context(ids),
});

export const commandScript = (ids, request) =>
  `begin; ${actorSettings(ids)} set local role service_role;
   select 'transport-role:' || current_user;
   select platform_api.cms_submit_governed_review(${jsonb(request)}); commit;`;

const fixtureCommand = (ids, functionName, request) =>
  queryScript(
    `begin; ${actorSettings(ids)} set local role service_role;
     select platform_api.${functionName}(${jsonb(request)}); commit;`,
    's12govrace-fixture-command',
  );

/**
 * Real Slice 09 owner/type chain: draft -> dry-run -> seal -> submit -> assign -> decide ->
 * activate. No direct active-type/pattern fixture and no disabled guard. The shared actor
 * fixture also provisions unrelated negative-control identities; those are not race subjects.
 * CMS-03A-15 grants the designer capability; CMS-03C-01 mints both ordinary draft subjects.
 */
export const buildGovernedFixture = async () => {
  const ids = await buildSourceFixture();
  const validThrough = await queryValue(
    'select (platform_private.cms_grant_today() + 1)::text;',
  );
  await fixtureCommand(ids, 'cms_grant_capability', {
    subjectPersonId: ids.person,
    capability: 'cms.template_designer',
    validThrough,
    idempotencyKey: nextKey('designer'),
    context: stepUpContext(ids),
  });
  for (const label of ['subject1', 'subject2']) {
    const resource = await fixtureCommand(ids, 'cms_define_template', {
      templateKey: `s12govrace-${label}`,
      compatibleTypeIds: [ids.typeId],
      slots: [],
      reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
      bindings: {},
      locale: 'en-US',
      audience: 'public',
      expectedVersion: null,
      idempotencyKey: nextKey(label),
      context: context(ids),
    });
    ids[label] = resource.id;
    ids[`${label}Hash`] = resource.contentHash;
  }
  return ids;
};

/** Exact projection-row revocation seam, run as an administrative fixture transaction. */
export const grantRevokeScript = (ids, active) =>
  `begin; select set_config('app.cms_rpc', 'true', true);
   update identity_private.organization_actor_grant
      set active = ${active}, updated_at = clock_timestamp()
    where organization_id = ${sql(ids.org)}::uuid
      and person_id = ${sql(ids.person)}::uuid
      and capability_code = 'cms.template_designer'; commit;`;

export const grantActive = async (ids) =>
  (await queryValue(
    `select active from identity_private.organization_actor_grant
      where organization_id = ${sql(ids.org)}::uuid
        and person_id = ${sql(ids.person)}::uuid
        and capability_code = 'cms.template_designer';`,
  )) === 't';
