# Native taxonomy definition RED authoring

2026-10-13; lane `native_s12_taxonomy_definition`; dispatched model
`gpt-6-astra`, effort `ultra`; worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`; observed HEAD
`b16edb54a7a1b698ed8ca15b6085046d4270626e` plus preserved dirty work.

Status: three separately root-released ALT diagnostics consumed on 2026-10-13.
Runs one/two were harness-gated; run three completed missing-producer RED:
plan 1..1143, 341 pass / 802 fail, SQL child exit 0, no SQL abort. No behavioral
acceptance, automatic retry, implementation, migration edit, AC tick, depth
signature, stage or commit. Between-run repairs required separate root releases.

## Sources and boundary

| Source                                                                     | Authoritative requirement used                                                                                                     |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md:178` | CMS-03C-16 draft creation, curator scope, conditional parent CAS, no event                                                         |
| BE03c:208,215,218–219                                                      | DEC-188 immutable definition number, private lifecycle counter; per-owner uniqueness; first-row lineage id and additive successors |
| BE03c:401–402,771–796,956–965                                              | Shape, key grammar, unique 1–64 allowlists, 0–6 closed canonical domains, request/resource fields                                  |
| BE03c:1314–1322,1371–1375,1502                                             | Taxonomy submission dependencies, no-bound-type default policy, unbuilt-domain refusal after creation, real lifecycle transition   |
| BE03c:1295,1447–1454,1477                                                  | Typed taxonomy errors, named create RPC, private grants and current curator authority                                              |
| `packages/contracts/src/cms-composition/taxonomy-version.ts:27–84`         | Actual strict request/resource schemas, JSON-null first operand, decimal-string successor operand                                  |
| `packages/contracts/src/cms-composition/key-grammar.ts:59–62`              | Taxonomy keys have no reserved route-segment set                                                                                   |
| `packages/contracts/src/content-schema-registry/field-rules.ts:12–26`      | Type/field key grammar and positive signed-bigint decimal version bound                                                            |
| `packages/contracts/src/cms-composition/conditional-if-match.ts:30–55`     | First request omits If-Match; successor carries equal strong HTTP operand                                                          |
| `.memory/pipeline/progress/slices/phase-02-slice-12.md:954–958`            | P2-S12-AC-124 through AC-128; SQL authoring covers only database-applicable portions                                               |

No create producer was found. `apps/worker/src/cms-composition-production-taxonomy.ts:18–55` is term-action `actTerm`, not a version producer.
Proposed adapter: `platform_api.cms_create_taxonomy_version(p_request jsonb) returns jsonb` delegates to equally named private function.
Name is normative; signature and flattened six fields plus `idempotencyKey`, server `context`, optional decoded `ifMatch` are derived.
Precedents: `20261013100200_cms_define_template_per_owner.sql:84–114,143–158`; `20260930150000_cms_idempotency_business_hash.sql:67–100`.
P0001/INVALID_REQUEST/VALIDATION_FAILED/FORBIDDEN/NOT_FOUND/CONFLICT/IDEMPOTENCY_MISMATCH are derived SQL bindings, not new HTTP codes; preserve assertions when reconciling the producer.

## Authored assertions

Entry point: `supabase/tests/phase_02_slice_12_taxonomy_definition.sql`.
Its owned support directory contains eight files including its README.

- Exact public/persisted draft, creator/owner/hash/lineage/lifecycle, atomic audit, replay, no activation effects; both shapes/all bounds.
- Strict fields/types/grammar/uniqueness, null/decimal operands, bigint, conditional If-Match, key bounds, owner uniqueness/replay mismatch.
- Anonymous/readable-denied/hidden/cross-owner scope; revoked/expired/restored authority before cache, browser denial/private grants.
- Governed submission: unbuilt domain refusal/detail; built-role/no-domain positives pin registry/default policy dependencies.
- Real draft → review: immutable definition 1, lifecycle 2; successor definition CAS preserves complete parent/stable lineage.

## Fixture and oracle integrity

Real `auth_bootstrap`/`rpc_create_organization` create identities/two organizations; raw facts: three synthetic provider users, one membership, two finite curator projections.
Setup checks scope/authority, no CMS-owner receipt, default policy and registry. No synthetic definition/active type, guard bypass, receipt-owner grant or helper replacement.
Only shared include: unchanged JWT helper. Server calls really use `service_role`; denial probes use browser roles; SQLSTATE/message/detail/body are separate.
Refusals compare thirteen ordered complete stores, gated on exact refusal. Replay needs successful non-null original; failed calls roll back their statement subtransaction.

## Validation and remaining prerequisites

