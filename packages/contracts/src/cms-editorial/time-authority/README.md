# CMS Time authority (BE03b E8)

Schedule times are resolved over **one pinned snapshot of the IANA tz database**.
The Worker and the schedule form run the same code over the same bytes, and the
Worker's answer is authoritative. Neither PostgreSQL nor the Workers `Intl` API
exposes a tz release (and `Intl` uses a host-dependent tzdata), so neither is
used for the schedule rules.

## Contents

| File                    | Owns                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `tzdb-pin.ts`           | `CMS_TZDB_VERSION` (`2026e`), `CMS_TZDB_SHA256` and `CMS_TZDB_SOURCE` (the two IANA tarballs, pinned by digest)         |
| `tzdb-snapshot-data.ts` | GENERATED. `CMS_TZDB_SNAPSHOT_JSON`: the exact snapshot text whose SHA-256 is `CMS_TZDB_SHA256`. Never edit by hand     |
| `tzdb-snapshot.ts`      | The `cms.tzdb.v1` shape, `parseSnapshot` and `sha256Hex`                                                                |
| `tzdb-zone.ts`          | A compiled zone: offset at an instant, offset changes in a window, and the set of instants for a local time             |
| `posix-footer.ts`       | The POSIX TZ footer (fixed offsets and `Mm.w.d[/time]` rules) that governs the instants after a zone's last transition  |
| `local-datetime.ts`     | Calendar arithmetic, local datetime and ISO instant parsing and formatting                                              |
| `schedule-time.ts`      | `resolveScheduleTime` (E8 steps 1-8), the horizon constants and the RPC offset sanity bound                             |
| `time-authority.ts`     | `createTimeAuthority` and `loadPinnedTimeAuthority`: hash verification at load and the resolver over the verified zones |
| `index.ts`              | The `@wejammin/contracts/time-authority` subpath export                                                                 |

## Import rules

The light pin (`tzdb-pin.ts`) and `resolveScheduleTime` are exported from
`@wejammin/contracts`. The 218 KB snapshot, `createTimeAuthority`,
`loadPinnedTimeAuthority` and `TzdbIntegrityError` are exported **only** from
`@wejammin/contracts/time-authority`, so the schedule form can lazy-load them
(about 26 KB gzip, against the 80 KB lazy-chunk budget) and no other bundle pays
for them. The Worker verifies the hash at module load: when
`createTimeAuthority` rejects with `TzdbIntegrityError`, every schedule command
answers 503 `DEPENDENCY_UNAVAILABLE`.

## Advancing the pin

Advancing the pin is code plus a forward migration. A stored schedule keeps the tag
and the instant it was accepted with, so a later pin never alters an existing
instant.

1. Name the new release in `tzdb-pin.ts` (`CMS_TZDB_VERSION`, `CMS_TZDB_SOURCE`
   URLs and the two tarball SHA-256 digests).
2. Run `node infra/generate-tzdb-snapshot.mjs --download`, paste the printed
   `CMS_TZDB_SHA256` into `tzdb-pin.ts` and commit the regenerated
   `tzdb-snapshot-data.ts`.
3. Run `node infra/generate-tzdb-snapshot.mjs --download --check` (drift guard),
   then the tests in this directory and `tests/contracts/phase-02-slice-11-tzdb-pin.test.ts`.
4. Ship a forward migration so `platform_private.cms_tzdb_version()` returns the same
   tag, and record the pin in the decisions log.

The differential test compares the snapshot with the host ICU for 39 zones from
2000 to 2040. When a new release changes a zone the host does not know yet, bound
that zone in `COMPARE_UNTIL` and pin the new behavior with golden values in
`tzdb-zone.test.ts` (Africa/Casablanca is the 2026e example).

## Related links

- [BE03b Time authority (E8)](../../../../../.memory/wiki/specs/be/03b-editorial-workflow-publication.md)
- [Schedule contracts](../publication-schedule-contracts.ts)
- [Platform runbook](../../../../../docs/runbooks/platform/cms-publication.md)
