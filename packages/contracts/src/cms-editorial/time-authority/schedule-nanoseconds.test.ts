/** Pure pinned resolver; integer nowMs only, no global clock or database imports. */
import { describe, expect, it } from 'vitest';
import { resolveScheduleTime } from './schedule-time';
import { CMS_TZDB_VERSION } from './tzdb-pin';
import { CMS_TZDB_SNAPSHOT_JSON } from './tzdb-snapshot-data';
import { parseSnapshot } from './tzdb-snapshot';
import { compileZone, type CompiledZone } from './tzdb-zone';

const snapshot = parseSnapshot(CMS_TZDB_SNAPSHOT_JSON);
const lookup = (name: string): CompiledZone | undefined => {
  const index = snapshot.names[name];
  const raw = index === undefined ? undefined : snapshot.zones[index];
  return raw === undefined ? undefined : compileZone(raw);
};
// Date supplies the integer clock fixture, never a fractional-instant oracle.
const NOW_MS = Date.parse('2026-10-08T12:00:00Z') + 250;
const NOW_SECOND = Math.floor(NOW_MS / 1_000);
const resolve = (localDateTime: string, resolvedUtc = `${localDateTime}Z`) =>
  resolveScheduleTime(
    lookup,
    CMS_TZDB_VERSION,
    {
      localDateTime,
      resolvedUtc,
      timezone: 'UTC',
      tzdbVersion: CMS_TZDB_VERSION,
      disambiguation: 'none',
    },
    NOW_MS,
  );

describe('[P2-S11-AC-105] exact nanosecond horizon with integer acceptance clock', () => {
  it.each([
    {
      label: 'minimum minus 1ns',
      local: '2026-10-08T12:01:00.249999999',
      accepted: false,
      unixSeconds: NOW_SECOND + 60,
      nanos: 249_999_999,
    },
    {
      label: 'minimum equal',
      local: '2026-10-08T12:01:00.250000000',
      accepted: true,
      unixSeconds: NOW_SECOND + 60,
      nanos: 250_000_000,
    },
    {
      label: 'minimum plus 1ns',
      local: '2026-10-08T12:01:00.250000001',
      accepted: true,
      unixSeconds: NOW_SECOND + 60,
      nanos: 250_000_001,
    },
    {
      label: 'maximum minus 1ns',
      local: '2027-10-09T12:00:00.249999999',
      accepted: true,
      unixSeconds: NOW_SECOND + 366 * 86_400,
      nanos: 249_999_999,
    },
    {
      label: 'maximum equal',
      local: '2027-10-09T12:00:00.250000000',
      accepted: true,
      unixSeconds: NOW_SECOND + 366 * 86_400,
      nanos: 250_000_000,
    },
    {
      label: 'maximum plus 1ns',
      local: '2027-10-09T12:00:00.250000001',
      accepted: false,
      unixSeconds: NOW_SECOND + 366 * 86_400,
      nanos: 250_000_001,
    },
  ])(
    '$label has exact inclusive horizon outcome and complete resolution tuple',
    (row) => {
      expect(Number.isInteger(NOW_MS)).toBe(true);
      const result = resolve(row.local);
      expect(result).toEqual(
        row.accepted
          ? {
              ok: true,
              resolvedUtc: `${row.local}Z`,
              unixSeconds: row.unixSeconds,
              nanos: row.nanos,
              offsetSeconds: 0,
              disambiguation: 'none',
            }
          : {
              ok: false,
              status: 422,
              pointer: '/resolvedUtc',
              details: {
                reasonCode: 'schedule_out_of_horizon',
                minUtc: '2026-10-08T12:01:00.250Z',
                maxUtc: '2027-10-09T12:00:00.250Z',
              },
            },
      );
    },
  );

  it('a one-nanosecond local/resolved mismatch returns only the exact mismatch refusal', () => {
    expect(
      resolve(
        '2026-10-08T12:01:00.250000001',
        '2026-10-08T12:01:00.250000000Z',
      ),
    ).toEqual({
      ok: false,
      status: 422,
      pointer: '/resolvedUtc',
      details: {
        reasonCode: 'resolved_utc_mismatch',
        expectedUtc: '2026-10-08T12:01:00.250000001Z',
      },
    });
  });
});