Original shared-quiet static checks passed: ≤300 lines, whitespace/newlines, includes, lexical balance, no bypass, formatting; not PL/pgSQL/runtime proof.
Tools: Node 22.23.1, pnpm 11.24.0. Full `pnpm db:verify`/`pnpm validate` did not run; any new diagnostic requires fresh release.
Governed submit's bare `canonical_source_unavailable` lacks `details.domain` required by BE03c:1314,1375; no repair claimed.
Activation/term actions require real producers/reachable states. Empty terms do not prove existing-term persistence.
Revocation/parent races, injected post-write faults, HTTP/rate/deadline, OpenAPI/browser and bound-type dependencies remain separate obligations; no acceptance cleared.

## Authoring SHA-256 receipts

Paths below are under `supabase/tests/`; hashes cover exact authored bytes.

| Path                                                                | SHA-256                                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `phase_02_slice_12_taxonomy_definition.sql`                         | `fad8eb53ee0b0c94e36ebeccdec2d04e45ad1f7f6a595d5dc8d725770361caf3` |
| `phase_02_slice_12_taxonomy_definition/000-harness.sqlinc`          | `dc5612248161ef071eb0aabe779de97403fa448abd977c9f6ed2207fe0557e62` |
| `phase_02_slice_12_taxonomy_definition/010-identities.sqlinc`       | `dbd8df62074f264306c79c384b2ed9dc60de753708440cdd0b9fc084dbba28c2` |
| `phase_02_slice_12_taxonomy_definition/020-oracles.sqlinc`          | `c1235e11870c85c3bd47f69c761425161690b986556ffecd63ba4a0ee4c2b8e1` |
| `phase_02_slice_12_taxonomy_definition/030-create.sqlinc`           | `204c8d6f25c5b9c7f5225ea837613ffe38081f6a89771b7ada2eff8e900aef4e` |
| `phase_02_slice_12_taxonomy_definition/040-validation.sqlinc`       | `199207c5e34e019ba8d299e9c98adbd5762e6833e32e5ea325dec2b6fde70b09` |
| `phase_02_slice_12_taxonomy_definition/050-authority.sqlinc`        | `93c5fc39eb307348900e1c3593cf5124a0ab5b5e685f8ec847113cf40e1ac4b6` |
| `phase_02_slice_12_taxonomy_definition/060-review-successor.sqlinc` | `4279baf4045bfe7a075805175baa7173559ef62058efde9b7216b99a0c70bb17` |
| `phase_02_slice_12_taxonomy_definition/README.md`                   | `2b75745a0b6176aad7d0b959ba6743b388972a7860504681e1dddfa14ad82059` |

## One-shot ALT checkpoint — 2026-10-13

Root explicitly released this single command after tracking READY at
`2026-10-13T22:28:34Z` and independent STATIC CLEAR for the intended missing
producer diagnostic. Released main/include manifest:
`7b5a86cdabbdc82becfb6ed9bc9d5d333bb4f14e88cc29b1d8c93e7e78736e50`;
released report: `dc6da83f696c595ee7cd02ef6acfcabcd8473394a1afad1c0e1021ac7b55d1c2`.

Executed from the Slice 12 worktree with `/bin/bash`, `login:false`, and
`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`:

```sh
flock /tmp/wejammin-supabase-ci.lock bash docs/handoffs/2026-10-10-claude-s11/lanes/lane-db-alt.sh /home/rob/.codex/worktrees/phase2-slice12/WeJammin supabase/tests/phase_02_slice_12_taxonomy_definition.sql
```

Immediately before execution, Node `v22.23.1` and pnpm `11.24.0` were verified.
Outer lock: `/tmp/wejammin-supabase-ci.lock`, exclusive. The inspected runner
then acquires shared `/tmp/wejammin-quiet.lock`, exclusive
`/tmp/wejammin-altdb.lock`, and `/tmp/wejammin-reset.lock` around reset. ALT lock
wait/acquisition both logged at `18:31:51 EDT` (`22:31:51Z`); reset success at
`18:32:19 EDT` (`22:32:19Z`). The runner's migration-link check passed. Reset
applied all thirteen frozen Slice 12 migrations below, seeded, and completed;
there was no reset failure. No other DB command or retry was issued.

### Actual TAP and first failing identities

Runner/pg_prove exit: **1**. SQL child exit: **3**, Wstat **768**. One file,
**19 emitted assertions: 17 passed, 2 failed**. The entry uses `no_plan()`;
the abort prevented `finish()` from emitting `1..N`, so the actual final plan
is **absent**, not 19. pg_prove reports `No plan found in TAP output` and FAIL.

