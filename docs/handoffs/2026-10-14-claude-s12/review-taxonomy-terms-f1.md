# Independent delta review: lane `claude_s12_taxonomy_terms_sql` fix pass (F1)

Reviewer: independent, adversarial, read-only; did not author the work. Worktree HEAD `b16edb54` verified. Target: report
`lane-taxonomy-terms-report.md` `## Fix pass` (SHA-256 `1bdc592f…250fb`, matches), brief `briefs/taxonomy-terms-f1.md`, prior review
`review-taxonomy-terms.md` (PARTIAL). Read in full: `120000`, `120100`, `120300`, `120310`, `120400`, `120500:60-125`, `120200` (validator +
locale), `120600:60-100`; tests `020-surface`, `085`, `097`, `098`, `060`, `040` (parent rows), `000-world` helpers, canonical `104-184`,
`populated-terms-lineage.sql`, parity test. Precedents: `20261014070500/070510/070600/070610`, `20261005018400` (BE00 jobs-row handler),
`20260830120000` (`claim_job`, `apply_job_outcome`), `20261003120200` (CMS-definer cross-shard policies), `20261013300790`.
Spec: BE03c 161, 379-381, 403, 407, 1334-1357, 1371-1377; FE03 1792; contract `taxonomy-term.ts`; DEC-100.
Executed (allowed): `vitest run tests/contracts/phase-02-slice-12-taxonomy-terms-witness-parity.test.ts` under the quiet lock: 3/3 passed.
Independent check: `uuid5(NAMESPACE_URL, …)` in Python reproduces all three known answers in canonical `180-183`. Item 5 (re-hash) not done, per
instruction.

## 1. Asked judgments

**M1 transport — verified, with one gap (F1).** `120310` is structurally the `070510` shape: SECURITY DEFINER, owner `wejammin_cms_definer`,
`search_path=''`, revoke from public/anon/authenticated/service_role then EXECUTE to service_role only, `deadlock_detected|lock_not_available`
-> `CONFLICT`, prior `app.cms_rpc` restored; the private handler sets the flag itself (`120300:166`), as `070500` does. Strict request
`{jobId, batch?}` (`120310:26-39`). `020-surface:37-52` asserts transport, ACL, ownership, internal batch/request functions and the flag
set; the old absence assertion is gone. `085:71-116` drives it only via `s12tt_run` (flag cleared, `s12gb_call` = `set local role
service_role`, `rpc_user` recorded). The restore test (`085:104`) is non-vacuous: a `set_config(...,true)` inside a function whose SET clause
names another GUC survives function exit, so without the restore the flag would read `true`. CMS-03C-19 shape for request/answer and the
`## RPC boundary` entry are present.

**M2 enqueue — verified.** Production merge calls the same `cms_converge_taxonomy_merge(retired, 5000)` and enqueues on `remaining > 0`
(`120400:180-183`). `097` seeds 5,001 real assignment rows set-based (same labelled forgery class as `s12tt_assignment`), merges through the
real `platform_api.cms_act_taxonomy_term`, and pins 5,000 survivor + 5,000 superseded + 1 unconverged, exactly one queued job bound to actor
and party, one event at version 2, one audit; the transport converges the last row, no duplicate survivor row, re-delivery 0/0. No test-only
batch size exists. The transport's optional `batch` (1..5000, default 5000) is production-reachable request surface, not a test branch;
it is not in the spec, so the Worker lane should omit it (recorded in `## RPC boundary`).

