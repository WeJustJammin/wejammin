# Lane claude_s12_dec202 report

## Status
GREEN (02:37 UTC). Final: entry_default_template.sql 141/141 PASS; 27 related suites green except an unrelated r8_api_surface failure (see Requests). Race module not run (root).

## Scope
CMS-03B-10 first-revision default template (DEC-202, AC-286..AC-296).

## Findings
- Live `platform_private.cms_create_entry` = `20261005018040` body + the E7 tail appended by DO-block text
  replacement in `20261010130000`. Newest migration defining it is therefore NOT 018040; the amendment must
  be an anchored patch of the live source (like E7), not a fresh `create or replace` of the 018040 text
  (that would drop the E7 tail and break `phase_02_slice_12_entry_default_template/020-policy-fault.sqlinc`,
  which pins the tail's call order).
- Current create takes the schema FOR SHARE lock (position 4) BEFORE the value loop that locks relation
  targets (position 2): this violates BE03b row 2<3<4 and race case EDTL-A (`schema4 must remain free`).
  Fix = move the schema lock below the value loop, after the new position-3 default lock.
- Resolver: `20261002132000` `cms_resolve_template_compatibility` -> NOT_FOUND / WITHDRAWN (retired, blocked) /
  INCOMPATIBLE; superseded eligible. DEC-202 mapping equals successor gate `20261002216000` except the
  DETAIL must be exactly `["/contentTypeVersionId"]`.
- Worker/Web: no change needed. `pnpm exec vitest run` of `cms-editorial-entry-create-setup.test.tsx` +
  `apps/worker/src/cms-editorial/create-routes.test.ts`: 2 files, 22 tests PASS (02:08 UTC). Worker maps the
  generic 404/409/422 tokens already; web DEC-202 neutral copy test already passes.

## Files (final)
| path | lines | SHA-256 |
|---|---|---|
| `supabase/migrations-wip/dec202/20261022010000_cms_entry_default_template_helpers.sql` | 100 | `442cdfb9f3d366976ba24cf8140c139b489a45e93cfbaf3e9810c0c1963e9db8` |
| `supabase/migrations-wip/dec202/20261022010100_cms_create_entry_default_template.sql` | 141 | `b1d23e7d456c415a48a5682ac533bd10b1f15de338dab4a32f28fbfc54c4eec8` |
| `supabase/tests/phase_02_slice_12_entry_default_template.sql` | 301 | `068d5cb198e079424f2793b9c6fee2c0affbee0d8c90766a7192de92ef03eb2b` |
| `supabase/tests/phase_02_slice_12_entry_default_template/030-policy-gate.sqlinc` | 67 | `60315d8a5368a994aeccdd476644d8df54997afbc59fc23d817778940a51eaa1` |

## Files (notes)
- NEW test include `supabase/tests/phase_02_slice_12_entry_default_template/030-policy-gate.sqlinc` (9 tests EDG-01..09, gate/helper unit
  coverage for states no legitimate producer can create: missing, incompatible; plus retired, blocked, superseded, unexpected fault, privileges).
- EDIT `supabase/tests/phase_02_slice_12_entry_default_template.sql`: `plan(132)` -> `plan(141)`, `\ir` of the new include (addition only).
- NEW WIP: `20261022010000_cms_entry_default_template_helpers.sql`, `20261022010100_cms_create_entry_default_template.sql`.

## Runs
| # | time | lane | files | result |
|---|------|------|-------|--------|
| 1 | 02:30 UTC (stamp 020402-3032043) | dec202, 0 WIP | entry_default_template.sql, plan 140 | RED: 116 pass / 24 fail, no harness abort. TAP `.lane-logs/alt-staged-dec202-020402-3032043.tap` SHA-256 `361cb161090ad92b824a85fed00e3e507c7552ef56822bed1163e6d33e06a578`. Failures (all GENUINE MISSING FEATURE): 24,25,60,61,72,73,98,99,125,126 = first-revision pin is NULL not the default (and slot readback follows); 79-81 EDP-R03..R05 retired default created instead of CONFLICT; 110-112 EDP-B07..B09 blocked default likewise; 133-140 EDG-01..08 new helper tests, helper functions absent. Baseline had 16 failing of the original 132 (matches brief). |
| 2 | 02:32 UTC (023218-3153382) | dec202 (2 WIP) | related set | HARNESS ABORT, not feature: my zsh did not word-split the file list (`/w/ supabase/...` NOTESTS). Reset OK: both WIP migrations applied cleanly (DO-block anchors and self-verification passed). TAP SHA-256 `3e452be32bd953dae7f5f52d2fdfc360e47a48894f4816c7b63d6eb0a236f9ad` |
| 3 | 02:33 UTC (023305-3158321) | dec202 (2 WIP) | entry_default_template.sql + 27 related suites (28 files) | 1123 tests, 2 failed: ONLY `phase_02_slice_09_r8_api_surface.sql` tests 5 and 14 (`have: cms_get_related_content`; 91 vs 92 API RPCs). Cause is root's promotion of the dec195 `cms_get_related_content` migrations into supabase/migrations (promoted=461) without updating that classification test; not caused by dec202 (no platform_api function added by me). entry_default_template.sql: 140/140 PASS. TAP SHA-256 `672b0f310e35d791477f991c6b2a26fc912e111d9c29d7e54a6ccfc22970d491` |

| 4 | 02:35 UTC (023523-3170757) | dec202 (2 WIP) | entry_default_template.sql, plan 141 (added EDG-09 lock-order source check) | **141/141 PASS**, exit 0. TAP SHA-256 `b3018eb74a34755203d6217cd6c81b76df426dcbad9c6ad8f00fda0e5f9a6d03` |

## Test corrections
(none; original 132 assertions untouched, 8 added)

## Spec citations
- BE03b "Initial revision default template (CMS-03B-10, DEC-202)" (lines ~1724-1731) and "Write-path lock order" row 3 + rule 1.
- decisions.md DEC-202 (line 5353).
- AC-286..AC-296: `.memory/pipeline/progress/slices/phase-02-slice-12.md` lines 4192-4202.

## Open items / BOUNDARY
- AC-294 deterministic race proof is the race module `supabase/tests/phase_02_slice_12_entry_default_template_lock/020-race.mjs`; I may not run it (root runs race modules).
- AC-295 (append/resolve/restore/locale-carry never rebind history) needs no code change: those writers copy the recorded pin; existing suites unchanged.

## Requests to root
- Promote `supabase/migrations-wip/dec202/*` in timestamp order (010000 helpers, then 010100 create amendment; 010100 is a guarded DO-block patch of the live `cms_create_entry` that needs the E7 tail from 20261010130000 already applied).
- `phase_02_slice_09_r8_api_surface.sql` tests 5 and 14 now fail on promoted dec195 (`cms_get_related_content` unclassified; 91 vs 92): needs the classification lists updated by whoever owns that file (not my claim).
- Run `020-race.mjs` (EDTL-C00/A/B) after promotion of the dec202 migrations.