- Assertions 1–14: all fixture/setup controls passed. They establish local
  organization creation, membership/curator scope, non-curator and cross-owner
  controls, no CMS-owner receipt, real default policy/registry and snapshot stores.
- First failure, #15: `proposed transport: named taxonomy-create API RPC exists`.
- Second failure, #16: `proposed transport: atomic private taxonomy-create implementation exists`.
- Assertions 17–19: JSON-null first operand, absent first If-Match and decimal
  successor operand controls passed.
- `030-create.sqlinc:13` reached the `flat-first` call runner. At line 14 its
  `s12td_created` oracle aborted: `operator does not exist: boolean -> unknown`.
  PostgreSQL identifies the unparenthesized JSONB containment expression in
  `020-oracles.sqlinc:75–77`, PL/pgSQL function `s12td_created(text)` line 56 at
  RETURN NEXT. No assertion from this set-returning oracle was emitted.

The two has_function failures witness missing proposed implementations, but
the suite is **harness-gated**, not a completed feature RED. Expected create
SQLSTATE `42883` was **not emitted or independently observed**: the runner
captures it privately, and this diagnostic did not query that temporary record.
No later validation, authority, replay, domain, lifecycle or successor matrix
result is claimed. No source fix or automatic retry followed the first run.

### Full logs and SHA-256

Paths are relative to the Slice 12 worktree; full TAP retains every emitted
assertion, SQL error/context and pg_prove summary.

| Artifact                                                | SHA-256                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------ |
| `.lane-logs/alt-reset-183151-249343.log` (27,582 bytes) | `023d53664ff75f6d0a62ad5e2432fc805937c7037e0aa0b024a2cc2106eaf01a` |
| `.lane-logs/alt-tap-183151-249343.tap` (3,577 bytes)    | `92379dca171e6dc5d98efab4ecb56e846eaa6b37dd5f1cb80aad0e6870ff75f5` |

### Before/after freeze

Before: `2026-10-13T22:31:44.365Z`. After run, before this report-only edit:
`2026-10-13T22:32:52.263Z`. All **24 files matched byte-for-byte**: thirteen
applied migrations; entry SQL; all eight owned support files including README;
shared JWT helper; this report. Aggregate SHA-256 of LF-terminated
`<sha256><two spaces><relative path>` rows, ordered as just listed (migration
and support basenames sorted), before and after:
`b69108460a93d66096a1a70dc800f5fad338a3a5e20bc1d20c0407bb64c7f4ee`.
This independently defined freeze is not the auditor's differently scoped
main/include manifest. The nine owned authoring hashes above remained exact.
Shared `supabase/tests/support/jwt-claims.sqlinc`:
`1e197105078c019461ea79ab891d08b5203b68edca7cfb8345896f6a12180984`.
Pre-edit report matched its released hash above; this checkpoint intentionally
changes only that report. Observed HEAD remained the authoring HEAD above.

Migration paths below are under `supabase/migrations/`:

| Frozen applied migration                                    | Before = after SHA-256                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------ |
| `20261013300000_cms_governed_subject_lifecycle.sql`         | `b94529716305457ee09b4a349bf05c2370f53b739e539f7bb878f29b59e7aba3` |
| `20261013300100_cms_canonical_domain_registry.sql`          | `3a48b4f10929ed10af61f8523cb8857a2ddfbec2c165ec1dd1cd93d9952fefcf` |
| `20261013300200_cms_governed_review_tables.sql`             | `84066aeff33448ceb6384fd2a056ef2f315a48cd48a29f7d06aafadb1189c252` |
| `20261013300300_cms_governed_subject_helpers.sql`           | `0b25de2c0c620c3460871b851fe6b26f5e1fa9fc6f25ead1de19a01820b02862` |
| `20261013300400_cms_governed_frozen_status.sql`             | `979d1e8150d027c87adb0a9af3be4a0370d0a08cee296aa824d01eabbaaa6059` |
| `20261013300500_cms_governed_review_support.sql`            | `ce85cd2e7254d396c3bfff8146fb3357d3f3f4ff5e1014840baec0426f047eff` |
| `20261013300600_cms_governed_review_guards.sql`             | `7d83807387958bd1db69b9a45bf6f8f77d16ec2f55d8df66714cde8959f1d2f8` |
| `20261013300700_cms_governed_activation_schedules.sql`      | `eb50971bcceedaec91a66759f8c6f224b599c71aabfc871a79814a2ad3b6822b` |
| `20261013300790_cms_governed_authority_lock.sql`            | `8b9f294dd2983b1fdeec825e60946c1a5f3a048f284da0ff2ef687296e15d972` |
| `20261013300800_cms_submit_governed_review.sql`             | `384fe5d569b2f203b4054b21d1bb17b0c9df093ad7739a3c4d04e9a455c94a7e` |
| `20261013300810_cms_submit_governed_review_public.sql`      | `ffa033abe9dc404b1cece59559d54e9fbe379645c66afd39209f94e55aa495fb` |
| `20261013300820_cms_submit_governed_review_binding_fix.sql` | `45f234534942279e4181b55f342bb4c8c6aa3753462c7833868c6f072ec55aff` |
| `20261013300830_cms_governed_submit_hash_privileges.sql`    | `7871c43e09809b6013e47a3fe9e403e58e3160a4a7ae8a1f6b7aeab5f682f55f` |

