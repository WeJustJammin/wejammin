/*
 * The pin and exclusion lists of the related-content form as pure operations (FE03 :890: pins are an
 * ordered list of at most 32 with explicit move controls and no drag-only path; exclusions are at most
 * 64; "exclusions win"). The wire contract refuses a pin that is also an exclusion
 * (`pin_exclusion_overlap`) and compares ids case-insensitively (BE03c 1417), so these operations
 * never let the overlap exist: choosing Exclude on a pinned entry removes its pin.
 */
export const MAX_PINS = 32;
export const MAX_EXCLUSIONS = 64;

export interface RelatedLists {
  readonly pins: readonly string[];
  readonly exclusions: readonly string[];
}

export type ListRefusal =
  | 'already_pinned'
  | 'already_excluded'
  | 'excluded'
  | 'pin_limit'
  | 'exclusion_limit';

export type ListChange =
  | {
      readonly ok: true;
      readonly lists: RelatedLists;
      /** True when adding the exclusion removed an existing pin of the same entry. */
      readonly displacedPin: boolean;
    }
  | { readonly ok: false; readonly reason: ListRefusal };

const same = (a: string, b: string): boolean =>
  a.toLowerCase() === b.toLowerCase();
const has = (ids: readonly string[], id: string): boolean =>
  ids.some((entry) => same(entry, id));

export const addPin = (lists: RelatedLists, id: string): ListChange => {
  if (has(lists.pins, id)) return { ok: false, reason: 'already_pinned' };
  if (has(lists.exclusions, id)) return { ok: false, reason: 'excluded' };
  if (lists.pins.length >= MAX_PINS) return { ok: false, reason: 'pin_limit' };
  return {
    ok: true,
    lists: { ...lists, pins: [...lists.pins, id] },
    displacedPin: false,
  };
};

export const addExclusion = (lists: RelatedLists, id: string): ListChange => {
  if (has(lists.exclusions, id))
    return { ok: false, reason: 'already_excluded' };
  if (lists.exclusions.length >= MAX_EXCLUSIONS)
    return { ok: false, reason: 'exclusion_limit' };
  return {
    ok: true,
    lists: {
      pins: lists.pins.filter((entry) => !same(entry, id)),
      exclusions: [...lists.exclusions, id],
    },
    displacedPin: has(lists.pins, id),
  };
};

export const removePin = (lists: RelatedLists, id: string): RelatedLists => ({
  ...lists,
  pins: lists.pins.filter((entry) => !same(entry, id)),
});

export const removeExclusion = (
  lists: RelatedLists,
  id: string,
): RelatedLists => ({
  ...lists,
  exclusions: lists.exclusions.filter((entry) => !same(entry, id)),
});

/** Move the pin at `index` one place; the same object comes back when the move is not possible. */
export const movePin = (
  lists: RelatedLists,
  index: number,
  delta: -1 | 1,
): RelatedLists => {
  const target = index + delta;
  if (
    index < 0 ||
    index >= lists.pins.length ||
    target < 0 ||
    target >= lists.pins.length
  )
    return lists;
  const pins = [...lists.pins];
  const [moved] = pins.splice(index, 1);
  pins.splice(target, 0, moved as string);
  return { ...lists, pins };
};
