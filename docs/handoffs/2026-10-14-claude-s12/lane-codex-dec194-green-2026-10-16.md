# DEC-194 durable admission — author freeze, UNRUN

Native lane `native_dec194_race_red_20261016`, assigned `gpt-6.1-sol` / `ultra`.
Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`; protected primary untouched.
Only the four exact new forward-only WIPs and this new report are in the GREEN author claim.
No original WIP, applied migration, test, helper, runner, transport, specification or tracker edit.
Author ran no parser, formatter, test, database, Docker, lock, network, Git or promotion command.
All edits use absolute-path apply_patch; source/log/hash analysis uses context-mode.

Status: all four new WIPs AUTHORED/UNRUN. Root explicitly released `190030` only after the
separate genuine outer-entry race RED. Root's complete six-WIP staging, tests, isolation proof
and independent review remain pending; this is an author handoff, not implementation acceptance.

## Test-first evidence and release boundary

Root's actual producer race RED log was read and SHA-256 verified:
`/tmp/wejammin-native-receiving-proto-red-BkaHbW/dec194-race-red.log`,
`6fee7782bfc1430814a6af9ea725fc1b44d6e10c7072f85785cd9ca3410cbeec`.
S1's real fixture passed (no live Job, idle>=20m, streak=1, work=3, latest failed Q), and the
actual receipt SELECT FOR UPDATE barrier was observed at waiter PID 352 / holder PID 345.
The ordinary producer nevertheless finished while the sweep transaction still held its barrier:
the exact predicted meaningful missing-serialization assertion. This was not a missing-table,
missing-helper, fixture or parser failure. Root reported no secondary cleanup error.

The existing race calls the real private enqueue helper. It does not establish that the outer
CMS merge takes the mutex EARLY, before its vocabulary/term locks and initial convergence.
Root therefore authored/reviewed/released a separate real outer-entry witness. Its actual RED log
was read and SHA-256 verified: `/tmp/wejammin-native-receiving-proto-red-BkaHbW/dec194-outer-red.log`,
`12160b7a3f9d7423dfa9320d6a78a30bc5ca8411b47739c262e8f9ee6e8e04a1`.
The real active-vocabulary/unmerged-term fixture, positive outer call with SAVEPOINT full-store
restoration, and invalid-key precedence control passed. Raw mutex holder PID 352 and actual
outer PID 373 were identified; the valid outer merge completed while the holder still owned
the transaction, instead of waiting before domain locks. The log has one meaningful assertion,
not a missing-helper/fixture/parser or secondary cleanup failure. Root reported independent
review CLEAR and partial-five staging readiness 4 PASS at
`.lane-logs/alt-staged-dec194-014936-2031180.tap`, then explicitly released `190030` in Dispatch.
No test was changed by this author. Actual Worker/PostgREST transaction isolation remains a gate.

## Actual lock map, read before implementation

Sources: `20261014120500_cms_act_taxonomy_term.sql`, `20261014120510_cms_act_taxonomy_term_public.sql`,
`20261014120400_cms_term_action_apply.sql`, `20261014120300_cms_taxonomy_merge_convergence.sql`,
`20261014120810_cms_taxonomy_merge_handler_fenced.sql`, `20261014120820_cms_run_taxonomy_merge_converge_claimed.sql`,
the original `190000`/`190010` WIPs, and `20261013300790_cms_governed_authority_lock.sql`.

| Path | Actual current lock/effect order |
| --- | --- |
| Ordinary outer merge | Verified identity/concealment -> authority FOR SHARE (person, sorted tenures, curator grant) -> CMS receipt -> active taxonomy FOR SHARE -> named terms FOR UPDATE ascending -> merge update/first convergence -> private ordinary enqueue -> BE00 receipt FOR UPDATE -> Job/outbox/audit. |
| Direct private enqueue | BE00 receipt FOR UPDATE -> existing per-retired-term acceptance; no authority/vocabulary/term locks in this helper. |
| Claimed continuation | Immutable Job identity lookup -> same authority shares -> claim/capability -> active vocabulary shares ascending -> all retired/survivor term locks ascending -> bounded assignment convergence -> BE00 continuation receipt/acceptance. |
| Recovery | Candidate scan -> live/activity/work/streak gates -> BE00 receipt/acceptance; no authority or taxonomy row locks. |

Putting the mutex only in the late ordinary helper would invert locks: the outer merge holds
terms while waiting for a mutex that a continuation holds while waiting for those terms.
The root-approved resolution is a MERGE-ONLY mutex insertion immediately BEFORE cms_reserve,
AFTER the existing idempotencyKey typecheck/authority checks. All other outer bytes/refusal,
preflight, CAS and receipt semantics must stay unchanged. The late helper reacquires the same
transaction key reentrantly; ordinary per-term acceptance is preserved, with no global coalescing.

The term UPDATE guards additionally take `cms.taxonomy.hierarchy:<lineage>` transaction advisory
locks after term locks (`20261014120050_cms_terms_guards_lineage.sql`). The enqueue mutex must
already be held before that point; late reacquisition introduces no new wait. The continuation
writes assignments rather than terms and does not acquire that hierarchy advisory lock.

The selected producer order is authority -> party enqueue mutex -> CMS receipt (outer merge
only) -> vocabulary -> terms -> existing convergence/BE00 acceptance. Recovery/direct enqueue
do not acquire authority/domain locks after their mutex. Recovery visits party UUIDs ascending.
No unresolved producer lock inversion was identified in this source map; runtime proof is separate.

## Drafted implementation

`190020` creates private `cms_taxonomy_merge_recoveries(failed_job_id PK FK jobs ON DELETE CASCADE,
recovery_job_id uuid NOT NULL, requested_at timestamptz NOT NULL)`. There is deliberately NO FK
to R, no TTL and no custom trigger/guard. The migration-created table retains its migration
owner; FORCE RLS plus CMS-context SELECT/INSERT policies and CMS SELECT/INSERT grants restrict
application access. PUBLIC/anon/authenticated/service_role have no table grants. No CMS UPDATE
or DELETE grant and no guard obstruct legitimate Q FK cascade or BE00 purge.

The private CMS-owned empty-search-path helper is `cms_taxonomy_merge_enqueue_lock(uuid)`:
`pg_advisory_xact_lock(hashtextextended('cms.taxonomy.merge.enqueue:' || party::text, 0))`.
The exact BIGINT namespace/seed/helper were root-approved before helper freeze. It has no API
EXECUTE grant. Null party returns so the existing downstream BE00 invalid-input error remains.

`190030` copies the actual complete private outer function and inserts only the three-line
merge conditional immediately before `cms_reserve`, after the existing idempotency-key typecheck.
The original outer body is byte-identical after removing that one insertion. The private ordinary
enqueue body is likewise byte-identical after removing its single mutex call before BE00.
The same helper/key is reacquired reentrantly; actor/party/correlation, per-retired-term key,
request hash, seven-day receipt window, response, non-merge actions, authority/concealment,
refusals, CAS, audit/outbox and ownership/API revokes are preserved. Public transport is unchanged.
These are static byte comparisons, not SQL parsing or runtime proof.

`190040` preserves the continuation's strict claimed-job protocol, original authority/capability
proof, ordered vocabulary/term locks, 1..5000 batch and derived continuation key. It adds the
party mutex after position 1 and rereads the actual running/version/token/unexpired lease AFTER
that wait. It fences again after domain-lock waits before effects, and after convergence/possible
late BE00 receipt wait before returning: a claim lost meanwhile rolls every provisional effect
back. No Job row is written; BE00 remains sole claim/lease/outcome owner. Transport is unchanged.

`190050` uses the pre-lock scan only to route party UUIDs. AFTER acquiring each party mutex it
reselects the latest failed Q, checks the durable association, and refreshes live/work/streak and
clock/inactivity facts. It calls unchanged BE00 acceptance with the same failed-Q-derived key,
actor/party/correlation and seven-day receipt window. It inserts Q->R AFTER acceptance on both
fresh and replay paths, then increments requested only if fresh. Existing associations refuse
recovery independently of receipt TTL and R retention.

Only association-INSERT `integrity_constraint_violation` is normalized to P0001 INTERNAL_ERROR,
as root approved for the frozen CHECK-fault oracle and safe error vocabulary. The error escapes
the RPC, rolling prior Job/outbox/audit/receipt acceptance back with the association; no partial
acceptance is returned. Deadlock/lock-not-available remain uncaught here for the unchanged wrapper's
CONFLICT mapping. No catch continues after a failed association and no direct marker backfill occurs.

## Author freeze manifest

| WIP | Lines | SHA-256 |
| --- | ---: | --- |
| `20261014190020_cms_taxonomy_merge_recovery_identity.sql` | 58 | `1f9ea5165c3a0a7b00bab4dea82677adecf24d0de9c7d44bd5030018787340f5` |
| `20261014190030_cms_taxonomy_merge_request_serialized.sql` | 178 | `e1e60a3a3a0f54531bcac770312f1ae587ce09934e1b6e341602ebb16767ef99` |
| `20261014190040_cms_taxonomy_merge_handler_serialized.sql` | 129 | `8a67155582f1b874a93369e1babe39de000dfe7082b56596b2e4fe460d52be3d` |
| `20261014190050_cms_taxonomy_merge_recovery_serialized.sql` | 97 | `b1cb29a4f8dc3e1652b224ab971c15585d4ab86bae6e770ef24b26671935d47c` |

All WIPs are under `supabase/migrations-wip/dec194/`. The report's own hash is returned separately.

## Root-authorized SQL oracle normalization

No test/helper edit was made by this author. `040-request.sqlinc:6` and
`050-generations.sqlinc:9,21` call real recovery before `060`. Correct GREEN consequently
retains Q->j3, j4->j5 and j5->j6, then `060` adds j6->R: at least four legitimate associations.
The former GLOBAL `s12dc_assoc_rows() = 1` assertions therefore contradicted durable history.
Root confirmed the issue, separately claimed only `060`/`070`, and applied a baseline-relative
normalization: `060` captures the association count immediately before x1; the later expiry and
fault counts require that baseline plus one. Existing association-sameness, full-store, per-Q,
eligibility and fault oracles are unchanged. An absent table still fails (-1 baseline, expected
0 versus actual -1), so this does not make the missing-association RED vacuous.

Readback identities after the authorized root edits (both UNRUN at this checkpoint):

| Frozen test | Lines | SHA-256 |
| --- | ---: | --- |
| `060-idempotency-expiry.sqlinc` | 167 | `da37adfe39debc693612cbb3bac79eca3d48fe514af18033f4aaacb5912323d1` |
| `070-atomicity.sqlinc` | 76 | `0e4c43bb7d992a24f9916d4d821c27c84eb11b4139f267c95542e3a751d4d590` |

Root's earlier SQL RED receipt (135 assertions, 116 pass / 19 fail; TAP SHA-256
`f9f129ff8d853cceeb1d26d34e323b349f34d733fb46ad9a6724ef2c3a69e8ed`) identifies the older
test bytes. Its decisive expiry assertion 112 (requested 1 versus expected 0) is unchanged;
it is not a runtime result for the normalized tests. Production must preserve earlier markers,
never purge their history to satisfy a global count.

## Root continuation and limits

1. Preserve both genuine RED receipts and all frozen test identities. `190030` is now authored
   after explicit release; read its complete final bytes against the actual outer/helper sources.
2. Read all final bytes, obtain independent review and run non-executing formatting/parser checks.
3. Root alone stages/applies the cluster on explicit ALT and runs frozen 135-assertion TAP,
   producer races, the new outer-entry witness, FK/purge/RLS/security checks and regression gates.
4. Prove actual RPC isolation separately. Fresh READ COMMITTED SQL statements matter: a party
   advisory lock does not refresh a REPEATABLE READ/SERIALIZABLE transaction snapshot. Direct
   READ COMMITTED race sessions do not prove Worker/PostgREST isolation.
5. No runner registration, migration promotion, canonical/hosted claim, tracker/AC tick or slice
   acceptance follows from this author freeze. No destructive DOWN drops durable identities;
   any later correction is forward-only and must preserve accepted recovery identity.
