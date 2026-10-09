import {
  resolveScheduleTime,
  type ScheduleTimeInput,
  type ScheduleTimeResolution,
} from './schedule-time.ts';
import { CMS_TZDB_SHA256, CMS_TZDB_VERSION } from './tzdb-pin.ts';
import { CMS_TZDB_SNAPSHOT_JSON } from './tzdb-snapshot-data.ts';
import { parseSnapshot, sha256Hex } from './tzdb-snapshot.ts';
import { compileZone, zoneOffsetAt, type CompiledZone } from './tzdb-zone.ts';

/*
 * The pinned Time authority: the snapshot is verified against `CMS_TZDB_SHA256`
 * before a single zone is read, so a corrupted or swapped asset can never answer
 * a schedule command (the Worker answers 503 `DEPENDENCY_UNAVAILABLE` instead).
 */

export class TzdbIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TzdbIntegrityError';
  }
}

export type TimeAuthority = Readonly<{
  release: string;
  sha256: string;
  hasZone: (name: string) => boolean;
  zoneNames: () => readonly string[];
  /** The UT offset (seconds) of a zone at a UTC instant, or null for an unknown zone. */
  offsetAt: (name: string, unixSeconds: number) => number | null;
  resolveSchedule: (
    input: ScheduleTimeInput,
    nowMs: number,
  ) => ScheduleTimeResolution;
}>;

/**
 * Verifies `snapshotText` against `expectedSha256` and the pinned release, then
 * builds a time authority over it. Rejects with `TzdbIntegrityError` on a hash or
 * release mismatch and with an Error on a malformed snapshot.
 */
export const createTimeAuthority = async (
  snapshotText: string,
  expectedSha256: string,
  pinnedVersion: string = CMS_TZDB_VERSION,
): Promise<TimeAuthority> => {
  const actual = await sha256Hex(snapshotText);
  if (actual !== expectedSha256)
    throw new TzdbIntegrityError(
      'The tz snapshot hash differs from the pinned CMS_TZDB_SHA256.',
    );
  const snapshot = parseSnapshot(snapshotText);
  if (snapshot.release !== pinnedVersion)
    throw new TzdbIntegrityError(
      'The tz snapshot release differs from the pinned CMS_TZDB_VERSION.',
    );
  const compiled = new Map<number, CompiledZone>();
  const zoneOf = (name: string): CompiledZone | undefined => {
    if (!Object.hasOwn(snapshot.names, name)) return undefined;
    const index = snapshot.names[name];
    const raw = index === undefined ? undefined : snapshot.zones[index];
    if (index === undefined || raw === undefined) return undefined;
    let zone = compiled.get(index);
    if (zone === undefined) {
      zone = compileZone(raw);
      compiled.set(index, zone);
    }
    return zone;
  };
  return {
    release: snapshot.release,
    sha256: actual,
    hasZone: (name) => Object.hasOwn(snapshot.names, name),
    zoneNames: () => Object.keys(snapshot.names),
    offsetAt: (name, unixSeconds) => {
      const zone = zoneOf(name);
      return zone === undefined ? null : zoneOffsetAt(zone, unixSeconds);
    },
    resolveSchedule: (input, nowMs) =>
      resolveScheduleTime(zoneOf, pinnedVersion, input, nowMs),
  };
};

let pinned: Promise<TimeAuthority> | undefined;

/** The authority over the committed pinned snapshot, verified once per module instance. */
export const loadPinnedTimeAuthority = (): Promise<TimeAuthority> => {
  pinned ??= createTimeAuthority(CMS_TZDB_SNAPSHOT_JSON, CMS_TZDB_SHA256);
  return pinned;
};
