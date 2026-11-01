import type {
  CompositionUpdateRequest,
  CompositionUpdateResource,
} from '@wejammin/contracts';

type AcceptRequest = Extract<CompositionUpdateRequest, { action: 'accept' }>;
type Row = CompositionUpdateResource['items'][number];

/**
 * DEC-193: a row whose update needed a choice must be backed by one. A linked active row is pinned to the target. A
 * detached active row keeps an earlier pin and exists only because the author kept `yours`; a retired linked row exists
 * only because the author took `theirs` on a removed root. Both need a single-instance request.
 */
const acceptedRowHonoursChoice = (row: Row, body: AcceptRequest): boolean => {
  if (row.linkMode === 'linked' && row.state === 'active')
    return row.patternVersion === body.targetPatternVersion;
  const only = body.instances[0];
  if (
    body.instances.length !== 1 ||
    only === undefined ||
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
    only.choices.some(({ choice }) => choice === requiredChoice)
  );
};

/**
 * A 200 answers THIS request only when it appends one row per requested instance in request order, each the next
 * version of its instance, all on the entry's one draft revision, with unique ids and paths, under the committed entry
 * ETag (the version the request named plus one). A detach leaves every row detached and active.
 */
export const answersUpdateRequest = (
  resource: CompositionUpdateResource,
  etag: string | null,
  body: CompositionUpdateRequest,
): boolean => {
  if (etag !== `"${BigInt(body.expectedVersion) + 1n}"`) return false;
  const { items } = resource;
  if (items.length !== body.instances.length) return false;
  if (
    new Set(items.map((row) => row.id)).size !== items.length ||
    new Set(items.map((row) => row.path)).size !== items.length ||
    new Set(items.map((row) => row.revisionId)).size !== 1
  )
    return false;
  return items.every((row, index) => {
    const target = body.instances[index];
    if (
      target === undefined ||
      row.version !== String(BigInt(target.expectedVersion) + 1n) ||
      row.patternId === null ||
      row.patternVersion === null
    )
      return false;
    return body.action === 'accept'
      ? acceptedRowHonoursChoice(row, body)
      : row.linkMode === 'detached' && row.state === 'active';
  });
};
