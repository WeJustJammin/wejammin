# Independent review — lane `claude_s12_taxonomy_def_sql`, follow-up pass (DELTA review)

Reviewer: independent adversarial reviewer; did not author the lane. Static review (`sha256sum`, `grep`, Python
reconstruction of baseline bytes, TAP/manifest parsing) plus the one allowed execution: the parity contract test
(`vitest run`), `prettier --check` and `eslint` on that file. No DB runner, psql, docker, race module, `pnpm validate`
or `pnpm db:verify`. No source, test, spec or tracking file was edited; this report is the only file written.

Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, HEAD
`b16edb54a7a1b698ed8ca15b6085046d4270626e` (verified at start). Baseline: `review-taxonomy-def.md` (SHA-256
`0af85889…822da9d5`, VERDICT CLEAR) and its file-hash table. Target: author report
`lane-taxonomy-def-report.md` (SHA-256 `fe5c9403…780cca10`, section `## Follow-up pass`), brief
`briefs/taxonomy-def-f1.md`, final TAP `.lane-logs/alt-staged-taxonomy-def-063528-3101048.tap` (SHA-256
`ecd728b0…82decce`).

## Status

COMPLETE. Every change since the CLEAR baseline was identified byte-exactly where the author's description allowed
reconstruction, read in full otherwise, checked against BE03c and the frozen Worker, and traced RED→GREEN through the
run-9/run-10 manifests and TAPs. No oracle was weakened, the plan only grew (1328 → 1334, +6 / −0), and the five
remaining failures are exactly the `details.domain` assertions that depend on the governed-fix amendment. Findings are
minor or informational; none blocks promotion of `030000`–`030400`.

## 1. Claims re-verified (author report `## Follow-up pass` vs disk)