### Remaining oracle limits and hold

Thirteen-store snapshots exclude identity/membership/capability authority
stores; they cannot prove those were unchanged. Term stores begin empty, so
their snapshots do not prove stable populated term identity. The domain-detail
oracle conditionally casts text beginning with `{` to JSONB; malformed such
DETAIL can itself abort, and robustness remains unproved. Local synthetic
auth-provider/grant fixtures do not prove hosted authentication, MFA, owner
receipts or integrated authority lifecycle. No race, injected rollback fault,
canonical producer, SQL acceptance, or AC completion was exercised or cleared.

The first checkpoint held after exactly one diagnostic. Root subsequently
released only the surgical authoring correction recorded below, not another run.

## Surgical containment repair — authoring only

After the first-run report was saved, root explicitly authorized only
`020-oracles.sqlinc:75–82` and this report. Both JSON extraction operands in
each of three containment assertions now have parentheses:
`(c.after_state->'store') @> (c.before_state->'store')`. The stores remain
taxonomy versions, audit events and idempotency records. All assertion titles,
expected tokens, counts, complete-store snapshots and intended containment
semantics are unchanged. Six lines gained twelve parentheses; no other oracle
bytes changed. `050-authority.sqlinc` and its `p.proconfig @> array` check were
not edited.

| Oracle receipt                | SHA-256                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| Before repair / exact inverse | `c1235e11870c85c3bd47f69c761425161690b986556ffecd63ba4a0ee4c2b8e1` |
| After repair                  | `1ab4f467acbdfcf43009f3fb9ab6e473a79844f99917ec966dd9aee43e5a12dd` |

Exact inverse removes only the twelve added parentheses from those three
specific expressions; its complete-file SHA-256 equals the frozen before hash.
The earlier authoring receipt table is historical, not this repaired hash.
Static include, lexical, formatting, file-bound and scoped-diff checks passed
under shared `/tmp/wejammin-quiet.lock` at `2026-10-13T22:36:31.646Z`: nine SQL
entry/include files resolve, exact inverse matches, no unexpected file changed,
and every owned file remains below 300 lines. These are the only checks released
for this correction; they do not establish PostgreSQL execution or repair any
later runtime blocker. The original run
remains 19 emitted / 17 pass / two missing-function failures / SQL abort / no
final plan; observed create SQLSTATE 42883 remains unreported by that TAP.

Independent review then cleared the repair; root separately released the single
second diagnostic below. No further runtime or source repair is authorized.

## Second ALT checkpoint — 2026-10-13

Tracking READY `22:43:39Z`; independent cleared nine-file manifest
`7dc0af9995a821c18a294f53070e3f8eca46ba8ca457fd66db546219ddfb3917`;
before-report `14a36b00673c119a474caf8817bb7286c9f55325a1611106caf840377e7650d4`.
Exactly the same command, non-login shell, pinned PATH and four locks above.
Node `v22.23.1` / pnpm `11.24.0` reverified. ALT acquired `18:45:40 EDT`;
reset succeeded `18:46:08 EDT`, applying all thirteen frozen migrations and seed.
No reset error, automatic retry, source repair or additional DB invocation.

pg_prove **exit 1**; SQL child **exit 3 / Wstat 768**. **495 emitted / 173 pass /
322 fail; no final TAP plan**. Setup #1–14: 14 pass. Existence #15–16: two fail,
same first identities as run one. Operand #17–19: three pass. Remaining
#20–495: 476 emitted / 156 pass / 320 fail; pass counts are not acceptance.
First create #20, `flat-first: ordinary authorized create succeeds`, explicitly
reports **have 42883 / want 00000**; #21 actual service-role control passes.
Unlike run one, create SQLSTATE 42883 is now observed. The run nevertheless
aborts constructing the validation matrix at `040-validation.sqlinc:109`:
`could not determine polymorphic type because input has type unknown`.
Line 108 supplies untyped `E'abcdefgh\n'` to `to_jsonb`; matrix execution at
line 111, later authority/domain/successor tests and `finish()` were not reached.
This is still **harness-gated**, not completed feature RED or SQL acceptance.

