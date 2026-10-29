import {
  CompositionUpdateDiffResourceSchema,
  CompositionUpdateResourceSchema,
  PatternSelectorPageSchema,
  type CompositionUpdateDiffResource,
  type CompositionUpdateRequest,
  type CompositionUpdateResource,
  type PatternSelectorPage,
} from '@wejammin/contracts';

/**
 * A dependency answer is accepted only when it honours the request that asked for it: the strict contract and the
 * request binding below. An answer that breaks either is an invalid dependency answer (a local 502 at the route), never
 * a body shown to the caller. Row identities and pattern keys compare bytewise (the SQL `collate "C"`); every key here
 * is ASCII.
 */
const bytewise = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

/**
 * CMS-03C-13 and cmsPatternNestableRead (the same PatternSelectorPage, DEC-196): at most `limit` rows, no version row twice, the keyset order the cursor is signed over
 * (`patternKey` ascending, `patternVersion` descending), and a continuation cursor only after a full page (the SQL
 * issues one only when more rows exist beyond the page).
 */
export const validSelectorPage = (
  value: unknown,
  query: Readonly<{ limit: number }>,
): value is PatternSelectorPage => {
  const parsed = PatternSelectorPageSchema.safeParse(value);
  if (!parsed.success) return false;
  const { items, nextCursor } = parsed.data;
  if (items.length > query.limit) return false;
  if (new Set(items.map((item) => item.patternVersionId)).size !== items.length)
    return false;
  if (
    nextCursor !== null &&
    (nextCursor === '' || items.length !== query.limit)
  )
    return false;
  return items.every((item, index) => {
    const previous = items[index - 1];
    if (previous === undefined) return true;
    const order = bytewise(previous.patternKey, item.patternKey);
    return (
      order < 0 ||
      (order === 0 && previous.patternVersion > item.patternVersion)
    );
  });
};

/** CMS-03C-14: the strict resource (which also bounds the 262,144-octet body) of the instance that was asked for. */
export const validUpdateDiff = (
  value: unknown,
  instanceId: string,
): value is CompositionUpdateDiffResource => {
  const parsed = CompositionUpdateDiffResourceSchema.safeParse(value);
  return (
    parsed.success &&
    parsed.data.instance.id.toLowerCase() === instanceId.toLowerCase()
  );
};

/** DEC-193: detached/retired accept results need a choice and an earlier pin. */
const validAcceptedRow = (
  row: CompositionUpdateResource['items'][number],
  body: Extract<CompositionUpdateRequest, { action: 'accept' }>,
): boolean => {
  if (row.linkMode === 'linked' && row.state === 'active')
    return row.patternVersion === body.targetPatternVersion;
  if (
    body.instances.length !== 1 ||
    row.patternVersion === null ||
    row.patternVersion >= body.targetPatternVersion
  )
    return false;
  const requiredChoice =
    row.linkMode === 'detached' && row.state === 'active'
      ? 'yours'
      : row.linkMode === 'linked' && row.state === 'retired'
        ? 'theirs'
        : null;
  return (
    requiredChoice !== null &&
    body.instances[0]!.choices.some(({ choice }) => choice === requiredChoice)
  );
};

/**
 * CMS-03C-15: one appended row per requested instance, in request order. Every appended row is the next version of its
 * instance (the SQL appends at `version + 1`), all rows share the entry's one draft revision, and the committed entry
 * ETag is the entry version the request named plus one. An active linked accept pins the target; a resolved detached
 * or retired accept retains earlier provenance (DEC-193). A detach leaves every row detached and active.
 */
export const validUpdateResource = (
  value: unknown,
  etag: unknown,
  body: CompositionUpdateRequest,
): value is CompositionUpdateResource => {
  const parsed = CompositionUpdateResourceSchema.safeParse(value);
  if (!parsed.success) return false;
  if (etag !== `"${BigInt(body.expectedVersion) + 1n}"`) return false;
  const { items } = parsed.data;
  if (items.length !== body.instances.length) return false;
  if (
    new Set(items.map((row) => row.id)).size !== items.length ||
    new Set(items.map((row) => row.path)).size !== items.length ||
    new Set(items.map((row) => row.revisionId)).size !== 1
  )
    return false;
  return items.every((row, index) => {
    if (
      row.version !==
        String(BigInt(body.instances[index]!.expectedVersion) + 1n) ||
      row.patternId === null ||
      row.patternVersion === null
    )
      return false;
    return body.action === 'accept'
      ? validAcceptedRow(row, body)
      : row.linkMode === 'detached' && row.state === 'active';
  });
};
