import {
  footerOffsetAt,
  footerTransitions,
  parseFooter,
  type FooterTransition,
  type ParsedFooter,
} from './posix-footer.ts';
import type { TzdbSnapshot } from './tzdb-snapshot.ts';

/*
 * One zone of the pinned snapshot, compiled for lookups: the UT offset at a UTC
 * instant, the offset changes inside a window, and the set of UTC instants whose
 * wall-clock time equals a given local time (zero for a gap, two for a fold).
 */

export type CompiledZone = Readonly<{
  initialOffset: number;
  /** Absolute UTC seconds of each explicit transition, ascending. */
  times: readonly number[];
  /** The UT offset in effect from each explicit transition on. */
  offsets: readonly number[];
  /** The footer that governs the instants from the last transition on; null when absent. */
  footer: ParsedFooter | null;
}>;

export const compileZone = (
  zone: TzdbSnapshot['zones'][number],
): CompiledZone => {
  const [distinct, initial, deltas, indexes, footerText] = zone;
  const times: number[] = [];
  let running = 0;
  for (const delta of deltas) {
    running += delta;
    times.push(running);
  }
  return {
    initialOffset: distinct[initial] ?? 0,
    times,
    offsets: indexes.map((index) => distinct[index] ?? 0),
    footer: footerText === '' ? null : parseFooter(footerText),
  };
};

/** The greatest index with `times[index] <= instant`, or -1. */
const lastAtOrBefore = (times: readonly number[], instant: number): number => {
  let low = 0;
  let high = times.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if ((times[middle] ?? 0) <= instant) {
      found = middle;
      low = middle + 1;
    } else high = middle - 1;
  }
  return found;
};

/** The UT offset in effect at a UTC instant. */
export const zoneOffsetAt = (zone: CompiledZone, instant: number): number => {
  const lastTime = zone.times[zone.times.length - 1];
  if (zone.footer !== null && (lastTime === undefined || instant >= lastTime))
    return footerOffsetAt(zone.footer, instant);
  const index = lastAtOrBefore(zone.times, instant);
  return index < 0
    ? zone.initialOffset
    : (zone.offsets[index] ?? zone.initialOffset);
};

/** Offset changes at instants in `(low, high]`, explicit transitions then footer rules. */
export const zoneTransitions = (
  zone: CompiledZone,
  low: number,
  high: number,
): readonly FooterTransition[] => {
  const found: FooterTransition[] = [];
  for (const [index, at] of zone.times.entries())
    if (at > low && at <= high)
      found.push({
        at,
        before:
          index === 0
            ? zone.initialOffset
            : (zone.offsets[index - 1] ?? zone.initialOffset),
        after: zone.offsets[index] ?? zone.initialOffset,
      });
  if (zone.footer !== null) {
    const lastTime = zone.times[zone.times.length - 1];
    for (const transition of footerTransitions(zone.footer, low, high))
      if (lastTime === undefined || transition.at > lastTime)
        found.push(transition);
  }
  return found.sort((left, right) => left.at - right.at);
};

export type ResolvedInstant = Readonly<{ instant: number; offset: number }>;

export type LocalResolution =
  | Readonly<{ kind: 'unique'; instant: number; offset: number }>
  | Readonly<{
      kind: 'ambiguous';
      earlier: ResolvedInstant;
      later: ResolvedInstant;
    }>
  | Readonly<{ kind: 'gap'; at: number; before: number; after: number }>;

/** Every real UT offset is within 16 hours, so candidates lie within a day of the local time. */
const WINDOW_SECONDS = 86_400;

/**
 * The set U of UTC instants whose wall-clock time in the zone equals the naive
 * local seconds (BE03b E8 step 3): |U| = 0 is a gap, 1 is unique and 2 is a fold.
 */
export const resolveLocal = (
  zone: CompiledZone,
  naiveSeconds: number,
): LocalResolution => {
  const low = naiveSeconds - WINDOW_SECONDS;
  const high = naiveSeconds + WINDOW_SECONDS;
  const transitions = zoneTransitions(zone, low, high);
  const candidateOffsets = new Set<number>([
    zoneOffsetAt(zone, low),
    ...transitions.map((transition) => transition.after),
  ]);
  const instants = [...candidateOffsets]
    .map((offset) => ({ instant: naiveSeconds - offset, offset }))
    .filter(({ instant, offset }) => zoneOffsetAt(zone, instant) === offset)
    .sort((left, right) => left.instant - right.instant);
  const first = instants[0];
  const last = instants[instants.length - 1];
  if (first !== undefined && last !== undefined)
    return instants.length === 1
      ? { kind: 'unique', instant: first.instant, offset: first.offset }
      : { kind: 'ambiguous', earlier: first, later: last };
  const gap = transitions.find(
    (transition) =>
      transition.after > transition.before &&
      naiveSeconds >= transition.at + transition.before &&
      naiveSeconds < transition.at + transition.after,
  );
  if (gap === undefined)
    throw new Error(
      'The tz snapshot has no instant and no gap for a local time.',
    );
  return { kind: 'gap', at: gap.at, before: gap.before, after: gap.after };
};