**Removed assertions (`040` parent-on-alias/deprecate/merge, `060` hp-alias-parent) — removal justified; coverage not weakened.** The
frozen contract makes `parentId` nullable on all five actions and restricts per action only `survivorId` (`taxonomy-term.ts:35, 41-54`): the
contract author modelled action scoping and chose none for `parentId`. BE03c 379 ("`parentId` other than null requires shape
`hierarchical`") and 381 ("cannot be self/cyclic/merged") carry no action scope; FE03 1792 forbids only `survivorId` off merge. No source
says a parent on alias must be refused, and refusing would break the term form's deprecate of a child. The removed rows also asserted on a
nonexistent term, so they encoded an ordering, not a rule. Replacement (`060:70-120`): one shared `cms_term_parent_check` on every action
(`120400:17-53, 88-89, 170`), six real-fixture refusals (absent/self/cycle/flat on alias; absent on deprecate and merge) with an unchanged-store
check, and three acceptances proving "validated, never applied". Spec rules are now enforced on more actions than before. Residual (nit):
alias with a *different* valid parent is accepted and silently not applied (`060:103-109`); spec-neutral, but the Worker/FE lane must know
that only create/rename move a term.

**R7 policy on `platform_private.role_facet_assertion` — acceptable and least-privilege; still a root ratification.** A definer read does
not avoid a policy: the table is forced-RLS with only a self-row policy for `authenticated`, and SEC-2 forbids a bypass-owned definer
reader, so any compliant reader needs an admitting policy for its owner; the only policy-free-for-CMS alternative is a new Shard 01-owned
role/function, outside this lane. Precedent already grants the CMS definer cross-shard `using (true)` SELECT on `person_party`, `membership_tenure`,
`organization_actor_grant`, `jobs` (`20261003120200:22, 24, 34, 36`). This one is narrower: columns `(facet_code, state)` only (no
`person_id`), SELECT only, `state = 'active'` rows only, one function names the table (`120100:55-65, 146-148`), all pinned by
canonical `114-150` including a definer-session row view. The header's DEC-100 citation is misapplied (F6).

**D9 data-derived cursor — acceptable.** "Its durable cursor is job state" (BE03c 1334) is satisfied in substance: the unconverged set is
durable, monotone and idempotent (`120300:26-43`); no `jobs.progress` writer exists anywhere (only CMS plan rows write `progress`), the
definer holds SELECT on `jobs` only, and the CMS dry-run job also keeps its cursor on a CMS-owned row. The BOUNDARY naming the BE00 owner is
correct. Costs: no keyset (a scan per batch, F4) and the per-job delivery ceiling (F2).

**Other changes.** Lock order: `120300:76-86` one statement, ascending id, re-read under lock (BE03c 1338) — correct. Positions: handler
takes 1 (`cms_lock_governed_authority`, never raises), 3 (FOR SHARE, ascending id), 6 (FOR UPDATE, ascending id, one statement) — matches
1351, but capability is not re-proved (F3). Locale: `cms_term_locale_canonical` correct for the tested BCP 47 cases; write dedupes and stores
canonical, selector matches canonical (`120700:83, 131`), tests `098` + reads `050:59-64` non-vacuous. Reads 400: `120600:73-86`; tests
`reads/030:52-70`. DEC-100 oracle: strengthened and non-vacuous. Populated witness: real versions via the producer, pre-lineage guards
restored verbatim (`120050` replaces functions only, trigger column lists unchanged, so the witness state equals production at `120000`),
a parented merged row with a deprecated survivor backfills cleanly, N/N = 6/6, other columns byte-identical, three refusals in undone
subtransactions. The bare 23505 -> 55000 change (`120000:47-52`) is the right fix-forward (loud, named cause; no producer ever wrote such rows).
TC1: unchanged; passes as the copy (37) per the author; R4 still open.

## 2. Findings

- `20261014120300:170-173`, `120310:26-41` — **minor** — The handler runs any job id of the right type in any state: no `running` state,
  version or lease-token fence, unlike the BE00 jobs-row handler precedent (`20261005018400:62-67`, `claimedJob {jobId, version,
  leaseToken}`) and the CMS-03C-19 executor (`070600:123, 149`, lease re-proved). `085:101-116` runs it on an unclaimed `queued` job. Impact
  is bounded (service_role only; idempotent; `apply_job_outcome` fences the outcome), but a cancelled or succeeded job, or a stale delivery
  after lease expiry, still writes. Fix: request `{claimedJob:{jobId,version,leaseToken}, batch?}`; CONFLICT unless `running`, version and
  lease match and lease unexpired; test the cancelled, stale-lease and unclaimed cases.
- `120310:9-10`, report `## RPC boundary` — **minor** — The documented mapping (one call per delivery, `remaining > 0` -> `queued`) meets
  `claim_job`'s hard cap `jsonb_array_length(attempts) < 32` (`20260830120000:223`): one job converges at most ~32 x 5,000 rows after the
  in-transaction 5,000 (fewer with retries), then stays `queued` and unclaimable with no alarm. Assignments are per revision, so a popular
  term can exceed this. Fix: state the ceiling and have the Worker loop calls within one lease budget (`p_lease_seconds` <= 840), or have
  the handler enqueue a fresh job; root decides. Do not mark P2-S12-AC-226 complete without one of these.
- `120300:147-150, 174-175` — **minor** — Position 1 is taken but the capability is deliberately not re-proved; BE03c 1354 rule 1 says every
  writer re-proves under the position 1 locks. The rationale (a committed merge must not strand its tail) is sound but contradicts a spec
  rule and appears only inline in m2. Fix: list it as a numbered decision under `## Requests to root` for ratification.
- `120300:26-43`; `20260927260000:112` — **minor** — No index leads with `term_id` (only `UNIQUE (revision_id, field_definition_id,
  term_id, version)`); `cms_taxonomy_merge_work` is a SECURITY DEFINER SRF (not inlined) and seq-scans every owner's assignments: twice per
  merge command inside the 15,000 ms budget while holding position-6 locks, about five times per handler call. Fix: a partial index on
  `(term_id, revision_id, field_definition_id, version)` or `(owner_id, term_id) where state = 'active'`, in this lane's range.
- `120600:73-79` — **nit** — `limit: 1.0` passes the floor check, then `(p_request->>'limit')::integer` casts text `'1.0'` and raises an
  unmapped 22P02. Unreachable through the Worker (Zod re-serializes to `1`). Fix: cast through numeric.
- report m5, `120100:44-54` — **nit** — The terms-read matrix row is BE03c 407 (406 is cmsTaxonomyVersionsRead). DEC-100 governs Shard 02 not
  reading higher-numbered stores; it does not mandate a "named projection" for a CMS read of Shard 01. The operative clause is BE03c 1373.
- `tests/contracts/…-witness-parity.test.ts:68-72` — **nit** — "detects drift" is a tautology (any replaced byte differs). `085:144-149`
  are prosrc regexes (`for share`, `order by`) that match incidental text; acceptable only because ordering is not observable without the
  forbidden concurrency run.
- `120300:186-208` — **nit** — The position-6 set is computed once; the per-term loop re-derives work in a later snapshot, so a >5,000 merge
  committed in between is locked later and out of ascending order. A rare deadlock maps to the retryable CONFLICT. Benign.

Conventions: SQL files <=300 lines (max 292), tests <=400 (max 389), no `any`/TODO/stub; flag/ACL/CONFLICT idiom matches precedent.

## 3. Verdict

Both majors are closed: the continuation is reachable by its registered caller exactly like CMS-03C-19, and the real command's 5,000
boundary and enqueue branch are proven with 5,001 real rows. The parentId alignment is correct and better tested than before. R7 and D9 are
acceptable for root ratification. The remaining items are minor and do not block promotion of the thirteen migrations: F1 (lease fence),
F2 (delivery ceiling, a Worker-lane and root decision) and F3 (ratify the non-re-proof). Keep P2-S12-AC-226 open until F2 has an
owner decision. Apply R4 (TC1) with promotion.

VERDICT: CLEAR
