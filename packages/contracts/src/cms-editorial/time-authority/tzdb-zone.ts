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

/** An explicit transition: the UTC second it takes effect and the UT offset from then on. */
export type ZoneTransition = Readonly<{ at: number; offset: number }>;

export type CompiledZone = Readonly<{
  initialOffset: number;
  /** Explicit transitions, ascending by `at`. */
  transitions: readonly ZoneTransition[];
  /** The footer that governs the instants from the last transition on; null when absent. */
  footer: ParsedFooter | null;
}>;

/** Compiles one snapshot zone, refusing a zone whose offset indexes do not line up. */
export const compileZone = (
  zone: TzdbSnapshot['zones'][number],
): CompiledZone => {
  const [distinct, initial, deltas, indexes, footerText] = zone;
  if (deltas.length !== indexes.length)
    throw new Error('The tz zone needs one offset index per transition delta.');
  const offsetFor = (index: number): number => {
    const offset = distinct[index];
    if (offset === undefined)
      throw new Error(
        `The tz zone offset index ${index} is outside its table of ${distinct.length} offsets.`,
      );
    return offset;
  };
  let running = 0;
  return {
    initialOffset: offsetFor(initial),
    transitions: deltas.map((delta, position) => {
      running += delta;
      return { at: running, offset: offsetFor(indexes[position]!) };
    }),
    footer: footerText === '' ? null : parseFooter(footerText),
  };
};

const lastTransitionAt = (zone: CompiledZone): number | undefined =>
  zone.transitions[zone.transitions.length - 1]?.at;

/** The UT offset in effect at a UTC instant. */
export const zoneOffsetAt = (zone: CompiledZone, instant: number): number => {
  const lastTime = lastTransitionAt(zone);
  if (zone.footer !== null && (lastTime === undefined || instant >= lastTime))
    return footerOffsetAt(zone.footer, instant);
  return zone.transitions.reduce(
    (offset, transition) =>
      transition.at <= instant ? transition.offset : offset,
    zone.initialOffset,
  );
};

/** Offset changes at instants in `(low, high]`, explicit transitions then footer rules. */
export const zoneTransitions = (
  zone: CompiledZone,
  low: number,
  high: number,
): readonly FooterTransition[] => {
  const found: FooterTransition[] = [];
  let before = zone.initialOffset;
  for (const { at, offset } of zone.transitions) {
    if (at > low && at <= high) found.push({ at, before, after: offset });
    before = offset;
  }
  if (zone.footer !== null) {
    const lastTime = lastTransitionAt(zone);
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