| Full second-run artifact                                | SHA-256                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------ |
| `.lane-logs/alt-reset-184540-321925.log` (27,582 bytes) | `023d53664ff75f6d0a62ad5e2432fc805937c7037e0aa0b024a2cc2106eaf01a` |
| `.lane-logs/alt-tap-184540-321925.tap` (139,883 bytes)  | `536a13821b47337301ddc073f5920c50caa7c9f0b83fbe34835868ebd11f6fdb` |

Before `22:45:34.956Z`, after `22:46:50.435Z`: all 24 frozen files matched,
including this report before its update; HEAD unchanged. Same freeze algorithm:
`307ec22a6996995c2426ae3fdcbf380c90262cdd6579fd5bbc83d70f2a460cef`.
All thirteen migration hashes above remain exact; repaired oracle remains
`1ab4f467acbdfcf43009f3fb9ab6e473a79844f99917ec966dd9aee43e5a12dd`.
Authority-store exclusion, empty terms, malformed-DETAIL casting and all other
oracle limits above remain. No third runtime diagnostic is released.

## Literal cast repair — authoring only

After saving the second-run receipt, root authorized only
`040-validation.sqlinc:108`: `to_jsonb(E'abcdefgh\n'::text)`.
One `::text` addition (six characters); exact inverse restores the entire before
file. Newline value, `control` label, expected `INVALID_REQUEST`, matrix count
and all other bytes remain unchanged; no other SQL file was edited.
Before/inverse: `199207c5e34e019ba8d299e9c98adbd5762e6833e32e5ea325dec2b6fde70b09`.
After: `180e62753ea6748099d37056c0a53a59e103b499a94c59b3805ea101afd6233f`.
Static scope/lexical/include/format/≤300 checks passed at `22:49:52.493Z`:
nine SQL entry/includes resolve; exact inverse and 22 unchanged neighboring
files verified, including all thirteen migrations. No PostgreSQL validation.
Independent review cleared the cast; root separately released only the third diagnostic below. Second-run history remains harness-gated.

## Third ALT checkpoint — 2026-10-13

Root release followed READY and independent STATIC CLEAR; nine-SQL manifest
`1e9607735aa584af356353a523204a8f17383cd11893cbefaca8dfbe763cc585` matched before run.
Same exact command/non-login shell/pinned PATH/four locks above; Node v22.23.1 and pnpm 11.24.0 reverified.
ALT acquired `18:56:29 EDT`; reset succeeded `18:56:57 EDT`, all thirteen migrations and seed applied. No reset failure.
pg_prove exit **1**, SQL child **exit 0 / Wstat 0**; contiguous **1,143 emitted / 341 pass / 802 fail**, final plan **1..1143**.
No SQL ERROR/FATAL or harness abort. Only warnings: entry lines 12/14, `there is no transaction in progress` (same initial COMMIT warnings).
All fourteen setup controls pass. First failures remain #15 API / #16 private missing-create function; #20 `flat-first: ordinary authorized create succeeds` reports **have 42883 / want 00000**; #21 real service-role control passes.
Classification: **completed missing-producer RED only**. Later failures cascade from absence; null/empty-comparison passes do not prove features, legitimate refusal, replay, immutable successors or lifecycle behavior.
Full plan/finish reaches final #1143; no subsequent diagnostic, source repair, migration, race or other test was issued.

| Full third-run artifact | SHA-256 |
| --- | --- |
| `.lane-logs/alt-reset-185629-376711.log` (27,582 bytes) | `023d53664ff75f6d0a62ad5e2432fc805937c7037e0aa0b024a2cc2106eaf01a` |
| `.lane-logs/alt-tap-185629-376711.tap` (2,246,990 bytes) | `e8622573b6b4a262496cc1e146be4e522ab9667cb83cd6a0a72b90220dd1e51a` |

Before `22:56:20.912Z`, after `22:57:46.737Z`: all 24 files byte-identical; same HEAD. Freeze algorithm above:
`abe58215708fe1e306295ba788bee116f51e9d0023051d0c98a7994aa013ee2a`.
Before-report `56d6fb81bb0b2075b7f193763f2c6ec07ed989806b344e14a71d2353d9c95630` matched after run, before this report-only update.
All source/migration hashes retained. Authority-store exclusion, empty terms, malformed-DETAIL robustness, no fault/race/HTTP/hosted proof remain unchanged.
**HOLD:** three diagnostics consumed. No producer implementation, fourth run, further fix or acceptance claim is authorized.
