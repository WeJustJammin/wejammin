import type { ContentSchemaRegistryPortInput } from '../../../apps/worker/src/content-schema-registry/types';

import { laneClaimOf, worldOfClaim, type LaneClaim } from './s09-lane-auth';
import { iso, type VersionRecord, type World } from './s09-lane-world';

type Body = Record<string, unknown>;

export const laneContext = (
  input: ContentSchemaRegistryPortInput,
): { claim: LaneClaim; world: World } | null => {
  const claim = laneClaimOf(input.request);
  return claim === null ? null : { claim, world: worldOfClaim(claim) };
};

export const bodyOf = (input: ContentSchemaRegistryPortInput): Body =>
  (input.body ?? {}) as unknown as Body;

export const versionFor = (
  world: World,
  input: ContentSchemaRegistryPortInput,
): VersionRecord | null =>
  world.versions.find(
    (entry) =>
      entry.id === input.path?.versionId &&
      entry.typeId === input.path?.contentTypeId,
  ) ?? null;

export const touch = (version: VersionRecord): void => {
  version.rev += 1;
  version.updatedAt = iso(Date.now());
};
