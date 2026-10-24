# Locale observability pgTAP fragments (DEC-208, DEC-213)

Driver: `../phase_02_slice_12_locale_observability.sql`. World: the CMS-03C-20 resolver suite world
(`../phase_02_slice_12_locale_resolution/001-world.sqlinc`) on the Slice 10 RPC fixtures.

- `000-helpers.sqlinc` - the transport probe `l208_read`, role probe, principal switch, the write-evidence counter.
- `001-shape-and-grants.sqlinc` - definer ownership, `search_path=""` only (no function-level `statement_timeout`), VOLATILE reader that sets the RPC context, flag-restoring wrapper, `service_role`-only
  transport, no write and no lock in the body, the two indexes.
- `002-refusals.sqlinc` - `VALIDATION_FAILED` (P0001 + DETAIL json) unless both bounds are whole minutes and the span is 60 s.
- `003-window.sqlinc` - builds the fan-out fixture, pins instants, closed-start/open-end window counts, drafts and legacy rows.
- `004-rpc-context.sqlinc` - the real caller path: `service_role` with the RPC flag cleared returns the real counts and restores the caller's flag (V3 F-1/F-2).
- `005-gauge.sqlinc` - the stale no_fallback gauge on the CURRENT row only, window independence, supersession by a newer draft.
- `006-cases.sqlinc` - retired definition, non-active type version, a second entry with two stale no_fallback fields on one variant, an unpinned real fan-out row, and the DEC-216 `lifecycle = 'active'` scope.
- `007-volume.sqlinc` - DEC-219: 200 superseded stale versions change nothing, and the gauge function reads no `INDEX(state, created_at)` entry, no sequential scan and a handful of current-row index entries (transaction-local scan counters).
- `008-closing.sqlinc` - case-insensitive supersession (FK-consistent forged `de-de` revision and row), exact three keys, no-write proof.

Add a case by appending to the fragment that owns its concern; keep each fragment under 400 lines. Run through the
staged ALT runner with the lane list in `docs/handoffs/2026-10-22-claude-s12/LANES.md` plus `dec208`.
