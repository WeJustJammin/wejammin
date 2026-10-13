/**
 * Slice 11 principals for the real-route workflow suites, layered on the Slice
 * 10 world (same owner, same content type): every person is made through
 * `identity_create`, the confirmed membership and the capability grants are the
 * production rows the invitation and grant flows write (as the Slice 10 world
 * does), and no entry, review, decision, schedule or publication is seeded: the
 * specs make them through the browser or the first-party routes.
 */
import { randomUUID } from 'node:crypto';

import {
  createAuthUser,
  createPerson,
  psql,
} from '../../postgrest/support/stack';
import { s10Session, type S10Principal, type S10World } from './s10-real-world';
import { S10_CAPABILITIES_CLAIM, S10_PARTY_CLAIM } from './s10-session-claims';
import { S11_PERSON_CLAIM, S11_STEP_UP_CLAIM } from './s11-session-claims';

/** The default life of a test grant, in days; a spec that needs more passes `grantDays`. */
export const S11_GRANT_DAYS = 30;

const grant = (
  world: S10World,
  person: S10Principal,
  capabilities: readonly string[],
  grantDays: number,
): void => {
  if (!Number.isInteger(grantDays) || grantDays < 1)
    throw new RangeError('grantDays must be a positive whole number of days');
  psql(`
    insert into identity_private.organization_actor_grant(
      organization_id, person_id, capability_code, valid_from, valid_through, active)
    select '${world.owner.organizationId}', '${person.personId}', capability,
           current_date, current_date + ${grantDays}, true
      from (values ${capabilities.map((capability) => `('${capability}')`).join(', ')}) as capabilities(capability)
    on conflict (organization_id, person_id, capability_code)
    do update set active = true, valid_through = excluded.valid_through`);
};

/**
 * A confirmed member of the owning organization holding `capabilities` for
 * `grantDays` days from today. A schedule is refused when the publisher's grant
 * ends before the day it takes effect (`authority_ends_before_schedule`), so a
 * spec that schedules months ahead provisions its publisher for longer.
 */
export const provisionMember = (
  world: S10World,
  label: string,
  capabilities: readonly string[],
  grantDays: number = S11_GRANT_DAYS,
): S10Principal => {
  const authUserId = createAuthUser(randomUUID());
  const person: S10Principal = {
    authUserId,
    personId: createPerson(authUserId),
    label,
  };
  psql(`
    insert into identity_private.membership_tenure(
      id, organization_id, person_id, state, provenance, governance_mode,
      starts_on, accepted_at, actor_id, version)
    values (gen_random_uuid(), '${world.owner.organizationId}', '${person.personId}',
            'confirmed', 'invitation', 'ungoverned', current_date,
            clock_timestamp(), '${world.owner.personId}', 1)`);
  grant(world, person, capabilities, grantDays);
  return person;
};

/** The receipt owner, who also holds the editor grant a reviewer assignment needs. */
export const ownerPrincipal = (world: S10World): S10Principal => {
  const owner: S10Principal = {
    authUserId: world.owner.authUserId,
    personId: world.owner.personId,
    label: 'owner',
  };
  grant(world, owner, ['cms.editor'], S11_GRANT_DAYS);
  return owner;
};

/**
 * Options for `authenticateLocalSession`. `stepUpAt` is the instant the MFA
 * ceremony completed (the authentication projection's `stepUpAt`); omitted, the
 * session has none and every step-up command is refused 401 STEP_UP_REQUIRED.
 */
export const s11Session = (
  world: S10World,
  principal: S10Principal,
  capabilities: readonly string[],
  stepUpAt: Date | null,
  sessionNumber = 1,
): ReturnType<typeof s10Session> => {
  const base = s10Session(world, principal, sessionNumber);
  return {
    ...base,
    claims: {
      [S10_PARTY_CLAIM]: world.owner.organizationId,
      [S10_CAPABILITIES_CLAIM]: capabilities,
      [S11_PERSON_CLAIM]: principal.personId,
      ...(stepUpAt === null
        ? {}
        : { [S11_STEP_UP_CLAIM]: stepUpAt.toISOString() }),
    },
  };
};