| Claim | Result |
| ----- | ------ |
| Twelve "Files after this pass" SHA-256 and line counts (169/83/237/42/134/30/92/151/161/74/51/70) | all match |
| Unchanged files (`030100`, `030300`, `000`, `010`, `020`, `030`, `040`, `080`, `populated-lineage.sql`) | hashes equal the baseline review's table |
| Run 9 TAP `786582cd…1744119`, run 10 TAP `ecd728b0…82decce`, manifest `9427f872…4048dbf0`, `promoted=373 wip=5` | all match |
| Run 9 used the OLD SQL bytes ("tests changed, SQL unchanged") | manifest `063419` lines 375–379 list `fda701e1…`, `d9e266cf…`, `e4a3feef…` (the baseline hashes of 030000/030200/030400); manifest `063528` lists the new `4981f14c…`, `1a7b88e8…`, `78002f03…`; neither stages 030500 (run 8's manifest line 380 did) |
| Run 9: plan 1..1334, 1310 pass / 24 fail; failures = F1 ×16, F3 ×3 (1329, 1331, 1334), 1061–1065 | verified from the TAP: 16 F1 lines `have FORBIDDEN want capability_missing`; 1329/1331 `have: 00000:` (hidden domain still created); 1334 producer text lacks the reader |
| Run 10: entry plan 1..1334, 1329 pass / 5 fail; witness 1..37 all pass; `Files=2, Tests=1371`, pg_prove exit 1 | verified: 1366 `ok`, 5 `not ok`, `Result: FAIL`, zero `# SKIP`/`# TODO`, no harness abort, numbering contiguous |
| Plan never shrank; no assertion deleted | all 1328 run-8 descriptions occur in run 10 as an in-order subsequence; multiset difference run8 − run10 = 0; the 6 additions are exactly the six `registry read:` assertions of `090` |
| 050: exactly six tokens changed (lines 5, 8, 49, 51, 61, 63) | reconstruction (`capability_missing` → `FORBIDDEN` on those six lines) hashes to the baseline `93c5fc39…`; no other occurrence |
| 070: exactly two tokens changed (lines 78, 118) | reconstruction hashes to the baseline `7d983d92…` |
| Entry file: one `\ir 090` added | reconstruction (minus line 27) hashes to the baseline `e7301d90…` |
| README: one row added | reconstruction (minus line 18) hashes to the baseline `fe3ebf3c…` |
| 030000: two header lines added, DDL region untouched | reconstruction (minus lines 10–11) hashes to the baseline `fda701e1…`; `populated-lineage.sql` unchanged (`fdd48ecd…`); parity test green |
| 060: `set_config` toggles removed, expected value reads the registry directly, same assertion text | reconstruction (lines 25–27 → the two baseline comment lines + `select set_config('app.cms_rpc','true',true);`, lines 31–33 → `(select jsonb_build_array(jsonb_build_object('kind','canonical_domain','refId',registry_id)) from platform_private.cms_canonical_domain_current('role')),`, plus a trailing `select set_config('app.cms_rpc','',true);`) hashes to the CLEAR baseline `dc1e044f…` exactly; so the delta is precisely those lines and nothing else |
| 030200 / 030400 deltas | baseline bytes not reconstructable from the report (header prose was rewritten, not quoted); both files read in full (237 / 134 lines) and their old/new hashes are pinned by the run-9/run-10 manifests; see sections 2–3 |
| Parity test "3/3; prettier clean" | `vitest run` under the root config (`tests/contracts/**/*.test.ts` is in `include`): 1 file, 3 tests passed; `prettier --check` clean; `eslint` exit 0 |
| All files ≤300 lines; no `TODO`; no `any` | verified (largest 237) |

## 2. The delta, clause by clause

| Change | Spec | Implemented | Tested | Ruling |
| ------ | ---- | ----------- | ------ | ------ |
| F1 create: capability refusal token `capability_missing` | BE03c:1304 "403: `capability_missing`"; 178 (403 for a readable taxonomy without capability) | `030200:85–87` (after concealment `:80–82` and the position-1 fence `:84`); no `'FORBIDDEN'` remains in the lane SQL | 050 `readable-not-curator`, `member-fresh-create`, `revoked-replay`, `revoked-fresh`, `expired-replay`, `expired-fresh` via `s12td_refusal` (SQLSTATE `P0001`, exact message, null response, 13-store snapshot gated on the exact refusal, `020:4–17`); RED in run 9, GREEN in run 10 | correct; concealment still precedes the capability check, replay still requires a live capability |
| F1 read: same token | BE03c:1304; 166 | `030400:52–54` | 070 `read-not-curator`, `read-revoked`; RED→GREEN | correct |
| F1 Worker consumption | frozen | `taxonomy-definition-response.ts:116–117` maps token `capability_missing` → 403 `{ reasonCode: 'capability_missing' }`; both operations route RPC refusals through it (`cms-composition-production-taxonomy-definition-versions.ts:95, 110`) | `taxonomy-definition-production.test.ts:170–185` drives the real mapper with a fetch stub returning the SQL wire payload `{code:'P0001', message:'capability_missing'}` and asserts 403 (not a mock returning the expected error); `taxonomy-definition-write.test.ts:128` | the race path (capability revoked between the Worker's `curatorError`, `taxonomy-definition-shared.ts:161–176`, and the RPC) now keeps the reason token; governed submit (`20261013300820:100`) and pattern-def raise the same token, so the Slice 12 family is consistent |
| F3 registry read at create | BE03c:178 middleware column "canonical domain registry read"; 1373 (closed registry), 1375 (unbuilt accepted at create) | `030200:139–148`: closed-set/shape validator first, then `cms_canonical_domain_current(declared.domain)` must return a row for every declared member, else `VALIDATION_FAILED` `["/canonicalOverlapDomains"]`; unbuilt rows still pass | `090` (six assertions; analysis in section 3); 030 `maximum` (six domains incl. five unbuilt) still accepted; 080 callee closure derives callees from `prosrc` with `(platform_api\|platform_private\|extensions)\.([a-z_0-9]+)\(` (`080:152`) so the new callee is covered automatically | correct; a plain STABLE read, no row lock, so lock order 1343 is unaffected |
| F3 table CHECK keeps the hardcoded set | DEC-135 / BE03c:1373 closed set | `030000:28–48` validator (IMMUTABLE) + CHECK `:148–150`; header `030000:10–11` and `030200:27–31` record that a seventh domain extends validator and CHECK | 080 CHECK probes (unchanged) | acceptable: a CHECK cannot read a table; the registry's own `cms_canonical_domain_registry_domain_check` (`20261013300100:27–29`) pins the identical six members, so a seventh domain already needs a forward migration on the registry; the failure mode if one copy is forgotten is fail-closed (the validator refuses the new domain). See F5-f1 for a cheap parity guard |
| F4 060 oracle | BE03c:1451 (registry has no browser/service-role read) | test-only: `060:28–34` expects `select r.id from platform_private.cms_canonical_domain_registry r where r.domain = 'role' order by r.version desc limit 1`, the reader's own definition (`20261013300100:89–93`), read by the pg_prove session (`PGUSER=postgres`, `lane-db-alt-staged.sh:78`, a superuser, which bypasses forced RLS); the two `app.cms_rpc` toggles are gone | #1067 GREEN in runs 9 and 10 | same assertion text, same expected value; non-vacuous: the actual side was non-null in run 4 (`have: [{kind: canonical_domain, refId: 6be9ffc1-…}]`) and is unchanged, so `is()` passes only because the superuser read returns that same id |
| Parity test | brief | `tests/contracts/phase-02-slice-12-taxonomy-lineage-witness-parity.test.ts` (70 lines): `toBe` on the text between `-- BEGIN/END TAXONOMY-LINEAGE-DDL`; reads the promoted migration when it exists, else the WIP one (`:21–26`) | 3/3; markers occur exactly once in each file (`030000:26,154`; `populated-lineage.sql:21,149`; the mention at `populated-lineage.sql:14` lacks the `-- BEGIN `/`-- END ` prefix) | non-vacuous (any byte difference in the region fails test 1); region 5,750 chars > the 4,000 floor; eslint/prettier clean |
| 060 #1061–1065 classified `blocked-on-governed-fix` | BE03c:1314, 1375 (`details.domain`) | not this lane's operation | TAP lines 1073–1092: each `have: NULL`, `want: <domain>`; the sibling assertions of the same calls pass (`1052–1055` SQLSTATE / exact message `canonical_source_unavailable` / no disclosure / snapshot; `1056–1060` draft intact); the same five passed in run 8 (manifest line 380 staged 030500) | the five fail only because the submit refusal carries no DETAIL in this lane's staging; not faked |

## 3. `090-registry-read.sqlinc` — non-vacuity and leak analysis

The probe (`090:7–45`) runs inside a PL/pgSQL `BEGIN … EXCEPTION` block, i.e. a subtransaction: it `CREATE OR REPLACE`s
`platform_private.cms_canonical_domain_current(text)` with a same-signature SECURITY DEFINER copy that hides one
domain, calls the private producer twice (one vocabulary declaring the hidden domain, one declaring another), records
SQLSTATE/message/DETAIL, then raises `S12TD_UNDO`, which aborts the subtransaction and so rolls back the DDL, both
creates, their reservations and audit rows; the outer handler re-raises anything that is not `S12TD_UNDO` (`:39–42`),
so a failed DDL aborts the suite loudly instead of passing. `CREATE OR REPLACE` keeps owner and ACL, and `#1333`
(`:67–71`) compares `md5(prosrc)`, owner, ACL and the registry row count before and after. The whole suite's transaction
is never committed (`phase_02_slice_12_taxonomy_definition.sql:30` `rollback;`), so no replaced function can leak past
the probe even on a harness abort. Non-vacuity is proven by run 9 (old `030200` bytes): `#1329` and `#1331` failed with
`have: 00000:` (the hidden domain was still created) and `#1334` failed; run 10 (new bytes) passes all six. The
controls `#1330`/`#1332` prove the refusal is not blanket and that a registered-but-unbuilt domain is still accepted.
Inlining cannot mask the replacement: the reader is SECURITY DEFINER, which PostgreSQL never inlines, and plan
invalidation follows the `pg_proc` change in any case.

## 4. Where 030500 went (root note)

`supabase/migrations-wip/governed-fix/` no longer holds `20261014030500_cms_submit_canonical_source_detail.sql`
(not on disk anywhere). The governed-fix lane folded it at 06:37, after the author's run 10 (06:35), as patch 2 of
`20261014040100_cms_submit_governed_review_refusals.sql` (`:3`, `:7–8`, `:31–39`): same single-anchor technique, the
same `DETAIL {"domain": <first declared domain whose provider is not built>}`, skip-if-already-applied via the
`jsonb_build_object('domain'` marker. The live body it patches iterates `subject->'canonicalDomains'`
(`20261013300820:146–151`), and `060:14–17` parses exactly `detail::jsonb->>'domain'`, so a canonical run that stages
governed-fix should turn `#1061–1065` green; that run is root's (author request 2). The author's report path reference
is therefore stale, not wrong in substance (F1-f1).

## 5. Security review of the delta

AuthN/authZ ordering unchanged (actor → concealment `NOT_FOUND` → position-1 fence → capability → advisory lock →
reservation → members/values → operand → CAS). The new token is reachable only by a caller who already passed
concealment, exactly as `FORBIDDEN` was; nothing new is disclosed. The registry read runs as the definer owner with
`app.cms_rpc` set by the producer itself (`030200:66`), takes no lock, and refuses an unregistered member of the
closed set at a public pointer. The 060 and 090 changes are test-only; neither touches a guard, inserts an active row,
forges evidence or widens a grant. Grants of both transports and both private functions are unchanged from the
baseline (`030200:230–235`, `030400:124–132`).

## 6. Findings

F1-f1 `docs/handoffs/2026-10-14-claude-s12/lane-taxonomy-def-report.md` (Follow-up pass, run 10 paragraph; Findings
dispositions row "F1"; Requests 2) — minor (report accuracy) — names `migrations-wip/governed-fix/20261014030500_…` as
the owner of `#1061–1065`; that file no longer exists, the amendment is patch 2 of
`migrations-wip/governed-fix/20261014040100_cms_submit_governed_review_refusals.sql`. Why it matters: the next reader
will look for a file that is gone and may conclude the five are unowned. Fix direction: root records the fold in the
promotion note (or the author updates the path); the `blocked-on-governed-fix` classification stands.

F2-f1 `supabase/tests/phase_02_slice_12_taxonomy_definition/090-registry-read.sqlinc:53–55` — minor (test depth) —
both probes declare a single domain, so a producer that consulted the registry for the first declared member only would
pass `090`. Why it matters: the registry read is the property under test; the SQL (`exists … where not exists`,
`030200:142–148`) is correct by reading, but the suite does not pin "every member". Fix direction: one more probe
declaring `['role', <hidden>]` (hidden in second position) expecting the same refusal. Not blocking.

F3-f1 `tests/contracts/phase-02-slice-12-taxonomy-lineage-witness-parity.test.ts:28–34` — minor (test robustness) —
`region()` takes the first `indexOf` of each marker; a future comment containing the literal `-- END TAXONOMY-LINEAGE-DDL`
ahead of the real marker would silently shrink the compared region. Today each marker occurs exactly once in both
files. Fix direction: assert `indexOf(marker) === lastIndexOf(marker)` for both markers (exactly one occurrence), or
match the markers at line start. Not blocking.

F4-f1 `090-registry-read.sqlinc:67–71` — informational — `#1333` compares `md5(prosrc)`, owner, ACL and registry rows
but not `proconfig`, `prosecdef` or `provolatile`; the subtransaction rollback restores them regardless. A
`to_jsonb(pg_proc) - 'prosrc'` comparison (as `040100:77–86` does) would make the no-leak assertion complete. No action
required.

F5-f1 `20261014030000_cms_taxonomy_lineage_columns.sql:41` / `:148–150` and `20261013300100:27–29` — informational —
the closed six-member set is now literal in three places (validator, table CHECK, registry CHECK) and nothing asserts
they agree; the lane documents the coupling in both headers. Fix direction: a static assertion in `080` or `090`
comparing `pg_get_constraintdef` of `cms_canonical_domain_registry_domain_check` with the validator's literal list, or a
one-clause BE03c note that a seventh domain extends all three. Fail-closed if forgotten, so not blocking.

F6-f1 `20261014030200_cms_create_taxonomy_version.sql:227–228` — informational (cosmetic) — the `comment on function`
still describes declared domains as "accepted whether or not a provider exists" without mentioning that each must have
a current registry row. Accurate but incomplete; the header `:27–31` is complete.

No blocker, no major. Baseline findings: F1 fixed, F3 fixed (ruling above), F4 fixed; F2/F5/F6/F7 untouched as the
brief allowed (F5 is now moot: 030500 no longer exists as a separate file).

## 7. Requests to root (reviewer's recommendations)

1. Promote `20261014030000`–`030400` from `migrations-wip/taxonomy-def/` at the hashes in section 1; the parity test
   follows the promoted path automatically.
2. Confirm `060 #1061–1065` in a canonical run that stages governed-fix `040100` with this lane before closing the
   slice; record the 030500 → 040100 fold where the lane report points at the old path (F1-f1).
3. Optional, cheap: F2-f1 probe and F3-f1 marker-uniqueness assertion; F5-f1 parity guard if a seventh domain is ever
   planned.
4. The author's standing requests (stale `taxonomy_authority.sql:78` oracle, `db:types`, sec2 pinned lists) are
   unchanged by this pass.

VERDICT: CLEAR
