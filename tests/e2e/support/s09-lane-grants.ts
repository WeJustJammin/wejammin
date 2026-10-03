import type { ContentSchemaRegistryPorts } from '../../../apps/worker/src/content-schema-registry/types';

import { fixtureHash } from './s09-lane-hash';
import { lanePersonRole } from './s09-lane-ids';
import {
  conflict,
  forbidden,
  invalid,
  notFound,
  ok,
  unavailable,
  versionMismatch,
} from './s09-lane-result';
import { bodyOf, laneContext } from './s09-lane-support';
import { ID_KIND, iso, nextId, type GrantRecord } from './s09-lane-world';

const DAY_MS = 86_400_000;
const MAX_TERM_DAYS = 89;

const utcDate = (ms: number): string => iso(ms).slice(0, 10);
const startOfUtcDay = (ms: number): number =>
  Date.parse(`${utcDate(ms)}T00:00:00.000Z`);

const termError = (validThrough: string): string | null => {
  const through = Date.parse(`${validThrough}T00:00:00.000Z`);
  const today = startOfUtcDay(Date.now());
  if (through < today) return 'valid_through_in_the_past';
  if (through > today + MAX_TERM_DAYS * DAY_MS)
    return 'valid_through_beyond_89_days';
  return null;
};

export const grantResource = (grant: GrantRecord) => ({
  id: grant.id,
  version: String(grant.version),
  contentHash: fixtureHash(`${grant.id}:${String(grant.version)}`),
  createdAt: grant.createdAt,
  updatedAt: grant.updatedAt,
  resourceKind: 'cms_capability_grant' as const,
  state: grant.state,
  subjectPersonId: grant.subjectPersonId,
  capability: grant.capability,
  validFrom: grant.validFrom,
  validThrough: grant.validThrough,
  endsAt: iso(Date.parse(`${grant.validThrough}T00:00:00.000Z`) + DAY_MS),
  lastAction: grant.lastAction,
  reason: grant.reason,
});

const ownerOnly = (role: string) =>
  role === 'owner' ? null : forbidden('OWNER_REQUIRED');

const grantCapability: ContentSchemaRegistryPorts['grantCapability'] = async (
  input,
) => {
  const lane = laneContext(input);
  if (lane === null) return unavailable();
  const { world, claim } = lane;
  const refusal = ownerOnly(claim.role);
  if (refusal !== null) return refusal;
  const body = bodyOf(input);
  if (lanePersonRole(String(body.subjectPersonId)) === null) return notFound();
  const problem = termError(String(body.validThrough));
  if (problem !== null) return invalid(problem);
  if (
    world.grants.some(
      (entry) =>
        entry.state === 'active' &&
        entry.subjectPersonId === body.subjectPersonId &&
        entry.capability === body.capability,
    )
  )
    return conflict('active_grant_exists');
  const now = iso(Date.now());
  const grant: GrantRecord = {
    id: nextId(world, ID_KIND.grant),
    version: 1,
    subjectPersonId: String(body.subjectPersonId),
    capability: String(body.capability),
    validFrom: utcDate(Date.now()),
    validThrough: String(body.validThrough),
    state: 'active',
    lastAction: 'granted',
    reason: typeof body.reason === 'string' ? body.reason : null,
    createdAt: now,
    updatedAt: now,
  };
  world.grants.push(grant);
  return ok(grantResource(grant)) as never;
};

const findGrant = (
  world: { grants: GrantRecord[] },
  id: string | undefined,
): GrantRecord | null => world.grants.find((entry) => entry.id === id) ?? null;

const renewCapabilityGrant: ContentSchemaRegistryPorts['renewCapabilityGrant'] =
  async (input) => {
    const lane = laneContext(input);
    if (lane === null) return unavailable();
    const refusal = ownerOnly(lane.claim.role);
    if (refusal !== null) return refusal;
    const grant = findGrant(lane.world, input.path?.grantId);
    if (grant === null) return notFound();
    const body = bodyOf(input);
    if (body.expectedVersion !== String(grant.version))
      return versionMismatch();
    if (grant.state !== 'active') return conflict('grant_not_active');
    const problem = termError(String(body.validThrough));
    if (problem !== null) return invalid(problem);
    grant.validThrough = String(body.validThrough);
    grant.lastAction = 'renewed';
    grant.reason = typeof body.reason === 'string' ? body.reason : grant.reason;
    grant.version += 1;
    grant.updatedAt = iso(Date.now());
    return ok(grantResource(grant)) as never;
  };

const revokeCapabilityGrant: ContentSchemaRegistryPorts['revokeCapabilityGrant'] =
  async (input) => {
    const lane = laneContext(input);
    if (lane === null) return unavailable();
    const refusal = ownerOnly(lane.claim.role);
    if (refusal !== null) return refusal;
    const grant = findGrant(lane.world, input.path?.grantId);
    if (grant === null) return notFound();
    const body = bodyOf(input);
    if (body.expectedVersion !== String(grant.version))
      return versionMismatch();
    if (grant.state !== 'active') return conflict('grant_not_active');
    grant.state = 'revoked';
    grant.lastAction = 'revoked';
    grant.reason = typeof body.reason === 'string' ? body.reason : grant.reason;
    grant.version += 1;
    grant.updatedAt = iso(Date.now());
    return ok(grantResource(grant)) as never;
  };

const listCapabilityGrants: ContentSchemaRegistryPorts['listCapabilityGrants'] =
  async (input) => {
    const lane = laneContext(input);
    if (lane === null) return unavailable();
    const refusal = ownerOnly(lane.claim.role);
    if (refusal !== null) return refusal;
    const query = (input.query ?? {}) as {
      capability?: string;
      state?: string;
      subjectPersonId?: string;
      limit?: number;
    };
    const items = lane.world.grants
      .filter(
        (entry) =>
          (query.capability === undefined ||
            entry.capability === query.capability) &&
          (query.state === undefined || entry.state === query.state) &&
          (query.subjectPersonId === undefined ||
            entry.subjectPersonId === query.subjectPersonId),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, query.limit ?? 25)
      .map(grantResource);
    return ok({ items, nextCursor: null }) as never;
  };

export const laneGrantPorts = {
  grantCapability,
  renewCapabilityGrant,
  revokeCapabilityGrant,
  listCapabilityGrants,
} as unknown as Partial<ContentSchemaRegistryPorts>;
