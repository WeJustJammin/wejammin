import { choicesFor, isComplete } from './composition-choices';
import { chunk, MAX_INSTANCES_PER_REQUEST } from './composition-rows';
import type { ChoiceMap, UpdateDiff } from './composition-types';

/*
 * CMS-03C-15 `CompositionUpdateRequest` construction (FE03 887, 1115, 1843; BE03c 179; DEC-181, DEC-193). The entry
 * `version` is the body `expectedVersion` and the strong `If-Match`; each instance carries its own `version` as the CAS
 * operand. `choices` exist only on a single-instance accept and cover every collision; a bulk accept is admitted only
 * when no listed instance collides; one request carries at most 32 instances.
 */
export interface UpdateTarget {
  readonly instanceId: string;
  readonly expectedVersion: string;
  readonly choices: ReadonlyArray<{ path: string; choice: 'yours' | 'theirs' }>;
}

export type UpdateBody =
  | {
      readonly action: 'accept';
      readonly targetPatternVersion: number;
      readonly instances: readonly UpdateTarget[];
      readonly expectedVersion: string;
    }
  | {
      readonly action: 'detach';
      readonly instances: readonly UpdateTarget[];
      readonly expectedVersion: string;
    };

const hasNewerVersion = (diff: UpdateDiff): boolean =>
  diff.targetPatternVersion > diff.instance.pinnedPatternVersion;

/** The single-instance accept, or null while a collision is unanswered or there is nothing newer to accept. */
export const acceptRequest = (
  diff: UpdateDiff,
  choices: ChoiceMap,
  entryVersion: string,
): Extract<UpdateBody, { action: 'accept' }> | null =>
  hasNewerVersion(diff) && isComplete(diff, choices)
    ? {
        action: 'accept',
        targetPatternVersion: diff.targetPatternVersion,
        instances: [
          {
            instanceId: diff.instance.id,
            expectedVersion: diff.instance.version,
            choices: choicesFor(diff, choices),
          },
        ],
        expectedVersion: entryVersion,
      }
    : null;

/** One planned bulk request; the entry `version` is applied when it is sent (refetched between requests). */
export interface BulkAcceptRequest {
  readonly targetPatternVersion: number;
  readonly instances: ReadonlyArray<{
    instanceId: string;
    expectedVersion: string;
  }>;
}

export type BulkAcceptPlan =
  | { readonly ok: true; readonly requests: readonly BulkAcceptRequest[] }
  | { readonly ok: false; readonly reason: 'collision' | 'not_newer' };

/** Instances group by target version in selection order, then split into requests of at most 32. */
export const planBulkAccept = (
  diffs: readonly UpdateDiff[],
): BulkAcceptPlan => {
  if (diffs.some((diff) => !hasNewerVersion(diff)))
    return { ok: false, reason: 'not_newer' };
  if (diffs.some((diff) => !diff.bulkEligible))
    return { ok: false, reason: 'collision' };
  const groups = new Map<number, UpdateDiff[]>();
  for (const diff of diffs)
    groups.set(diff.targetPatternVersion, [
      ...(groups.get(diff.targetPatternVersion) ?? []),
      diff,
    ]);
  return {
    ok: true,
    requests: [...groups].flatMap(([targetPatternVersion, members]) =>
      chunk(members, MAX_INSTANCES_PER_REQUEST).map((part) => ({
        targetPatternVersion,
        instances: part.map((diff) => ({
          instanceId: diff.instance.id,
          expectedVersion: diff.instance.version,
        })),
      })),
    ),
  };
};

export const bulkAcceptBody = (
  request: BulkAcceptRequest,
  entryVersion: string,
): Extract<UpdateBody, { action: 'accept' }> => ({
  action: 'accept',
  targetPatternVersion: request.targetPatternVersion,
  instances: request.instances.map((target) => ({ ...target, choices: [] })),
  expectedVersion: entryVersion,
});

export interface DetachTarget {
  readonly instanceId: string;
  readonly expectedVersion: string;
}

/** Detach takes no choices; more than 32 instances become successive requests. */
export const detachRequests = (
  targets: readonly DetachTarget[],
  entryVersion: string,
): Array<Extract<UpdateBody, { action: 'detach' }>> =>
  chunk(targets, MAX_INSTANCES_PER_REQUEST).map((part) => ({
    action: 'detach',
    instances: part.map((target) => ({ ...target, choices: [] })),
    expectedVersion: entryVersion,
  }));
