import { isCmsUuid, isCmsVersion } from '@wejammin/contracts/client';

import type { SelectorPage, UpdateDiff } from './composition-types';

/*
 * Structural guards for answers the first-party proxy has already verified against the strict contracts. They exist
 * because the island carries no zod (FE03 AC261): a body that is not the expected shape is treated as a failed read,
 * never rendered from a guess.
 */
type Json = Readonly<Record<string, unknown>>;
const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isText = (value: unknown): value is string => typeof value === 'string';

const isSelectorItem = (value: unknown): boolean =>
  isRecord(value) &&
  isText(value.patternId) &&
  isText(value.patternVersionId) &&
  isText(value.patternKey) &&
  isInt(value.patternVersion) &&
  isInt(value.nodeCount) &&
  isText(value.blockRegistryDigest);

export const isSelectorPage = (value: unknown): value is SelectorPage =>
  isRecord(value) &&
  Array.isArray(value.items) &&
  value.items.every(isSelectorItem) &&
  (value.nextCursor === null || isText(value.nextCursor));

const isDiffPath = (value: unknown): boolean =>
  isRecord(value) &&
  isText(value.path) &&
  typeof value.collision === 'boolean' &&
  (value.collisionKind === null ||
    value.collisionKind === 'props' ||
    value.collisionKind === 'structure' ||
    value.collisionKind === 'removed_root') &&
  'base' in value &&
  'theirs' in value &&
  'yours' in value;

const isNewRoot = (value: unknown): boolean =>
  isRecord(value) &&
  isText(value.rootPath) &&
  isText(value.blockKey) &&
  isInt(value.blockVersion);

/** The diff of exactly the instance that was asked for. */
export const isDiffOf = (
  value: unknown,
  instanceId: string,
): value is UpdateDiff => {
  if (!isRecord(value) || !isRecord(value.instance)) return false;
  const instance = value.instance;
  return (
    isText(instance.id) &&
    instance.id.toLowerCase() === instanceId.toLowerCase() &&
    isText(instance.version) &&
    isCmsVersion(instance.version) &&
    isText(instance.revisionId) &&
    isInt(instance.pinnedPatternVersion) &&
    isText(value.slotPath) &&
    isInt(value.targetPatternVersion) &&
    Array.isArray(value.paths) &&
    value.paths.every(isDiffPath) &&
    Array.isArray(value.newRoots) &&
    value.newRoots.every(isNewRoot) &&
    isInt(value.collisionCount) &&
    typeof value.bulkEligible === 'boolean'
  );
};

export interface EntryFacts {
  readonly version: string;
  readonly revisionId: string;
  readonly editable: boolean;
}

/** CMS-03B-11 draft detail of exactly this entry: its version, its draft revision and whether it is editable. */
export const entryFactsOf = (
  value: unknown,
  entryId: string,
): EntryFacts | null => {
  if (!isRecord(value) || !isRecord(value.entry) || !isRecord(value.revision))
    return null;
  const { entry, revision } = value;
  if (
    entry.id !== entryId ||
    !isText(entry.version) ||
    !isCmsVersion(entry.version) ||
    !isText(revision.id) ||
    !isCmsUuid(revision.id)
  )
    return null;
  return {
    version: entry.version,
    revisionId: revision.id,
    editable: value.state === 'draft' && value.lifecycle === 'active',
  };
};
