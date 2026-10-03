# Decisions

## Summary

- **Total decisions**: 131
- **Unique decision titles**: 131

## DEC-001: The rights stack is the thesis, not an adjacency (2026-07-16)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-16T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate
- **Index**: [[index]]

- **Problem**: Rights & Ownership, Royalties, Licensing and Distribution emerged as 4 domains / ~70 sub-domains that **no user directive asked for**. The owner named a marketplace, digital goods, a directory and events. Marking them `core` was an agent inference and needed owner ratification.
- **Options considered**: (1) Thesis — all four `core`, platform holds the ownership record end-to-end. (2) Adjacency — all four `important`, ship directed scope first. (3) Partial — Rights `core`, the rest `important` (agent recommendation).
- **Decision**: **Option 1 — thesis.** All four `core`. Owner overrode the agent's "partial" recommendation, consistent with the maximal brief ("a platform musicians cannot live without").
- **Downstream**: Adds the most regulated, most integration-heavy scope in the industry (PRO/society registration, CWR exchange, DDEX conformance, statement ingestion) before any user liquidity exists. Massively raises `/create-prd-security` compliance surface. `/plan-phase` must not treat these as deferrable.
- **Reversibility**: Medium — priority can be lowered later, but the split-at-creation capture must exist from day one or the data is permanently lost for sessions that already happened.

## DEC-002: Fans are first-class users, not CRM records (2026-07-16)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-16T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate
- **Index**: [[index]]

- **Problem**: Does WeJammin have a fan-facing surface, or are fans objects inside an artist's CRM?
- **Options considered**: (1) B2B-only — fans are records. (2) Fan surface — fans get accounts. (3) Deferred — model the fan properly now, build the surface later (agent recommendation).
- **Decision**: **Option 2 — fans are users.** Fans get accounts, follow artists, receive gig alerts, discover shows. Owner overrode the agent's "deferred" recommendation.
- **Downstream**: (a) Consumer-scale traffic — fans outnumber professionals by orders of magnitude → rewrites the performance budget; (b) a second moderation population with different failure modes → Trust & Safety (24) load; (c) statutory duties that scale with consumer reach (age assurance / children's access, DSA thresholds) → `/create-prd-security`; (d) strengthens the open mobile-surface question — gig alerts are push notifications and show discovery is phone-shaped.
- **Reversibility**: Low — a consumer surface changes the growth model, the compliance posture and the architecture. Hard to unwind once fans exist.

## DEC-003: Structural classification remains `single-surface` despite the fan decision (2026-07-16)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-16T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate
- **Index**: [[index]]

- **Problem**: The sweep's synthesis asserted that a fan audience forces a multi-surface classification. This would have restructured the entire ideation folder tree.
- **Options considered**: (1) Accept the synthesis and reclassify multi-surface. (2) Verify against the kit's own reference first.
- **Decision**: **Verified and rejected the claim.** Per `prd-templates/references/surface-model.md`, a *surface* is a **deployment target** (web/mobile/desktop/cli/api/extension), not an audience. Fans + professionals on one Astro web app = one surface. Classification stays `single-surface`.
- **Downstream**: Folder layout unchanged (domains stay top-level children of `ideation/`, no `surfaces/` folder). Real consequence is an expanded Role Matrix in all 24 domain indexes. The **mobile surface question remains genuinely open** and is now more pressing — see `meta/constraints.md`.
- **Reversibility**: High — but reclassifying later means restructuring the tree, so getting it right pre-seeding mattered.
- **See also**: PAT-001.

## DEC-004: Three separate marketplace domains, not one (2026-07-16)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-16T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate
- **Index**: [[index]]

- **Problem**: Physical gear, digital plugins and human services — one "Marketplace" domain or three?
- **Options considered**: (1) Three domains (agent recommendation). (2) One Marketplace with heavy sub-domains. (3) Two — Goods + Services.
- **Decision**: **Option 1 — three domains** (05 Services, 13 Gear, 14 Digital Goods).
- **Downstream**: Everything genuinely shared (cart, payments, messaging, search, reviews, disputes, tax, shipping) is already a **cross-cut** — the merge would buy nothing. Everything that differs is irreconcilable at schema level: gear is qty=1 non-fungible stock where condition is ~40% of price; digital is licence keys + a format×OS×DAW matrix with refunds that cannot be un-given (colliding with EU withdrawal law); services are scoped human output with briefs and taste disputes. A merge yields a `listing` entity with ~40 nullable columns. `/write-be-spec` must not collapse these.
- **Reversibility**: Medium.

## DEC-005: Commit identity is the business account, set repo-local (2026-07-16)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-16T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate
- **Index**: [[index]]

- **Problem**: No git identity was configured at all (`user.name`/`user.email` unset globally and locally) — any commit would have failed. Repo ownership had moved from `NEVRITERob` to `WeJustJammin`.
- **Options considered**: (1) Business account + GitHub noreply. (2) Business account + real business email. (3) Keep the personal Gmail.
- **Decision**: **Option 1.** `WeJustJammin <305953066+WeJustJammin@users.noreply.github.com>`, set **repo-local** so other projects are unaffected. `WeJustJammin` verified as `type: User`, id `305953066`.
- **Downstream**: Commits attribute to the business. **`gh` transport is still the personal account** — see BLOCKER-001. Open question raised: `WeJustJammin` is a User account, not an Organization — no teams, no scoped repo roles, no runner groups. Converting is cheapest now while the repo is empty.
- **Reversibility**: High.

## DEC-006: Firebase removed entirely from project documents (2026-07-16)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-16T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate
- **Index**: [[index]]

- **Problem**: The predecessor (SoundBytez) ran Next.js + Firebase App Hosting. Initial constraints capture documented the migration as a was/is table.
- **Options considered**: (1) Keep migration context for traceability. (2) Remove — document only the stack in use.
- **Decision**: **Option 2 — removed.** Owner: "that's from an old plan we don't even need that entry in the documents; we are going to move forward with the stack we use."
- **Downstream**: `meta/constraints.md` states only the locked stack (Astro islands, Cloudflare Pages + Workers, Supabase) plus what remains open for `/create-prd` (auth provider, media storage, styling, payments). **Supabase is the only element carried forward from the predecessor** — Firebase Auth, App Hosting and its deploy pipeline have no equivalent and must not be assumed by `/create-prd-stack`.
- **Reversibility**: High.

## DEC-007: 08 Real-Time Jamming is the only genuine domain-merge candidate (2026-07-18)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-18T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate
- **Index**: [[index]]

- **Problem**: Step 6 flagged 101 boundary problems across the 24-domain map. Are any real merge candidates, or is the high cross-domain connectivity (76%) evidence the map is over-split (D-17)?
- **Options considered**: (1) Keep 24 domains — connectivity is structural. (2) Merge the high-tension seams. (3) Case-by-case.
- **Decision**: **Keep 24 domains.** ~85 of 101 boundary problems are legitimate seam-work between near-mirror domains; the universal hubs were lifted into the 25-mechanism cross-cut registry rather than left as domain edges. **Only `08 Real-Time Jamming` → `07 Music Projects` is a genuine merge candidate** (Overdub machinery could dissolve 08 into 07; rejected only narrowly). Escalated to `/create-prd` for explicit keep-or-fold.
- **Downstream**: High-tension seams (17/18 tour object, 17/19 ticket count, 13/15 serial unit, 14/20 delivery, 04/05 demand/supply anchors) get a **named shared owner or an extracted cross-cut**, NOT a merge. `/create-prd` must decide 08's fate before architecture locks.
- **Reversibility**: Medium — merging 08 later is cheaper than splitting a merged domain.

## DEC-008: The identifier-binding seam is an unowned architectural gap (2026-07-18)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-18T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate
- **Index**: [[index]]

- **Problem**: Step 6 surfaced that splits and titles attach to a work in Services (domain 05) — often years before an ISRC/ISWC identifier exists — but Royalties (domain 10) collects against those identifiers. No mechanism or domain owns the step that binds the early split-record to the later identifier.
- **Options considered**: (implicit) leave it to emerge in BE spec vs flag it now.
- **Decision**: **Flag and persist now.** Recorded in `meta/cross-cut-emergent-capabilities.md` and D-27. This is the highest-risk of 52 emergent cross-cuts / 76 emergent features found in Step 6.
- **Downstream**: `/create-prd` and `/write-be-spec` must assign an owner to the binding step; a schema that assumes work↔identifier was always linked will be wrong. Intersects the provenance thesis (D-18) directly — the split captured at creation must survive until the identifier exists to collect against it.
- **Reversibility**: Low if missed (retrofitting the binding after royalty flows exist is expensive); High if handled at architecture time.

## DEC-009: Taxonomy selection and proposals use constrained Config access (2026-07-19)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-19T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: Service taxonomy `05.01.02` marked all personas Read-only while credits taxonomy `02.06` marked the identical select/propose action Config for Musician, Producer, and Operator. The conflict left taxonomy-proposal writes without a platform-wide RBAC contract.
- **Options considered**: (1) Read-only for all personas. (2) Config for Musician, Producer, and Operator; Read-only for Fan. (3) New standalone Propose permission.
- **Decision**: **Option 2.** Musician, Producer, and Operator receive Config solely to select permitted values and submit a missing-value proposal to the curation queue; Fan remains Read-only. No persona can create, promote, deprecate, map, or edit vocabulary — those remain exclusive to the non-persona admin/governance role.
- **Downstream**: Aligns the service and credit taxonomy Role Lenses and parent Role Matrices. A proposal does not block publication and must not be mistaken for vocabulary curation. Resolves ledger `r-09[0]` / queue CQ-01.
- **Reversibility**: Medium — permission changes are structurally reversible before implementation, but every consumer's authorization checks must preserve the select/propose-versus-curate boundary.

## DEC-010: Collusion evidence uses a constrained versioned edge contract (2026-07-19)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-19T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: Credit-dispute resolution needed a defined interface to consume collusion detection without converting statistical topology into an accusation, witness exclusion, or automatic Trust & Safety case.
- **Options considered**: (1) Per-edge negative multiplier only. (2) Per-edge multiplier plus a typed `requiresNonTopologicalCorroboration` constraint. (3) Per-witness trust score plus ring flag.
- **Decision**: **Option 2.** `CollusionEvidenceConstraintV1` contains only `contractVersion`, opaque `attestationEdgeId`, per-edge `negativeMultiplier`, and literal `requiresNonTopologicalCorroboration: true`. Unknown versions are excluded. No raw score, topology signal, cluster/witness identity, trust score, ring flag, hard exclusion, or enforcement recommendation crosses the boundary.
- **Downstream**: `02.05` weights only the referenced attested-evidence edge. The collusion signal cannot itself create or advance a Domain 24 factual-dispute case; separately captured non-topological corroboration is required for any transition that relies on it. Contract persisted in `02.04.04`, `02.05`, the `02.04` index, Credits CX-18, and Domain 24 intake routing. Resolves ledger `r-20[2]` / queue CQ-03.
- **Reversibility**: Medium — a future interface version can add explicitly governed fields, but v1 consumers must reject unknown versions and preserve the prohibition on topology-only action.

## DEC-011: Ownership-ledger ordering uses a portable bytewise party-ID collation (2026-07-19)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-19T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: Domain 09 had already locked the total row key for reproducible Domain 10 cent allocation as `(pool, party-id, role, contribution-basis)`, but left `party-id` collation unresolved across Supabase Postgres, Cloudflare Workers, exports, and replay jobs.
- **Options considered**: (1) Explicit Postgres binary collation. (2) Platform-defined unsigned UTF-8 bytewise comparison of immutable canonical serialized internal party IDs.
- **Decision**: **Option 2.** The platform compares `party-id` as unsigned UTF-8 byte sequences in lexicographic order. Locale, display name, case-folding, Unicode normalization, and database-default behaviour are prohibited. Every runtime uses the same comparator or a persisted equivalent binary sort key.
- **Downstream**: The source-locked four-field tuple now produces the same portable, content-derived allocation order for every consented ledger. Database insertion/retrieval order and `entered-by` remain prohibited inputs; Domain 10 retains sole ownership of cent remainder policy. Resolves ledger `r-34[0]` / queue CQ-05.
- **Reversibility**: Medium — a future comparator must be explicitly versioned and historical ledger allocations must retain this v1 ordering contract for reproducibility.

## DEC-012: V1 feedback contradictions use bounded positional candidates and human flags (2026-07-19)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-19T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: Multi-stakeholder feedback required a practical v1 way to surface contradictions without enabling the platform to judge creative conflicts, introduce undeclared AI processing, or turn ambiguous language into a system verdict.
- **Options considered**: (1) Positional candidates plus manual flags. (2) Model-backed semantic detection. (3) Manual flags only.
- **Decision**: **Option 1.** Sort same-version timestamped comments ascending by offset. Seed each cluster with the earliest unassigned comment and include only later unassigned comments at most 5,000 ms from that seed; a Producer manually flags two or more comment IDs in a positional cluster or song-level bin as a contradiction. No topic extraction, semantic inference, AI request, ranking, recommendation, adjudication, or automatic notification occurs in v1.
- **Downstream**: Producers receive reproducible candidate groupings while retained contradiction flags remain attached to comment IDs through cluster split/merge. Human creative authority stays intact; a later semantic capability requires an explicit privacy, evaluation, and architecture decision. Resolves ledger `r-45[0]` / queue A-01.
- **Reversibility**: High — a later version may add an independently governed semantic detector, but must preserve the v1 no-adjudication boundary and auditable manual flags.

## DEC-013: Reaffirmed 24-domain ideation map after independent recovery audit (2026-07-19)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-19T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: An interrupted workflow required recovery of WeJammin's proposed domain classification before advancing pipeline state. The recovered 24-domain tree already existed in the working tree, so replacement or reseeding without inspection would risk invalidating extensive ideation work.
- **Options considered**: (1) Confirm all 24 domains. (2) Review domain boundaries before confirmation. (3) Confirm map while reducing v1 scope. (4) Replace map.
- **Decision**: **Option 1 — confirm all 24.** The owner reaffirmed the complete map after an independent recovery: 14 lenses swept 1,545 concepts; 24 candidates were synthesized; four fresh audits found no missing required domain, cross-cut, blocker, or major boundary defect. The existing 24-folder fractal tree remains authoritative. Scope is not reduced by domain deletion; existing MoSCoW and release sequencing control v1.
- **Downstream**: `/ideate` proceeds from the already-complete 24-domain tree rather than reseeding it. The recovery proposal is retained as ratified evidence. The current accepted architecture remains Astro islands + Cloudflare Pages/Workers + Supabase; Firebase is excluded. Recorded as ideation D-35.
- **Reversibility**: Medium — individual domain boundaries can be evolved through the decision-propagation process, but replacing the 24-domain structure would cascade through 1,120 ideation files.

## DEC-014: Ratified immutable private-link recipient isolation for review feedback (2026-07-19)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-19T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: `r-51[0]` classified the review-link permission intersection as unresolved despite existing Domain 07 cross-cut and child contracts defining recipient isolation.
- **Options considered**: (1) Ratify the existing asymmetric permission intersection: recipient sees only their own thread and replies. (2) Expose a shared recipient-visible feedback stream. (3) Allow owner-configured per-thread visibility.
- **Decision**: **Option 1.** The owner ratified, without redesign, CX-01, D-13, D-14, and D-10 as authoritative. An unauthenticated/private-link recipient may comment only in their own thread and see replies in it; they see no roster or internal comments, other recipient or their comments, other versions, project content, hidden-comment count, teaser, or hidden affordance. Audience is selected at post time and immutable; scope crossing requires a deliberate, attributed new comment. Link-recipient comments notify the roster, and listen-recording failure never blocks posting.
- **Downstream**: Domain 07 keeps one append-only, version-anchored comment stream with asymmetric recipient visibility. `/create-prd-architecture` must enforce the ratified intersection without adding a separate recipient ACL, mutable audience, or v1 scope expansion. Queue A-02 and ledger `r-51[0]` record the resolved ratification; no source-contract redesign occurred. Recorded as ideation D-36.
- **Reversibility**: Medium — a future, separately specified and authenticated sharing mode may be introduced only through a new decision; v1 isolation and every existing comment's post-time audience remain immutable.

## DEC-015: DAW parsing support is validation-gated before selection (2026-07-20)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-20T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: The capture-at-source thesis depends on DAW session parsing, but proprietary formats, silent parser rot, DAW-specific EULAs, and person-free track names made broad support an unvalidated premise.
- **Options considered**: (1) Validate supported DAWs first and define the person-free fallback. (2) Commit to broad parser coverage immediately. (3) Use manually mapped tracks only.
- **Decision**: **Option 1.** A candidate DAW must pass representative real-session validation and a DAW-specific legal review before WeJammin selects its parser or track-mapping integration. Person-free names retain available track/instrument context but create no contributor guess; the existing Producer prompt asks explicitly. Ambiguity asks, never infers; unsupported or unreadable formats remain non-blocking.
- **Downstream**: `07.09.02` and the DAW bridge index record the validation gate. `/create-prd-architecture` may choose candidates and delivery shape only after validation; it must preserve visible confidence, counter-attestation, parser-health monitoring, and non-blocking ingest. This does not choose DAWs, require a broad parser, or alter the web-only surface classification. Queue A-03 and ledger `r-52[0]` are resolved. Recorded as ideation D-37.
- **Reversibility**: Medium — later support expansion requires the same validation and legal gate; the no-inference and non-blocking boundaries remain required unless superseded through a new decision.

## DEC-016: Rights-aware vault defaults require practitioner validation (2026-07-20)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-20T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: The vault's role × asset-class profiles encode sensitive least-privilege defaults, but their fit with real producer and engineer workflows remained unvalidated.
- **Options considered**: (1) Validate proposed profiles with practitioners, then lock them. (2) Lock the current matrix immediately. (3) Replace defaults with owner-configured access only.
- **Decision**: **Option 1.** The proposed profiles are candidates only until practitioners performing each affected song role validate them and an approved profile version is recorded. Validation may refine grants per sensitivity class; it cannot introduce manual per-asset ACLs, project-wide grants, or an owner-configured-only access model.
- **Downstream**: `07.03.03` and its parent index record the validation gate. `/create-prd-security` defines validation evidence, profile versioning, and enforcement rollout while retaining per-song, role-derived least privilege; first-access NDA evidence; immediate fail-closed revocation; terms-not-grants separation; version-pinned ordinary acceptance; and explained denial. In-product NDA legal enforceability and master-owner precedence remain separate unresolved decisions. Queue A-04 and ledger `r-53[0]` are resolved. Recorded as ideation D-38.
- **Reversibility**: Medium — later default changes require new practitioner validation and profile versioning; existing approved-profile decisions remain auditable.

## DEC-017: Mixed DSP acceptance uses attached rejected-item details (2026-07-20)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-20T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: A DSP may accept some tracks in a release and reject others. The existing `(release × store × territory)` status identity must remain truthful without hiding actionable per-track evidence.
- **Options considered**: (1) Add a track axis to status identity. (2) Retain release-level identity with structured rejected-item detail. (3) Collapse to a release accepted/rejected result.
- **Decision**: **Option 2.** One `(release × store × territory)` row projects `Partial acceptance` while partner evidence is mixed. Each rejected-item detail retains stable affected-item ID, partner and original delivery/message correlation, evidence timestamp and normalized reason, triage/remediation state, and successor-delivery correlation after redelivery. The parent shows accepted/rejected/pending counts and actionable items; it never reports wholly `Accepted` or wholly `Rejected` until full-release evidence supports that claim.
- **Downstream**: `12.03.02`, its parent index, rejection triage, and DDEX cross-cuts record the contract. `/create-prd-architecture` defines persistence/query mechanics but must preserve evidence-labelled status, store-side `Live` truth, discard-not-amend in-flight messages, and rejecting-partner-only redelivery. Queue A-05 and ledger `r-54[1]` are resolved. Recorded as ideation D-39.
- **Reversibility**: Medium — future track-level status rows require an explicit identity migration and parent roll-up contract; historical mixed results retain the v1 attached-detail representation.

## DEC-018: Hold ladders use optimistic version checks and reject-and-reoffer (2026-07-20)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-20T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: Concurrent operators, expiry/release actions, challenges, and confirmation can mutate one ordered hold ladder. Last-write-wins, hidden merges, or locks would either silently demote a live party or block time-sensitive inventory.
- **Options considered**: (1) Optimistic per-ladder version check with reject-and-reoffer. (2) Serialized command queue. (3) Pessimistic edit lock. (4) Last write wins.
- **Decision**: **Option 1.** The owner ratified the existing source contract. Every mutation carries the current bookable-slot ladder version; the server alone assigns dense positions and receipt-time order. A stale version rejects before write, returns the authoritative ladder, and re-offers the intent. No merge, automatic replay, queue-behind, lock, or last-write-wins path exists.
- **Downstream**: Domain 17 source, parent CX, and parent index record the contract. `/create-prd-architecture` supplies compare-and-swap storage, idempotency, durable expiry execution, dual-ladder confirmation boundaries, and notification-outbox mechanics. It must atomically preserve ordering/version, required reorder attribution, audit/notification intent, and terminal semantics: expiry/release promote; withdrawal/date passage/confirmation void; release wins over a simultaneous challenge. Queue DQ-04.06 and ledger `r-78[0]` are resolved. Recorded as ideation D-40.
- **Reversibility**: Medium — implementation substrate may evolve only if it preserves version-conditional stale rejection and the resulting observable ordering/audit contract.

## DEC-019: Public comped-out credits retain transparent qualification (2026-07-20)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-20T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: A session contribution can be real while absent from the delivered master. D-09 retained the credit and outcome qualifier but left the public-discography treatment unresolved, risking either silent erasure or a misleading unqualified public credit.
- **Options considered**: (1) Keep the qualified record owner-only. (2) Render it publicly with a plain-language `not in final master` qualifier. (3) Render it publicly without a qualifier.
- **Decision**: **Option 2.** An otherwise publicly eligible retained credit renders once in its ordinary role family with the plain-language qualifier `not in final master`. Normal publication, per-credit visibility, embargo, and public-work-identity gates take precedence. The owner sees the trigger date; visitors see neither that date, the comp-out reason, nor delivery history. The record and provenance tier remain unchanged.
- **Downstream**: `02.01.01` D-09/Q-05 and `02.01.02` D-15/Q-07 record the contract. Viewer-relative counts include a visible qualified line once and a suppressed line zero times. The public qualifier does not determine ownership, union reporting, rights, registration, royalties, payment, or Domain 10 neighbouring-rights treatment; that registration question remains open. Queue CQ-02 and ledger `r-19[1]` are resolved. Recorded as ideation D-41.
- **Reversibility**: Medium — changing what a public credit means later requires an explicit product decision and matching source/audit migration, but does not require changing the preserved contribution record.

## DEC-020: Suspected-ring demotion changes traversal rank, not presentation (2026-07-20)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-20T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: A suspected attestation ring can silently lower one attestation edge's derived traversal weight, while the prior traversal contract left unresolved whether a still-eligible edge should be hidden, marked, or presented normally.
- **Options considered**: (1) Hide the edge. (2) Mark the edge as suspected. (3) Render the edge normally while silently applying the existing per-edge tier-weight demotion.
- **Decision**: **Option 3.** An otherwise eligible edge follows ordinary publication, viewer-visibility, embargo, provenance-floor, role, query-shape, fan-safety, and normal result-window gates. If returned, its path renders normally while the existing per-attestation-edge-derived demotion affects only ordinary ranking. No collusion-specific threshold, hiding, label, annotation, rationale, tooltip, notification, detector metadata, or unweighted bypass exists.
- **Downstream**: `02.01.03` D-05/Q-03 and `02.04` D-06/CX-03 record this presentation contract. Ring detection stays internal to every persona; CQ-03's constrained evidence interface stays per-edge with no score, flag, identity, hard exclusion, or topology-only escalation. The signal cannot create, advance, adjudicate, or notify a Domain 24 case without separately captured non-topological corroboration. Queue CQ-04 and ledger `r-25[0]` are resolved. Recorded as ideation D-42.
- **Reversibility**: Medium — a change to traversal presentation requires a new product decision and synchronized safety/audit review, but does not alter the underlying credit, detector, or dispute-evidence contract.

## DEC-021: Recorded master majority requires strictly more than half (2026-07-20)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-20T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: The master registry allowed parties to record `majority-by-share` but did not define the exact threshold, leaving a 50/50 ownership split and other consent outcomes ambiguous.
- **Options considered**: (1) Strictly more than 50% of consented ownership share. (2) At least 50%. (3) A higher recorded supermajority such as two-thirds.
- **Decision**: **Option 1.** For an expressly recorded master `majority-by-share` rule, a specific action authorizes only when affirmative **exact nominal master-owner share is strictly greater than 50%** of the full current consented master pool. Exactly 50% fails closed. Shares aggregate by owner stake rather than headcount; points, encumbrances, effective net, display rounding, silence, unreachability, and stale/invalid records cannot create or enlarge approval.
- **Downstream**: `09.01.03` owns the predicate, scope/version binding, Control Summary routing, and concrete tie/rounding/absence examples. `09.01.02` remains authority for exact shares, whole-ledger consent, versions, and states. An absent rule remains unanimous; `any-owner-non-exclusive` remains separate. The rule neither replaces amendment re-consent nor overrides a policy veto, encumbrance, publishing/performer/sample right, release/takedown policy, payout calculation, or Domain 24 case. Queue CQ-06 and ledger `r-35[0]` are resolved. Recorded as ideation D-43.
- **Reversibility**: Medium — threshold changes require an explicit owner decision and action-authorization migration, while established ledger versions and action approval history remain evidence.

## DEC-022: Overlapping mashup work weights require declarant allocation (2026-07-20)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-20T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: A multi-work recording needs exact `Recording→Work` weights totaling 100%, but duration cannot determine allocation when a mashup's embodied works sound simultaneously. A universal duration default would normalize an arbitrary contribution claim into a royalty input.
- **Options considered**: (1) Prorate each work's full overlapping duration, then normalize. (2) Require declarant-entered exact weights totaling 100%. (3) Offer equal shares.
- **Decision**: **Option 2.** For temporal overlap, each embodied work receives a declarant-entered positive exact-rational weight and all weights total exactly 100%. No duration calculation, normalization, equal-share fallback, inferred remainder, or display-rounded validation exists. Duration proration remains an editable proposal only for declared disjoint medley/live-set spans.
- **Downstream**: `09.01.01` owns the link allocation; works remain separate and a mashup still requires independent source-master lineage/sample and embodied-work declarations. `10.03.01` consumes the valid as-of Domain 09 allocation before each separate work ledger and blocks invalid/incomplete allocation rather than inventing or repairing it. The weight declaration is neither ledger consent nor a master-action approval, and it does not decide licensing, release permission, or royalty entitlement beyond this allocation input. Queue CQ-07 and ledger `r-36[0]` are resolved. Recorded as ideation D-44.
- **Reversibility**: Medium — changing the default later requires a new owner decision and calculation-version treatment, while previously declared allocations and their calculation inputs remain historical evidence.

## DEC-023: Unclaimed stubs merge only on exact canonical writer-name sets (2026-07-21)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-21T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: The unclaimed-stub exception prevents duplicate work records from proliferating, but raw-string equality misses harmless presentation differences while fuzzy, identifier, or identity matching risks silently treating distinct people or assertions as the same.
- **Options considered**: (1) Exact stored-string equality. (2) Canonical asserted-text set equality. (3) Legal/stage identity resolution. (4) Fuzzy name similarity.
- **Decision**: **Option 2.** `writer-name-canonical-v1` evaluates each retained asserted writer string with pinned Unicode 15.1 data: NFC → Default Case Folding → trim/collapse Unicode whitespace → NFD/remove marks/NFC. The resulting order-independent sets must be exactly equal. An atomic merge occurs only while both works are distinct current unclaimed, unconsented, conflict-free stubs with no distinct-person or unresolved identity/alias evidence. Canonical text equality never resolves people, aliases, legal/stage identities, accounts, or authorship.
- **Downstream**: `09.01.01` solely owns the predicate, candidate/action split, raw-evidence retention, atomic recheck, lineage, and recording-owner notification. ISWC/ISRC, audio, fuzzy text/title, aliases, and identity signals may nominate candidates but cannot authorize merging. `09.01` CX-01 forbids link movement, ledger reconciliation, or partial mutation when recheck fails. A later incompatible assertion uses `09.04.01` ordinary claim-time detection/notification/dispute routing — no auto-unmerge, auto-case, fund freeze, or identity adjudication. Queue CQ-08 and ledger `r-36[1]` are resolved. Recorded as ideation D-45.
- **Reversibility**: Medium — changing a future canonicalization profile requires explicit versioning and migration review; retained original strings, source IDs, provenance, and merge lineage preserve evidence without asserting an identity conclusion.

## DEC-024: Term and moral-right status is bounded to four v1 jurisdictions (2026-07-21)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-21T12:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: Copyright term/public-domain and moral-right status vary by territory, but the product lacked a v1 coverage boundary for term rules, death-date facts, moral-right applicability, and waiver treatment. A global answer would falsely imply complete legal coverage; US-only would omit the central non-waivable/waiver distinctions the rights model already identifies.
- **Options considered**: (1) United States only. (2) United States plus France, Germany, and the United Kingdom. (3) Global per-territory status wherever evidence exists.
- **Decision**: **Option 2.** V1 supports determinate status only for `US`, `FR`, `DE`, and `GB`. A result requires source-attributed applicable-rule and required facts: work/category/authorship and death/publication/creation facts for term; author/estate standing plus transfer/waiver facts for moral rights. Every other territory or missing/insufficient fact is explicitly `unknown` / not determined. Territory remains an explicit model dimension, never a global boolean.
- **Downstream**: `09.03.05` owns source-backed term/public-domain status; `09.03.06` owns jurisdiction-scoped moral-right applicability/waivability; `09.03.04` remains authority for estate/death facts. Economic transfers never transfer moral rights. FR/DE non-waivability, GB waiver treatment, and US music non-applicability stay jurisdiction-scoped. No output is legal advice, clearance, licence, ownership adjudication, or release authorization; Domain 11 licensing and Domain 12 release gates remain independent. Queue CQ-09 and ledger `r-40[0]` are resolved. Recorded as ideation D-46.
- **Reversibility**: Medium — adding jurisdictions requires an explicit owner decision plus jurisdiction-specific rule/evidence validation. Historical results retain their jurisdiction, inputs, sources, and rule version; the four-jurisdiction boundary prevents a silent global expansion.

## DEC-025: Production-stage vocabulary is validation-gated before approval (2026-07-21)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-21T13:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: The existing production-stage labels are credible candidate evidence but unvalidated for recurring beatmaker delivery and contribution-centric session-player workflows. Hardening labels early could misplace Songs, fire provenance prompts at incorrect moments, or make release readiness depend on an unfit terminal stage.
- **Options considered**: (1) Lock the current ten-stage draft. (2) Practitioner-validate one shared fixed vocabulary, then have the product owner approve a version. (3) Split vocabulary by production model.
- **Decision**: **Option 2.** One platform-owned, fixed, music-specific vocabulary remains the sole permissible stage model. A candidate becomes enforceable only after two eligible beatmakers and two eligible session players map the required redacted workflow traces, every mismatch has a disposition, no critical mismatch or split-state-machine request remains, the gate passes, and the product owner explicitly approves one immutable enum version with its initial semantic, approved-master terminal semantic, and non-blocking prompt mappings.
- **Downstream**: `Song.current_stage` remains authoritative and the board remains its projection. Until approval, labels, order, initial state, terminal stage, prompt mappings, release predicate, reporting, and migration stay provisional. Validation may refine a candidate but cannot introduce user-configurable columns, production-model enums, a second machine, or unnormalised exceptions. Queue P-01 and ledger `r-44[0]` — see DEC-047 for the close. Recorded as ideation D-47.
- **Reversibility**: Medium — a future vocabulary requires a separately validated immutable version and migration plan; no unapproved candidate silently becomes historical contract.

## DEC-026: Large catalogues get a dense table, never a second lifecycle (2026-07-21)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-21T13:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: The production board had no defined behavior for a project or label catalogue at scale. A kanban of hundreds of cards stops being scannable, but a second view risks forking `Song.current_stage`, duplicating a Song per Release membership, or introducing bulk writes that bypass per-Song capture and authorization.
- **Options considered**: (1) Paginated board only. (2) Board below a threshold, dense catalogue table above it. (3) Exclude large catalogues from the feature.
- **Decision**: **Option 2, with a `60`-Song boundary.** Count unique visible authorized Songs in the selected scope **before** local search, sort, or table-only filters: `0–59` renders the craft board, `60+` renders the dense catalogue table. Selection is automatic — no v1 user override, saved preference, or URL mode. A local filter never switches a large scope back to board. A Song on several Releases counts once; sequence, selected master, and release-specific edits stay on the membership edge.
- **Downstream**: Both views are projections of the same `Song.current_stage` and a table row action invokes the identical per-Song authorized transition — same optimistic rollback, non-blocking capture prompt, dismissal completeness debt, roster notification, last-write-wins attributed notice, and derived readiness recomputation for every linked Release. V1 has **no bulk stage transition**; the table adds no configurable columns, per-card assignee, table-owned stage, or Release-local state. Pagination/cursor shape, page size, ordering, responsive behavior, and cache semantics are deferred to `/write-be-spec` and `/write-fe-spec`. Queue P-02 and ledger `r-44[1]` are resolved. Recorded as ideation D-48.
- **Reversibility**: High — the threshold is presentation policy over an unchanged state model, so a later value or an added manual override needs no data migration.

## DEC-027: Superseded approvals reinstate on version identity, never on judgement (2026-07-21)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-21T13:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: A backward stage transition marks later-stage approvals superseded. Nothing defined what happens when the song re-advances to that gate. Re-collecting every time punishes a mis-drag; auto-reviving would present an approval nobody gave for the current artifact.
- **Options considered**: (1) Always re-collect. (2) Auto-revive superseded approvals. (3) Re-collect only after a material change — either as a semantic judgement or as version identity.
- **Decision**: **Option 3, read as version identity.** Superseded approvals reinstate on re-advance **iff no new immutable version landed on the song in between**; any intervening version means the gate re-collects against its **current** approver set. The predicate is the append-only version timeline (`07.04.01` D-01 immutability, D-08 ingest order). The platform never asks a human whether a change was "material" and never certifies that nothing changed (`07.04.01` D-12).
- **Downstream**: `07.05.04` D-07 owns the rule; the `Reinstated` state and re-advance edge cases live there. The new-version branch is not a new rule — `07.05.04` D-01 already prevents an approval from transferring to a later version, so only the byte-identical administrative-reversion case needed deciding. Supersession and reinstatement are both **appended** events, preserving D-04's append-only trail and D-03's pinned comment state; nothing is retracted or rewritten. Already-pinned approvals are never rewritten when the approver set changes, and a departed approver still stalls the gate. The rule is presentation-agnostic across the P-02 board/table split, and Release re-readiness recomputes from the resulting stage without its own re-approval rule. Rejecting the semantic reading also avoids minting a third project-wide materiality definition alongside `07.03.03` D-07 and `02.04.01` D-10. Queue P-03 and ledger `r-44[2]` are resolved. Recorded as ideation D-49.
- **Reversibility**: Medium — a later semantic-materiality model would need its own classifier, judge, appeal path, and reconciliation with the two existing materiality definitions; historical supersede/reinstate events remain valid evidence either way.

## DEC-028: A handoff spec is authored where owned and referenced where not (2026-07-21)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-21T13:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: `07.08.01` advertises six recipient specs — mastering, mix, sync, live, remix, archive — but only two have real contents on disk. Authoring all six would have the handoff builder originate requirements that domains 11, 12 and 05 already own, and invent `live` from no source at all.
- **Options considered**: (1) Define all six now. (2) Define the highest-frequency two first, others as follow-ons. (3) Ship a generic package with optional fields.
- **Decision**: **Option 2, re-cut on authority rather than frequency.** `07.08.01` originates `mastering`, `mix`, and `archive`'s asset half — the specs it provably owns per `07.08.03` Q-02. It **references** every spec owned elsewhere: `sync` → domain 11, DSP destination → domain 12, engagement-purchased handover → `05.04.02`/`05.04.04`. Referencing validates presence and surfaces the owner's verdict; it never restates the requirement. `live` and `remix` get no invented contents and become an ownership question.
- **Downstream**: Generalises `07.07.03` D-04 ("two copies of third-party requirements would drift, and one would be wrong") from destination specs to all referenced requirements. Preserves D-01 (specs are the product, not config) and D-02 (a spec is a least-privilege boundary — the mastering spec excludes stems *because the engineer should not have them*), both of which option 3 would have deleted. Severity is explicit: every requirement warns; integrity failure remains the sub-domain's only hard stop under domain D-04's "non-blocking is absolute". Also repaired a pre-existing contradiction where the no-canonical edge case asserted a second block citing a source that says the opposite. The Empty state now advertises only specs with contents behind them. Queue P-04 and ledger `r-46[0]` are resolved; `07.08.01` Q-01 is partly resolved and Q-04 opened for `live`/`remix` ownership. Recorded as ideation D-50.
- **Reversibility**: High for the set (adding a spec once a domain owns it is additive); Low for the ownership rule, which is now load-bearing across domains 05, 07, 11 and 12.

## DEC-029: Readiness targets follow the same ownership rule, and pin-vs-live is dissolved (2026-07-21)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-21T13:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: The readiness score computes against four targets — mix-handoff, mastering, DSP-release, sync-pitch — but no file enumerated any target's facts or thresholds. Separately, the score needed a *live* target while the handoff package *pins* its contents, which looked like two lifetimes on one object.
- **Options considered**: (1) Define every target fact now. (2) Evaluate externally owned specs only, deferring targets whose specs don't exist. (3) A generic score independent of target.
- **Decision**: **Option 2, re-cut per target on authority.** This is DEC-028's rule applied again: the score's targets and the handoff builder's recipient specs are one list under two names. `07.08.01` authors mastering and mix-handoff; DSP-release references domain 12 and sync-pitch references domain 11, consuming their severity classes as this feature's weights rather than re-deriving them. An unowned target is **not offerable**. "Block shipping" is recorded as **feature sequencing, never user-blocking** — the latter would breach domain D-04's absolute non-blocking rule and contradict DEC-028's own handling of the identical condition.
- **Downstream**: `07.08.03` D-07 records the ownership rule and D-08 dissolves pin-vs-live — one target-spec store with one version identity, the score a live **view**, the package a pinned **record** that now also pins the spec version it validated against. Domain 12 resolved the identical shape this way (`12.02.02` D-01, `12.01.02` D-07/DT-09); 07 does not inherit 12's authority to hold dispatch. Only `ready-for-DSP-release` is fully scoreable today. A set mismatch is recorded rather than hidden: eight recipient specs, four targets. Option 3 was foreclosed, not weighed — `07.08.03` DT-01 rejects a target-independent score "twice over". Also corrected a mis-routing: ISWC is `09.06.01`'s (captured, never issued), not domain 12's. Queue P-05 and ledger `r-47[0]` are resolved; whether readiness ever hard-blocks remains separately open. Recorded as ideation D-51.
- **Reversibility**: High per target (each becomes scoreable as its owner publishes); Medium for the store-and-version model, which now underpins both the score and every pinned package.

## DEC-030: A mis-typed source declaration is flagged, never reclassified (2026-07-21)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-21T13:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: A contributor may declare a "preset" that is really a full melodic loop — a different clearance obligation. The line is genuinely blurry and, as the source notes, the user will not know it either.
- **Options considered**: (1) Reclassify as a library-loop class and route to clearance review. (2) Keep the declared class and flag it. (3) Reject until resubmitted.
- **Decision**: **Option 2.** The declaration stands as made. A disputed type uses the existing attributed type-conflict path where both types are kept and surfaced, never auto-merged. Mitigation moves upstream: the capture prompt asks enumeratively — loop, one-shot, drum hit, vocal, break, stem, bought beat — so ambiguity surfaces at declaration time rather than hiding behind a bare "preset". Recorded as `07.08.04` D-08.
- **Downstream**: Reclassifying would have breached `07.08.04` D-03 (07 owns capture; 09/11 own clearance), the P-04/P-05 originate-vs-reference rule (the type axes belong to domain 14, the clearance consequence to `11.05.01`), and domain D-05 ("measure and show; never judge") — and would have required a detector that four separate decisions reject, "the honest posture is declaration, not detection". Rejection was foreclosed by domain D-04, which names "the capture prompt never blocks" as an enumerated instance, and is self-defeating: a rejected declaration reverts the region to `sources not reviewed`, destroying the fact it demanded. Queue P-06 and ledger `r-48[0]` are resolved. Recorded as ideation D-52.
- **Reversibility**: High — the enumerated prompt vocabulary can be extended without changing the no-adjudication rule, which is the load-bearing part.

## DEC-031: Vault re-gating fires only on an owner-declared material change (2026-07-21)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-21T13:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: When access terms are re-versioned, it was unclear which existing holders must acknowledge the new version. Blanket re-gating interrupts live work; never re-gating leaves people operating under terms they never accepted.
- **Options considered**: (1) Re-gate every current holder. (2) Re-gate only on an owner-flagged material change. (3) Never re-gate.
- **Decision**: **Option 2 — confirming `07.03.03` D-07 at owner level rather than inventing policy.** Existing holders are not re-gated by default and acceptance records stay version-pinned; only an owner-flagged material change re-gates, at the holder's next access and never mid-transfer. Denial stays explained.
- **Downstream**: Materiality is **owner-declared, never platform-detected** — the owner authored the change, so the correct party judges. This is why it does not repeat the semantic reading DEC-027 rejected, where the only available judge was the wrong party, and it reuses D-07's existing definition rather than minting a fourth materiality concept. Option 1 was a recorded reversal: `07.03.03` DT-04 already rejected blanket re-gating for interrupting live work and training users to click through gates. The finding's real defect was a stale `[PENDING]` marker in the parent CX file contradicting its own resolved child. **The vault's fail-closed revocation is a locked security property and is not touched** — domain D-04's absolute non-blocking rule governs creative surfaces and enumerates no vault entry. Queue P-07a and ledger `r-50[0]` are resolved; what the flag records became `07.03.03` Q-05. Recorded as ideation D-53.
- **Reversibility**: Medium — the acceptance-record model is version-pinned and immutable, so changing the trigger later does not invalidate existing evidence.

## DEC-032: An access downgrade notifies the affected person and the roster (2026-07-21)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-21T13:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: A downgrade already notified the affected person, but no rule said whether anyone else is told. The queue's standing recommendation was to tell only the affected party.
- **Options considered**: (1) Affected contributor only. (2) Affected person plus the roster. (3) Only when they encounter denial.
- **Decision**: **Option 2, scoped.** A downgrade is an instance of D-09 ("every roster write is announced — to the named party, and to the existing roster"), not an exception to it. The roster audience is scoped by D-16 to members who can already see that person's entry, so a confidentiality-restricted roster discloses nothing it deliberately hides. Recorded as `07.03.01` D-18.
- **Downstream**: **This reversed the queue's own prior recommendation on evidence** — its "sensitive demotion" premise has no source anywhere in the tree, and D-16 makes personnel default-visible. The coordination argument decides it: work is *rostered*, not assigned, so the roster is the team's only coordination record, and `07.03.03` D-04 has already killed the downgraded party's live URLs — under option 1 co-contributors keep routing stems to someone whose access is dead. Option 3 contradicts written `[DEEP]` behavior and locked copy, and makes the first notice a mid-work lockout. Audience only: cadence and batching stay with the notification cross-cut per the reference-never-restate rule. Queue P-07b and ledger `r-50[1]` are resolved; actorless band-derived downgrades became `07.03.01` Q-05. Recorded as ideation D-54.
- **Reversibility**: High — audience is a fan-out rule over an unchanged access model.

## DEC-033: Originality aggregates into a nominal enum for comp matching (2026-07-21)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-21T14:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: The gear comp key is locked as `model × condition × originality` in four places, but nothing defined what fills the originality slot — only a per-component vector existed.
- **Options considered**: (1) Derive an enumerated aggregate. (2) Component vector only. (3) Seller-entered label.
- **Decision**: **Option 1, constrained to a nominal enum.** `13.02.03` D-05 derives an enumerated aggregate from the component vector — explicitly unordered, because D-04 locks originality as "a factual axis, not a quality scale" (a mod raises studio-gear value and lowers vintage value). It partitions comp sets; it never ranks units.
- **Downstream**: Authored on the owning axis and consumed by `13.04.01`, per the reference-never-restate rule; a value derived inside matching logic would be the forbidden second copy. The component vector is untouched. Option 2 contradicts the locked comp key and leaves nearly every bucket at n≤1 across 3ⁿ cells, forcing constant disclosed widening; option 3 makes the comp key manipulable by the incentivised party. Derivation inputs, the Unknown mapping, a completeness predicate and enum versioning are `13.02.03` Q-03/Q-04. Queue P-08a and ledger `r-56[0]` are resolved. Recorded as ideation D-55.
- **Reversibility**: Medium — the enum's definitions and mapping must be versioned, since a copy edit corrupts a price time series invisibly.

## DEC-034: An originality change voids a live offer in either direction (2026-07-21)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-21T14:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: A seller can edit an originality disclosure while an offer is live. Nothing said whether the offer survives.
- **Options considered**: (1) Void on downgrade, preserve on upgrade. (2) Preserve all with a notice. (3) Void on any change.
- **Decision**: **Option 3.** `13.02.03` D-06: any originality change voids the live offer, versioned and disclosed. `13.03.02` principle 3 already voids an offer on any material change to the stated listing.
- **Downstream**: Option 1 was unratifiable as worded — "downgrade" presumes an ordering DEC-033 just declined to create, and its "evidence worsens" rationale has no substrate since this axis mandates no photos. Option 2 contradicts principle 3 and would make originality weaker than the post-purchase case. Option 3 needs neither an ordering nor a materiality definition, so it is the only option with zero invention. Per `13.02.02` D-04/D-11 it is framed as seller-protection with a re-offer path, so late honest disclosure is not punished. The offer's missing disclosure-version pin is routed to `/write-be-spec`. Queue P-08b and ledger `r-56[1]` are resolved. Recorded as ideation D-56.
- **Reversibility**: High — a narrower trigger can replace it once an ordering or evidence substrate exists.

## DEC-035: Local-pickup settlement is a per-listing seller choice (2026-07-21)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-21T14:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: Whether money moves through the platform on a local pickup was called the most consequential open question in its file — it determines fee revenue, escrow protection, and whether the ownership chain has a hole at a common transaction shape.
- **Options considered**: (1) Platform-settled always. (2) Off-platform always. (3) Seller chooses per listing.
- **Decision**: **Option 3.** `13.11` D-04 confirms what the tree already implements: a per-listing pickup boolean, a ship/pickup/both selector, and four downstream files already branching on where money moved.
- **Downstream**: A global settled rule would impose marketplace-facilitator sales-tax and 1099-K duties on every cash handshake plus custody and refund liability; a global off-platform rule would strand escrow, evidence and ownership-chain machinery already specified. **The chain follows the money**: settled writes the transfer at settlement, off-platform uses the manual handshake `15.01.03` D-01 already names as the fallback for off-platform trade. Two sources currently disagree about whether an off-platform chain entry is possible; that conflict is recorded as `13.11` Q-04 rather than silently resolved, with settled-branch residuals as Q-05. Queue P-09 and ledger `r-59[0]` are resolved. Recorded as ideation D-57.
- **Reversibility**: High — the branch is per listing, so policy can narrow later without migrating existing sales.

## DEC-036: A rights takedown preserves the holder record; a revision appends (2026-07-21)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-21T14:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: Two adjacent questions — what a rights takedown does to existing holders, and what an ordinary revision does. Both risked collapsing into one lifecycle path.
- **Options considered**: For takedown — preserve record + notice, treat as revision, or remove record. For revision — append + archive + notify, replace in place, or require repurchase.
- **Decision**: **Preserve for takedown; append for revision** — two paths, never one. `14.03.02` D-04 states both, joining `14.09.03` D-02/D-04, `14.04.01` D-08/D-09, and `14.03.02`'s own D-01/D-02.
- **Downstream**: Both were confirmations: `14.04.01` already carries the heading "Removal is not deletion, and a rights takedown is not a revision", and permanent fetchability was already locked. Treating a takedown as a revision would reuse a path that does not exist singly; removing the holder record contradicts at least seven locked decisions and leaves counter-notice put-back undefined; replace-in-place contradicts five; repurchase-per-revision contradicts "updates are offered" plus the displayed version range. Archive-fetch posture after a takedown and takedown granularity are `14.03.02` Q-04; retention cost/duration remains Q-01. Queue P-10a/P-10b and ledger `r-62[0]`/`r-62[1]` are resolved. Recorded as ideation D-58.
- **Reversibility**: Low for the two-path separation, which is now load-bearing across delivery, catalogue and refunds; High for retention parameters.

## DEC-037: A departed contributor's confirmed split row survives unchanged (2026-07-21)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-21T14:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: What happens to a confirmed contributor's share when they leave or are erased — asked as a question about an *accruing* balance.
- **Options considered**: (1) Escrow for future claim. (2) Redistribute among remaining. (3) Forfeit to seller/platform.
- **Decision**: **Resolved as scoped.** `14.10.03` D-05: the confirmed split row survives unchanged — never zeroed, redistributed, or forfeited. **The accruing premise is out of scope**: pool funding and download attribution/accrual are both WONT, and the splits feature is explicitly decoupled from the pool, so no accrual exists to escrow.
- **Downstream**: Both alternatives were already foreclosed elsewhere — `09.02.04` D-14 makes a 0% row the removal-without-consent loophole, and `10.04.03` D-01 with `royalties-collections-index.md` D-09 forbid unpayable money becoming platform float or revenue. No escrow contract was created, because the premise requiring one is cut. GDPR erasure versus payout retention is `14.10.03` Q-04, a security question. **If the WONT features are ever promoted, the accruing half returns.** Queue P-11 and ledger `r-63[0]` are resolved. Recorded as ideation D-59.
- **Reversibility**: High — the split row is unchanged, so any future accrual model attaches to it without migration.

## DEC-038: A host-update break is an external change — flag, disclose, never revoke (2026-07-21)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-21T14:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: When a host update breaks a purchased preset bank, nothing said who owes remediation.
- **Options considered**: (1) External compatibility, flag the entry, no default refund. (2) Vendor conformity defect. (3) Platform goodwill remedy.
- **Decision**: **Option 1.** `14.04.02` D-04 ratifies into the preset catalogue the pattern already locked at `14.07.01` D-04 ("'perpetual' is a promise about the entitlement and the artifact, not a guarantee of function") and D-06 (third-party state change → permit + mandatory disclosure + never revoke).
- **Downstream**: Gives OS drift, lapsed dependencies and host breaks one consistent story instead of three. Vendor-defect classification would assign liability for a third party's act against supply-time conformity scope; a goodwill remedy creates discretionary cost with no source-defined trigger on a low-value product. **What triggers the flag is undecided** (`14.04.02` Q-04): the compatibility matrix records *declared* host-version facts, not observed breakage, so only a buyer-reported path exists today, and asserting a break without evidence would be the platform judging a third party's product. Queue P-12 and ledger `r-64[0]` are resolved. Recorded as ideation D-60.
- **Reversibility**: High — a detection mechanism can be added later without changing who owes what.

## DEC-039: Several queue entries were mis-framed, and the ratifications correct them (2026-07-21)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-21T14:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: Across the marketplace block, four entries asked the owner to choose among options for questions that were already answered, mis-cited, or built on a cut premise — a pattern first seen in Domain 07's stale CX markers.
- **Options considered**: Ratify as framed, or correct the framing and record why.
- **Decision**: **Correct and record.** P-10a/P-10b were confirmations of contracts already locked in files the entries never cited; P-11's premise depends on two WONT features; P-08a cited the wrong CX (a flaw/evidence cross-cut, not the comp key) and the wrong sibling decision (P-08b's offer-void asymmetry); the P-08a interim rule suspended a locked comp key rather than describing the status quo.
- **Downstream**: Each ratification names the defect it corrects, so the queue stops teaching a false open/closed state. Reinforces the standing check: verify a queue recommendation's *premise* exists in the tree, and read the child before treating a parent marker as open. Adjacent stale markers found but deliberately not folded in (grade auto-downgrade, post-purchase disclosure change, `14.04.02` Q-03 against `14.09.02` DT-05) are recorded as separate reconciliations.
- **Reversibility**: N/A — this is a record-keeping correction, not a product policy.

## DEC-040: The bulk-import quality bar does not bend — the evidence moment moves (2026-07-21)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-21T15:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: Bulk gear import appeared to force a choice between relaxing the quality bar and failing the Operator persona. The queue collapsed four independently-locked axes into one scalar.
- **Options considered**: (1) Keep the normal per-unit bar, no publish until complete. (2) Allow disclosed lower-evidence bulk publication. (3) Restrict to specified seller classes.
- **Decision**: **Per-axis confirmation — the dilemma was false.** Model binding does not relax (bulk *raises* it); grading relaxes in a bounded, disclosed way with reduced comp weight and never an exemption; disclosure does not relax and admits no substitute; unit media does not relax but its capture moment moves to label print. In one line: the bar does not bend, the evidence moment moves, absence is disclosed and never gated.
- **Downstream**: A scalar answer would have silently overwritten at least one axis and, per `13.03` CX-03, created the prohibited shadow listing tier. Option 2's wording ("lower-evidence", "two-tier") reversed the meaning of the decisions it claimed to confirm, and two of its stated costs were inventions — no "trust weight" exists anywhere, and "unit handling" is not a state or event. Also repaired the false-dilemma prose surviving in `gear-marketplace-index.md` Q-13 and `13.03-listings-inventory-cx.md` — the unapplied half of this finding's own prescribed fix. Queue DQ-MG-01 and ledger `r-57[0]` are resolved. Recorded as ideation D-61.
- **Reversibility**: Medium per axis; the four are independently adjustable, which is the point of refusing the scalar.

## DEC-041: Stolen-serial review consumes domain 24's severity, and authors none (2026-07-21)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-21T15:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: A false-positive stolen-serial hit blocks an innocent seller, and the source promised only a "fast human resolution path" — unmeasurable.
- **Options considered**: (1) Expedited SLA with mandatory updates. (2) Standard severity with escalation on evidence of imminent sale or hardship. (3) Provisional release after a short window.
- **Decision**: **Option 2 with its escalation clause struck.** The listing stays held, never deleted, and neither party is accused. Severity, SLA and escalation are consumed from `24.01.03`, which owns routing skill, severity and clock; domain 13 authors no number of its own.
- **Downstream**: The seller's substantive remedy already exists as the locked `reported → contested` dispute path in `15.02.04` — a dispute lane, not a support queue. The struck clause was the only inventive part: no source defines how the platform would observe "imminent sale or hardship", and doing so would mean adjudicating a fact nobody has. Option 1 would author a severity domain 24 owns; option 3 contradicts hold-not-delete. Queue DQ-MG-02 and ledger `r-58[0]` are resolved. Recorded as ideation D-62.
- **Reversibility**: High — severity is consumed, so a change in domain 24 propagates without a decision here.

## DEC-042: Approval-required licence transfers freeze on vendor exit (2026-07-21)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-21T15:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: When a vendor exits, transfers their policy required them to approve have no approver.
- **Options considered**: (1) Platform substitutes for the vendor. (2) Auto-approve where recorded terms contain objective eligibility rules. (3) Freeze.
- **Decision**: **Option 3, recorded as resolved-as-scoped** — the same disposition shape as DEC-037. The platform never substitutes its judgement for a departed vendor's discretionary approval and never invents consent; the freeze is what the locked exit behaviour already produces once no approver exists.
- **Downstream**: Option 2 would commission a mechanism that does not exist — `14.06.01` stores a policy, not an evaluator, with no criteria slot, no evaluator and no appeal path. Two stale `[PENDING]` markers repaired, and the entry's miscitation of `14.03.03` D-03 (a stale-cache rule, unrelated) noted. **Recorded friction:** `14.02.05` D-09 promises tombstoned terms "remain in force", so one clause is permanently inoperative while displayed as active. Queue DQ-MG-03 and ledger `r-65[0]` are resolved. Recorded as ideation D-63.
- **Reversibility**: High — if the transfer machinery is promoted from its current scope, options 1 and 2 return as live.

## DEC-043: Theft-report standing binds to enumerated custody states (2026-07-21)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-21T15:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: Who may file a theft report when ownership and physical custody differ.
- **Options considered**: (1) Owner or documented holder/custodian. (2) Legal owner only. (3) Any witness, provisionally.
- **Decision**: **Option 1, amended.** The owner **or** a party in a custody state `15.08` already enumerates may file, with filing capacity recorded; a second filer joins the existing flag; the platform still never adjudicates title.
- **Downstream**: The word "documented" was deliberately not adopted — it is a custody-evidence threshold no source defines and maps to none of the six enumerated states, so the option as literally worded resolved its own motivating loan/consignment case to "nobody may file". Option 2 is foreclosed by `15.02.01` DT-02, which explicitly rejects the owner as the natural trigger — the deeper node answered its parent in the opposite direction. Option 3 invents a seventh state outside the locked set. Standing under `stale` and `disputed` custody remains open. Queue DQ-MG-04 and ledger `r-69[0]` are resolved. Recorded as ideation D-64.
- **Reversibility**: High — standing is a predicate over states that already exist.

## DEC-044: Identity-confidence and collision rules move to the file that owns them (2026-07-21)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-21T15:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: Two gear-registry questions — which identity-confidence vocabulary is canonical, and what happens when two records resolve to one identity key.
- **Options considered**: For vocabulary — adopt the render set, a smaller set, or a richer evidence-derived set. For collisions — never auto-merge, first-minted-wins, or threshold auto-merge.
- **Decision**: **Re-cut both as authority decisions.** `15.01.05` D-03 authors the canonical confidence set (the six values already in use) and `15.01.01` renders without defining its own. `15.01.05` D-04: colliding records **never auto-merge** — both retained, both claim-holders notified, merge only on mutual consent.
- **Downstream**: The queue's vocabulary recommendation was circular — its premise described the option it rejected. Collapsing the set risks contradicting D-01 ("a WJ-ID is never presented as equivalent to a serial"); the richer set was three orthogonal fields wearing one enum's clothes. The collision answer follows DEC-023's CQ-08 precedent: nothing probabilistic merges records asserting independent provenance. The entry's interim rule described the wrong mechanism — CX-01 **blocks the mint pending disambiguation**, it does not fork. Queue DQ-MG-05/06 and ledger `r-70[0]`/`r-71[0]` are resolved. Recorded as ideation D-65.
- **Reversibility**: Medium — relocating an enum is cheap now because no downstream literal binds to it.

## DEC-045: Unclaimed-record suggestions auto-apply by field class (2026-07-21)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-21T15:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: What happens to a community suggestion on an unclaimed venue or studio record — the majority case at launch.
- **Options considered**: (1) Auto-apply all eligible edits. (2) Queue everything. (3) Auto-apply by field class, queue the rest.
- **Decision**: **Option 3.** Factual classes apply immediately with community provenance retained; higher-stakes classes queue; commercial fields stay Operator-only. The classification already exists — `16.01.01` defines Statutory / Anchor / Fact / Commercial / Structural with "who writes" and "beats" per class.
- **Downstream**: Mirrors `13.01.02`'s ratified posture that automation may propose but never dispose. Option 1 gives consequential facts no protection; option 2 leaves the unclaimed majority stale, defeating community correction exactly when the registry needs it. The entry's "requires field classification" con was stale, and it cited the wrong question (the ignored-suggestion timeout, a claimed-record concern) rather than the load-bearing one. Class cut line and freshness effects are `16.05.03` Q-05. Queue DQ-MG-07 and ledger `r-72[0]` are resolved. Recorded as ideation D-66.
- **Reversibility**: High — the cut line moves within an existing class model.

## DEC-046: The live-booking block resolves by consuming rules its own files already point to (2026-07-21)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-21T15:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: Six live-booking questions — soft-hold availability, default offer approval, offer expiry mid-approval, reconciliation conflict, verified-draw count, and gig-alert eligibility.
- **Options considered**: The canonical option sets for each; several proved unratifiable as worded.
- **Decision**: **Soft holds** — the date stays available with an aggregate hold state, never identities, scoped to the parties the ladder already exposes it to (`17.01.02` D-14). **Offer approval** — consume domain 01's governance model; with no rule configured, no offer is approved (`17.02.03` D-07). **Expiry** — the offer expires with no implicit grace; an extension is explicit, pre-expiry, by the offering side, as a new version (D-08). **Reconciliation** — the count stays provisional and undisputed portions settle (`17.09.02` D-16). **Draw** — `scanned_paid` is the verified draw, confirming D-08's three-count model. **Alerts** — announced first-party shows at on-sale (`20.06.02` D-09).
- **Downstream**: Four were confirmations of locked source. Two entries were bound to the wrong finding: `r-76[0]` actually holds the verified-draw question, and `r-79[0]` actually holds an alert-radius contradiction (25 mi vs 80 km, neither file citing the other) now carried as `20.06.02` Q-04. One was misrouted — the band governance rule belongs to domain 01, which already defines unanimity / majority / any-one-member. Third-party alerts were rejected mechanically: no external listing produces an on-sale instant the platform can observe. Ledger `r-74[0]`, `r-75[0]`, `r-75[1]`, `r-76[0]`, `r-77[0]`, `r-79[0]` are resolved. Recorded as ideation D-67.
- **Reversibility**: High for the confirmations; Medium for the domain-01 consumption, which is now load-bearing across 01 and 17.

## DEC-047: P-01 closes on its policy; validation evidence is implementation work (2026-07-22)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-22T15:00:00.000Z
- **Agents**: claude
- **Sources**: ideate-validate
- **Index**: [[index]]

- **Problem**: `r-44[0]` was the last open ledger identity. Its policy was ratified on 2026-07-21, but the validation packet's practitioner trace register was empty — and the evidence it requires (redacted workflow traces from two beatmakers and two session players) cannot be authored from inside the repository without fabricating research.
- **Options considered**: (1) Close the finding on the decided policy, tracking evidence collection downstream. (2) Hold the finding open until four practitioners have been interviewed and an enum approved. (3) Reverse to Option A and lock the unvalidated ten-stage draft now.
- **Decision**: **Option 1.** The finding's text was "exact stage vocabulary still explicitly owner-open", and it is no longer open: the model, the gate, its cohort minima, its pass conditions and the owner-approval requirement are all decided and propagated. Candidate labels remain non-enforceable **because the gate is in force**, not because a decision is pending.
- **Downstream**: Matches the disposition already applied to **A-03** (DAW parsing) and **A-04** (vault profiles), both of which closed on their validation gate rather than on their evidence — consistent precedent, not a new leniency. Option 3 was rejected because it discards the reason Option B was chosen: the draft is explicitly unvalidated for beatmakers and session players. Fabricating traces was never available — the packet's only purpose is to prove the vocabulary was tested against reality, so inventing its contents would destroy the artifact it is meant to be. `Song.current_stage` keeps its semantic roles, no draft label is a downstream contract, and the packet remains the authority for when an enum becomes enforceable. **The ledger now reads 107/107 `verified-fixed`.** Recorded as ideation D-68.
- **Reversibility**: High — if validation fails or the owner rejects every candidate, the packet records the failure and the next iteration; nothing downstream hardened in the meantime.

## DEC-048: All 57 blocking sub-decisions ratified and propagated to source (2026-07-23)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-23T03:00:00.000Z
- **Agents**: claude
- **Sources**: audit-ambiguity
- **Index**: [[index]]

- **Problem**: A fresh full ambiguity audit of all 1,121 ideation documents confirmed 20 blocking findings — contradictions where two ratified specs give an implementer opposite instructions. Each had to be decided by the owner and then made true in the source.
- **Options considered**: Present all findings at once for bulk review; work domain by domain; or decompose each finding into independently-lockable axes first. The third was chosen after an adversarial challenge round found that nearly every first-pass entry collapsed several axes into one scalar question.
- **Decision**: **20 blocking findings → 2 already-resolved → 18 entries → 94 axes → 57 open sub-decisions, all ratified** (43 owner-decided, 14 agent-decided as spec hygiene or technically determined, each flagged). Full record with reasoning, preserved invariants and downstream commitments: `.memory/wiki/specs/audits/decision-ratification-log.md`. Options each was chosen from: `blocking-decision-queue.md`.
- **Downstream**: The 37 axes found already-locked are the load-bearing result — a scalar answer to any of them would have silently reversed a ratified decision. Propagated into source across three passes (144 files, then 144, then 41). Verification: every decision findable in source, zero broken invariants, and the two invented values that appeared were removed. Notable outcomes: v1 positioning restated from "capture at source" to "capture at the first sharing moment" (domain 07 D-06 made this obligatory, not optional); the UK statutory vocabulary retired to an unauthored profile yielding explicit `unknown`; `scanned` renamed to `admissions_total`/`admissions_paid` because one name could not carry two quantities.
- **Reversibility**: Medium. Each sub-decision is individually recorded with its rejected alternatives, so any one can be revisited; but several are now load-bearing across domains.

## DEC-049: DQ-R2-01 representation scope is two flat axes conjoined at the call site (2026-07-29)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-30T00:38:30.695Z
- **Agents**: claude
- **Sources**: propagate-decision (DQ-R2-01)
- **Index**: [[index]]

- **Problem**: `01.03.02`:25 lists a five-item commercial-domain scope and the ratified seven-verb
  mandate as siblings on one representation edge; `01.03.02`:76 and `01.03-cx` CX-02 both assert
  "scope **is** the mandate". The identity reading is unsatisfiable — the activity enum is closed at
  seven (D-01, DQ-02.3, global D-69) and none of the five domains is in it. Three normative
  statements, no open marker on any of them. The word "activities" was filled with two different
  vocabularies nine lines apart in one file (`:16` verbs, `:25` domains).
- **Options considered**: A full cross-product (7x5=35 cells, the draft's recommendation);
  A-prime two flat axes ANDed at the call site; A-double-prime domain as edge identity (one edge per
  domain); B domains-for-representation/verbs-for-membership; C collapse to one vocabulary;
  D domains as presets expanding to verbs; G defer to `/create-prd`.
- **Decision**: **A-prime**, owner-ratified 2026-07-29. A representation edge carries two
  independent flat axes — `activities` (subset of the closed seven) and `domains` (subset of live
  booking / recording / publishing / sync / merch) — ANDed at the moment of the action. At most
  7+5=12 plain-language statements per edge, never 35 cells, which is what keeps `01.03.03` DT-02
  (permission matrix REJECTED) and D-02 (plain language, not a grid) intact. A membership edge
  carries the activity axis only and resolves to ALL domains, which is what keeps `01.03-cx` CX-03:
  both edge types present one shape, `{activities, domains}`, to the enforcement cross-cut.
  Territory, term and commission stay edge-level and do not vary per domain (accepted cost).
  `administer` does not reach naming a publisher over a share the party did not write (`09.01.04`
  D-06 stands over the mandate).
- **Why the draft's Option A was rejected**: a 35-cell grid *is* the artefact DT-02 rejects by name;
  its cross-type asymmetry breaks the CX-03 union the sub-domain merge exists to protect; and its
  "book for live but not publishing" justification is only half-sourced — the verb half is real at
  `01.03.02`:16 ("my manager can book but not sign"), the domain half appears nowhere in 1,122 files.
  The five-domain list occurs on exactly **one line** tree-wide.
- **Downstream**: `01.03.02` D-02 restated + new D-05; `01.03.03` D-11 + `:25` scope dimensions;
  `01.03.01` D-19 (membership universal-domain); `01.03-cx` CX-02 + CX-03; parent index D-05;
  `ideation-cx.md`:27 Roles/Permissions cross-cut; `ideation-index.md` D-75; `09.01.04` D-17
  carve-out; domain 17 booking authority (+ its `publishing authority` wording collision);
  domains 04, 05, 07, 20 local authority vocabularies.
- **Reversibility**: Medium. The rename and the conjunction are cheap to revise; the eliminated
  options are not — B, C and G were each independently refuted against source.
- **Left open (tracked)**: are the five domains identical to domain 17's ratified work-type enum, or
  a fourth vocabulary? `01.03.02`:25 lists sync as publishing's *sibling*; `09.01.04`:102 carves sync
  *inside* publishing as a right type. Tracked as `01.03.02` Q-03, targeted at `/create-prd`.

## DEC-050: Opportunity post decide-by is derived by default and overridable (2026-07-30)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-30T09:05:20.138Z
- **Agents**: claude
- **Sources**: audit-ambiguity run 3 — owner decision queue
- **Index**: [[index]]

- **Problem**: five decisions and two queue states across `04.04`/`04.05` treated a decide-by date as an
  established field on the opportunity post; `04.01.01`, which owns the post object, never defined it, and
  its only expiry rule keyed on the *event* date instead.
- **Options considered**: mandatory field with type-scoped default; derived-by-default and overridable;
  derived only (no separate concept); leave it out and let dependents degrade.
- **Decision**: **derived by default, always present, overridable**. Presence types default to the event
  date, delivery types to the stated deadline, per `04.01.01` D-10's type-scoped date semantics. The
  composer adds no interaction. Open calls and briefs get a real asked field because their type says so.
- **Key consequence**: decide-by is a D-09 **terms field** — a poster silently pushing 'you'll hear by
  14 Aug' to 30 Sep has ghosted twelve people while the UI still shows them a date.
- **Expiry reconciled**: the post's date closes **submission**; the decide-by closes the **post**. Identical
  on the ten derived types, divergent only for briefs and open calls, so the old one-date rule became the
  special case of the new one.
- **Downstream**: `04.01.01` D-16 + per-type default table; `04.04.01` D-05/D-06 and the dormant/abandoned
  triggers gain a real bound; `04.05.01` Q-02 becomes computable; `04.07` D-05; `04.02.04` Q-10 left open on
  whether the deadline escalation reads decide-by or event date.
- **Reversibility**: Medium.

## DEC-051: Benchmark band is a surface split — sellers-only pre-transactionally, symmetric once issued (2026-07-30)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-30T09:05:20.147Z
- **Agents**: claude
- **Sources**: audit-ambiguity run 3 — owner decision queue
- **Index**: [[index]]

- **Problem**: `05.02.01` D-15 required the rate benchmark band to render symmetrically to both parties on
  a live quote; `05.01.04` Q-03 was closed 'sellers only'. Same band, simultaneously required and forbidden.
- **The insight that decided it**: every 'sellers only' statement is textually scoped to the **listing**
  surface ('public listing', 'buyer preview'), yet Q-03 closed a question broader than its own evidence
  covered. The two rules were argued against different threats.
- **Decision**: **surface split**. Public listing, browse and buyer preview stay band-free; once a quote is
  **issued**, both parties see the cohort band. `05.01.01` D-05 gains a listing-surface scope qualifier;
  `05.02.01` D-15 stands.
- **Rationale**: D-05's argument is about a public, browse-scale surface where anyone can shop a cohort's
  position. A live quote is bilateral, post-request, and already discloses the seller's exact figure to that
  one buyer. Different exposure, different rule.
- **Downstream**: `05.01.04` D-05 + Q-03 re-resolved and its stale-text note withdrawn; CX R-04 and R-06
  scoped; below-*k* on an issued quote withholds from **both** parties (D-15's 'or to neither' branch made
  operative); Q-01's minimum cohort *k* is now buyer-facing and harder — escalated, **no value picked**.
- **Reversibility**: Medium.

## DEC-052: Spec deals pre-commit a normal posture whose effect is deferred to a trigger (2026-07-30)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-30T09:05:20.148Z
- **Agents**: claude
- **Sources**: audit-ambiguity run 3 — owner decision queue
- **Index**: [[index]]

- **Problem**: `spec` is a publishable pricing model whose nature is a term vesting on a future trigger, but
  `05.06.01`'s legal-combinations table had no spec row, its posture vocabulary is closed (D-07), and no tier
  can publish without an election (D-01). The whole `05.06` sub-domain never mentioned spec.
- **Options considered**: open the vocabulary with a conditional posture; pre-commit and defer effect;
  two-stage instrument; forbid spec as a listing tier.
- **Decision**: **pre-commit the posture, defer its effect** — the seller elects a normal posture from the
  closed vocabulary and the signed instrument takes effect on the named trigger. Effective-date is a property
  of the **instrument**, not a new posture, so D-07 stays closed.
- **Why not two-stage**: it leaves the seller holding a promise to sign rather than signed paper — the exact
  exploitation pattern `05.01.03` DT-01 names, aimed at the population the domain most wants to protect.
- **Q-07 resolved onto the same mechanism**: reversion is a normal posture whose effect **ends** on a trigger,
  the mirror of spec's **beginning** on one. One mechanism (`05.06.01` D-14) covers both; D-07 byte-identical.
- **Also fixed while the table was open**: the cash-only row covered five of eight publishable models —
  hourly, half-day and retainer had no posture set at all; buyout got its own row per DT-13.
- **Left open**: `05.06.01` **Q-08** — may a Points posture carry deferred effect? `05.06.02` D-02 has
  participation existing from execution regardless of earnings, the opposite of vesting on a trigger. Points
  omitted from the Spec row until answered; if it resolves against, the spec *production* deal collapses to
  co-ownership. `05.01.03` Q-07 (who detects the trigger) promoted to **prerequisite**.
- **Reversibility**: Low — it settles the shape of a closed vocabulary two other features enumerate.

## DEC-053: public-domain is user-declared and machine-corroborated, never platform-asserted (2026-07-30)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-30T09:05:20.148Z
- **Agents**: claude
- **Sources**: audit-ambiguity run 3 — owner decision queue
- **Index**: [[index]]

- **Problem**: `09.01.01` treated `public-domain` as a terminal ledger state satisfying the release gate, but
  named `09.03.05` as sole determiner — which emits only per-jurisdiction term statuses for US/FR/DE/GB, is
  read-only to every persona, and rules by D-06 that a term status is **not** ownership or release
  authorization. No path in the tree could set the state.
- **The decisive constraint was timing**: `09.03.05` is a COULD that 'launches empty regardless of build
  effort'; `09.01.01` is a MUST. Any option making it the writer blocks trad-folk and classical release at
  launch — an outcome `09.01.01`:289 itself calls absurd.
- **Decision**: **hybrid — self-declared now, corroborated later**. The user's declaration writes the state
  and satisfies the **composition side** of the release gate. `09.03.05`, when built, attaches per-jurisdiction
  results as corroboration **or contradiction**, never override; a contradiction surfaces persistently and
  routes to `09.04.01`, but a release already made is not retracted by the platform.
- **Pattern reused**: `09.01.04` D-09's ratified `consented` ≠ `registered` two-truths shape.
  `09.03.05` D-03/D-05/D-06 are **confirmed, not amended**.
- **Key detail**: `09.01.02`'s deliberately-alarming empty-ledger copy ('Nobody owns this yet') must **not**
  fire on it — DT-03's thesis is that absence is the alarm; this is the one absence that is an answer.
- **Territory**: a v1 declaration is worldwide; jurisdictional contradiction is surfaced, not modelled.
- **Reversibility**: Medium.

## DEC-054: Delivery integrity — metadata written at ingest, two hashes only for watermarked products (2026-07-30)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-30T09:05:20.149Z
- **Agents**: claude
- **Sources**: audit-ambiguity run 3 — owner decision queue
- **Index**: [[index]]

- **Problem**: `14.03.01` published one SHA-256 per artifact **before any bytes move** and auto-verified the
  download against it, while the same delivery step was specified to rewrite bytes per buyer (embedded
  tempo/key/loop metadata per `14.04.01` D-06, plus a per-buyer forensic watermark). Under the spec as
  written, every content download failed verification and E-19 quarantined a correctly-delivered build.
  Both colliding units are in the MUST band, so it was not deferrable.
- **Decision**: **move the metadata write upstream**. Embedded tempo/key/loop metadata is a property of the
  *product*, not the buyer — written once at ingest in `14.08.03` audio QC into the stored master. Delivery
  then has at most **one** writer. Unmarked products are byte-identical to the master, so the single published
  hash is simply correct. Watermarked products take a two-hash treatment (master + per-grant).
- **Why this over two-hashes-for-everything**: a per-buyer hash is a number only *we* can vouch for. The
  master hash is **corroborable** — two buyers of one build compare and agree. D-09's 'verify on a machine
  that has never met us' survives intact for the entire air-gapped Operator inventory.
- **E-19 split**: a per-grant mismatch is a transfer or stamping fault; only a **master** mismatch quarantines.
- **Not decided here**: `14.03.05` Q-02/Q-03 (watermarking opt-in and cost model) remain the owner's separate
  calls — Q-03 gains weight because it now also decides which products keep the one-hash contract.
- **Reversibility**: Medium.

## DEC-055: Radius breach hard-blocks confirm; the waiver becomes a real-time instrument (2026-07-30)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-30T09:05:20.149Z
- **Agents**: claude
- **Sources**: audit-ambiguity run 3 — owner decision queue
- **Index**: [[index]]

- **Problem**: `17.01.04` C-06/D-13 made a radius-clause breach a hard confirmation precondition; `17.01.03`
  D-15 made the same check at the same moment 'warn + recorded override, never hard-block'. Confirm-under-
  challenge routes through 17.01.04's gate, so both fired on one commit. The CX layer contradicted itself
  **inside one entry** (:31 'hard block' vs :371 'a hard block would be wrong').
- **The reframing that decided it**: 17.01.03's argument is not about permission, it is about **latency** —
  'consent is obtainable, just not within 48h'. Fix the latency and the argument dissolves.
- **Decision**: **C-06 stands.** The waiver becomes a first-class in-app instrument against the constraining
  Operator, with its own clock and escalation. Break-glass is narrow and priced: only while a challenge clock
  is live, artist principal never a delegate, the constraining promoter notified **at the moment of use**, and
  recorded as a named breach event feeding `17.12`.
- **Why not warn-everywhere**: it contradicts three ratified rows, and a warning dismissible at the last
  irreversible step is the weakest possible version of 17.06's promise. Why not split-by-pressure: a
  contractual permission depending on whether a rival challenged is indefensible and invites manufactured
  challenges.
- **New authority slot for domain 01**: 'artist principal, never a delegate' joins offer-binding
  (`17.02.03` D-03) and settlement-signing (`17.09.05` D-06).
- **Reversibility**: Medium.

## DEC-056: A require-confirmation rider requirement holds at unknown rather than matching (2026-07-30)

- **Occurrences**: 1
- **Latest timestamp**: 2026-07-30T09:05:20.150Z
- **Agents**: claude
- **Sources**: audit-ambiguity run 3 — owner decision queue
- **Index**: [[index]]

- **Problem**: `18.04.01`'s `verification` flag said a `require-confirmation` item blocks the advance freeze
  even on an automatic diff match. But the freeze reads the checklist's hard-outstanding count, and
  `18.03.01` D-04 rules that a `match` generates **no item** — so the blocking effect had no mechanism
  anywhere. `require-confirmation` and `trust-listing` occur in exactly one file; no consumer implements them.
  D-05 floors every power item at `require-confirmation`, so this is mandatory on a whole category.
- **Decision**: such a requirement **never resolves to `match` from listing data** — it holds at `unknown`
  via one new `basis` value. The existing source-1 rule then fires (unknown → venue-side question) and D-06's
  existing sentence derives severity. **No new machinery at all.**
- **Why this over a fifth generation source**: that punches a permanent exception into D-04's headline rule
  and emits the largest item volume of any option — power's floor guarantees a matched 6-item power section
  emits 6 rows — which is precisely the alert-fatigue trade-off DT-14 was decided on.
- **Precedent, not invention**: `16.05.05` D-03 already forces `match` → `unknown` on stale show-stopping
  rows. 'Listing data is not consent' (DT-11) is the same claim about a different untrustworthiness.
- **`18.03.01` D-04 and D-06 untouched**; `18.03.05` unchanged.
- **Reversibility**: High — one enum value and three reworded claims.

## DEC-057: P1 keeps Supabase PostgreSQL canonical and bounds adjunct services (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:00.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: Supabase Pro PostgreSQL is canonical for relational business state; Storage owns governed bytes, Realtime carries hints, PostgreSQL search is v1, and Queue transport is paired with a transactional outbox. No adjunct may become an ungoverned second source of truth.
- **Reasoning**: The approved feature-to-query map favors relational invariants, rights, authority, money, CMS versioning, and audit consistency while retaining bounded managed capabilities.
- **Downstream**: Decomposition and schema work preserve canonical UUIDs, transactional authority, replay, and rebuild rules.
- **Reversibility**: Medium.

## DEC-058: Supabase Auth serves consumer identity; enterprise capabilities wait (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:01.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: Supabase Auth owns consumer credentials and sessions. Enterprise SSO, SCIM, enterprise tenancy, and enterprise administration are deferred until consumer launch is ready.
- **Reasoning**: Consumer launch needs secure social identity without premature enterprise scope or cost.
- **Downstream**: Auth specs implement consumer OAuth and recovery only; enterprise features require later evolution.
- **Reversibility**: Medium.

## DEC-059: Social identities are additive credentials on one canonical user (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:02.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: Google, Apple, Meta, lower-priority TikTok, SoundCloud, and BandLab when applicable are additive login credentials on one canonical user. Users may link or unlink providers after proof; no email-only auto-merge occurs and at least one recovery path must remain.
- **Reasoning**: Provider accounts are credentials, not separate people; safe linking prevents account takeover and duplicate identities.
- **Downstream**: Identity specs define link, unlink, conflict, recovery, audit, and provider-admission flows.
- **Reversibility**: Medium.

## DEC-060: TypeScript is the sole v1 primary language (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:03.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: TypeScript is the sole application language across Astro, React islands, Hono Workers, contracts, jobs, and tests; SQL remains migration and database-function implementation.
- **Reasoning**: One language maximizes shared contracts and minimizes runtime/tooling fragmentation.
- **Downstream**: A second primary language requires measured evidence and architecture evolution.
- **Reversibility**: Medium.

## DEC-061: CMS and settings-first operation are mission-critical (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:04.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: WeJammin includes a governed WordPress-like CMS/control plane for typed content types, fields, entries, templates/blocks, menus, navigation, taxonomies, media, settings, flags, revisions, approvals, preview, and publication. Plugins, themes, arbitrary code/CSS, and security/legal/transactional invariants as settings are prohibited.
- **Reasoning**: Routine variable content and configuration must be operator-editable without deployment while preserving domain authority and safety.
- **Downstream**: CMS is an early dependency and every variable must be classified as content, setting, rule pack, runtime config, secret, or invariant.
- **Reversibility**: Low.

## DEC-062: GitHub Actions runs CI/CD on the verified self-hosted fleet (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:05.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: GitHub Actions is the canonical CI/CD control plane using verified self-hosted runners, protected environments, immutable artifacts, and same-artifact promotion.
- **Reasoning**: It matches the repository and avoids hosted-runner baseline spend while retaining protected automation.
- **Downstream**: Setup verifies runner isolation, concurrency, secrets, caching, and protected deployment.
- **Reversibility**: Medium.

## DEC-063: Sentry plus structured native telemetry is the v1 monitoring stack (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:06.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: Use Sentry Developer for release-aware errors and sampled traces, Cloudflare/Supabase native logs and metrics for platform evidence, and PostgreSQL audit for durable business evidence.
- **Reasoning**: This provides actionable diagnostics at launch cost without treating telemetry as legal or business audit.
- **Downstream**: Setup configures scrubbing, quotas, sampling, source maps, alerts, and independent blind-spot detection.
- **Reversibility**: High.

## DEC-064: Astro hybrid rendering uses React only for hydrated islands (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:07.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: Astro hybrid rendering owns documents and route shells; React is limited to explicit interactive islands with validated serializable props and local state.
- **Reasoning**: Most surfaces benefit from server/static HTML while complex workbenches need bounded hydration.
- **Downstream**: Frontend specs justify every island and preserve canonical server-rendered context on island failure.
- **Reversibility**: Medium.

## DEC-065: Cloudflare Workers and Hono form one modular backend (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:08.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: Hono on Cloudflare Workers is one edge-deployed modular backend; domain modules own contracts and boundaries inside the deployable. No launch microservices or always-on servers exist.
- **Reasoning**: The model minimizes operations and latency while preserving later extraction seams.
- **Downstream**: Separate services require measured isolation, runtime, scale, legal, or organizational evidence.
- **Reversibility**: Medium.

## DEC-066: Versioned REST and OpenAPI define the platform API (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:09.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: The public application boundary is versioned REST/HTTP JSON under /api/v1, with OpenAPI generated from shared Zod contracts.
- **Reasoning**: REST provides explicit resources, commands, caching, provider/native compatibility, and bounded query cost.
- **Downstream**: Breaking changes require versioning or compatibility migration; GraphQL/tRPC are not launch boundaries.
- **Reversibility**: Medium.

## DEC-067: Cloudflare serves deploy assets; Supabase serves governed media (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:10.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: Cloudflare serves immutable build assets and cached public output; Supabase Storage serves governed media/documents behind PostgreSQL-owned metadata and policy.
- **Reasoning**: Deploy assets and rights-bearing user objects have different authority, retention, and access requirements.
- **Downstream**: Object access always authorizes in PostgreSQL and uses bounded signed delivery.
- **Reversibility**: Medium.

## DEC-068: The Working Record defines a product-first governed design system (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:11.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: The design north star is The Working Record: credible, human, exact, provenance-forward, warm-light, and product-first, with Jam Magenta as the constrained accent and root DESIGN.md as normative.
- **Reasoning**: The system must support dense professional work without generic dashboards, decorative cliches, or unverifiable claims.
- **Downstream**: Frontend specs consume tokens, archetypes, states, and provenance semantics rather than inventing local design rules.
- **Reversibility**: Medium.

## DEC-069: pnpm, Vitest, Playwright, ESLint, Prettier, and strict TypeScript form the toolchain (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:12.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: Use pnpm workspaces/Corepack, strict TypeScript, ESLint, Prettier, Vitest, and Playwright as the canonical development and validation toolchain.
- **Reasoning**: The tools align with Astro/Vite/Workers and provide reproducible contract, unit, integration, browser, and E2E gates.
- **Downstream**: Setup pins versions and implements canonical scripts without introducing parallel runners or package managers.
- **Reversibility**: Medium.

## DEC-070: Navigation adapts by route family and viewport (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:13.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: Public, product, admin, auth/recovery, and system route families use purpose-specific navigation; mobile and desktop adapt without becoming separate information architectures.
- **Reasoning**: One universal dashboard or menu cannot serve the platform breadth accessibly.
- **Downstream**: Frontend decomposition preserves named shells and menu locations.
- **Reversibility**: Medium.

## DEC-071: The layout uses a 4/8/12 hybrid grid (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:14.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: Responsive layout uses four columns on compact, eight on medium, and twelve on wide viewports with locked spacing tokens.
- **Reasoning**: A shared grid gives consistent density while supporting mobile through professional workbench layouts.
- **Downstream**: Components align to the shared grid and do not create independent spacing systems.
- **Reversibility**: High.

## DEC-072: Twelve page archetypes cover the platform without one universal dashboard (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:15.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: Twelve named page archetypes cover public records, discovery, workbenches, forms, review, admin, settings, operations, and system states.
- **Reasoning**: The product needs reusable structural patterns without flattening every workflow into cards or a dashboard.
- **Downstream**: Frontend specs classify pages into an archetype before component design.
- **Reversibility**: Medium.

## DEC-073: The global component inventory is a mandatory seed (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:16.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: A shared packages/ui inventory owns navigation, forms, provenance, status, errors, tables, uploads, audit, and offline/conflict primitives.
- **Reasoning**: Cross-domain consistency and accessibility require shared high-risk primitives.
- **Downstream**: Feature modules may extend but not redefine the global inventory.
- **Reversibility**: Medium.

## DEC-074: Motion is subtle responsive feedback (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:17.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: Motion is bounded responsive feedback, normally 150–220ms with reduced-motion support; bounce, elastic motion, layout animation, and choreographed product loads are prohibited.
- **Reasoning**: Motion must communicate state without delaying work or harming accessibility.
- **Downstream**: All frontend acceptance criteria include reduced-motion behavior.
- **Reversibility**: High.

## DEC-075: Data density is hybrid by archetype (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:18.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: Public surfaces are calmer; professional workbenches are compact and information-dense; density follows page archetype rather than one global mode.
- **Reasoning**: Users need both approachable public pages and efficient operational tools.
- **Downstream**: Components use approved compact/comfortable variants only where archetypes permit.
- **Reversibility**: High.

## DEC-076: Global states remain explicit and non-interchangeable (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:19.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: Loading, empty, absent, forbidden, blocked, stale, offline, degraded, conflict, failed, and success states are distinct contracts and cannot be collapsed into generic empty/error UI.
- **Reasoning**: Conflating states causes unsafe retries, authority leaks, and false confidence.
- **Downstream**: Every affected route/component specifies and tests applicable states.
- **Reversibility**: Low.

## DEC-077: Supabase Data API and PostgreSQL RPC replace a general ORM (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:20.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: Use generated Supabase Data API queries for bounded ordinary access and migration-owned PostgreSQL RPC for protected multi-row transactions; no general ORM is selected.
- **Reasoning**: This preserves RLS and transactional invariants without adding an abstraction that obscures SQL and policy.
- **Downstream**: Repositories expose typed ports; raw rows never become transport contracts.
- **Reversibility**: Medium.

## DEC-078: The launch system is an edge-deployed modular monolith (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:21.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: Launch as one Astro/Hono edge deployment with explicit domain modules, PostgreSQL schemas/contracts, Queue consumers, and provider adapters.
- **Reasoning**: A modular monolith fits launch staffing and budget while preserving clear boundaries.
- **Downstream**: Extraction requires evidence and a migration/replay plan.
- **Reversibility**: Medium.

## DEC-079: Every API failure uses one four-field envelope (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:22.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: Every JSON API failure has exactly code, message, requestId, and details; HTTP status stays on the response line and unsafe internals never reach clients.
- **Reasoning**: One envelope enables consistent safe error handling across browser, API, jobs, and support.
- **Downstream**: Contracts define per-code details and clients branch on code/context, never message text.
- **Reversibility**: Low.

## DEC-080: PostgreSQL owns truth and every secondary store is reconstructible or coordinated (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:23.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: PostgreSQL owns canonical authority; Storage bytes are governed by database metadata, Queue is disposable transport backed by outbox, Realtime is a hint, and search/public projections are transactional or rebuildable.
- **Reasoning**: Cross-store ambiguity is unacceptable for rights, money, publication, and evidence.
- **Downstream**: Every secondary representation defines identity, version, replay, deletion, and recovery.
- **Reversibility**: Low.

## DEC-081: Authentication is additive, but authorization is always first-party and contextual (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:24.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: External providers authenticate credentials only. Authorization resolves canonical user, acting party, current mandate/relationship/capability, and RLS policy server-side for every action.
- **Reasoning**: Social identity must never imply organizational or resource authority.
- **Downstream**: Every protected endpoint and job revalidates current acting context.
- **Reversibility**: Low.

## DEC-082: Zod 4 is the single runtime contract library and WCAG 2.2 AA is a release gate (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:25.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: Zod 4 defines runtime contracts and OpenAPI derivation; WCAG 2.2 AA gates public, authenticated, admin, and PWA release.
- **Reasoning**: Shared runtime validation and accessibility are production invariants, not later polish.
- **Downstream**: Contracts precede implementation and accessibility failures block release.
- **Reversibility**: Low.

## DEC-083: Launch integrations are allowlisted, degradable, and spend-gated (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:26.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: Launch integrations are Cloudflare, Supabase Pro at setup, GitHub/self-hosted Actions, Sentry, Resend, approved identity providers, and counsel-cleared Stripe-hosted Checkout Sessions plus hosted Connect. Unregistered destinations and deferred advertising, AI, enterprise, specialist search, and multi-party payout integrations fail closed.
- **Reasoning**: Each admitted provider has typed boundaries, local canonical state, failure fallback, deletion behavior, and a bounded cost gate.
- **Downstream**: Setup must verify provider terms, data placement, secrets, webhooks, outage behavior, quotas, and deletion before activation.
- **Reversibility**: High.

## DEC-084: Structured correlation plus numeric SLO alerts define launch observability (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:27.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: Propagate request, correlation, causation, job, attempt, and safe entity-version identifiers across API, RPC, outbox, Queue, and adapters; combine scrubbed logs, Sentry, numeric SLOs, dashboards, alerts, and runbooks.
- **Reasoning**: A solo owner needs actionable numeric signals without false 24/7 promises or PII leakage.
- **Downstream**: Setup creates and drills dashboards, alerts, scrubbing, sampling, and runbooks.
- **Reversibility**: High.

## DEC-085: Quality is contract-first and vertical from the first slice (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:28.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: Every capability advances through approved specs, Zod contract, failing test, minimal implementation, refactor, full validation, and all affected user/admin/data/security/telemetry/documentation surfaces.
- **Reasoning**: Horizontal partial delivery creates false completeness across highly coupled authority, CMS, rights, and money workflows.
- **Downstream**: All plans and slices follow Red-Green-Refactor and the completion checklist.
- **Reversibility**: Low.

## DEC-086: Consumer v1 ships through six dependency and infrastructure gates (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:29.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: Sequence assurance, operational foundation, identity/admin/CMS, projects/media/safety, credits/splits, services/single-payee commerce, and release hardening before later domains; enterprise remains deferred.
- **Reasoning**: Identity, acting context, CMS, and operations are prerequisites; commerce depends on earlier provenance and counsel gates.
- **Downstream**: Planning may optimize within gates but cannot violate dependency or exit criteria.
- **Reversibility**: Medium.

## DEC-087: Launch spend is capped and media is the primary cost risk (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:30.000Z
- **Agents**: codex
- **Sources**: create-prd decision recovery
- **Index**: [[index]]

- **Decision**: Spend is $0 before setup, setup/staging is capped at $50/month, and consumer production at $300/month. Supabase Pro starts at setup; seven-day production PITR reserves about $100 inside the production ceiling; 80/90% alerts and freezes apply.
- **Reasoning**: Media storage/renditions/egress grow faster than request volume and require attribution, quotas, and admission controls.
- **Downstream**: Setup records dated calculators and production features prove cost at 1k and 10k MAU.
- **Reversibility**: High.

## DEC-088: Final architecture owns every implementer-critical contract (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:31.000Z
- **Agents**: codex
- **Sources**: audit-ambiguity architecture
- **Index**: [[index]]

- **Decision**: Lock token-driven vanilla CSS with cascade layers, Astro scoped styles, and React CSS Modules; manual injection and explicit composition roots; exact error/cursor contracts; communication/fallback matrices; Stripe-hosted Checkout and hosted Connect without embedded card UI; and a linked runbook contract.
- **Reasoning**: Each omission allowed incompatible or less-safe implementations without changing product intent.
- **Downstream**: Later specs preserve these contracts; alternatives require evolution or propagated architecture change.
- **Reversibility**: Medium.

## DEC-089: Seven-day PITR gates protected production data (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:32.000Z
- **Agents**: codex
- **Sources**: audit-ambiguity architecture
- **Index**: [[index]]

- **Decision**: Enable and restore-test Supabase seven-day PITR before production money, rights, or publication records. Worst-case RPO is ≤2 minutes; protected writes remain disabled if PITR is unavailable or unverified; the roughly $100/month cost stays inside the $300 ceiling.
- **Reasoning**: Database-resident audit/outbox shares the recovery domain and cannot truthfully guarantee zero loss under daily restore.
- **Downstream**: Setup provisions production PITR and infrastructure verification proves RPO/RTO before enabling protected writes.
- **Reversibility**: Low.

## DEC-090: Final architecture embeds query and PII registries (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:33.000Z
- **Agents**: codex
- **Sources**: audit-ambiguity architecture
- **Index**: [[index]]

- **Decision**: Embed the normative 25-domain plus cross-cut feature-to-query map and canonical semantic PII field-registry seed in final architecture. Extensions require reviewed purpose, lawful basis/consent, access, retention, deletion, telemetry, search, and export treatment.
- **Reasoning**: Final-layer implementers cannot depend on working notes or prose-only PII classes.
- **Downstream**: Decomposition and schema specs map every entity/query and protected field to these registries.
- **Reversibility**: Medium.

## DEC-091: Performance gates use one numeric load and data profile (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-02T18:00:34.000Z
- **Agents**: codex
- **Sources**: audit-ambiguity architecture
- **Index**: [[index]]

- **Decision**: Use the committed 20-iteration pull-request smoke; staging 5 RPS for 15 minutes then 25 RPS for 2 minutes; fixed route/cache mix, sample floors, deterministic dataset floors, and ten-client pgbench profile.
- **Reasoning**: Latency gates are meaningless if teams choose different traffic, data volume, cache state, or sample count.
- **Downstream**: Setup commits scenarios and seed manifests; validation reports environment, checksum, plans, samples, percentiles, and errors.
- **Reversibility**: High.

## DEC-092: Runtime contracts close the final architecture implementation seams (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-03T00:40:00.000Z
- **Agents**: codex
- **Sources**: audit-ambiguity architecture fresh rerun 1
- **Index**: [[index]]

- **Decision**: Lock the CSS rationale and rejected alternatives; add explicit Hono/Queue-to-domain protocols and domain failure fallback; select repository-owned @wejammin/observability as the typed newline-delimited JSON runtime logger; fix client deadlines at 8 seconds for reads, 15 seconds for commands, 2 seconds for job acceptance, 30 seconds no-byte upload idle, and 15 minutes signed-upload expiry; and require every route/consumer to register exactly one SLO/async tier with CI coverage.
- **Reasoning**: Fresh implementer simulation proved that guidance without an import contract, approximate deadlines, implicit in-process arrows, unregistered SLO tiers, and unexplained CSS rejection still allowed incompatible conforming implementations.
- **Downstream**: Decomposition and later specs must use the named logger port, service-call direction, exact deadlines, route/consumer registry, and selected CSS governance. Alternatives require architecture evolution and equivalent contract tests.
- **Reversibility**: Medium; implementations can evolve behind stable ports and registries, but wire deadlines and monitoring assignments require propagated contract changes.

## DEC-093: Every technology axis and component arrow has one normative contract (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-03T00:50:00.000Z
- **Agents**: codex
- **Sources**: audit-ambiguity architecture fresh rerun 2
- **Index**: [[index]]

- **Decision**: Add an exhaustive launch technology matrix naming each axis, selection, project-specific rationale, and rejected alternatives; replace the communication matrix with one row for every component-diagram arrow and preserve transport → domain port → infrastructure adapter direction.
- **Reasoning**: Fresh rerun 2 found that scattered rationale did not satisfy every selected axis and grouped protocol rows contradicted the diagram by allowing Hono to bypass domain persistence ports.
- **Downstream**: Decomposition and all architecture/backend specs must preserve the technology matrix and one-to-one path contracts. Any technology substitution or diagram/path change requires an originating architecture decision and synchronized matrix update.
- **Reversibility**: Medium; rows can evolve through explicit propagation, but silent local substitution is prohibited.

## DEC-094: Workers Paid is the selected shared staging and production tier (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-03T01:00:00.000Z
- **Agents**: codex
- **Sources**: audit-ambiguity architecture fresh rerun 3
- **Index**: [[index]]

- **Decision**: Cloudflare Workers Paid is required beginning with shared staging at /setup-workspace and remains the production tier. Pre-setup repository/local work and disposable Free-tier evaluation remain $0 and cannot carry shared staging, production data, or production traffic. Procurement and dated price verification are deferred; tier selection is not.
- **Reasoning**: Fresh rerun 3 found an explicit deferred-tier statement that contradicted the integration and cost models already reserving the Workers Paid floor and left setup teams free to choose incompatible postures.
- **Downstream**: Setup provisions Workers Paid within the $50 staging ceiling, verifies current pricing/limits, and configures 80/90% alerts before shared staging. Production promotion retains the selected tier unless an architecture change is propagated.
- **Reversibility**: High through a future hosting architecture decision, provided availability, queues, abuse controls, cost, and migration evidence remain satisfied.

## DEC-095: Design verification is local, first-party, and warm-light-only at launch (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-03T01:10:00.000Z
- **Agents**: codex
- **Sources**: audit-ambiguity architecture fresh rerun 4
- **Index**: [[index]]

- **Decision**: Use a local/CI-only static Astro apps/docs catalog importing packages/ui; run tagged Playwright screenshots and @axe-core/playwright inside pnpm test:e2e; self-host approved immutable WOFF2 fonts through Cloudflare deploy assets without launch subsetting; launch only the warm-light theme and require /evolve-feature for dark theme.
- **Reasoning**: Fresh rerun 4 found that Storybook or equivalent, font delivery/subsetting, visual regression, and dark-theme admission were still selectable at setup, allowing different services, privacy/CSP posture, cost, accessibility scope, and visual coverage.
- **Downstream**: Setup pins the selected package/font versions, builds apps/docs without production deployment, creates reviewed baselines, and proves CI. Frontend specs enumerate catalog states and may not add font origins or themes outside this decision.
- **Reversibility**: Medium; tooling can evolve behind the same local/CI evidence contract, while font origin and theme changes require propagated security/accessibility/design updates.

## DEC-096: Provider effects are local-intent-first cross-store operations (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-03T01:20:00.000Z
- **Agents**: codex
- **Sources**: audit-ambiguity architecture fresh rerun 5
- **Index**: [[index]]

- **Decision**: Every payment, email, registry, identity-adjacent, or other provider-backed operation uses a PostgreSQL operation/transaction UUID as canonical identity; commits local pending intent, idempotency, audit, and outbox before the provider effect; reads local state normally; reconciles unknown outcomes through signed webhook or bounded poll; and revokes locally before provider cancel/delete/suppress with retained evidence or exception.
- **Reasoning**: Fresh rerun 5 found that integration fallbacks did not supply the full canonical ID, creation order, failure recovery, deletion cascade, and read join required for every multi-store entity.
- **Downstream**: Every provider adapter and backend spec instantiates this lifecycle and may narrow retention/deletion only through its approved legal/provider contract. Blind retry and provider-authoritative rendering are prohibited.
- **Reversibility**: Low for operation ordering and canonical ownership; individual providers remain replaceable behind adapters.

## DEC-097: Decompose approved architecture into 43 dependency-ordered IA shards (2026-08-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-03T01:24:45.515Z
- **Agents**: codex
- **Sources**: decompose-architecture
- **Index**: [[index]]

Owner approved the recommended architecture decomposition: 43 total IA shards comprising 00-infrastructure plus 42 feature-domain shards. Mandatory splits M01-M13, recommended splits R01-R02, and keep-together decisions for domains 04, 05, 07, 08, 09, 12, 16, 20, 21, and 24 are locked. Dependencies must point only to lower-numbered shards. The canonical boundary table is .memory/wiki/specs/ia/decomposition-plan.md. Downstream IA, BE, FE, phase, setup, and implementation work must preserve these boundaries unless /remediate-shard-split or /propagate-decision is run.

## DEC-098: Shard 04 delivery eligibility learns dispute/rights/licence state by inbound command, not upward read (2026-08-05)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-05T06:54:22.708Z
- **Agents**: claude
- **Sources**: /resolve-ambiguity all ia — gap A-25
- **Index**: [[index]]

- **Problem**: Shard 04 (CMS delivery and media) gates delivery eligibility on dispute, takedown, rights and licence state owned by Shards 06, 10 and 20. Those dependencies were undeclared, cited no section, and were absent from the Section Contract Map. Declaring them directly would point 04 at higher-numbered shards, which DEC-097 forbids, and 04 -> 06 closes a real cycle through Shard 05.
- **Options considered**: (A) inbound-command inversion — Shard 04 exposes protected delivery commands that 06/10/20 call; (B) upward event consumption via the Shard 00 envelope, amending DEC-097; (C) broker everything through Shard 05; (D) renumber the shards.
- **Decision**: Option A. Shard 04 exposes protected delivery commands (apply/release delivery hold, revoke delivery eligibility) that write `TakedownCaseLink` and set `AssetRight.state`. Shards 06, 10 and 20 call them. Every new edge points downward (06 -> 04, 10 -> 04, 20 -> 04), so DEC-097 and the acyclicity guarantee both survive unamended — 06 -> 04 already held transitively via 05, and 10 and 20 are not in 04's closure {00, 01, 03}. Shard 04 never adjudicates; it executes. Rejected B because Shard 00's events are identifier-only envelopes, so the consumer must still read producer state, reintroducing the upward edge the amendment was meant to remove. Rejected C because Shard 05's declared dependencies are 00, 01, 03, 04 — it cannot read Shard 10 or 20 either, and it would park adjudicated legal state in the admin shard. Rejected D because DEC-097 locks the 43-shard boundary table and renumbering rewrites every reference across 83 IA documents for no product benefit.
- **Downstream**: Shards 06, 10 and 20 each gain a Shard 04 integration section and a reciprocal Cross-Shard Section Contract Map entry. Shard 04 gains the protected command contracts and drops its undeclared upward dependencies. Sets the precedent for every future cross-shard need that would otherwise point upward: invert to an inbound command rather than amend DEC-097.
- **Reversibility**: Medium. The command surface is additive, but three shards take integration sections that would need unwinding.

## DEC-099: Vault access binds to a per-role vault_role_class, shipped as non-enforceable profile_version 0 with a review floor (2026-08-05)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-05T06:54:22.747Z
- **Agents**: claude
- **Sources**: /resolve-ambiguity all ia — gap A-10
- **Index**: [[index]]

- **Problem**: Shard 09's PRJ-07 resolves vault access as roster roles intersected with asset sensitivity against an 'approved role-profile version', but nothing in the IA layer, its deep dive, or the architecture states what the profile binds to or what a roster role the profile does not name receives. DEC-016 makes the six ideation profiles non-enforceable candidates until practitioner validation approves a version, and assigned the profile-versioning and enforcement-rollout design to `/create-prd-security` — an assignment never discharged (the architecture design has zero hits for `sensitivity`, `role profile`, `role-derived` or `profile version`). PRJ-07 must still ship.
- **Options considered**: (A) per-`role_version` `vault_role_class` attribute, ideation rows shipped as draft `profile_version: 0`, unclassified roles floor to `review`; (B) bind to `role_version.family_id`; (C) owner and Producer only for v1; (D) defer the matrix to the BE layer.
- **Decision**: Option A. Add a `vault_role_class` attribute per `role_version` in Shard 07's taxonomy, valued from `SensitivityClass` (`roster | review | stems | takes | restricted`). Ship the six ideation candidate rows as `profile_version: 0`, explicitly marked non-enforceable draft. Any `role_version` with no `vault_role_class` — including every `pending_role_alias` — defaults to the lowest class (`review`) with an explained denial. Rejected B because role families are grouped for discography presentation, not confidentiality: mix engineer and mastering engineer share a family yet require opposite grants, which is the counter-intuitive case DT-01 says the feature exists for. Rejected C because it deletes the feature's value and reproduces the DT-02 failure the design exists to prevent. Rejected D because the BE layer was deleted in commit 5c4e712, so there is no downstream spec to defer into, and deferring reproduces this exact defect one layer down.
- **Precedent**: follows DEC-047 (P-01 stage vocabulary) — candidate values are evidence, not contract; the gate is in force, so no draft label becomes a downstream contract. Same disposition as the DAW-parsing and vault-profile calls.
- **Downstream**: Shard 07 takes a reciprocal taxonomy-model edit and changelog entry for `vault_role_class`; shard 09 keys `ResolveVaultAccess` on it. Classifying newly admitted DDEX roles becomes ongoing taxonomy-admin work, harmless by default because unclassified floors to `review`. DEC-016's boundaries hold: no per-asset ACLs, no project-wide grants, no owner-configured-only model. `/create-prd-security` still owes the profile-versioning and enforcement-rollout design.
- **Reversibility**: High while `profile_version` is 0 — nothing is enforceable until an approved version lands.

## DEC-100: Shard 02 accepts bounded inbound evidence and policy commands without upward store reads (2026-08-28)

- **Occurrences**: 1
- **Latest timestamp**: 2026-08-28T19:00:00-04:00
- **Agents**: codex
- **Sources**: /write-be-spec Shard 02
- **Index**: [[index]]

- **Problem**: Shard 02 profile, credential and trader projections consume media, credit, attendance, consent, policy and marketplace evidence canonically owned by later-numbered shards. Direct reads into those stores would reverse dependency direction, couple availability and let this shard reinterpret producer truth.
- **Options considered**: (A) direct request-time reads from higher-numbered stores; (B) duplicate canonical truth in Shard 02; (C) accept bounded, versioned producer observations and protected commands through transactional outbox, signed ingress and idempotent inbox contracts.
- **Decision**: Option C. Later shards retain canonical ownership and deliver only allowlisted, versioned observations or policy commands. Shard 02 authenticates the producer, validates the exact schema and monotonic source version, stores the bounded local projection, and never reads a higher-numbered store. Critical consequences use protected commands rather than advisory events. Shard 05 may operate generic governed publication, while 02c owns qualification and trader policy semantics, rule versions and evaluation behavior.
- **Downstream**: 02a consumes party, proof and Shard 06 outcome inputs; 02b consumes Shard 04 media, Shard 07 credit, Shard 17 attendance and Shard 20 consent observations; 02c consumes governed Shard 05 policy publication and bounded marketplace signals. Producers use at-least-once delivery, idempotent inboxes, version fencing, retry and DLQ recovery.
- **Reversibility**: Medium. Producer schemas and adapters can evolve version by version, but changing canonical ownership or permitting request-time upward reads requires rerunning the originating architecture stage and cascading downstream.

## DEC-101: AC266 moves to a post-Phase-2 production-readiness gate without being passed or waived (2026-09-21)

- **Occurrences**: 1
- **Latest timestamp**: 2026-09-21T00:38:00-04:00
- **Agents**: codex
- **Sources**: /propagate-decision AC266
- **Index**: [[index]]

- **Problem**: Slice 09 counted AC266 real-device VoiceOver/Safari and NVDA/Firefox evidence in its implementation-completion denominator even though the owner cannot practically access both required devices. Keeping that unavailable manual attestation in the implementation sequence blocks every later Phase 2 slice, while treating automation, simulation, or deferral as acceptance would fabricate evidence.
- **Options considered**: (A) keep AC266 in Slice 09 completion and halt Phase 2; (B) mark AC266 passed or waived; (C) preserve all authored IDs and fail-closed evidence contracts, exclude AC266 from Phase 2 implementation completion, and retain it as a mandatory post-Phase-2 production-readiness and release gate.
- **Decision**: Option C. Phase 2 retains 2,000 authored criteria and 1,999 implementation-completion criteria. Slice 09 retains 283 contiguous authored IDs and uses a 282-criterion implementation-completion denominator. AC266 remains authored, unchecked, owner-deferred, and must never be represented as passed, waived, simulated, or inferred. Slice 10 remains locked until AC209, AC211, and AC265 pass.
- **Downstream**: The Phase 2 plan, Slice 09 and aggregate progress records, architecture map, release-evidence runbook, policy tests, and progress validator distinguish implementation completion from production readiness. Existing AC266 contracts, protected workflows, and real macOS/Safari/VoiceOver plus Windows/Firefox/NVDA requirements remain unchanged and must pass before production readiness or release.
- **Reversibility**: High for implementation sequencing, but no production release may erase or weaken the deferred real-device evidence obligation without a new owner decision and full downstream propagation.

## DEC-102: Browser gates run Google Chrome only, on the engine-family wire contract (2026-09-24)

- **Occurrences**: 1
- **Latest timestamp**: 2026-09-24T12:20:00-04:00
- **Agents**: codex
- **Sources**: Owner instruction - Chrome-only browser gates (branch codex/chrome-only-browser-gates)
- **Index**: [[index]]

- **Problem**: Every Playwright project installed and launched Playwright's bundled Chromium download, including the protected staging AC266 automated-axe collector. Local runs, CI, and release evidence could therefore validate a browser build the owner never uses, while the desktop of record runs the installer-provided Google Chrome. The project Playwright skill named Chromium as the pull-request baseline, so the repository had no single statement of which browser the gates must exercise.
- **Options considered**: (A) keep bundled Chromium and treat Google Chrome as a manual-only check; (B) install Google Chrome dynamically inside the workflows so any runner could satisfy the gate; (C) run the installer-provided Google Chrome through Playwright's Chrome channel (channel: 'chrome') and fail closed on a runner that lacks it.
- **Decision**: Option C. Owner-scoped: the browser automation and CI gates for this project run Google Chrome only, and no Chromium fallback is provided. All three Playwright entry points (playwright.config.ts, playwright.s09-real.config.ts, tests/e2e/support/ac265-hosted-config.ts) declare channel: 'chrome', and infra/workflows/verify-system-chrome.sh asserts the binary before any gate runs. The AC266 automated-axe artifact keeps its locked name: 'chromium' engine-family literal and its ac266-automated-axe-v1 schema version, because that field records the render engine rather than the distributor build; Google Chrome is Chromium-based, so no retained or deployed evidence interpretation changes and no new device acceptance is claimed. The Playwright skill mirrors were deliberately left unedited for this change.
- **Downstream**: CI and staging verification now depend on the official Google Chrome package being present on the runner; a runner without it fails closed instead of silently degrading. Verified on the self-hosted fleet - three wejammin runners on this host, Chrome 154.0.8037.57 - with 101/101 functional checks reported as [chrome], the production-built S09 real-route suite, 100% coverage across 4,835 tests, and pnpm validate exit 0. Launched processes resolved to /opt/google/chrome/chrome. The GitHub-hosted ubuntu-24.04 image already ships Google Chrome (152.0.7977.82, image 20260907.300.1), so the AC265 authorization-foundation preflight passes there, with a hosted/local Chrome version skew of 152 versus 154 that matters for evidence reproducibility. The AC266 real-device VoiceOver/NVDA obligation is untouched: this decision covers automated browser gates only and claims no hosted acceptance.
- **Reversibility**: High. Reverting to bundled Chromium means restoring the playwright install chromium steps and dropping the channel pin; the fail-closed preflight is the only new runner requirement.

## DEC-103: AC265 staging identities come from Cloud Identity Free, with exactly one narrow expiring CMS read grant (2026-09-25)

- **Occurrences**: 1
- **Latest timestamp**: 2026-09-25T15:52:00-04:00
- **Agents**: codex
- **Sources**: Owner decision - Cloud Identity Free source for dedicated AC265 staging test identities, plus a single narrow read-grant exception (branch codex/ac265-free-identity-decision)
- **Index**: [[index]]

- **Problem**: Slice 09 could not provision the dedicated AC265 staging test identities because two gates were open. The identity source was undecided (Cloud Identity Free on the owner-controlled `wejamm.in` domain versus an existing Google organization) under a cost ceiling that excludes paid Workspace seats, and the sole-admin/no-other-CMS-authority rule had no dated exception. Separately, the locked `entitled_read` role requires an actor holding `cms.schema_registry.read` without `cms.schema_designer`, because the deployed server resolver selects `ownerFull` first whenever `cms.schema_designer` is present, so the role cannot be produced by the sole admin account.
- **Options considered**: (A) leave both gates open and continue to hold the matrix; (B) source identities from paid Google Workspace or an existing organization; (C) source them from Cloud Identity Free on `wejamm.in` with no paid Workspace, keep the existing account as sole admin, and approve exactly one narrowly scoped, expiring `cms.schema_registry.read` staging grant as an explicit exception.
- **Decision**: Option C. Dedicated AC265 staging test identities come from **Cloud Identity Free** on `wejamm.in` with **no paid Google Workspace**. The existing owner account remains the **sole admin**, and exactly one narrowly scoped, expiring `cms.schema_registry.read` staging test-account grant is authorized as an explicit exception; no test account receives `cms.schema_designer` or admin/design permission. Recorded in the [2026-09-25 decision record](../pipeline/progress/verification/2026-09-25-ac265-free-identity-and-read-grant-decision.md), which resolves gates 1-2 of the [2026-09-23 dedicated-accounts record](../pipeline/progress/verification/2026-09-23-ac265-dedicated-staging-test-accounts-decision.md) and leaves its privileged-admin-question gate unanswered. **Nothing is provisioned and no criterion closes**: Google-side Cloud Identity account/administrator creation, `wejamm.in` domain verification, and terms acceptance remain owner-performed and outstanding.
- **Downstream**: Unblocks owner-performed provisioning of the nonprivileged staging identities and the single expiring read grant, with the sole-admin decision retained rather than superseded. `admin_step_up` still needs a confirmed enrolled factor and a completed current-context step-up (the staging dashboard showed App Authenticator `Enabled` on the Free plan, but enrolled factors were not confirmed), and the step-up surface decision remains open. `staff_case_scoped` stays a Slice 09 scope blocker, not an account blocker. The runner contract still forbids the runner from creating identities, grants, mandates, organizations, cases, content schemas, or prerequisites, so provisioning happens outside the runner under owner control. Resolves the stale `supabase/config.toml` claim that MFA requires the Supabase Pro plan.
- **Reversibility**: Medium. The identity source and the single narrow grant can be changed by a new dated owner record, but hosted AC265 acceptance remains contingent on genuine provisioned identities, a confirmed enrolled factor, and the unprovisioned broker/evidence services, none of which this decision supplies.

## DEC-104: AC209 and AC211 move to post-implementation production-evidence gates without being passed or waived (2026-09-25)

- **Occurrences**: 1
- **Latest timestamp**: 2026-09-25T20:30:00-04:00
- **Agents**: codex
- **Sources**: /propagate-decision AC209/AC211 prelaunch production-evidence rescope
- **Index**: [[index]]

- **Problem**: The owner cannot produce genuine production evidence before the product exists. Slice 09 required a live-delivery receipt for `P2-S09-AC-209` and a complete-UTC-day Tier 2 SLO report for `P2-S09-AC-211`, but the pipeline is prelaunch with no production deployment carrying the exact release and no genuine production traffic. Keeping both inside the active implementation-completion denominator blocked Slice 09 and every dependent slice on evidence that cannot exist yet, which is circular; treating the absence as acceptance would fabricate evidence.
- **Options considered**: (A) keep AC209 and AC211 as active Slice 09 implementation gates and halt Phase 2 until production exists; (B) mark both passed, waived, or satisfied by staging, synthetic, or fixture evidence; (C) preserve all 283 authored IDs and their fail-closed evidence contracts, exclude both from the active implementation denominators, and retain them as mandatory production-evidence gates on distinct timelines.
- **Decision**: Option C. Phase 2 implementation completion uses a **1997-criterion denominator** and Slice 09 uses a **280-criterion denominator**; Slice 09 is **279/280 active** with all 283 authored IDs retained. `P2-S09-AC-265` is the **only** Slice 10 implementation prerequisite, and it is staging-only by contract. AC209 and AC211 remain authored and unchecked and must never be represented as passed, waived, simulated, or inferred. This supersedes DEC-101's Slice 10 dependency sentence; DEC-101's AC266 deferral otherwise stands.
- **Distinct gate timing**: AC209 is a **production-rollout/post-deployment evidence gate**. It does not gate Slice 10 implementation or the initial controlled production deployment needed to produce its evidence; it must pass before alerting is declared ready. AC211 is **post-launch operational SLO acceptance**. It does not gate the initial launch and is mandatory after initial launch, once genuine production traffic spans a complete UTC day; it requires the natural floors of 200 commands, 200 protected RPCs, 200 acceptances, and one queue first attempt plus all five locked SLO results. AC266 remains the separate **pre-release** real-device accessibility gate. AC209 and AC211 are not pre-release blockers, and AC266's pre-release label must not be copied onto them.
- **Downstream**: The Phase 2 plan, Phase 2 and Slice 09 trackers, overall index, spec-pipeline tracker, progress blockers, architecture map, release-evidence runbook, progress-consistency validator, focused policy tests, session record, and propagation record now distinguish implementation completion from production acceptance across these three timelines. The alert policy, alert boundaries, SLO thresholds, DLQ and queue definitions, the protected AC211 collector, and their tests remain Slice 09 implementation scope and stay in the tree unchanged.
- **AC265 boundary and remaining work**: AC265 remains the only Slice 10 implementation prerequisite and is an active implementation gate, but it **cannot close prelaunch** as currently implemented. Its contract is staging-only, yet its declared acceptance route requires the combined release-evidence verifier, which pins `alerting.deploymentId` and `slo.deploymentId` to `expected.productionDeploymentId` while the evidence shape requires all four members. Closing AC265 therefore requires production-bound AC209/AC211 evidence, which is the circularity this decision removes.
- **Follow-up (not delivered here)**: implement a hosted-scope acceptance route: add a hosted-scope evidence shape and hosted-only expected identity (`{artifact, hostedE2e, accessibility, verifiedAt}` without `productionDeploymentId`/`productionDeployedAt`) and route AC265 and AC266 acceptance through the retained hosted-report verifier plus the existing axe and manual verifiers. `alerting` and `slo` remain mandatory in the production sidecar for AC209 and AC211. Delivered as a separate follow-up PR so this rescope stays a policy and record correction.
- **Reversibility**: High for implementation sequencing, but no production release may erase or weaken the deferred production-evidence obligations, and no initial launch may be represented as alerting-ready before AC209 passes, without a new owner decision and full downstream propagation.

## DEC-105: AC265 hosted acceptance is a mandatory pre-release gate, not a Slice 10 implementation prerequisite (2026-09-26)

- **Occurrences**: 1
- **Latest timestamp**: 2026-09-26T18:02:36.994Z
- **Agents**: codex
- **Sources**: Owner decision - move P2-S09-AC-265 to pre-release
- **Index**: [[index]]

- **Problem**: AC265's genuine hosted staging matrix and exact-artifact provenance remain open, but requiring that external acceptance before Slice 10 implementation recreates a dependency lock while the product is still in development.
- **Options considered**: Keep AC265 as the active implementation prerequisite; claim it passed or waive its evidence; or retain every authored evidence requirement and move acceptance timing to pre-release while allowing implementation to proceed.
- **Decision**: Move P2-S09-AC-265 to a mandatory pre-release production-readiness/release gate. It is excluded only from the Slice 09 and Phase 2 active implementation-completion denominators. Slice 09 is 279/279 active with 283 authored IDs; Phase 2 has 1,996 active of 2,000 authored IDs. Slice 10 implementation has no AC265 prerequisite. AC265 remains authored and unchecked and must not be called passed, waived, simulated, or inferred. Its nine real staging role sessions, ten scenarios, signed exact artifact provenance, retained hosted report, and authenticated receipt remain necessary before release.
- **Other gates**: AC266 remains a separate pre-release real-device accessibility gate. AC209 remains a production-rollout/post-deployment alerting-readiness gate. AC211 remains post-launch operational SLO acceptance. No gate is deleted, and this decision does not authorize launch while AC265 or AC266 is unproven.
- **Downstream**: Update the Phase 2 plan, active progress records, architecture/runbooks, validator, and focused tests. Retain dated historical records and prior decisions; this decision supersedes DEC-104's sentence that AC265 is the only Slice 10 prerequisite, not DEC-104's AC209/AC211 timing.
- **Reversibility**: A future timing change requires a new owner decision and propagation. The hosted evidence requirements remain fail-closed.

## DEC-106: CMS authors need protected entry bootstrap and draft-detail reads (2026-09-26)

- **Occurrences**: 1
- **Latest timestamp**: 2026-09-26T19:16:50Z
- **Agents**: codex
- **Sources**: Owner approval of protected entry-create and draft-detail API contracts for Slice 10
- **Index**: [[index]]

- **Problem**: IA03 CMS-05 promises creation and editing of content entries, but BE03b defines only `POST /api/v1/cms/entries/{entryId}/revisions`, which requires an existing active entry and a positive readable base revision. Its history GET returns summaries and hashes, not editable values. Direct browser database access is revoked. Consequently the current contracts cannot bootstrap the first revision or load an existing draft for the editor.
- **Options considered**: Keep Slice 10 limited to out-of-band pre-provisioned entries and leave create/edit incomplete; or add protected entry-create and draft-detail routes with server-derived identity, assignment, active-schema validation, and a complete authorization boundary.
- **Decision**: Add protected initial-entry-create and authorized draft-detail-read contracts to the locked CMS specifications and Slice 10 implementation scope. Initial creation must atomically create an active entry, its attributable first draft revision, assignment, audit/idempotency/outbox effects, and return an authorized canonical resource; retries may not duplicate effects. Draft detail must return only the caller-authorized editable values and provenance, with hidden entries concealed as 404 and visible-but-unauthorized entries denied as 403. Neither route may trust caller-supplied owner, acting party, capability, or authority. Browser direct table access stays revoked.
- **Downstream**: Propagate through IA03/deep dive, BE03b route registry and Zod/authorization/data/error contracts, FE03 loader/form mapping, Phase 2 Slice 10 acceptance criteria and trackers, code, tests, runbooks, and spec graph. Preserve existing CMS-03B-01 through -09 operation IDs and existing Slice 09 evidence gates. Do not mark new criteria complete until implemented and verified.
- **Reversibility**: Medium. Any removal of protected bootstrap or detail reads would again require an owner decision and downstream propagation because CMS-05 cannot otherwise fulfill its locked create/edit outcome.

## DEC-107: CMS-06 conflict resolution requires a private durable conflict record (2026-09-26)

- **Occurrences**: 1
- **Latest timestamp**: 2026-09-26T20:35:12Z
- **Agents**: codex
- **Sources**: Owner approval of durable private CMS conflict record for Slice 10
- **Index**: [[index]]

- **Problem**: BE03b defines CMS-03B-02 conflict resolution with conflictId, current unresolved-conflict lookup, and atomic close, but its eleven-table canonical model contains no conflict record, field envelope, RLS boundary, or index. A wire-only conflictId cannot safely support durable resolution.
- **Options considered**: Add a twelfth private canonical conflict table and propagate the locked BE03b model; or defer CMS-06 until an alternate persistence design is approved.
- **Decision**: Add the private conflict table. The record must bind entry and base/theirs/yours revision identities, changed paths and safe hashes, open/resolved/superseded state, version and timestamps, one open conflict per entry, current actor/assignment and RLS authority, and atomic resolution with the resulting revision/audit/outbox. No browser table grants or caller authority assertions.
- **Downstream**: Amend BE03b canonical records and all table counts, conflict data flow, authorization and tests; check IA03/FE03 references and Phase 2 Slice 10 plan for impact; add a forward migration and pgTAP tests. Preserve all eleven existing table definitions and operation IDs. Keep CMS-06 criteria unchecked until route, RPC, UI and evidence pass.
- **Reversibility**: Medium. Replacing the durable record with a different persistence design requires another owner decision and propagation.

## DEC-108: Complete CMS schema activation with private review and real prerequisite producers (2026-10-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-10-02T02:06:54Z
- **Agents**: codex
- **Sources**: Owner approval of Slice 09 activation producer amendment
- **Index**: [[index]]

- **Problem**: CMS-04 requires independently approved immutable schema activation, but BE03a's eight-operation registry has no successor/dry-run/review producers, installed activation misuses CFG setting-value review ownership, and real source/template producers follow Slice 09.
- **Decision**: Approve the exact amendment recorded in .memory/pipeline/progress/verification/2026-10-02-slice-09-activation-amendment-approval.md, approved source SHA-256 e481bb9046703bbbd5ace3ef60b30d75bf21fb766f77477481e8a4cfcdaf33ca. Add CMS-owned private review, append-only decisions and bounded assignments; protected CMS-03A-09 through -14; approval-only cms.schema_review and owner-only cms.schema_review.assign; stable server-derived private binding evidence; actual successor/dry-run/scan/transform producers. Move only minimum protected source-row and immutable compatible-template prerequisites into Slice 09. Existing owner remains sole admin.
- **Downstream**: Cascade IA03/deep dive, BE03a/03b/03c prerequisite references, FE03, capability/route/OpenAPI contracts, Phase 2 plan and progress. Add open criteria and recompute depth floor before implementation acceptance. Existing private-binding transport and independently verified AC250 are retained.
- **Boundaries**: Approval creates no real account, assignment, grant, provider enrollment, paid service, deployment or acceptance receipt. All 17 activation criteria and new criteria remain open. AC209/AC211 remain post-deployment/post-launch and AC265/AC266 mandatory pre-release, authored and unchecked. Remaining Slice 10/12 scope stays gated. Public template activation is a separate Slice 12 gap, not AC169's prerequisite.
- **Reversibility**: Medium. Changing private ownership, reviewer authority or dependency scope requires owner decision and downstream cascade.

## DEC-109: Editorial workflow policies come from a code-owned versioned registry (2026-10-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-10-02T03:58:16.473Z
- **Agents**: claude
- **Sources**: implement-slice (Slice 09 DEC-108 cascade)
- **Index**: [[index]]

- **Problem**: CMS-03B-10 entry create refuses because `platform_private.cms_editorial_workflow_policy_evidence` returns NULL; DEC-108 needs real entries for the second activation path and no editorial policy source existed (BE03b DEC-108 attribution; propagation-scan-2026-09-28-cms-editorial-policy-source).
- **Options considered**: (A) code-owned versioned registry seeded by forward migration, shared shape with the DEC-108 schema-review registry; (B) owner-enrolled append-only persisted registry with a new protected enrollment operation/UI; (C) Slice 07 protected typed settings.
- **Decision**: A, chosen by the owner 2026-10-02. One versioned policy module in code (key, version, policyHash, riskClass, requiredDecisionCount 1..8, requiredCapabilities); a forward-only migration seeds immutable rows; each content-type version binds one policy key/version at activation; the evidence seam resolves the bound immutable row and returns NULL on absence, ambiguity or malformed data. Caller-supplied policy is never authority. Supersedes the scan proposal of owner enrollment with no default rows.
- **Downstream**: BE03b/IA03 policy-source text, entry authority migration, Slice 09 prerequisite path, Slice 10 editorial review, Slice 11 publication preflight.
- **Reversibility**: Medium (a later persisted registry can replace the seam).

## DEC-110: Protected workflow policies are four disclosure classes with their own specialist reviewer capabilities (2026-10-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-10-02T03:58:16.474Z
- **Agents**: claude
- **Sources**: implement-slice (Slice 09 DEC-108 cascade)
- **Index**: [[index]]

- **Problem**: the registry allowlist held only ordinary keys (editorial, editorial.default, cms.content.workflow, cms.standard), so the protected path (P2-S09-AC-091) was unreachable; IA03 Risk review and BE03b protected-review rules require policy/legal/security/financial disclosure classes with two distinct humans and a named specialist capability.
- **Options considered**: (A) four protected class keys each with its own specialist capability; (B) four keys sharing one specialist capability; (C) one generic protected key.
- **Decision**: A, chosen by the owner 2026-10-02. Existing four keys stay ordinary (one independent reviewer). Add protected keys cms.disclosure.policy, cms.disclosure.legal, cms.disclosure.security, cms.disclosure.financial at version 1, each requiring at least two distinct human decisions including one holder of the class specialist capability cms.reviewer.policy, cms.reviewer.legal, cms.reviewer.security or cms.reviewer.financial respectively. DEC-108 schema reviews follow the same key risk class: ordinary needs one cms.schema_review reviewer, protected needs two.
- **Downstream**: code-owned policy registry members, capability registry, BE03a/BE03b/IA03 registry text, Slice 09 AC091 protected path, Slice 10/11 editorial review tests.
- **Reversibility**: Medium.

## DEC-111: Step-up MFA is delivered by server-mediated Worker operations and a protected step-up page (2026-10-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-10-02T03:59:51.269Z
- **Agents**: claude
- **Sources**: implement-slice (Slice 09 DEC-108 cascade)
- **Index**: [[index]]

- **Problem**: DEC-108 decisions/assignments/activation (and later S11 publish, S14 revoke, S15 holds, S16 lifecycle) require recent MFA and answer 401 STEP_UP_REQUIRED, but no surface lets a signed-in user complete an MFA challenge. BE01a keeps Supabase Auth as MFA authority; the Worker only reads amr MFA timestamps (apps/worker/src/authentication/production-token.ts); the 2026-09-25 free-identity record left the surface open.
- **Options considered**: (A) server-mediated step-up challenge/verify operations that call Supabase MFA server-side and rotate the first-party session to an aal2 token, with a protected step-up page and safe returnTo; (B) browser supabase-js MFA then token exchange; (C) full re-sign-in with a new step_up intent.
- **Decision**: A, chosen by the owner 2026-10-02. The browser never handles Supabase tokens; one reusable surface serves every later slice. Includes TOTP factor enrollment if no enrollment surface exists.
- **Downstream**: BE01a/FE01 new operations and page, BE00 STEP_UP_REQUIRED recovery routing, Slice 09 prerequisite scope (first consumer), Slices 11/14/15/16.
- **Reversibility**: Medium.

## DEC-112: CMS rich text uses an owned versioned rich_text.v1 AST (2026-10-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-10-02T04:00:41.858Z
- **Agents**: claude
- **Sources**: implement-slice (Phase 2 decision queue)
- **Index**: [[index]]

- **Problem**: architecture/IA03 require rich_text as an approved structured AST, never executable HTML, but no grammar, validator or renderer was chosen; migration 20260927540000 refuses every non-null rich_text value (propagation-scan-2026-09-30-cms-rich-text-ast).
- **Options considered**: (A) own minimal versioned grammar; (B) allowlisted TipTap/ProseMirror JSON; (C) Portable Text subset.
- **Decision**: A, chosen by the owner 2026-10-02. rich_text.v1 blocks: paragraph, heading levels 2-4, bulleted list, numbered list, list item, quote; marks: bold, italic, code; links limited to https, mailto and internal first-party routes; no inline embeds (media stays in governed blocks). Shared TypeScript and PostgreSQL validators, RFC 8785/JCS canonical hash, typed React renderer, constrained native editor. Bounds (depth/children/bytes) follow the BE03b JSON caps.
- **Downstream**: architecture/IA03/BE03a validator registry/BE03b/FE03 cascade; replaces the 20260927540000 refusal after RED to GREEN; Slice 10 AC031 and AC050-052.
- **Reversibility**: Medium (versioned grammar allows v2).

## DEC-113: Template and pattern activation is reviewer-gated through generalized CMS review machinery (2026-10-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-10-02T04:01:00.277Z
- **Agents**: claude
- **Sources**: implement-slice (Phase 2 decision queue)
- **Index**: [[index]]

- **Problem**: BE03c records template activation as an unresolved contract gap (BE03c:226-230; propagation-scan-2026-09-28-cms-template-activation); IA03 requires create and activate for templates and patterns; no authority was chosen.
- **Options considered**: (A) reviewer-gated, generalizing the DEC-108 review/decision/assignment machinery to template and pattern subjects; (B) designer-only activation with recent MFA; (C) split by risk.
- **Decision**: A, chosen by the owner 2026-10-02. A designer submits; independent assigned reviewer(s) decide with recent MFA (DEC-111 step-up); an atomic CAS switch emits cms.template.activated.v1 (pattern equivalent). Required decision count = strictest DEC-110 workflow policy among the bound content types (ordinary 1, protected 2 with class specialist). Same-key serialization, exact replay, no event on refusal, 403/404 concealment.
- **Downstream**: IA03/BE03c/FE03 cascade, new protected operations, Slice 12 criteria, Slices 11 and 15 safe publication.
- **Reversibility**: Medium.

## DEC-114: Build the scope-locked CMS-15/16 and CFG-05C-01 flows in Phase 2 instead of moving their criteria (2026-10-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-10-02T04:01:35.112Z
- **Agents**: claude
- **Sources**: implement-slice (Phase 2 decision queue)
- **Index**: [[index]]

- **Problem**: the Phase 2 scope lock (phases/phase-2.md Scope lock) defers CMS-15 localization, CMS-16 related content and config import/export/restore, while the approved plan carries Phase 2 criteria for them (Slice 12 AC033-038; Slice 16 AC011-013, AC017, AC019-021).
- **Options considered**: (A) un-defer and build the flows those criteria require; (B) count-preserving move of the criteria out of Phase 2; (C) contract-level fail-closed satisfaction.
- **Decision**: A, chosen by the owner 2026-10-02, consistent with the more-work-now default. Implement exactly the flows the criteria require per BE03c/BE05c, close their spec gaps first (related-content eligible-target authority, locale source-stale fan-out bound and event key), and amend the scope-lock line.
- **Downstream**: phases/phase-2.md scope lock, IA03/IA05, BE03c/BE05c/FE03/FE05 cascades, Slices 12 and 16 size.
- **Reversibility**: Low once shipped.

## DEC-115: Navigation, route/slug and discovery-metadata candidates are approved through generalized CMS review (2026-10-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-10-02T04:01:55.869Z
- **Agents**: claude
- **Sources**: implement-slice (Phase 2 decision queue)
- **Index**: [[index]]

- **Problem**: BE04a Menu/MenuVersion/RouteRecord/RedirectRecord/DiscoveryMetadataVersion use draft-review-approved-active and DLV-NAV-API-02 requires an approved previewed candidate, but no submit/review/approve operation exists.
- **Options considered**: (A) generalized DEC-108/DEC-113 CMS review machinery with nav/route/metadata subjects; (B) publish-is-approval; (C) Slice 08 admin task-inbox approval.
- **Decision**: A, chosen by the owner 2026-10-02. Editor submits, an assigned independent reviewer approves with recent MFA (records approved_by_person_id/approved_at), and a publisher activates via DLV-NAV-API-02. Count from the code-owned policy registry (DEC-109/110; ordinary 1).
- **Downstream**: BE04a/FE04/IA04 cascade, new submit/decide operations, Slice 13 criteria.
- **Reversibility**: Medium.

## DEC-116: Media scanning and renditions are $0 self-operated; Phase 2 hosted per-file cap is 50 MiB (2026-10-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-10-02T04:02:56.243Z
- **Agents**: claude
- **Sources**: implement-slice (Phase 2 decision queue)
- **Index**: [[index]]

- **Problem**: Slice 14 needs a malware scanner and image-rendition transforms (ENGINEERING-STANDARDS upload safety; BE04b ingest/verification), no providers were chosen, and BE04b allows 5 GiB uploads while hosted Supabase Free caps files at 50 MiB. Only Workers Paid is an authorized paid service.
- **Options considered**: (A) self-operated ClamAV scanner container pulling identifier-only jobs over an authenticated channel, WASM image renditions in Workers, 50 MiB Phase 2 cap as a plan-limit profile; (B) Supabase Pro plus a paid scanning API; (C) quarantine-only hosted pipeline.
- **Decision**: A, chosen by the owner 2026-10-02. Uploads above 50 MiB refuse with a typed error under a recorded plan-limit profile; the 5 GiB rule remains the contract ceiling for a later plan upgrade. Local tests use a scanner sandbox with the same contract.
- **Downstream**: architecture provider table, BE04b/FE04 limits and scanner contract, Slice 14 criteria, operations runbook for the scanner host.
- **Reversibility**: High (provider seam).

## DEC-117: Slice 13 AC171 screen-reader smoke is automated, and AC266 real-device scope extends to S13 delivery surfaces (2026-10-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-10-02T04:03:34.994Z
- **Agents**: claude
- **Sources**: implement-slice (Phase 2 decision queue)
- **Index**: [[index]]

- **Problem**: P2-S13-AC-171 requires a VoiceOver/NVDA smoke; Slices 03/05/07 closed identical wording with automated Chrome accessibility-tree smoke, while DEC-101 keeps real VoiceOver/Safari and NVDA/Firefox as the mandatory pre-release AC266 gate outside the Phase 2 denominator.
- **Options considered**: (A) automated smoke plus extending AC266 real-device scope to S13 public delivery surfaces; (B) automated only; (C) split the clause into a deferred real-device gate.
- **Decision**: A, chosen by the owner 2026-10-02. AC171 closes on automated Chrome accessibility-tree screen-reader smoke (roles, names, landmarks, focus order) with evidence stated as automated; AC266 stays authored, unchecked and outside the denominator, and its pre-release real-device scope and runbook now include S13 public delivery surfaces. Never represent automated smoke as real-device evidence.
- **Downstream**: S13 AC171 evidence wording, AC266 plan/tracker/runbook scope.
- **Reversibility**: High.

## DEC-118: Slice 17 observability and backup gates use the scoped staging/configuration reading (2026-10-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-10-02T04:04:03.280Z
- **Agents**: claude
- **Sources**: implement-slice (Phase 2 decision queue)
- **Index**: [[index]]

- **Problem**: P2-S17-AC-008/009 require verify-infrastructure across observability/backup/rollback and recovery runbooks, an earlier verify-infrastructure run marked logging/alerting BLOCKED for lack of AC209/AC211 evidence, those criteria are outside the Phase 2 denominator, and ENGINEERING-STANDARDS says Supabase Free has no PITR and local restore drills are diagnostic only.
- **Options considered**: (A) scoped reading on staging + configuration + diagnostic local restore drill; (B) wait for AC209 production alerting evidence; (C) buy Supabase Pro PITR first.
- **Decision**: A, chosen by the owner 2026-10-02. Slice 17 passes on staging and configuration evidence (structured logs, alert rules configured and test-fired in staging, rollback exercised) plus a local restore drill recorded as diagnostic with no RPO/RTO claim. AC209/AC211 stay on their own timelines; protected production writes stay disabled per ENGINEERING-STANDARDS Availability and Recovery.
- **Downstream**: Slice 17 verify-infrastructure scope, runbook evidence wording.
- **Reversibility**: High.

## DEC-119: A protected owner CMS grant operation grants, renews and revokes bounded CMS capabilities (2026-10-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-10-02T04:05:36.213Z
- **Agents**: claude
- **Sources**: implement-slice (Phase 2 decision queue)
- **Index**: [[index]]

- **Problem**: the one-shot owner bootstrap (20260910023405) grants only cms.schema_registry.read and cms.schema_designer (plus two admin reads), each expiring within seven days with no renewal, and no command grants cms.author, cms.editor, cms.template_designer, publisher or the DEC-110 specialist reviewer capabilities; CMS checks organization_actor_grant and never consults Slice 08 admin_capability_grants. Hosted CMS would stop working a week after bootstrap.
- **Options considered**: (A) protected owner CMS grant operation plus console form; (B) route CMS authority through Slice 08 admin grants; (C) operator SQL runbook.
- **Decision**: A, chosen by the owner 2026-10-02. The receipt-derived owner, with DEC-111 step-up MFA, grants, renews and revokes bounded-duration CMS capabilities on organization_actor_grant to existing humans in the organization, including renewing their own designer/assign authority; fully audited with idempotency, CAS and outbox; confers no admin or delegation authority; creates no identity. The owner remains sole admin.
- **Downstream**: IA03/BE03a (or owning CMS shard)/FE03 cascade, capability registry, Slice 09/10 prerequisite scope, hosted CMS operation.
- **Reversibility**: Medium.

## DEC-120: Standing CMS capability grants last up to 90 days; schema-review assignments stay at most 7 days (2026-10-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-10-02T13:01:11.147Z
- **Agents**: claude
- **Sources**: implement-slice (Phase 2 decision queue)
- **Index**: [[index]]

- **Problem**: the DEC-119 owner grant operation was specified with a 7 UTC day maximum borrowed from the DEC-108 assignment bound; no source sets a standing-role limit, so every author/editor/reviewer/designer grant would need weekly renewal and schedules beyond a grant end would fail closed.
- **Options considered**: 90 days; keep 7 days; 365 days; per-capability terms.
- **Decision**: 90 days, chosen by the owner 2026-10-02. Standing CMS grants (author, editor, reviewer and specialists, designer, publisher, curators, navigation/media) may run up to 90 UTC days and are renewable with step-up; revocation stays immediate. DEC-108 schema-review assignments remain at most 7 days.
- **Downstream**: BE03a CMS-03A-15/16 validThrough bound, grant contracts and DB CHECK, FE03 grant console validation, S11 schedule authority recheck.
- **Reversibility**: High.

## DEC-121: Stale fallback-permitted locale fields keep serving the last approved translation (2026-10-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-10-02T14:05:32.572Z
- **Agents**: claude
- **Sources**: implement-slice (Phase 2 decision queue)
- **Index**: [[index]]

- **Problem**: CMS-15 localization (DEC-114) marks fallback-permitted translated fields stale when the source changes; IA03 only blocks no_fallback fields and says unchanged fields keep approval, but never says what public readers see for a stale field.
- **Options considered**: (A) block the locale until every stale field is revalidated; (B) keep serving the last approved translation, marked stale for editors; (C) resolve stale fields through the fallback chain to the default locale.
- **Decision**: B, chosen by the owner 2026-10-02. Public delivery keeps the last approved translation; editorial reads and the cms_locale_stale_total metric expose stale state until revalidation; no_fallback fields still block publication when missing.
- **Downstream**: BE03c/FE03/IA03 localization contract, Slice 12 AC033-035, Slice 15 delivery resolution.
- **Reversibility**: High.

## DEC-122: Orchestrator criterion rulings for Slice 09 evidence gaps (AC300, AC678, AC774, AC1031, AC1166) (2026-10-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-10-02T22:05:55.966Z
- **Agents**: claude
- **Sources**: implement-slice (Slice 09 evidence)
- **Index**: [[index]]

- **Problem**: evidence lanes found five Slice 09 criteria whose text disagreed with locked infrastructure or slice ownership.
- **Options considered**: implement the literal text; reword to the locked source; move scope to the owning slice.
- **Decision** (orchestrator, owner may override): AC300 follows BE00 actor-scoped idempotency bindings (changed actor is a distinct binding; changed path with the same key is 409); AC678 records the provisional fingerprint object in cms_schema_migration_plans.dry_run_report with the sealed report as authority; AC774 refusals roll back and auth_mfa_registry_sweep persists expiry; AC1031 Slice 09 covers only its own step-up routes and the CMS-03B-06/07/09 step-up recovery is carried by Slice 11 criteria; AC1166 Slice 09 covers no_fallback declaration/storage and resolution semantics are Slice 12/15 delivery scope. Moved scope must appear in the receiving tracker.
- **Downstream**: Slice 09/11/12 trackers and plan rows, evidence index.
- **Reversibility**: High.

## DEC-122 (ratified): Owner ratifies nine Slice 09 criterion rewordings (2026-10-02)

- **Occurrences**: 1
- **Latest timestamp**: 2026-10-03T03:11:22.121Z
- **Agents**: claude
- **Sources**: implement-slice (Slice 09 evidence)
- **Index**: [[index]]

- **Problem**: nine Slice 09 criteria contradicted locked BE00/BE03a/BE05b sections or slice ownership; they had been reworded as orchestrator rulings and an independent audit noted they needed owner ratification.
- **Options considered**: ratify all; review each individually; implement the literal original text with spec amendments.
- **Decision**: ratified by the owner 2026-10-02: AC300 (idempotency actor-scoped per BE00), AC678 (plan provisional dry-run fingerprint; sealed report authority), AC774 (expired-enrollment refusal rolls back; sweep persists expiry), AC1031 (Slice 09 covers its own step-up routes; CMS-03B-06/07/09 step-up recovery moves to Slice 11), AC1166 (no_fallback resolution moves to Slice 12/15), AC285 (successor request includes the OD-4 locale pair), AC431 (403 when readable, 404 when concealed), AC942 (schema violations 400 per BE05b, self-target 422), AC1049 (revoke sends the review expectedVersion). Moved scope (AC1031, AC1166) must appear as explicit receiving criteria in the Slice 11/12 plans.
- **Downstream**: Slice 09/11/12 plan and tracker rows, ledger rewording table.
- **Reversibility**: High.

## DEC-123: New content types bind a default template through their first successor, not at creation (2026-10-03)

- **Occurrences**: 1
- **Latest timestamp**: 2026-10-03T06:14:38.884Z
- **Agents**: claude
- **Sources**: implement-slice (Slice 09 evidence)
- **Index**: [[index]]

- **Problem**: Slice 09 AC003/045/049 required CMS-03A-01 to atomically bind a default template at type creation, but the template-compatibility guard and the BE03c exact contentTypeId resolver require the template to list the type id, which is generated inside the create call.
- **Options considered**: (A) bind on the first successor version; (B) compatibility by content-type key; (C) a type-id reservation operation.
- **Decision**: A, chosen by the owner 2026-10-03. A new type initial version is created without a template binding; once the type exists, a template declares compatibility with its id and the binding is added through a successor version reviewed and activated as usual. AC003/045/049 positive clauses are reworded accordingly; the exact-id compatibility model and resolver stay unchanged.
- **Downstream**: BE03a CMS-03A-01 template-binding text, FE03 create form, Slice 09 AC003/045/049, Slice 12 template binding flows.
- **Reversibility**: High.

## DEC-124: Owner ratifies 16 Slice 09 criterion rewordings (2026-10-03)

- **Occurrences**: 1
- **Latest timestamp**: 2026-10-03T17:11:54.903Z
- **Agents**: claude
- **Sources**: implement-slice phase-2 slice-09 R14 owner ratification
- **Index**: [[index]]

- **Problem**: Audit #3 found 16 Slice 09 criteria checked on orchestrator rewordings never ratified by the owner, some with defects (AC658 contradicted its own test, AC025 contradicted BE00, AC685 said "exactly eighteen" while 51 RPCs are executable, AC181 said "immutable" while the helper is STABLE).
- **Options considered**: ratify all proposed corrected texts; review each individually; reject and keep originals (several false against the amended scope).
- **Decision**: Owner ratified the proposed texts verbatim for AC005, AC007, AC025, AC034, AC037, AC180, AC181, AC233, AC246, AC282, AC356, AC431 (refinement), AC658, AC685, AC708, AC1147. Each proposed text claims only what code and tests prove. Criteria re-check only on evidence.
- **Downstream**: Slice 09 plan and tracker criterion text; verification ledger rewording rows; S09 closure.
- **Reversibility**: High
- **Source**: scratchpad/decisions/r14-ratification-bundle.md (copied to the verification ledger)

## DEC-125: AC185 legal-hold and incident-fence enforcement over CMS records belongs to Slice 16 (2026-10-03)

- **Occurrences**: 1
- **Latest timestamp**: 2026-10-03T17:11:54.903Z
- **Agents**: claude
- **Sources**: implement-slice phase-2 slice-09 R14 owner ratification
- **Index**: [[index]]

- **Problem**: AC185 said legal hold and incident fencing block purge of CMS definitions, plans and reports, but no CMS purge path exists.
- **Options considered**: Slice 16 lifecycle foundation (receiving S16-AC029); build hold checks in Slice 09 over a nonexistent purge path; add a CMS purge path now.
- **Decision**: Slice 16 lifecycle foundation owns the enforcement (S16-AC029); Slice 09 states no purge path exists for CMS definitions, plans or reports.
- **Downstream**: AC185 text; Slice 16 AC029; P-04 author-where-owned.
- **Reversibility**: High
- **Source**: scratchpad/decisions/r14-ratification-bundle.md (copied to the verification ledger)

## DEC-126: CMS-03A-09 keeps the optional workflowKey/workflowVersion pair (2026-10-03)

- **Occurrences**: 1
- **Latest timestamp**: 2026-10-03T17:11:54.904Z
- **Agents**: claude
- **Sources**: implement-slice phase-2 slice-09 R14 owner ratification
- **Index**: [[index]]

- **Problem**: AC390's protected-to-ordinary successor case had no API producer; an optional pair was added to the CMS-03A-09 request contract without owner approval.
- **Options considered**: keep the optional pair; remove it (AC390 unprovable); a separate change-workflow-policy operation.
- **Decision**: Keep the pair: both absent or null keep the source member, both present replace it with a seeded registry member, anything else returns 422; review still uses the strictest-of policy.
- **Downstream**: BE03a CMS-03A-09 contract, OpenAPI, Worker, DB, AC390 text.
- **Reversibility**: Medium
- **Source**: scratchpad/decisions/r14-ratification-bundle.md (copied to the verification ledger)

## DEC-127: Rollback RPC may fail a dry_running schema migration plan (2026-10-03)

- **Occurrences**: 1
- **Latest timestamp**: 2026-10-03T17:11:54.904Z
- **Agents**: claude
- **Sources**: implement-slice phase-2 slice-09 R14 owner ratification
- **Index**: [[index]]

- **Problem**: No dry-run could end failed, so activationPreparation dryRunRef.failureCode (AC641) could never be produced from a real attempt.
- **Options considered**: cms_rollback_schema_migration fails a dry_running plan; a separate fail-dry-run RPC; no failed dry-runs.
- **Decision**: Keep the rollback RPC behaviour: on a dry_running plan it marks the latest attempt failed with the code and blocks the plan; recovery is a new CMS-03A-10 dry-run.
- **Downstream**: BE03a migration worker protocol, AC641 text, operator runbooks.
- **Reversibility**: Medium
- **Source**: scratchpad/decisions/r14-ratification-bundle.md (copied to the verification ledger)

## DEC-128: AC906 projections refetch AUTH-API-16 under the pull model (2026-10-03)

- **Occurrences**: 1
- **Latest timestamp**: 2026-10-03T17:11:54.904Z
- **Agents**: claude
- **Sources**: implement-slice phase-2 slice-09 R14 owner ratification
- **Index**: [[index]]

- **Problem**: AC906's "projections refetch AUTH-API-16" assumed an event consumer, but no MFA factor projection cache exists in Phase 2.
- **Options considered**: pull model, proven by a no-cache guard and a real multi-tab refetch test; build an event consumer with nothing to invalidate; defer.
- **Decision**: Pull model: AUTH-API-16 returns canonical state and a new ETag on every read; a guard proves no MFA projection cache exists; the multi-tab refetch is tested without a stubbed BroadcastChannel. A future cache owner must add an event consumer.
- **Downstream**: AC906 text; web MFA tests; any future projection cache.
- **Reversibility**: High
- **Source**: scratchpad/decisions/r14-ratification-bundle.md (copied to the verification ledger)

## DEC-129: Delete the CMS-03A-05 'unknown release target is 404' clause (2026-10-03)

- **Occurrences**: 1
- **Latest timestamp**: 2026-10-03T21:45:03.750Z
- **Agents**: claude
- **Sources**: implement-slice phase-2 slice-09 R14b DB3 ruling
- **Index**: [[index]]

- **Problem**: BE03a rows for CMS-03A-05 (block release registration) required 404 for an unknown release target, but no target is defined: references are 422 per the field matrix, an unregistered release key is 401 WEBHOOK_REJECTED, and the block key/version is created by the command.
- **Options considered**: delete the clause; define a release-channel registry to give it meaning; keep it open.
- **Decision**: Owner chose deletion. BE03a drops the A05 unknown-target 404 (changelog row); CMS-03A-08 keeps its 404 for unknown block versions.
- **Downstream**: BE03a rows ~164/1825/2219, Worker A05 refusal rows, AC034-adjacent evidence.
- **Reversibility**: High

## DEC-130: AC1122 admin MFA reset errors are proven per branch (2026-10-03)

- **Occurrences**: 1
- **Latest timestamp**: 2026-10-03T21:56:49.084Z
- **Agents**: claude
- **Sources**: implement-slice phase-2 slice-09 R14b web ruling
- **Index**: [[index]]

- **Problem**: AC1122 required the self-target copy plus schema field errors for one 422 MFA_RESET_INVALID response; production sends MFA_RESET_INVALID only for self-targeting and VALIDATION_FAILED for schema-invalid input, so no response carries both.
- **Options considered**: reword to each branch; make the API send both (new envelope variant outside BE00); leave open.
- **Decision**: Owner chose rewording: self-target gives 422 MFA_RESET_INVALID shown with the self-target copy; schema-invalid input gives VALIDATION_FAILED shown as field errors from the schema.
- **Downstream**: AC1122 text; admin MFA reset form tests.
- **Reversibility**: High

## Full Log

### DEC-001: The rights stack is the thesis, not an adjacency (2026-07-16)

- **Timestamp**: 2026-07-16T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate
- **Tags**: decision, ideation, recovered

- **Problem**: Rights & Ownership, Royalties, Licensing and Distribution emerged as 4 domains / ~70 sub-domains that **no user directive asked for**. The owner named a marketplace, digital goods, a directory and events. Marking them `core` was an agent inference and needed owner ratification.
- **Options considered**: (1) Thesis — all four `core`, platform holds the ownership record end-to-end. (2) Adjacency — all four `important`, ship directed scope first. (3) Partial — Rights `core`, the rest `important` (agent recommendation).
- **Decision**: **Option 1 — thesis.** All four `core`. Owner overrode the agent's "partial" recommendation, consistent with the maximal brief ("a platform musicians cannot live without").
- **Downstream**: Adds the most regulated, most integration-heavy scope in the industry (PRO/society registration, CWR exchange, DDEX conformance, statement ingestion) before any user liquidity exists. Massively raises `/create-prd-security` compliance surface. `/plan-phase` must not treat these as deferrable.
- **Reversibility**: Medium — priority can be lowered later, but the split-at-creation capture must exist from day one or the data is permanently lost for sessions that already happened.

### DEC-002: Fans are first-class users, not CRM records (2026-07-16)

- **Timestamp**: 2026-07-16T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate
- **Tags**: decision, ideation, recovered

- **Problem**: Does WeJammin have a fan-facing surface, or are fans objects inside an artist's CRM?
- **Options considered**: (1) B2B-only — fans are records. (2) Fan surface — fans get accounts. (3) Deferred — model the fan properly now, build the surface later (agent recommendation).
- **Decision**: **Option 2 — fans are users.** Fans get accounts, follow artists, receive gig alerts, discover shows. Owner overrode the agent's "deferred" recommendation.
- **Downstream**: (a) Consumer-scale traffic — fans outnumber professionals by orders of magnitude → rewrites the performance budget; (b) a second moderation population with different failure modes → Trust & Safety (24) load; (c) statutory duties that scale with consumer reach (age assurance / children's access, DSA thresholds) → `/create-prd-security`; (d) strengthens the open mobile-surface question — gig alerts are push notifications and show discovery is phone-shaped.
- **Reversibility**: Low — a consumer surface changes the growth model, the compliance posture and the architecture. Hard to unwind once fans exist.

### DEC-003: Structural classification remains `single-surface` despite the fan decision (2026-07-16)

- **Timestamp**: 2026-07-16T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate
- **Tags**: decision, ideation, recovered

- **Problem**: The sweep's synthesis asserted that a fan audience forces a multi-surface classification. This would have restructured the entire ideation folder tree.
- **Options considered**: (1) Accept the synthesis and reclassify multi-surface. (2) Verify against the kit's own reference first.
- **Decision**: **Verified and rejected the claim.** Per `prd-templates/references/surface-model.md`, a *surface* is a **deployment target** (web/mobile/desktop/cli/api/extension), not an audience. Fans + professionals on one Astro web app = one surface. Classification stays `single-surface`.
- **Downstream**: Folder layout unchanged (domains stay top-level children of `ideation/`, no `surfaces/` folder). Real consequence is an expanded Role Matrix in all 24 domain indexes. The **mobile surface question remains genuinely open** and is now more pressing — see `meta/constraints.md`.
- **Reversibility**: High — but reclassifying later means restructuring the tree, so getting it right pre-seeding mattered.
- **See also**: PAT-001.

### DEC-004: Three separate marketplace domains, not one (2026-07-16)

- **Timestamp**: 2026-07-16T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate
- **Tags**: decision, ideation, recovered

- **Problem**: Physical gear, digital plugins and human services — one "Marketplace" domain or three?
- **Options considered**: (1) Three domains (agent recommendation). (2) One Marketplace with heavy sub-domains. (3) Two — Goods + Services.
- **Decision**: **Option 1 — three domains** (05 Services, 13 Gear, 14 Digital Goods).
- **Downstream**: Everything genuinely shared (cart, payments, messaging, search, reviews, disputes, tax, shipping) is already a **cross-cut** — the merge would buy nothing. Everything that differs is irreconcilable at schema level: gear is qty=1 non-fungible stock where condition is ~40% of price; digital is licence keys + a format×OS×DAW matrix with refunds that cannot be un-given (colliding with EU withdrawal law); services are scoped human output with briefs and taste disputes. A merge yields a `listing` entity with ~40 nullable columns. `/write-be-spec` must not collapse these.
- **Reversibility**: Medium.

### DEC-005: Commit identity is the business account, set repo-local (2026-07-16)

- **Timestamp**: 2026-07-16T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate
- **Tags**: decision, ideation, recovered

- **Problem**: No git identity was configured at all (`user.name`/`user.email` unset globally and locally) — any commit would have failed. Repo ownership had moved from `NEVRITERob` to `WeJustJammin`.
- **Options considered**: (1) Business account + GitHub noreply. (2) Business account + real business email. (3) Keep the personal Gmail.
- **Decision**: **Option 1.** `WeJustJammin <305953066+WeJustJammin@users.noreply.github.com>`, set **repo-local** so other projects are unaffected. `WeJustJammin` verified as `type: User`, id `305953066`.
- **Downstream**: Commits attribute to the business. **`gh` transport is still the personal account** — see BLOCKER-001. Open question raised: `WeJustJammin` is a User account, not an Organization — no teams, no scoped repo roles, no runner groups. Converting is cheapest now while the repo is empty.
- **Reversibility**: High.

### DEC-006: Firebase removed entirely from project documents (2026-07-16)

- **Timestamp**: 2026-07-16T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate
- **Tags**: decision, ideation, recovered

- **Problem**: The predecessor (SoundBytez) ran Next.js + Firebase App Hosting. Initial constraints capture documented the migration as a was/is table.
- **Options considered**: (1) Keep migration context for traceability. (2) Remove — document only the stack in use.
- **Decision**: **Option 2 — removed.** Owner: "that's from an old plan we don't even need that entry in the documents; we are going to move forward with the stack we use."
- **Downstream**: `meta/constraints.md` states only the locked stack (Astro islands, Cloudflare Pages + Workers, Supabase) plus what remains open for `/create-prd` (auth provider, media storage, styling, payments). **Supabase is the only element carried forward from the predecessor** — Firebase Auth, App Hosting and its deploy pipeline have no equivalent and must not be assumed by `/create-prd-stack`.
- **Reversibility**: High.

### DEC-007: 08 Real-Time Jamming is the only genuine domain-merge candidate (2026-07-18)

- **Timestamp**: 2026-07-18T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate
- **Tags**: decision, ideation, recovered

- **Problem**: Step 6 flagged 101 boundary problems across the 24-domain map. Are any real merge candidates, or is the high cross-domain connectivity (76%) evidence the map is over-split (D-17)?
- **Options considered**: (1) Keep 24 domains — connectivity is structural. (2) Merge the high-tension seams. (3) Case-by-case.
- **Decision**: **Keep 24 domains.** ~85 of 101 boundary problems are legitimate seam-work between near-mirror domains; the universal hubs were lifted into the 25-mechanism cross-cut registry rather than left as domain edges. **Only `08 Real-Time Jamming` → `07 Music Projects` is a genuine merge candidate** (Overdub machinery could dissolve 08 into 07; rejected only narrowly). Escalated to `/create-prd` for explicit keep-or-fold.
- **Downstream**: High-tension seams (17/18 tour object, 17/19 ticket count, 13/15 serial unit, 14/20 delivery, 04/05 demand/supply anchors) get a **named shared owner or an extracted cross-cut**, NOT a merge. `/create-prd` must decide 08's fate before architecture locks.
- **Reversibility**: Medium — merging 08 later is cheaper than splitting a merged domain.

### DEC-008: The identifier-binding seam is an unowned architectural gap (2026-07-18)

- **Timestamp**: 2026-07-18T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate
- **Tags**: decision, ideation, recovered

- **Problem**: Step 6 surfaced that splits and titles attach to a work in Services (domain 05) — often years before an ISRC/ISWC identifier exists — but Royalties (domain 10) collects against those identifiers. No mechanism or domain owns the step that binds the early split-record to the later identifier.
- **Options considered**: (implicit) leave it to emerge in BE spec vs flag it now.
- **Decision**: **Flag and persist now.** Recorded in `meta/cross-cut-emergent-capabilities.md` and D-27. This is the highest-risk of 52 emergent cross-cuts / 76 emergent features found in Step 6.
- **Downstream**: `/create-prd` and `/write-be-spec` must assign an owner to the binding step; a schema that assumes work↔identifier was always linked will be wrong. Intersects the provenance thesis (D-18) directly — the split captured at creation must survive until the identifier exists to collect against it.
- **Reversibility**: Low if missed (retrofitting the binding after royalty flows exist is expensive); High if handled at architecture time.

### DEC-009: Taxonomy selection and proposals use constrained Config access (2026-07-19)

- **Timestamp**: 2026-07-19T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: Service taxonomy `05.01.02` marked all personas Read-only while credits taxonomy `02.06` marked the identical select/propose action Config for Musician, Producer, and Operator. The conflict left taxonomy-proposal writes without a platform-wide RBAC contract.
- **Options considered**: (1) Read-only for all personas. (2) Config for Musician, Producer, and Operator; Read-only for Fan. (3) New standalone Propose permission.
- **Decision**: **Option 2.** Musician, Producer, and Operator receive Config solely to select permitted values and submit a missing-value proposal to the curation queue; Fan remains Read-only. No persona can create, promote, deprecate, map, or edit vocabulary — those remain exclusive to the non-persona admin/governance role.
- **Downstream**: Aligns the service and credit taxonomy Role Lenses and parent Role Matrices. A proposal does not block publication and must not be mistaken for vocabulary curation. Resolves ledger `r-09[0]` / queue CQ-01.
- **Reversibility**: Medium — permission changes are structurally reversible before implementation, but every consumer's authorization checks must preserve the select/propose-versus-curate boundary.

### DEC-010: Collusion evidence uses a constrained versioned edge contract (2026-07-19)

- **Timestamp**: 2026-07-19T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: Credit-dispute resolution needed a defined interface to consume collusion detection without converting statistical topology into an accusation, witness exclusion, or automatic Trust & Safety case.
- **Options considered**: (1) Per-edge negative multiplier only. (2) Per-edge multiplier plus a typed `requiresNonTopologicalCorroboration` constraint. (3) Per-witness trust score plus ring flag.
- **Decision**: **Option 2.** `CollusionEvidenceConstraintV1` contains only `contractVersion`, opaque `attestationEdgeId`, per-edge `negativeMultiplier`, and literal `requiresNonTopologicalCorroboration: true`. Unknown versions are excluded. No raw score, topology signal, cluster/witness identity, trust score, ring flag, hard exclusion, or enforcement recommendation crosses the boundary.
- **Downstream**: `02.05` weights only the referenced attested-evidence edge. The collusion signal cannot itself create or advance a Domain 24 factual-dispute case; separately captured non-topological corroboration is required for any transition that relies on it. Contract persisted in `02.04.04`, `02.05`, the `02.04` index, Credits CX-18, and Domain 24 intake routing. Resolves ledger `r-20[2]` / queue CQ-03.
- **Reversibility**: Medium — a future interface version can add explicitly governed fields, but v1 consumers must reject unknown versions and preserve the prohibition on topology-only action.

### DEC-011: Ownership-ledger ordering uses a portable bytewise party-ID collation (2026-07-19)

- **Timestamp**: 2026-07-19T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: Domain 09 had already locked the total row key for reproducible Domain 10 cent allocation as `(pool, party-id, role, contribution-basis)`, but left `party-id` collation unresolved across Supabase Postgres, Cloudflare Workers, exports, and replay jobs.
- **Options considered**: (1) Explicit Postgres binary collation. (2) Platform-defined unsigned UTF-8 bytewise comparison of immutable canonical serialized internal party IDs.
- **Decision**: **Option 2.** The platform compares `party-id` as unsigned UTF-8 byte sequences in lexicographic order. Locale, display name, case-folding, Unicode normalization, and database-default behaviour are prohibited. Every runtime uses the same comparator or a persisted equivalent binary sort key.
- **Downstream**: The source-locked four-field tuple now produces the same portable, content-derived allocation order for every consented ledger. Database insertion/retrieval order and `entered-by` remain prohibited inputs; Domain 10 retains sole ownership of cent remainder policy. Resolves ledger `r-34[0]` / queue CQ-05.
- **Reversibility**: Medium — a future comparator must be explicitly versioned and historical ledger allocations must retain this v1 ordering contract for reproducibility.

### DEC-012: V1 feedback contradictions use bounded positional candidates and human flags (2026-07-19)

- **Timestamp**: 2026-07-19T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: Multi-stakeholder feedback required a practical v1 way to surface contradictions without enabling the platform to judge creative conflicts, introduce undeclared AI processing, or turn ambiguous language into a system verdict.
- **Options considered**: (1) Positional candidates plus manual flags. (2) Model-backed semantic detection. (3) Manual flags only.
- **Decision**: **Option 1.** Sort same-version timestamped comments ascending by offset. Seed each cluster with the earliest unassigned comment and include only later unassigned comments at most 5,000 ms from that seed; a Producer manually flags two or more comment IDs in a positional cluster or song-level bin as a contradiction. No topic extraction, semantic inference, AI request, ranking, recommendation, adjudication, or automatic notification occurs in v1.
- **Downstream**: Producers receive reproducible candidate groupings while retained contradiction flags remain attached to comment IDs through cluster split/merge. Human creative authority stays intact; a later semantic capability requires an explicit privacy, evaluation, and architecture decision. Resolves ledger `r-45[0]` / queue A-01.
- **Reversibility**: High — a later version may add an independently governed semantic detector, but must preserve the v1 no-adjudication boundary and auditable manual flags.

### DEC-013: Reaffirmed 24-domain ideation map after independent recovery audit (2026-07-19)

- **Timestamp**: 2026-07-19T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: An interrupted workflow required recovery of WeJammin's proposed domain classification before advancing pipeline state. The recovered 24-domain tree already existed in the working tree, so replacement or reseeding without inspection would risk invalidating extensive ideation work.
- **Options considered**: (1) Confirm all 24 domains. (2) Review domain boundaries before confirmation. (3) Confirm map while reducing v1 scope. (4) Replace map.
- **Decision**: **Option 1 — confirm all 24.** The owner reaffirmed the complete map after an independent recovery: 14 lenses swept 1,545 concepts; 24 candidates were synthesized; four fresh audits found no missing required domain, cross-cut, blocker, or major boundary defect. The existing 24-folder fractal tree remains authoritative. Scope is not reduced by domain deletion; existing MoSCoW and release sequencing control v1.
- **Downstream**: `/ideate` proceeds from the already-complete 24-domain tree rather than reseeding it. The recovery proposal is retained as ratified evidence. The current accepted architecture remains Astro islands + Cloudflare Pages/Workers + Supabase; Firebase is excluded. Recorded as ideation D-35.
- **Reversibility**: Medium — individual domain boundaries can be evolved through the decision-propagation process, but replacing the 24-domain structure would cascade through 1,120 ideation files.

### DEC-014: Ratified immutable private-link recipient isolation for review feedback (2026-07-19)

- **Timestamp**: 2026-07-19T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: `r-51[0]` classified the review-link permission intersection as unresolved despite existing Domain 07 cross-cut and child contracts defining recipient isolation.
- **Options considered**: (1) Ratify the existing asymmetric permission intersection: recipient sees only their own thread and replies. (2) Expose a shared recipient-visible feedback stream. (3) Allow owner-configured per-thread visibility.
- **Decision**: **Option 1.** The owner ratified, without redesign, CX-01, D-13, D-14, and D-10 as authoritative. An unauthenticated/private-link recipient may comment only in their own thread and see replies in it; they see no roster or internal comments, other recipient or their comments, other versions, project content, hidden-comment count, teaser, or hidden affordance. Audience is selected at post time and immutable; scope crossing requires a deliberate, attributed new comment. Link-recipient comments notify the roster, and listen-recording failure never blocks posting.
- **Downstream**: Domain 07 keeps one append-only, version-anchored comment stream with asymmetric recipient visibility. `/create-prd-architecture` must enforce the ratified intersection without adding a separate recipient ACL, mutable audience, or v1 scope expansion. Queue A-02 and ledger `r-51[0]` record the resolved ratification; no source-contract redesign occurred. Recorded as ideation D-36.
- **Reversibility**: Medium — a future, separately specified and authenticated sharing mode may be introduced only through a new decision; v1 isolation and every existing comment's post-time audience remain immutable.

### DEC-015: DAW parsing support is validation-gated before selection (2026-07-20)

- **Timestamp**: 2026-07-20T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: The capture-at-source thesis depends on DAW session parsing, but proprietary formats, silent parser rot, DAW-specific EULAs, and person-free track names made broad support an unvalidated premise.
- **Options considered**: (1) Validate supported DAWs first and define the person-free fallback. (2) Commit to broad parser coverage immediately. (3) Use manually mapped tracks only.
- **Decision**: **Option 1.** A candidate DAW must pass representative real-session validation and a DAW-specific legal review before WeJammin selects its parser or track-mapping integration. Person-free names retain available track/instrument context but create no contributor guess; the existing Producer prompt asks explicitly. Ambiguity asks, never infers; unsupported or unreadable formats remain non-blocking.
- **Downstream**: `07.09.02` and the DAW bridge index record the validation gate. `/create-prd-architecture` may choose candidates and delivery shape only after validation; it must preserve visible confidence, counter-attestation, parser-health monitoring, and non-blocking ingest. This does not choose DAWs, require a broad parser, or alter the web-only surface classification. Queue A-03 and ledger `r-52[0]` are resolved. Recorded as ideation D-37.
- **Reversibility**: Medium — later support expansion requires the same validation and legal gate; the no-inference and non-blocking boundaries remain required unless superseded through a new decision.

### DEC-016: Rights-aware vault defaults require practitioner validation (2026-07-20)

- **Timestamp**: 2026-07-20T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: The vault's role × asset-class profiles encode sensitive least-privilege defaults, but their fit with real producer and engineer workflows remained unvalidated.
- **Options considered**: (1) Validate proposed profiles with practitioners, then lock them. (2) Lock the current matrix immediately. (3) Replace defaults with owner-configured access only.
- **Decision**: **Option 1.** The proposed profiles are candidates only until practitioners performing each affected song role validate them and an approved profile version is recorded. Validation may refine grants per sensitivity class; it cannot introduce manual per-asset ACLs, project-wide grants, or an owner-configured-only access model.
- **Downstream**: `07.03.03` and its parent index record the validation gate. `/create-prd-security` defines validation evidence, profile versioning, and enforcement rollout while retaining per-song, role-derived least privilege; first-access NDA evidence; immediate fail-closed revocation; terms-not-grants separation; version-pinned ordinary acceptance; and explained denial. In-product NDA legal enforceability and master-owner precedence remain separate unresolved decisions. Queue A-04 and ledger `r-53[0]` are resolved. Recorded as ideation D-38.
- **Reversibility**: Medium — later default changes require new practitioner validation and profile versioning; existing approved-profile decisions remain auditable.

### DEC-017: Mixed DSP acceptance uses attached rejected-item details (2026-07-20)

- **Timestamp**: 2026-07-20T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: A DSP may accept some tracks in a release and reject others. The existing `(release × store × territory)` status identity must remain truthful without hiding actionable per-track evidence.
- **Options considered**: (1) Add a track axis to status identity. (2) Retain release-level identity with structured rejected-item detail. (3) Collapse to a release accepted/rejected result.
- **Decision**: **Option 2.** One `(release × store × territory)` row projects `Partial acceptance` while partner evidence is mixed. Each rejected-item detail retains stable affected-item ID, partner and original delivery/message correlation, evidence timestamp and normalized reason, triage/remediation state, and successor-delivery correlation after redelivery. The parent shows accepted/rejected/pending counts and actionable items; it never reports wholly `Accepted` or wholly `Rejected` until full-release evidence supports that claim.
- **Downstream**: `12.03.02`, its parent index, rejection triage, and DDEX cross-cuts record the contract. `/create-prd-architecture` defines persistence/query mechanics but must preserve evidence-labelled status, store-side `Live` truth, discard-not-amend in-flight messages, and rejecting-partner-only redelivery. Queue A-05 and ledger `r-54[1]` are resolved. Recorded as ideation D-39.
- **Reversibility**: Medium — future track-level status rows require an explicit identity migration and parent roll-up contract; historical mixed results retain the v1 attached-detail representation.

### DEC-018: Hold ladders use optimistic version checks and reject-and-reoffer (2026-07-20)

- **Timestamp**: 2026-07-20T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: Concurrent operators, expiry/release actions, challenges, and confirmation can mutate one ordered hold ladder. Last-write-wins, hidden merges, or locks would either silently demote a live party or block time-sensitive inventory.
- **Options considered**: (1) Optimistic per-ladder version check with reject-and-reoffer. (2) Serialized command queue. (3) Pessimistic edit lock. (4) Last write wins.
- **Decision**: **Option 1.** The owner ratified the existing source contract. Every mutation carries the current bookable-slot ladder version; the server alone assigns dense positions and receipt-time order. A stale version rejects before write, returns the authoritative ladder, and re-offers the intent. No merge, automatic replay, queue-behind, lock, or last-write-wins path exists.
- **Downstream**: Domain 17 source, parent CX, and parent index record the contract. `/create-prd-architecture` supplies compare-and-swap storage, idempotency, durable expiry execution, dual-ladder confirmation boundaries, and notification-outbox mechanics. It must atomically preserve ordering/version, required reorder attribution, audit/notification intent, and terminal semantics: expiry/release promote; withdrawal/date passage/confirmation void; release wins over a simultaneous challenge. Queue DQ-04.06 and ledger `r-78[0]` are resolved. Recorded as ideation D-40.
- **Reversibility**: Medium — implementation substrate may evolve only if it preserves version-conditional stale rejection and the resulting observable ordering/audit contract.

### DEC-019: Public comped-out credits retain transparent qualification (2026-07-20)

- **Timestamp**: 2026-07-20T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: A session contribution can be real while absent from the delivered master. D-09 retained the credit and outcome qualifier but left the public-discography treatment unresolved, risking either silent erasure or a misleading unqualified public credit.
- **Options considered**: (1) Keep the qualified record owner-only. (2) Render it publicly with a plain-language `not in final master` qualifier. (3) Render it publicly without a qualifier.
- **Decision**: **Option 2.** An otherwise publicly eligible retained credit renders once in its ordinary role family with the plain-language qualifier `not in final master`. Normal publication, per-credit visibility, embargo, and public-work-identity gates take precedence. The owner sees the trigger date; visitors see neither that date, the comp-out reason, nor delivery history. The record and provenance tier remain unchanged.
- **Downstream**: `02.01.01` D-09/Q-05 and `02.01.02` D-15/Q-07 record the contract. Viewer-relative counts include a visible qualified line once and a suppressed line zero times. The public qualifier does not determine ownership, union reporting, rights, registration, royalties, payment, or Domain 10 neighbouring-rights treatment; that registration question remains open. Queue CQ-02 and ledger `r-19[1]` are resolved. Recorded as ideation D-41.
- **Reversibility**: Medium — changing what a public credit means later requires an explicit product decision and matching source/audit migration, but does not require changing the preserved contribution record.

### DEC-020: Suspected-ring demotion changes traversal rank, not presentation (2026-07-20)

- **Timestamp**: 2026-07-20T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: A suspected attestation ring can silently lower one attestation edge's derived traversal weight, while the prior traversal contract left unresolved whether a still-eligible edge should be hidden, marked, or presented normally.
- **Options considered**: (1) Hide the edge. (2) Mark the edge as suspected. (3) Render the edge normally while silently applying the existing per-edge tier-weight demotion.
- **Decision**: **Option 3.** An otherwise eligible edge follows ordinary publication, viewer-visibility, embargo, provenance-floor, role, query-shape, fan-safety, and normal result-window gates. If returned, its path renders normally while the existing per-attestation-edge-derived demotion affects only ordinary ranking. No collusion-specific threshold, hiding, label, annotation, rationale, tooltip, notification, detector metadata, or unweighted bypass exists.
- **Downstream**: `02.01.03` D-05/Q-03 and `02.04` D-06/CX-03 record this presentation contract. Ring detection stays internal to every persona; CQ-03's constrained evidence interface stays per-edge with no score, flag, identity, hard exclusion, or topology-only escalation. The signal cannot create, advance, adjudicate, or notify a Domain 24 case without separately captured non-topological corroboration. Queue CQ-04 and ledger `r-25[0]` are resolved. Recorded as ideation D-42.
- **Reversibility**: Medium — a change to traversal presentation requires a new product decision and synchronized safety/audit review, but does not alter the underlying credit, detector, or dispute-evidence contract.

### DEC-021: Recorded master majority requires strictly more than half (2026-07-20)

- **Timestamp**: 2026-07-20T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: The master registry allowed parties to record `majority-by-share` but did not define the exact threshold, leaving a 50/50 ownership split and other consent outcomes ambiguous.
- **Options considered**: (1) Strictly more than 50% of consented ownership share. (2) At least 50%. (3) A higher recorded supermajority such as two-thirds.
- **Decision**: **Option 1.** For an expressly recorded master `majority-by-share` rule, a specific action authorizes only when affirmative **exact nominal master-owner share is strictly greater than 50%** of the full current consented master pool. Exactly 50% fails closed. Shares aggregate by owner stake rather than headcount; points, encumbrances, effective net, display rounding, silence, unreachability, and stale/invalid records cannot create or enlarge approval.
- **Downstream**: `09.01.03` owns the predicate, scope/version binding, Control Summary routing, and concrete tie/rounding/absence examples. `09.01.02` remains authority for exact shares, whole-ledger consent, versions, and states. An absent rule remains unanimous; `any-owner-non-exclusive` remains separate. The rule neither replaces amendment re-consent nor overrides a policy veto, encumbrance, publishing/performer/sample right, release/takedown policy, payout calculation, or Domain 24 case. Queue CQ-06 and ledger `r-35[0]` are resolved. Recorded as ideation D-43.
- **Reversibility**: Medium — threshold changes require an explicit owner decision and action-authorization migration, while established ledger versions and action approval history remain evidence.

### DEC-022: Overlapping mashup work weights require declarant allocation (2026-07-20)

- **Timestamp**: 2026-07-20T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: A multi-work recording needs exact `Recording→Work` weights totaling 100%, but duration cannot determine allocation when a mashup's embodied works sound simultaneously. A universal duration default would normalize an arbitrary contribution claim into a royalty input.
- **Options considered**: (1) Prorate each work's full overlapping duration, then normalize. (2) Require declarant-entered exact weights totaling 100%. (3) Offer equal shares.
- **Decision**: **Option 2.** For temporal overlap, each embodied work receives a declarant-entered positive exact-rational weight and all weights total exactly 100%. No duration calculation, normalization, equal-share fallback, inferred remainder, or display-rounded validation exists. Duration proration remains an editable proposal only for declared disjoint medley/live-set spans.
- **Downstream**: `09.01.01` owns the link allocation; works remain separate and a mashup still requires independent source-master lineage/sample and embodied-work declarations. `10.03.01` consumes the valid as-of Domain 09 allocation before each separate work ledger and blocks invalid/incomplete allocation rather than inventing or repairing it. The weight declaration is neither ledger consent nor a master-action approval, and it does not decide licensing, release permission, or royalty entitlement beyond this allocation input. Queue CQ-07 and ledger `r-36[0]` are resolved. Recorded as ideation D-44.
- **Reversibility**: Medium — changing the default later requires a new owner decision and calculation-version treatment, while previously declared allocations and their calculation inputs remain historical evidence.

### DEC-023: Unclaimed stubs merge only on exact canonical writer-name sets (2026-07-21)

- **Timestamp**: 2026-07-21T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: The unclaimed-stub exception prevents duplicate work records from proliferating, but raw-string equality misses harmless presentation differences while fuzzy, identifier, or identity matching risks silently treating distinct people or assertions as the same.
- **Options considered**: (1) Exact stored-string equality. (2) Canonical asserted-text set equality. (3) Legal/stage identity resolution. (4) Fuzzy name similarity.
- **Decision**: **Option 2.** `writer-name-canonical-v1` evaluates each retained asserted writer string with pinned Unicode 15.1 data: NFC → Default Case Folding → trim/collapse Unicode whitespace → NFD/remove marks/NFC. The resulting order-independent sets must be exactly equal. An atomic merge occurs only while both works are distinct current unclaimed, unconsented, conflict-free stubs with no distinct-person or unresolved identity/alias evidence. Canonical text equality never resolves people, aliases, legal/stage identities, accounts, or authorship.
- **Downstream**: `09.01.01` solely owns the predicate, candidate/action split, raw-evidence retention, atomic recheck, lineage, and recording-owner notification. ISWC/ISRC, audio, fuzzy text/title, aliases, and identity signals may nominate candidates but cannot authorize merging. `09.01` CX-01 forbids link movement, ledger reconciliation, or partial mutation when recheck fails. A later incompatible assertion uses `09.04.01` ordinary claim-time detection/notification/dispute routing — no auto-unmerge, auto-case, fund freeze, or identity adjudication. Queue CQ-08 and ledger `r-36[1]` are resolved. Recorded as ideation D-45.
- **Reversibility**: Medium — changing a future canonicalization profile requires explicit versioning and migration review; retained original strings, source IDs, provenance, and merge lineage preserve evidence without asserting an identity conclusion.

### DEC-024: Term and moral-right status is bounded to four v1 jurisdictions (2026-07-21)

- **Timestamp**: 2026-07-21T12:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: Copyright term/public-domain and moral-right status vary by territory, but the product lacked a v1 coverage boundary for term rules, death-date facts, moral-right applicability, and waiver treatment. A global answer would falsely imply complete legal coverage; US-only would omit the central non-waivable/waiver distinctions the rights model already identifies.
- **Options considered**: (1) United States only. (2) United States plus France, Germany, and the United Kingdom. (3) Global per-territory status wherever evidence exists.
- **Decision**: **Option 2.** V1 supports determinate status only for `US`, `FR`, `DE`, and `GB`. A result requires source-attributed applicable-rule and required facts: work/category/authorship and death/publication/creation facts for term; author/estate standing plus transfer/waiver facts for moral rights. Every other territory or missing/insufficient fact is explicitly `unknown` / not determined. Territory remains an explicit model dimension, never a global boolean.
- **Downstream**: `09.03.05` owns source-backed term/public-domain status; `09.03.06` owns jurisdiction-scoped moral-right applicability/waivability; `09.03.04` remains authority for estate/death facts. Economic transfers never transfer moral rights. FR/DE non-waivability, GB waiver treatment, and US music non-applicability stay jurisdiction-scoped. No output is legal advice, clearance, licence, ownership adjudication, or release authorization; Domain 11 licensing and Domain 12 release gates remain independent. Queue CQ-09 and ledger `r-40[0]` are resolved. Recorded as ideation D-46.
- **Reversibility**: Medium — adding jurisdictions requires an explicit owner decision plus jurisdiction-specific rule/evidence validation. Historical results retain their jurisdiction, inputs, sources, and rule version; the four-jurisdiction boundary prevents a silent global expansion.

### DEC-025: Production-stage vocabulary is validation-gated before approval (2026-07-21)

- **Timestamp**: 2026-07-21T13:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: The existing production-stage labels are credible candidate evidence but unvalidated for recurring beatmaker delivery and contribution-centric session-player workflows. Hardening labels early could misplace Songs, fire provenance prompts at incorrect moments, or make release readiness depend on an unfit terminal stage.
- **Options considered**: (1) Lock the current ten-stage draft. (2) Practitioner-validate one shared fixed vocabulary, then have the product owner approve a version. (3) Split vocabulary by production model.
- **Decision**: **Option 2.** One platform-owned, fixed, music-specific vocabulary remains the sole permissible stage model. A candidate becomes enforceable only after two eligible beatmakers and two eligible session players map the required redacted workflow traces, every mismatch has a disposition, no critical mismatch or split-state-machine request remains, the gate passes, and the product owner explicitly approves one immutable enum version with its initial semantic, approved-master terminal semantic, and non-blocking prompt mappings.
- **Downstream**: `Song.current_stage` remains authoritative and the board remains its projection. Until approval, labels, order, initial state, terminal stage, prompt mappings, release predicate, reporting, and migration stay provisional. Validation may refine a candidate but cannot introduce user-configurable columns, production-model enums, a second machine, or unnormalised exceptions. Queue P-01 and ledger `r-44[0]` — see DEC-047 for the close. Recorded as ideation D-47.
- **Reversibility**: Medium — a future vocabulary requires a separately validated immutable version and migration plan; no unapproved candidate silently becomes historical contract.

### DEC-026: Large catalogues get a dense table, never a second lifecycle (2026-07-21)

- **Timestamp**: 2026-07-21T13:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: The production board had no defined behavior for a project or label catalogue at scale. A kanban of hundreds of cards stops being scannable, but a second view risks forking `Song.current_stage`, duplicating a Song per Release membership, or introducing bulk writes that bypass per-Song capture and authorization.
- **Options considered**: (1) Paginated board only. (2) Board below a threshold, dense catalogue table above it. (3) Exclude large catalogues from the feature.
- **Decision**: **Option 2, with a `60`-Song boundary.** Count unique visible authorized Songs in the selected scope **before** local search, sort, or table-only filters: `0–59` renders the craft board, `60+` renders the dense catalogue table. Selection is automatic — no v1 user override, saved preference, or URL mode. A local filter never switches a large scope back to board. A Song on several Releases counts once; sequence, selected master, and release-specific edits stay on the membership edge.
- **Downstream**: Both views are projections of the same `Song.current_stage` and a table row action invokes the identical per-Song authorized transition — same optimistic rollback, non-blocking capture prompt, dismissal completeness debt, roster notification, last-write-wins attributed notice, and derived readiness recomputation for every linked Release. V1 has **no bulk stage transition**; the table adds no configurable columns, per-card assignee, table-owned stage, or Release-local state. Pagination/cursor shape, page size, ordering, responsive behavior, and cache semantics are deferred to `/write-be-spec` and `/write-fe-spec`. Queue P-02 and ledger `r-44[1]` are resolved. Recorded as ideation D-48.
- **Reversibility**: High — the threshold is presentation policy over an unchanged state model, so a later value or an added manual override needs no data migration.

### DEC-027: Superseded approvals reinstate on version identity, never on judgement (2026-07-21)

- **Timestamp**: 2026-07-21T13:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: A backward stage transition marks later-stage approvals superseded. Nothing defined what happens when the song re-advances to that gate. Re-collecting every time punishes a mis-drag; auto-reviving would present an approval nobody gave for the current artifact.
- **Options considered**: (1) Always re-collect. (2) Auto-revive superseded approvals. (3) Re-collect only after a material change — either as a semantic judgement or as version identity.
- **Decision**: **Option 3, read as version identity.** Superseded approvals reinstate on re-advance **iff no new immutable version landed on the song in between**; any intervening version means the gate re-collects against its **current** approver set. The predicate is the append-only version timeline (`07.04.01` D-01 immutability, D-08 ingest order). The platform never asks a human whether a change was "material" and never certifies that nothing changed (`07.04.01` D-12).
- **Downstream**: `07.05.04` D-07 owns the rule; the `Reinstated` state and re-advance edge cases live there. The new-version branch is not a new rule — `07.05.04` D-01 already prevents an approval from transferring to a later version, so only the byte-identical administrative-reversion case needed deciding. Supersession and reinstatement are both **appended** events, preserving D-04's append-only trail and D-03's pinned comment state; nothing is retracted or rewritten. Already-pinned approvals are never rewritten when the approver set changes, and a departed approver still stalls the gate. The rule is presentation-agnostic across the P-02 board/table split, and Release re-readiness recomputes from the resulting stage without its own re-approval rule. Rejecting the semantic reading also avoids minting a third project-wide materiality definition alongside `07.03.03` D-07 and `02.04.01` D-10. Queue P-03 and ledger `r-44[2]` are resolved. Recorded as ideation D-49.
- **Reversibility**: Medium — a later semantic-materiality model would need its own classifier, judge, appeal path, and reconciliation with the two existing materiality definitions; historical supersede/reinstate events remain valid evidence either way.

### DEC-028: A handoff spec is authored where owned and referenced where not (2026-07-21)

- **Timestamp**: 2026-07-21T13:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: `07.08.01` advertises six recipient specs — mastering, mix, sync, live, remix, archive — but only two have real contents on disk. Authoring all six would have the handoff builder originate requirements that domains 11, 12 and 05 already own, and invent `live` from no source at all.
- **Options considered**: (1) Define all six now. (2) Define the highest-frequency two first, others as follow-ons. (3) Ship a generic package with optional fields.
- **Decision**: **Option 2, re-cut on authority rather than frequency.** `07.08.01` originates `mastering`, `mix`, and `archive`'s asset half — the specs it provably owns per `07.08.03` Q-02. It **references** every spec owned elsewhere: `sync` → domain 11, DSP destination → domain 12, engagement-purchased handover → `05.04.02`/`05.04.04`. Referencing validates presence and surfaces the owner's verdict; it never restates the requirement. `live` and `remix` get no invented contents and become an ownership question.
- **Downstream**: Generalises `07.07.03` D-04 ("two copies of third-party requirements would drift, and one would be wrong") from destination specs to all referenced requirements. Preserves D-01 (specs are the product, not config) and D-02 (a spec is a least-privilege boundary — the mastering spec excludes stems *because the engineer should not have them*), both of which option 3 would have deleted. Severity is explicit: every requirement warns; integrity failure remains the sub-domain's only hard stop under domain D-04's "non-blocking is absolute". Also repaired a pre-existing contradiction where the no-canonical edge case asserted a second block citing a source that says the opposite. The Empty state now advertises only specs with contents behind them. Queue P-04 and ledger `r-46[0]` are resolved; `07.08.01` Q-01 is partly resolved and Q-04 opened for `live`/`remix` ownership. Recorded as ideation D-50.
- **Reversibility**: High for the set (adding a spec once a domain owns it is additive); Low for the ownership rule, which is now load-bearing across domains 05, 07, 11 and 12.

### DEC-029: Readiness targets follow the same ownership rule, and pin-vs-live is dissolved (2026-07-21)

- **Timestamp**: 2026-07-21T13:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: The readiness score computes against four targets — mix-handoff, mastering, DSP-release, sync-pitch — but no file enumerated any target's facts or thresholds. Separately, the score needed a *live* target while the handoff package *pins* its contents, which looked like two lifetimes on one object.
- **Options considered**: (1) Define every target fact now. (2) Evaluate externally owned specs only, deferring targets whose specs don't exist. (3) A generic score independent of target.
- **Decision**: **Option 2, re-cut per target on authority.** This is DEC-028's rule applied again: the score's targets and the handoff builder's recipient specs are one list under two names. `07.08.01` authors mastering and mix-handoff; DSP-release references domain 12 and sync-pitch references domain 11, consuming their severity classes as this feature's weights rather than re-deriving them. An unowned target is **not offerable**. "Block shipping" is recorded as **feature sequencing, never user-blocking** — the latter would breach domain D-04's absolute non-blocking rule and contradict DEC-028's own handling of the identical condition.
- **Downstream**: `07.08.03` D-07 records the ownership rule and D-08 dissolves pin-vs-live — one target-spec store with one version identity, the score a live **view**, the package a pinned **record** that now also pins the spec version it validated against. Domain 12 resolved the identical shape this way (`12.02.02` D-01, `12.01.02` D-07/DT-09); 07 does not inherit 12's authority to hold dispatch. Only `ready-for-DSP-release` is fully scoreable today. A set mismatch is recorded rather than hidden: eight recipient specs, four targets. Option 3 was foreclosed, not weighed — `07.08.03` DT-01 rejects a target-independent score "twice over". Also corrected a mis-routing: ISWC is `09.06.01`'s (captured, never issued), not domain 12's. Queue P-05 and ledger `r-47[0]` are resolved; whether readiness ever hard-blocks remains separately open. Recorded as ideation D-51.
- **Reversibility**: High per target (each becomes scoreable as its owner publishes); Medium for the store-and-version model, which now underpins both the score and every pinned package.

### DEC-030: A mis-typed source declaration is flagged, never reclassified (2026-07-21)

- **Timestamp**: 2026-07-21T13:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: A contributor may declare a "preset" that is really a full melodic loop — a different clearance obligation. The line is genuinely blurry and, as the source notes, the user will not know it either.
- **Options considered**: (1) Reclassify as a library-loop class and route to clearance review. (2) Keep the declared class and flag it. (3) Reject until resubmitted.
- **Decision**: **Option 2.** The declaration stands as made. A disputed type uses the existing attributed type-conflict path where both types are kept and surfaced, never auto-merged. Mitigation moves upstream: the capture prompt asks enumeratively — loop, one-shot, drum hit, vocal, break, stem, bought beat — so ambiguity surfaces at declaration time rather than hiding behind a bare "preset". Recorded as `07.08.04` D-08.
- **Downstream**: Reclassifying would have breached `07.08.04` D-03 (07 owns capture; 09/11 own clearance), the P-04/P-05 originate-vs-reference rule (the type axes belong to domain 14, the clearance consequence to `11.05.01`), and domain D-05 ("measure and show; never judge") — and would have required a detector that four separate decisions reject, "the honest posture is declaration, not detection". Rejection was foreclosed by domain D-04, which names "the capture prompt never blocks" as an enumerated instance, and is self-defeating: a rejected declaration reverts the region to `sources not reviewed`, destroying the fact it demanded. Queue P-06 and ledger `r-48[0]` are resolved. Recorded as ideation D-52.
- **Reversibility**: High — the enumerated prompt vocabulary can be extended without changing the no-adjudication rule, which is the load-bearing part.

### DEC-031: Vault re-gating fires only on an owner-declared material change (2026-07-21)

- **Timestamp**: 2026-07-21T13:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: When access terms are re-versioned, it was unclear which existing holders must acknowledge the new version. Blanket re-gating interrupts live work; never re-gating leaves people operating under terms they never accepted.
- **Options considered**: (1) Re-gate every current holder. (2) Re-gate only on an owner-flagged material change. (3) Never re-gate.
- **Decision**: **Option 2 — confirming `07.03.03` D-07 at owner level rather than inventing policy.** Existing holders are not re-gated by default and acceptance records stay version-pinned; only an owner-flagged material change re-gates, at the holder's next access and never mid-transfer. Denial stays explained.
- **Downstream**: Materiality is **owner-declared, never platform-detected** — the owner authored the change, so the correct party judges. This is why it does not repeat the semantic reading DEC-027 rejected, where the only available judge was the wrong party, and it reuses D-07's existing definition rather than minting a fourth materiality concept. Option 1 was a recorded reversal: `07.03.03` DT-04 already rejected blanket re-gating for interrupting live work and training users to click through gates. The finding's real defect was a stale `[PENDING]` marker in the parent CX file contradicting its own resolved child. **The vault's fail-closed revocation is a locked security property and is not touched** — domain D-04's absolute non-blocking rule governs creative surfaces and enumerates no vault entry. Queue P-07a and ledger `r-50[0]` are resolved; what the flag records became `07.03.03` Q-05. Recorded as ideation D-53.
- **Reversibility**: Medium — the acceptance-record model is version-pinned and immutable, so changing the trigger later does not invalidate existing evidence.

### DEC-032: An access downgrade notifies the affected person and the roster (2026-07-21)

- **Timestamp**: 2026-07-21T13:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: A downgrade already notified the affected person, but no rule said whether anyone else is told. The queue's standing recommendation was to tell only the affected party.
- **Options considered**: (1) Affected contributor only. (2) Affected person plus the roster. (3) Only when they encounter denial.
- **Decision**: **Option 2, scoped.** A downgrade is an instance of D-09 ("every roster write is announced — to the named party, and to the existing roster"), not an exception to it. The roster audience is scoped by D-16 to members who can already see that person's entry, so a confidentiality-restricted roster discloses nothing it deliberately hides. Recorded as `07.03.01` D-18.
- **Downstream**: **This reversed the queue's own prior recommendation on evidence** — its "sensitive demotion" premise has no source anywhere in the tree, and D-16 makes personnel default-visible. The coordination argument decides it: work is *rostered*, not assigned, so the roster is the team's only coordination record, and `07.03.03` D-04 has already killed the downgraded party's live URLs — under option 1 co-contributors keep routing stems to someone whose access is dead. Option 3 contradicts written `[DEEP]` behavior and locked copy, and makes the first notice a mid-work lockout. Audience only: cadence and batching stay with the notification cross-cut per the reference-never-restate rule. Queue P-07b and ledger `r-50[1]` are resolved; actorless band-derived downgrades became `07.03.01` Q-05. Recorded as ideation D-54.
- **Reversibility**: High — audience is a fan-out rule over an unchanged access model.

### DEC-033: Originality aggregates into a nominal enum for comp matching (2026-07-21)

- **Timestamp**: 2026-07-21T14:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: The gear comp key is locked as `model × condition × originality` in four places, but nothing defined what fills the originality slot — only a per-component vector existed.
- **Options considered**: (1) Derive an enumerated aggregate. (2) Component vector only. (3) Seller-entered label.
- **Decision**: **Option 1, constrained to a nominal enum.** `13.02.03` D-05 derives an enumerated aggregate from the component vector — explicitly unordered, because D-04 locks originality as "a factual axis, not a quality scale" (a mod raises studio-gear value and lowers vintage value). It partitions comp sets; it never ranks units.
- **Downstream**: Authored on the owning axis and consumed by `13.04.01`, per the reference-never-restate rule; a value derived inside matching logic would be the forbidden second copy. The component vector is untouched. Option 2 contradicts the locked comp key and leaves nearly every bucket at n≤1 across 3ⁿ cells, forcing constant disclosed widening; option 3 makes the comp key manipulable by the incentivised party. Derivation inputs, the Unknown mapping, a completeness predicate and enum versioning are `13.02.03` Q-03/Q-04. Queue P-08a and ledger `r-56[0]` are resolved. Recorded as ideation D-55.
- **Reversibility**: Medium — the enum's definitions and mapping must be versioned, since a copy edit corrupts a price time series invisibly.

### DEC-034: An originality change voids a live offer in either direction (2026-07-21)

- **Timestamp**: 2026-07-21T14:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: A seller can edit an originality disclosure while an offer is live. Nothing said whether the offer survives.
- **Options considered**: (1) Void on downgrade, preserve on upgrade. (2) Preserve all with a notice. (3) Void on any change.
- **Decision**: **Option 3.** `13.02.03` D-06: any originality change voids the live offer, versioned and disclosed. `13.03.02` principle 3 already voids an offer on any material change to the stated listing.
- **Downstream**: Option 1 was unratifiable as worded — "downgrade" presumes an ordering DEC-033 just declined to create, and its "evidence worsens" rationale has no substrate since this axis mandates no photos. Option 2 contradicts principle 3 and would make originality weaker than the post-purchase case. Option 3 needs neither an ordering nor a materiality definition, so it is the only option with zero invention. Per `13.02.02` D-04/D-11 it is framed as seller-protection with a re-offer path, so late honest disclosure is not punished. The offer's missing disclosure-version pin is routed to `/write-be-spec`. Queue P-08b and ledger `r-56[1]` are resolved. Recorded as ideation D-56.
- **Reversibility**: High — a narrower trigger can replace it once an ordering or evidence substrate exists.

### DEC-035: Local-pickup settlement is a per-listing seller choice (2026-07-21)

- **Timestamp**: 2026-07-21T14:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: Whether money moves through the platform on a local pickup was called the most consequential open question in its file — it determines fee revenue, escrow protection, and whether the ownership chain has a hole at a common transaction shape.
- **Options considered**: (1) Platform-settled always. (2) Off-platform always. (3) Seller chooses per listing.
- **Decision**: **Option 3.** `13.11` D-04 confirms what the tree already implements: a per-listing pickup boolean, a ship/pickup/both selector, and four downstream files already branching on where money moved.
- **Downstream**: A global settled rule would impose marketplace-facilitator sales-tax and 1099-K duties on every cash handshake plus custody and refund liability; a global off-platform rule would strand escrow, evidence and ownership-chain machinery already specified. **The chain follows the money**: settled writes the transfer at settlement, off-platform uses the manual handshake `15.01.03` D-01 already names as the fallback for off-platform trade. Two sources currently disagree about whether an off-platform chain entry is possible; that conflict is recorded as `13.11` Q-04 rather than silently resolved, with settled-branch residuals as Q-05. Queue P-09 and ledger `r-59[0]` are resolved. Recorded as ideation D-57.
- **Reversibility**: High — the branch is per listing, so policy can narrow later without migrating existing sales.

### DEC-036: A rights takedown preserves the holder record; a revision appends (2026-07-21)

- **Timestamp**: 2026-07-21T14:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: Two adjacent questions — what a rights takedown does to existing holders, and what an ordinary revision does. Both risked collapsing into one lifecycle path.
- **Options considered**: For takedown — preserve record + notice, treat as revision, or remove record. For revision — append + archive + notify, replace in place, or require repurchase.
- **Decision**: **Preserve for takedown; append for revision** — two paths, never one. `14.03.02` D-04 states both, joining `14.09.03` D-02/D-04, `14.04.01` D-08/D-09, and `14.03.02`'s own D-01/D-02.
- **Downstream**: Both were confirmations: `14.04.01` already carries the heading "Removal is not deletion, and a rights takedown is not a revision", and permanent fetchability was already locked. Treating a takedown as a revision would reuse a path that does not exist singly; removing the holder record contradicts at least seven locked decisions and leaves counter-notice put-back undefined; replace-in-place contradicts five; repurchase-per-revision contradicts "updates are offered" plus the displayed version range. Archive-fetch posture after a takedown and takedown granularity are `14.03.02` Q-04; retention cost/duration remains Q-01. Queue P-10a/P-10b and ledger `r-62[0]`/`r-62[1]` are resolved. Recorded as ideation D-58.
- **Reversibility**: Low for the two-path separation, which is now load-bearing across delivery, catalogue and refunds; High for retention parameters.

### DEC-037: A departed contributor's confirmed split row survives unchanged (2026-07-21)

- **Timestamp**: 2026-07-21T14:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: What happens to a confirmed contributor's share when they leave or are erased — asked as a question about an *accruing* balance.
- **Options considered**: (1) Escrow for future claim. (2) Redistribute among remaining. (3) Forfeit to seller/platform.
- **Decision**: **Resolved as scoped.** `14.10.03` D-05: the confirmed split row survives unchanged — never zeroed, redistributed, or forfeited. **The accruing premise is out of scope**: pool funding and download attribution/accrual are both WONT, and the splits feature is explicitly decoupled from the pool, so no accrual exists to escrow.
- **Downstream**: Both alternatives were already foreclosed elsewhere — `09.02.04` D-14 makes a 0% row the removal-without-consent loophole, and `10.04.03` D-01 with `royalties-collections-index.md` D-09 forbid unpayable money becoming platform float or revenue. No escrow contract was created, because the premise requiring one is cut. GDPR erasure versus payout retention is `14.10.03` Q-04, a security question. **If the WONT features are ever promoted, the accruing half returns.** Queue P-11 and ledger `r-63[0]` are resolved. Recorded as ideation D-59.
- **Reversibility**: High — the split row is unchanged, so any future accrual model attaches to it without migration.

### DEC-038: A host-update break is an external change — flag, disclose, never revoke (2026-07-21)

- **Timestamp**: 2026-07-21T14:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: When a host update breaks a purchased preset bank, nothing said who owes remediation.
- **Options considered**: (1) External compatibility, flag the entry, no default refund. (2) Vendor conformity defect. (3) Platform goodwill remedy.
- **Decision**: **Option 1.** `14.04.02` D-04 ratifies into the preset catalogue the pattern already locked at `14.07.01` D-04 ("'perpetual' is a promise about the entitlement and the artifact, not a guarantee of function") and D-06 (third-party state change → permit + mandatory disclosure + never revoke).
- **Downstream**: Gives OS drift, lapsed dependencies and host breaks one consistent story instead of three. Vendor-defect classification would assign liability for a third party's act against supply-time conformity scope; a goodwill remedy creates discretionary cost with no source-defined trigger on a low-value product. **What triggers the flag is undecided** (`14.04.02` Q-04): the compatibility matrix records *declared* host-version facts, not observed breakage, so only a buyer-reported path exists today, and asserting a break without evidence would be the platform judging a third party's product. Queue P-12 and ledger `r-64[0]` are resolved. Recorded as ideation D-60.
- **Reversibility**: High — a detection mechanism can be added later without changing who owes what.

### DEC-039: Several queue entries were mis-framed, and the ratifications correct them (2026-07-21)

- **Timestamp**: 2026-07-21T14:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: Across the marketplace block, four entries asked the owner to choose among options for questions that were already answered, mis-cited, or built on a cut premise — a pattern first seen in Domain 07's stale CX markers.
- **Options considered**: Ratify as framed, or correct the framing and record why.
- **Decision**: **Correct and record.** P-10a/P-10b were confirmations of contracts already locked in files the entries never cited; P-11's premise depends on two WONT features; P-08a cited the wrong CX (a flaw/evidence cross-cut, not the comp key) and the wrong sibling decision (P-08b's offer-void asymmetry); the P-08a interim rule suspended a locked comp key rather than describing the status quo.
- **Downstream**: Each ratification names the defect it corrects, so the queue stops teaching a false open/closed state. Reinforces the standing check: verify a queue recommendation's *premise* exists in the tree, and read the child before treating a parent marker as open. Adjacent stale markers found but deliberately not folded in (grade auto-downgrade, post-purchase disclosure change, `14.04.02` Q-03 against `14.09.02` DT-05) are recorded as separate reconciliations.
- **Reversibility**: N/A — this is a record-keeping correction, not a product policy.

### DEC-040: The bulk-import quality bar does not bend — the evidence moment moves (2026-07-21)

- **Timestamp**: 2026-07-21T15:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: Bulk gear import appeared to force a choice between relaxing the quality bar and failing the Operator persona. The queue collapsed four independently-locked axes into one scalar.
- **Options considered**: (1) Keep the normal per-unit bar, no publish until complete. (2) Allow disclosed lower-evidence bulk publication. (3) Restrict to specified seller classes.
- **Decision**: **Per-axis confirmation — the dilemma was false.** Model binding does not relax (bulk *raises* it); grading relaxes in a bounded, disclosed way with reduced comp weight and never an exemption; disclosure does not relax and admits no substitute; unit media does not relax but its capture moment moves to label print. In one line: the bar does not bend, the evidence moment moves, absence is disclosed and never gated.
- **Downstream**: A scalar answer would have silently overwritten at least one axis and, per `13.03` CX-03, created the prohibited shadow listing tier. Option 2's wording ("lower-evidence", "two-tier") reversed the meaning of the decisions it claimed to confirm, and two of its stated costs were inventions — no "trust weight" exists anywhere, and "unit handling" is not a state or event. Also repaired the false-dilemma prose surviving in `gear-marketplace-index.md` Q-13 and `13.03-listings-inventory-cx.md` — the unapplied half of this finding's own prescribed fix. Queue DQ-MG-01 and ledger `r-57[0]` are resolved. Recorded as ideation D-61.
- **Reversibility**: Medium per axis; the four are independently adjustable, which is the point of refusing the scalar.

### DEC-041: Stolen-serial review consumes domain 24's severity, and authors none (2026-07-21)

- **Timestamp**: 2026-07-21T15:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: A false-positive stolen-serial hit blocks an innocent seller, and the source promised only a "fast human resolution path" — unmeasurable.
- **Options considered**: (1) Expedited SLA with mandatory updates. (2) Standard severity with escalation on evidence of imminent sale or hardship. (3) Provisional release after a short window.
- **Decision**: **Option 2 with its escalation clause struck.** The listing stays held, never deleted, and neither party is accused. Severity, SLA and escalation are consumed from `24.01.03`, which owns routing skill, severity and clock; domain 13 authors no number of its own.
- **Downstream**: The seller's substantive remedy already exists as the locked `reported → contested` dispute path in `15.02.04` — a dispute lane, not a support queue. The struck clause was the only inventive part: no source defines how the platform would observe "imminent sale or hardship", and doing so would mean adjudicating a fact nobody has. Option 1 would author a severity domain 24 owns; option 3 contradicts hold-not-delete. Queue DQ-MG-02 and ledger `r-58[0]` are resolved. Recorded as ideation D-62.
- **Reversibility**: High — severity is consumed, so a change in domain 24 propagates without a decision here.

### DEC-042: Approval-required licence transfers freeze on vendor exit (2026-07-21)

- **Timestamp**: 2026-07-21T15:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: When a vendor exits, transfers their policy required them to approve have no approver.
- **Options considered**: (1) Platform substitutes for the vendor. (2) Auto-approve where recorded terms contain objective eligibility rules. (3) Freeze.
- **Decision**: **Option 3, recorded as resolved-as-scoped** — the same disposition shape as DEC-037. The platform never substitutes its judgement for a departed vendor's discretionary approval and never invents consent; the freeze is what the locked exit behaviour already produces once no approver exists.
- **Downstream**: Option 2 would commission a mechanism that does not exist — `14.06.01` stores a policy, not an evaluator, with no criteria slot, no evaluator and no appeal path. Two stale `[PENDING]` markers repaired, and the entry's miscitation of `14.03.03` D-03 (a stale-cache rule, unrelated) noted. **Recorded friction:** `14.02.05` D-09 promises tombstoned terms "remain in force", so one clause is permanently inoperative while displayed as active. Queue DQ-MG-03 and ledger `r-65[0]` are resolved. Recorded as ideation D-63.
- **Reversibility**: High — if the transfer machinery is promoted from its current scope, options 1 and 2 return as live.

### DEC-043: Theft-report standing binds to enumerated custody states (2026-07-21)

- **Timestamp**: 2026-07-21T15:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: Who may file a theft report when ownership and physical custody differ.
- **Options considered**: (1) Owner or documented holder/custodian. (2) Legal owner only. (3) Any witness, provisionally.
- **Decision**: **Option 1, amended.** The owner **or** a party in a custody state `15.08` already enumerates may file, with filing capacity recorded; a second filer joins the existing flag; the platform still never adjudicates title.
- **Downstream**: The word "documented" was deliberately not adopted — it is a custody-evidence threshold no source defines and maps to none of the six enumerated states, so the option as literally worded resolved its own motivating loan/consignment case to "nobody may file". Option 2 is foreclosed by `15.02.01` DT-02, which explicitly rejects the owner as the natural trigger — the deeper node answered its parent in the opposite direction. Option 3 invents a seventh state outside the locked set. Standing under `stale` and `disputed` custody remains open. Queue DQ-MG-04 and ledger `r-69[0]` are resolved. Recorded as ideation D-64.
- **Reversibility**: High — standing is a predicate over states that already exist.

### DEC-044: Identity-confidence and collision rules move to the file that owns them (2026-07-21)

- **Timestamp**: 2026-07-21T15:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: Two gear-registry questions — which identity-confidence vocabulary is canonical, and what happens when two records resolve to one identity key.
- **Options considered**: For vocabulary — adopt the render set, a smaller set, or a richer evidence-derived set. For collisions — never auto-merge, first-minted-wins, or threshold auto-merge.
- **Decision**: **Re-cut both as authority decisions.** `15.01.05` D-03 authors the canonical confidence set (the six values already in use) and `15.01.01` renders without defining its own. `15.01.05` D-04: colliding records **never auto-merge** — both retained, both claim-holders notified, merge only on mutual consent.
- **Downstream**: The queue's vocabulary recommendation was circular — its premise described the option it rejected. Collapsing the set risks contradicting D-01 ("a WJ-ID is never presented as equivalent to a serial"); the richer set was three orthogonal fields wearing one enum's clothes. The collision answer follows DEC-023's CQ-08 precedent: nothing probabilistic merges records asserting independent provenance. The entry's interim rule described the wrong mechanism — CX-01 **blocks the mint pending disambiguation**, it does not fork. Queue DQ-MG-05/06 and ledger `r-70[0]`/`r-71[0]` are resolved. Recorded as ideation D-65.
- **Reversibility**: Medium — relocating an enum is cheap now because no downstream literal binds to it.

### DEC-045: Unclaimed-record suggestions auto-apply by field class (2026-07-21)

- **Timestamp**: 2026-07-21T15:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: What happens to a community suggestion on an unclaimed venue or studio record — the majority case at launch.
- **Options considered**: (1) Auto-apply all eligible edits. (2) Queue everything. (3) Auto-apply by field class, queue the rest.
- **Decision**: **Option 3.** Factual classes apply immediately with community provenance retained; higher-stakes classes queue; commercial fields stay Operator-only. The classification already exists — `16.01.01` defines Statutory / Anchor / Fact / Commercial / Structural with "who writes" and "beats" per class.
- **Downstream**: Mirrors `13.01.02`'s ratified posture that automation may propose but never dispose. Option 1 gives consequential facts no protection; option 2 leaves the unclaimed majority stale, defeating community correction exactly when the registry needs it. The entry's "requires field classification" con was stale, and it cited the wrong question (the ignored-suggestion timeout, a claimed-record concern) rather than the load-bearing one. Class cut line and freshness effects are `16.05.03` Q-05. Queue DQ-MG-07 and ledger `r-72[0]` are resolved. Recorded as ideation D-66.
- **Reversibility**: High — the cut line moves within an existing class model.

### DEC-046: The live-booking block resolves by consuming rules its own files already point to (2026-07-21)

- **Timestamp**: 2026-07-21T15:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: Six live-booking questions — soft-hold availability, default offer approval, offer expiry mid-approval, reconciliation conflict, verified-draw count, and gig-alert eligibility.
- **Options considered**: The canonical option sets for each; several proved unratifiable as worded.
- **Decision**: **Soft holds** — the date stays available with an aggregate hold state, never identities, scoped to the parties the ladder already exposes it to (`17.01.02` D-14). **Offer approval** — consume domain 01's governance model; with no rule configured, no offer is approved (`17.02.03` D-07). **Expiry** — the offer expires with no implicit grace; an extension is explicit, pre-expiry, by the offering side, as a new version (D-08). **Reconciliation** — the count stays provisional and undisputed portions settle (`17.09.02` D-16). **Draw** — `scanned_paid` is the verified draw, confirming D-08's three-count model. **Alerts** — announced first-party shows at on-sale (`20.06.02` D-09).
- **Downstream**: Four were confirmations of locked source. Two entries were bound to the wrong finding: `r-76[0]` actually holds the verified-draw question, and `r-79[0]` actually holds an alert-radius contradiction (25 mi vs 80 km, neither file citing the other) now carried as `20.06.02` Q-04. One was misrouted — the band governance rule belongs to domain 01, which already defines unanimity / majority / any-one-member. Third-party alerts were rejected mechanically: no external listing produces an on-sale instant the platform can observe. Ledger `r-74[0]`, `r-75[0]`, `r-75[1]`, `r-76[0]`, `r-77[0]`, `r-79[0]` are resolved. Recorded as ideation D-67.
- **Reversibility**: High for the confirmations; Medium for the domain-01 consumption, which is now load-bearing across 01 and 17.

### DEC-047: P-01 closes on its policy; validation evidence is implementation work (2026-07-22)

- **Timestamp**: 2026-07-22T15:00:00.000Z
- **Agent**: claude
- **Source**: ideate-validate
- **Tags**: decision, ideation, remediation, recovered

- **Problem**: `r-44[0]` was the last open ledger identity. Its policy was ratified on 2026-07-21, but the validation packet's practitioner trace register was empty — and the evidence it requires (redacted workflow traces from two beatmakers and two session players) cannot be authored from inside the repository without fabricating research.
- **Options considered**: (1) Close the finding on the decided policy, tracking evidence collection downstream. (2) Hold the finding open until four practitioners have been interviewed and an enum approved. (3) Reverse to Option A and lock the unvalidated ten-stage draft now.
- **Decision**: **Option 1.** The finding's text was "exact stage vocabulary still explicitly owner-open", and it is no longer open: the model, the gate, its cohort minima, its pass conditions and the owner-approval requirement are all decided and propagated. Candidate labels remain non-enforceable **because the gate is in force**, not because a decision is pending.
- **Downstream**: Matches the disposition already applied to **A-03** (DAW parsing) and **A-04** (vault profiles), both of which closed on their validation gate rather than on their evidence — consistent precedent, not a new leniency. Option 3 was rejected because it discards the reason Option B was chosen: the draft is explicitly unvalidated for beatmakers and session players. Fabricating traces was never available — the packet's only purpose is to prove the vocabulary was tested against reality, so inventing its contents would destroy the artifact it is meant to be. `Song.current_stage` keeps its semantic roles, no draft label is a downstream contract, and the packet remains the authority for when an enum becomes enforceable. **The ledger now reads 107/107 `verified-fixed`.** Recorded as ideation D-68.
- **Reversibility**: High — if validation fails or the owner rejects every candidate, the packet records the failure and the next iteration; nothing downstream hardened in the meantime.

### DEC-048: All 57 blocking sub-decisions ratified and propagated to source (2026-07-23)

- **Timestamp**: 2026-07-23T03:00:00.000Z
- **Agent**: claude
- **Source**: audit-ambiguity
- **Tags**: decision, ideation, audit, remediation

- **Problem**: A fresh full ambiguity audit of all 1,121 ideation documents confirmed 20 blocking findings — contradictions where two ratified specs give an implementer opposite instructions. Each had to be decided by the owner and then made true in the source.
- **Options considered**: Present all findings at once for bulk review; work domain by domain; or decompose each finding into independently-lockable axes first. The third was chosen after an adversarial challenge round found that nearly every first-pass entry collapsed several axes into one scalar question.
- **Decision**: **20 blocking findings → 2 already-resolved → 18 entries → 94 axes → 57 open sub-decisions, all ratified** (43 owner-decided, 14 agent-decided as spec hygiene or technically determined, each flagged). Full record with reasoning, preserved invariants and downstream commitments: `.memory/wiki/specs/audits/decision-ratification-log.md`. Options each was chosen from: `blocking-decision-queue.md`.
- **Downstream**: The 37 axes found already-locked are the load-bearing result — a scalar answer to any of them would have silently reversed a ratified decision. Propagated into source across three passes (144 files, then 144, then 41). Verification: every decision findable in source, zero broken invariants, and the two invented values that appeared were removed. Notable outcomes: v1 positioning restated from "capture at source" to "capture at the first sharing moment" (domain 07 D-06 made this obligatory, not optional); the UK statutory vocabulary retired to an unauthored profile yielding explicit `unknown`; `scanned` renamed to `admissions_total`/`admissions_paid` because one name could not carry two quantities.
- **Reversibility**: Medium. Each sub-decision is individually recorded with its rejected alternatives, so any one can be revisited; but several are now load-bearing across domains.

### DEC-049: DQ-R2-01 representation scope is two flat axes conjoined at the call site (2026-07-29)

- **Timestamp**: 2026-07-30T00:38:30.695Z
- **Agent**: claude
- **Source**: propagate-decision (DQ-R2-01)
- **Tags**: decision, dq-r2-01, domain-01, authority, ratified

- **Problem**: `01.03.02`:25 lists a five-item commercial-domain scope and the ratified seven-verb
  mandate as siblings on one representation edge; `01.03.02`:76 and `01.03-cx` CX-02 both assert
  "scope **is** the mandate". The identity reading is unsatisfiable — the activity enum is closed at
  seven (D-01, DQ-02.3, global D-69) and none of the five domains is in it. Three normative
  statements, no open marker on any of them. The word "activities" was filled with two different
  vocabularies nine lines apart in one file (`:16` verbs, `:25` domains).
- **Options considered**: A full cross-product (7x5=35 cells, the draft's recommendation);
  A-prime two flat axes ANDed at the call site; A-double-prime domain as edge identity (one edge per
  domain); B domains-for-representation/verbs-for-membership; C collapse to one vocabulary;
  D domains as presets expanding to verbs; G defer to `/create-prd`.
- **Decision**: **A-prime**, owner-ratified 2026-07-29. A representation edge carries two
  independent flat axes — `activities` (subset of the closed seven) and `domains` (subset of live
  booking / recording / publishing / sync / merch) — ANDed at the moment of the action. At most
  7+5=12 plain-language statements per edge, never 35 cells, which is what keeps `01.03.03` DT-02
  (permission matrix REJECTED) and D-02 (plain language, not a grid) intact. A membership edge
  carries the activity axis only and resolves to ALL domains, which is what keeps `01.03-cx` CX-03:
  both edge types present one shape, `{activities, domains}`, to the enforcement cross-cut.
  Territory, term and commission stay edge-level and do not vary per domain (accepted cost).
  `administer` does not reach naming a publisher over a share the party did not write (`09.01.04`
  D-06 stands over the mandate).
- **Why the draft's Option A was rejected**: a 35-cell grid *is* the artefact DT-02 rejects by name;
  its cross-type asymmetry breaks the CX-03 union the sub-domain merge exists to protect; and its
  "book for live but not publishing" justification is only half-sourced — the verb half is real at
  `01.03.02`:16 ("my manager can book but not sign"), the domain half appears nowhere in 1,122 files.
  The five-domain list occurs on exactly **one line** tree-wide.
- **Downstream**: `01.03.02` D-02 restated + new D-05; `01.03.03` D-11 + `:25` scope dimensions;
  `01.03.01` D-19 (membership universal-domain); `01.03-cx` CX-02 + CX-03; parent index D-05;
  `ideation-cx.md`:27 Roles/Permissions cross-cut; `ideation-index.md` D-75; `09.01.04` D-17
  carve-out; domain 17 booking authority (+ its `publishing authority` wording collision);
  domains 04, 05, 07, 20 local authority vocabularies.
- **Reversibility**: Medium. The rename and the conjunction are cheap to revise; the eliminated
  options are not — B, C and G were each independently refuted against source.
- **Left open (tracked)**: are the five domains identical to domain 17's ratified work-type enum, or
  a fourth vocabulary? `01.03.02`:25 lists sync as publishing's *sibling*; `09.01.04`:102 carves sync
  *inside* publishing as a right type. Tracked as `01.03.02` Q-03, targeted at `/create-prd`.

### DEC-050: Opportunity post decide-by is derived by default and overridable (2026-07-30)

- **Timestamp**: 2026-07-30T09:05:20.138Z
- **Agent**: claude
- **Source**: audit-ambiguity run 3 — owner decision queue
- **Tags**: decision, run3, ratified, domain-04

- **Problem**: five decisions and two queue states across `04.04`/`04.05` treated a decide-by date as an
  established field on the opportunity post; `04.01.01`, which owns the post object, never defined it, and
  its only expiry rule keyed on the *event* date instead.
- **Options considered**: mandatory field with type-scoped default; derived-by-default and overridable;
  derived only (no separate concept); leave it out and let dependents degrade.
- **Decision**: **derived by default, always present, overridable**. Presence types default to the event
  date, delivery types to the stated deadline, per `04.01.01` D-10's type-scoped date semantics. The
  composer adds no interaction. Open calls and briefs get a real asked field because their type says so.
- **Key consequence**: decide-by is a D-09 **terms field** — a poster silently pushing 'you'll hear by
  14 Aug' to 30 Sep has ghosted twelve people while the UI still shows them a date.
- **Expiry reconciled**: the post's date closes **submission**; the decide-by closes the **post**. Identical
  on the ten derived types, divergent only for briefs and open calls, so the old one-date rule became the
  special case of the new one.
- **Downstream**: `04.01.01` D-16 + per-type default table; `04.04.01` D-05/D-06 and the dormant/abandoned
  triggers gain a real bound; `04.05.01` Q-02 becomes computable; `04.07` D-05; `04.02.04` Q-10 left open on
  whether the deadline escalation reads decide-by or event date.
- **Reversibility**: Medium.

### DEC-051: Benchmark band is a surface split — sellers-only pre-transactionally, symmetric once issued (2026-07-30)

- **Timestamp**: 2026-07-30T09:05:20.147Z
- **Agent**: claude
- **Source**: audit-ambiguity run 3 — owner decision queue
- **Tags**: decision, run3, ratified, domain-05

- **Problem**: `05.02.01` D-15 required the rate benchmark band to render symmetrically to both parties on
  a live quote; `05.01.04` Q-03 was closed 'sellers only'. Same band, simultaneously required and forbidden.
- **The insight that decided it**: every 'sellers only' statement is textually scoped to the **listing**
  surface ('public listing', 'buyer preview'), yet Q-03 closed a question broader than its own evidence
  covered. The two rules were argued against different threats.
- **Decision**: **surface split**. Public listing, browse and buyer preview stay band-free; once a quote is
  **issued**, both parties see the cohort band. `05.01.01` D-05 gains a listing-surface scope qualifier;
  `05.02.01` D-15 stands.
- **Rationale**: D-05's argument is about a public, browse-scale surface where anyone can shop a cohort's
  position. A live quote is bilateral, post-request, and already discloses the seller's exact figure to that
  one buyer. Different exposure, different rule.
- **Downstream**: `05.01.04` D-05 + Q-03 re-resolved and its stale-text note withdrawn; CX R-04 and R-06
  scoped; below-*k* on an issued quote withholds from **both** parties (D-15's 'or to neither' branch made
  operative); Q-01's minimum cohort *k* is now buyer-facing and harder — escalated, **no value picked**.
- **Reversibility**: Medium.

### DEC-052: Spec deals pre-commit a normal posture whose effect is deferred to a trigger (2026-07-30)

- **Timestamp**: 2026-07-30T09:05:20.148Z
- **Agent**: claude
- **Source**: audit-ambiguity run 3 — owner decision queue
- **Tags**: decision, run3, ratified, domain-05, rights

- **Problem**: `spec` is a publishable pricing model whose nature is a term vesting on a future trigger, but
  `05.06.01`'s legal-combinations table had no spec row, its posture vocabulary is closed (D-07), and no tier
  can publish without an election (D-01). The whole `05.06` sub-domain never mentioned spec.
- **Options considered**: open the vocabulary with a conditional posture; pre-commit and defer effect;
  two-stage instrument; forbid spec as a listing tier.
- **Decision**: **pre-commit the posture, defer its effect** — the seller elects a normal posture from the
  closed vocabulary and the signed instrument takes effect on the named trigger. Effective-date is a property
  of the **instrument**, not a new posture, so D-07 stays closed.
- **Why not two-stage**: it leaves the seller holding a promise to sign rather than signed paper — the exact
  exploitation pattern `05.01.03` DT-01 names, aimed at the population the domain most wants to protect.
- **Q-07 resolved onto the same mechanism**: reversion is a normal posture whose effect **ends** on a trigger,
  the mirror of spec's **beginning** on one. One mechanism (`05.06.01` D-14) covers both; D-07 byte-identical.
- **Also fixed while the table was open**: the cash-only row covered five of eight publishable models —
  hourly, half-day and retainer had no posture set at all; buyout got its own row per DT-13.
- **Left open**: `05.06.01` **Q-08** — may a Points posture carry deferred effect? `05.06.02` D-02 has
  participation existing from execution regardless of earnings, the opposite of vesting on a trigger. Points
  omitted from the Spec row until answered; if it resolves against, the spec *production* deal collapses to
  co-ownership. `05.01.03` Q-07 (who detects the trigger) promoted to **prerequisite**.
- **Reversibility**: Low — it settles the shape of a closed vocabulary two other features enumerate.

### DEC-053: public-domain is user-declared and machine-corroborated, never platform-asserted (2026-07-30)

- **Timestamp**: 2026-07-30T09:05:20.148Z
- **Agent**: claude
- **Source**: audit-ambiguity run 3 — owner decision queue
- **Tags**: decision, run3, ratified, domain-09, rights

- **Problem**: `09.01.01` treated `public-domain` as a terminal ledger state satisfying the release gate, but
  named `09.03.05` as sole determiner — which emits only per-jurisdiction term statuses for US/FR/DE/GB, is
  read-only to every persona, and rules by D-06 that a term status is **not** ownership or release
  authorization. No path in the tree could set the state.
- **The decisive constraint was timing**: `09.03.05` is a COULD that 'launches empty regardless of build
  effort'; `09.01.01` is a MUST. Any option making it the writer blocks trad-folk and classical release at
  launch — an outcome `09.01.01`:289 itself calls absurd.
- **Decision**: **hybrid — self-declared now, corroborated later**. The user's declaration writes the state
  and satisfies the **composition side** of the release gate. `09.03.05`, when built, attaches per-jurisdiction
  results as corroboration **or contradiction**, never override; a contradiction surfaces persistently and
  routes to `09.04.01`, but a release already made is not retracted by the platform.
- **Pattern reused**: `09.01.04` D-09's ratified `consented` ≠ `registered` two-truths shape.
  `09.03.05` D-03/D-05/D-06 are **confirmed, not amended**.
- **Key detail**: `09.01.02`'s deliberately-alarming empty-ledger copy ('Nobody owns this yet') must **not**
  fire on it — DT-03's thesis is that absence is the alarm; this is the one absence that is an answer.
- **Territory**: a v1 declaration is worldwide; jurisdictional contradiction is surfaced, not modelled.
- **Reversibility**: Medium.

### DEC-054: Delivery integrity — metadata written at ingest, two hashes only for watermarked products (2026-07-30)

- **Timestamp**: 2026-07-30T09:05:20.149Z
- **Agent**: claude
- **Source**: audit-ambiguity run 3 — owner decision queue
- **Tags**: decision, run3, ratified, domain-14

- **Problem**: `14.03.01` published one SHA-256 per artifact **before any bytes move** and auto-verified the
  download against it, while the same delivery step was specified to rewrite bytes per buyer (embedded
  tempo/key/loop metadata per `14.04.01` D-06, plus a per-buyer forensic watermark). Under the spec as
  written, every content download failed verification and E-19 quarantined a correctly-delivered build.
  Both colliding units are in the MUST band, so it was not deferrable.
- **Decision**: **move the metadata write upstream**. Embedded tempo/key/loop metadata is a property of the
  *product*, not the buyer — written once at ingest in `14.08.03` audio QC into the stored master. Delivery
  then has at most **one** writer. Unmarked products are byte-identical to the master, so the single published
  hash is simply correct. Watermarked products take a two-hash treatment (master + per-grant).
- **Why this over two-hashes-for-everything**: a per-buyer hash is a number only *we* can vouch for. The
  master hash is **corroborable** — two buyers of one build compare and agree. D-09's 'verify on a machine
  that has never met us' survives intact for the entire air-gapped Operator inventory.
- **E-19 split**: a per-grant mismatch is a transfer or stamping fault; only a **master** mismatch quarantines.
- **Not decided here**: `14.03.05` Q-02/Q-03 (watermarking opt-in and cost model) remain the owner's separate
  calls — Q-03 gains weight because it now also decides which products keep the one-hash contract.
- **Reversibility**: Medium.

### DEC-055: Radius breach hard-blocks confirm; the waiver becomes a real-time instrument (2026-07-30)

- **Timestamp**: 2026-07-30T09:05:20.149Z
- **Agent**: claude
- **Source**: audit-ambiguity run 3 — owner decision queue
- **Tags**: decision, run3, ratified, domain-17, domain-01

- **Problem**: `17.01.04` C-06/D-13 made a radius-clause breach a hard confirmation precondition; `17.01.03`
  D-15 made the same check at the same moment 'warn + recorded override, never hard-block'. Confirm-under-
  challenge routes through 17.01.04's gate, so both fired on one commit. The CX layer contradicted itself
  **inside one entry** (:31 'hard block' vs :371 'a hard block would be wrong').
- **The reframing that decided it**: 17.01.03's argument is not about permission, it is about **latency** —
  'consent is obtainable, just not within 48h'. Fix the latency and the argument dissolves.
- **Decision**: **C-06 stands.** The waiver becomes a first-class in-app instrument against the constraining
  Operator, with its own clock and escalation. Break-glass is narrow and priced: only while a challenge clock
  is live, artist principal never a delegate, the constraining promoter notified **at the moment of use**, and
  recorded as a named breach event feeding `17.12`.
- **Why not warn-everywhere**: it contradicts three ratified rows, and a warning dismissible at the last
  irreversible step is the weakest possible version of 17.06's promise. Why not split-by-pressure: a
  contractual permission depending on whether a rival challenged is indefensible and invites manufactured
  challenges.
- **New authority slot for domain 01**: 'artist principal, never a delegate' joins offer-binding
  (`17.02.03` D-03) and settlement-signing (`17.09.05` D-06).
- **Reversibility**: Medium.

### DEC-056: A require-confirmation rider requirement holds at unknown rather than matching (2026-07-30)

- **Timestamp**: 2026-07-30T09:05:20.150Z
- **Agent**: claude
- **Source**: audit-ambiguity run 3 — owner decision queue
- **Tags**: decision, run3, ratified, domain-18

- **Problem**: `18.04.01`'s `verification` flag said a `require-confirmation` item blocks the advance freeze
  even on an automatic diff match. But the freeze reads the checklist's hard-outstanding count, and
  `18.03.01` D-04 rules that a `match` generates **no item** — so the blocking effect had no mechanism
  anywhere. `require-confirmation` and `trust-listing` occur in exactly one file; no consumer implements them.
  D-05 floors every power item at `require-confirmation`, so this is mandatory on a whole category.
- **Decision**: such a requirement **never resolves to `match` from listing data** — it holds at `unknown`
  via one new `basis` value. The existing source-1 rule then fires (unknown → venue-side question) and D-06's
  existing sentence derives severity. **No new machinery at all.**
- **Why this over a fifth generation source**: that punches a permanent exception into D-04's headline rule
  and emits the largest item volume of any option — power's floor guarantees a matched 6-item power section
  emits 6 rows — which is precisely the alert-fatigue trade-off DT-14 was decided on.
- **Precedent, not invention**: `16.05.05` D-03 already forces `match` → `unknown` on stale show-stopping
  rows. 'Listing data is not consent' (DT-11) is the same claim about a different untrustworthiness.
- **`18.03.01` D-04 and D-06 untouched**; `18.03.05` unchanged.
- **Reversibility**: High — one enum value and three reworded claims.

### DEC-057: P1 keeps Supabase PostgreSQL canonical and bounds adjunct services (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:00.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: Supabase Pro PostgreSQL is canonical for relational business state; Storage owns governed bytes, Realtime carries hints, PostgreSQL search is v1, and Queue transport is paired with a transactional outbox. No adjunct may become an ungoverned second source of truth.
- **Reasoning**: The approved feature-to-query map favors relational invariants, rights, authority, money, CMS versioning, and audit consistency while retaining bounded managed capabilities.
- **Downstream**: Decomposition and schema work preserve canonical UUIDs, transactional authority, replay, and rebuild rules.
- **Reversibility**: Medium.

### DEC-058: Supabase Auth serves consumer identity; enterprise capabilities wait (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:01.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: Supabase Auth owns consumer credentials and sessions. Enterprise SSO, SCIM, enterprise tenancy, and enterprise administration are deferred until consumer launch is ready.
- **Reasoning**: Consumer launch needs secure social identity without premature enterprise scope or cost.
- **Downstream**: Auth specs implement consumer OAuth and recovery only; enterprise features require later evolution.
- **Reversibility**: Medium.

### DEC-059: Social identities are additive credentials on one canonical user (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:02.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: Google, Apple, Meta, lower-priority TikTok, SoundCloud, and BandLab when applicable are additive login credentials on one canonical user. Users may link or unlink providers after proof; no email-only auto-merge occurs and at least one recovery path must remain.
- **Reasoning**: Provider accounts are credentials, not separate people; safe linking prevents account takeover and duplicate identities.
- **Downstream**: Identity specs define link, unlink, conflict, recovery, audit, and provider-admission flows.
- **Reversibility**: Medium.

### DEC-060: TypeScript is the sole v1 primary language (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:03.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: TypeScript is the sole application language across Astro, React islands, Hono Workers, contracts, jobs, and tests; SQL remains migration and database-function implementation.
- **Reasoning**: One language maximizes shared contracts and minimizes runtime/tooling fragmentation.
- **Downstream**: A second primary language requires measured evidence and architecture evolution.
- **Reversibility**: Medium.

### DEC-061: CMS and settings-first operation are mission-critical (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:04.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: WeJammin includes a governed WordPress-like CMS/control plane for typed content types, fields, entries, templates/blocks, menus, navigation, taxonomies, media, settings, flags, revisions, approvals, preview, and publication. Plugins, themes, arbitrary code/CSS, and security/legal/transactional invariants as settings are prohibited.
- **Reasoning**: Routine variable content and configuration must be operator-editable without deployment while preserving domain authority and safety.
- **Downstream**: CMS is an early dependency and every variable must be classified as content, setting, rule pack, runtime config, secret, or invariant.
- **Reversibility**: Low.

### DEC-062: GitHub Actions runs CI/CD on the verified self-hosted fleet (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:05.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: GitHub Actions is the canonical CI/CD control plane using verified self-hosted runners, protected environments, immutable artifacts, and same-artifact promotion.
- **Reasoning**: It matches the repository and avoids hosted-runner baseline spend while retaining protected automation.
- **Downstream**: Setup verifies runner isolation, concurrency, secrets, caching, and protected deployment.
- **Reversibility**: Medium.

### DEC-063: Sentry plus structured native telemetry is the v1 monitoring stack (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:06.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: Use Sentry Developer for release-aware errors and sampled traces, Cloudflare/Supabase native logs and metrics for platform evidence, and PostgreSQL audit for durable business evidence.
- **Reasoning**: This provides actionable diagnostics at launch cost without treating telemetry as legal or business audit.
- **Downstream**: Setup configures scrubbing, quotas, sampling, source maps, alerts, and independent blind-spot detection.
- **Reversibility**: High.

### DEC-064: Astro hybrid rendering uses React only for hydrated islands (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:07.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: Astro hybrid rendering owns documents and route shells; React is limited to explicit interactive islands with validated serializable props and local state.
- **Reasoning**: Most surfaces benefit from server/static HTML while complex workbenches need bounded hydration.
- **Downstream**: Frontend specs justify every island and preserve canonical server-rendered context on island failure.
- **Reversibility**: Medium.

### DEC-065: Cloudflare Workers and Hono form one modular backend (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:08.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: Hono on Cloudflare Workers is one edge-deployed modular backend; domain modules own contracts and boundaries inside the deployable. No launch microservices or always-on servers exist.
- **Reasoning**: The model minimizes operations and latency while preserving later extraction seams.
- **Downstream**: Separate services require measured isolation, runtime, scale, legal, or organizational evidence.
- **Reversibility**: Medium.

### DEC-066: Versioned REST and OpenAPI define the platform API (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:09.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: The public application boundary is versioned REST/HTTP JSON under /api/v1, with OpenAPI generated from shared Zod contracts.
- **Reasoning**: REST provides explicit resources, commands, caching, provider/native compatibility, and bounded query cost.
- **Downstream**: Breaking changes require versioning or compatibility migration; GraphQL/tRPC are not launch boundaries.
- **Reversibility**: Medium.

### DEC-067: Cloudflare serves deploy assets; Supabase serves governed media (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:10.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: Cloudflare serves immutable build assets and cached public output; Supabase Storage serves governed media/documents behind PostgreSQL-owned metadata and policy.
- **Reasoning**: Deploy assets and rights-bearing user objects have different authority, retention, and access requirements.
- **Downstream**: Object access always authorizes in PostgreSQL and uses bounded signed delivery.
- **Reversibility**: Medium.

### DEC-068: The Working Record defines a product-first governed design system (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:11.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: The design north star is The Working Record: credible, human, exact, provenance-forward, warm-light, and product-first, with Jam Magenta as the constrained accent and root DESIGN.md as normative.
- **Reasoning**: The system must support dense professional work without generic dashboards, decorative cliches, or unverifiable claims.
- **Downstream**: Frontend specs consume tokens, archetypes, states, and provenance semantics rather than inventing local design rules.
- **Reversibility**: Medium.

### DEC-069: pnpm, Vitest, Playwright, ESLint, Prettier, and strict TypeScript form the toolchain (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:12.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: Use pnpm workspaces/Corepack, strict TypeScript, ESLint, Prettier, Vitest, and Playwright as the canonical development and validation toolchain.
- **Reasoning**: The tools align with Astro/Vite/Workers and provide reproducible contract, unit, integration, browser, and E2E gates.
- **Downstream**: Setup pins versions and implements canonical scripts without introducing parallel runners or package managers.
- **Reversibility**: Medium.

### DEC-070: Navigation adapts by route family and viewport (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:13.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: Public, product, admin, auth/recovery, and system route families use purpose-specific navigation; mobile and desktop adapt without becoming separate information architectures.
- **Reasoning**: One universal dashboard or menu cannot serve the platform breadth accessibly.
- **Downstream**: Frontend decomposition preserves named shells and menu locations.
- **Reversibility**: Medium.

### DEC-071: The layout uses a 4/8/12 hybrid grid (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:14.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: Responsive layout uses four columns on compact, eight on medium, and twelve on wide viewports with locked spacing tokens.
- **Reasoning**: A shared grid gives consistent density while supporting mobile through professional workbench layouts.
- **Downstream**: Components align to the shared grid and do not create independent spacing systems.
- **Reversibility**: High.

### DEC-072: Twelve page archetypes cover the platform without one universal dashboard (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:15.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: Twelve named page archetypes cover public records, discovery, workbenches, forms, review, admin, settings, operations, and system states.
- **Reasoning**: The product needs reusable structural patterns without flattening every workflow into cards or a dashboard.
- **Downstream**: Frontend specs classify pages into an archetype before component design.
- **Reversibility**: Medium.

### DEC-073: The global component inventory is a mandatory seed (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:16.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: A shared packages/ui inventory owns navigation, forms, provenance, status, errors, tables, uploads, audit, and offline/conflict primitives.
- **Reasoning**: Cross-domain consistency and accessibility require shared high-risk primitives.
- **Downstream**: Feature modules may extend but not redefine the global inventory.
- **Reversibility**: Medium.

### DEC-074: Motion is subtle responsive feedback (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:17.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: Motion is bounded responsive feedback, normally 150–220ms with reduced-motion support; bounce, elastic motion, layout animation, and choreographed product loads are prohibited.
- **Reasoning**: Motion must communicate state without delaying work or harming accessibility.
- **Downstream**: All frontend acceptance criteria include reduced-motion behavior.
- **Reversibility**: High.

### DEC-075: Data density is hybrid by archetype (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:18.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: Public surfaces are calmer; professional workbenches are compact and information-dense; density follows page archetype rather than one global mode.
- **Reasoning**: Users need both approachable public pages and efficient operational tools.
- **Downstream**: Components use approved compact/comfortable variants only where archetypes permit.
- **Reversibility**: High.

### DEC-076: Global states remain explicit and non-interchangeable (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:19.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: Loading, empty, absent, forbidden, blocked, stale, offline, degraded, conflict, failed, and success states are distinct contracts and cannot be collapsed into generic empty/error UI.
- **Reasoning**: Conflating states causes unsafe retries, authority leaks, and false confidence.
- **Downstream**: Every affected route/component specifies and tests applicable states.
- **Reversibility**: Low.

### DEC-077: Supabase Data API and PostgreSQL RPC replace a general ORM (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:20.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: Use generated Supabase Data API queries for bounded ordinary access and migration-owned PostgreSQL RPC for protected multi-row transactions; no general ORM is selected.
- **Reasoning**: This preserves RLS and transactional invariants without adding an abstraction that obscures SQL and policy.
- **Downstream**: Repositories expose typed ports; raw rows never become transport contracts.
- **Reversibility**: Medium.

### DEC-078: The launch system is an edge-deployed modular monolith (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:21.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: Launch as one Astro/Hono edge deployment with explicit domain modules, PostgreSQL schemas/contracts, Queue consumers, and provider adapters.
- **Reasoning**: A modular monolith fits launch staffing and budget while preserving clear boundaries.
- **Downstream**: Extraction requires evidence and a migration/replay plan.
- **Reversibility**: Medium.

### DEC-079: Every API failure uses one four-field envelope (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:22.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: Every JSON API failure has exactly code, message, requestId, and details; HTTP status stays on the response line and unsafe internals never reach clients.
- **Reasoning**: One envelope enables consistent safe error handling across browser, API, jobs, and support.
- **Downstream**: Contracts define per-code details and clients branch on code/context, never message text.
- **Reversibility**: Low.

### DEC-080: PostgreSQL owns truth and every secondary store is reconstructible or coordinated (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:23.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: PostgreSQL owns canonical authority; Storage bytes are governed by database metadata, Queue is disposable transport backed by outbox, Realtime is a hint, and search/public projections are transactional or rebuildable.
- **Reasoning**: Cross-store ambiguity is unacceptable for rights, money, publication, and evidence.
- **Downstream**: Every secondary representation defines identity, version, replay, deletion, and recovery.
- **Reversibility**: Low.

### DEC-081: Authentication is additive, but authorization is always first-party and contextual (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:24.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: External providers authenticate credentials only. Authorization resolves canonical user, acting party, current mandate/relationship/capability, and RLS policy server-side for every action.
- **Reasoning**: Social identity must never imply organizational or resource authority.
- **Downstream**: Every protected endpoint and job revalidates current acting context.
- **Reversibility**: Low.

### DEC-082: Zod 4 is the single runtime contract library and WCAG 2.2 AA is a release gate (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:25.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: Zod 4 defines runtime contracts and OpenAPI derivation; WCAG 2.2 AA gates public, authenticated, admin, and PWA release.
- **Reasoning**: Shared runtime validation and accessibility are production invariants, not later polish.
- **Downstream**: Contracts precede implementation and accessibility failures block release.
- **Reversibility**: Low.

### DEC-083: Launch integrations are allowlisted, degradable, and spend-gated (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:26.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: Launch integrations are Cloudflare, Supabase Pro at setup, GitHub/self-hosted Actions, Sentry, Resend, approved identity providers, and counsel-cleared Stripe-hosted Checkout Sessions plus hosted Connect. Unregistered destinations and deferred advertising, AI, enterprise, specialist search, and multi-party payout integrations fail closed.
- **Reasoning**: Each admitted provider has typed boundaries, local canonical state, failure fallback, deletion behavior, and a bounded cost gate.
- **Downstream**: Setup must verify provider terms, data placement, secrets, webhooks, outage behavior, quotas, and deletion before activation.
- **Reversibility**: High.

### DEC-084: Structured correlation plus numeric SLO alerts define launch observability (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:27.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: Propagate request, correlation, causation, job, attempt, and safe entity-version identifiers across API, RPC, outbox, Queue, and adapters; combine scrubbed logs, Sentry, numeric SLOs, dashboards, alerts, and runbooks.
- **Reasoning**: A solo owner needs actionable numeric signals without false 24/7 promises or PII leakage.
- **Downstream**: Setup creates and drills dashboards, alerts, scrubbing, sampling, and runbooks.
- **Reversibility**: High.

### DEC-085: Quality is contract-first and vertical from the first slice (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:28.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: Every capability advances through approved specs, Zod contract, failing test, minimal implementation, refactor, full validation, and all affected user/admin/data/security/telemetry/documentation surfaces.
- **Reasoning**: Horizontal partial delivery creates false completeness across highly coupled authority, CMS, rights, and money workflows.
- **Downstream**: All plans and slices follow Red-Green-Refactor and the completion checklist.
- **Reversibility**: Low.

### DEC-086: Consumer v1 ships through six dependency and infrastructure gates (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:29.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: Sequence assurance, operational foundation, identity/admin/CMS, projects/media/safety, credits/splits, services/single-payee commerce, and release hardening before later domains; enterprise remains deferred.
- **Reasoning**: Identity, acting context, CMS, and operations are prerequisites; commerce depends on earlier provenance and counsel gates.
- **Downstream**: Planning may optimize within gates but cannot violate dependency or exit criteria.
- **Reversibility**: Medium.

### DEC-087: Launch spend is capped and media is the primary cost risk (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:30.000Z
- **Agent**: codex
- **Source**: create-prd decision recovery
- **Tags**: decision, create-prd

- **Decision**: Spend is $0 before setup, setup/staging is capped at $50/month, and consumer production at $300/month. Supabase Pro starts at setup; seven-day production PITR reserves about $100 inside the production ceiling; 80/90% alerts and freezes apply.
- **Reasoning**: Media storage/renditions/egress grow faster than request volume and require attribution, quotas, and admission controls.
- **Downstream**: Setup records dated calculators and production features prove cost at 1k and 10k MAU.
- **Reversibility**: High.

### DEC-088: Final architecture owns every implementer-critical contract (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:31.000Z
- **Agent**: codex
- **Source**: audit-ambiguity architecture
- **Tags**: decision, architecture-audit

- **Decision**: Lock token-driven vanilla CSS with cascade layers, Astro scoped styles, and React CSS Modules; manual injection and explicit composition roots; exact error/cursor contracts; communication/fallback matrices; Stripe-hosted Checkout and hosted Connect without embedded card UI; and a linked runbook contract.
- **Reasoning**: Each omission allowed incompatible or less-safe implementations without changing product intent.
- **Downstream**: Later specs preserve these contracts; alternatives require evolution or propagated architecture change.
- **Reversibility**: Medium.

### DEC-089: Seven-day PITR gates protected production data (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:32.000Z
- **Agent**: codex
- **Source**: audit-ambiguity architecture
- **Tags**: decision, architecture-audit

- **Decision**: Enable and restore-test Supabase seven-day PITR before production money, rights, or publication records. Worst-case RPO is ≤2 minutes; protected writes remain disabled if PITR is unavailable or unverified; the roughly $100/month cost stays inside the $300 ceiling.
- **Reasoning**: Database-resident audit/outbox shares the recovery domain and cannot truthfully guarantee zero loss under daily restore.
- **Downstream**: Setup provisions production PITR and infrastructure verification proves RPO/RTO before enabling protected writes.
- **Reversibility**: Low.

### DEC-090: Final architecture embeds query and PII registries (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:33.000Z
- **Agent**: codex
- **Source**: audit-ambiguity architecture
- **Tags**: decision, architecture-audit

- **Decision**: Embed the normative 25-domain plus cross-cut feature-to-query map and canonical semantic PII field-registry seed in final architecture. Extensions require reviewed purpose, lawful basis/consent, access, retention, deletion, telemetry, search, and export treatment.
- **Reasoning**: Final-layer implementers cannot depend on working notes or prose-only PII classes.
- **Downstream**: Decomposition and schema specs map every entity/query and protected field to these registries.
- **Reversibility**: Medium.

### DEC-091: Performance gates use one numeric load and data profile (2026-08-02)

- **Timestamp**: 2026-08-02T18:00:34.000Z
- **Agent**: codex
- **Source**: audit-ambiguity architecture
- **Tags**: decision, architecture-audit

- **Decision**: Use the committed 20-iteration pull-request smoke; staging 5 RPS for 15 minutes then 25 RPS for 2 minutes; fixed route/cache mix, sample floors, deterministic dataset floors, and ten-client pgbench profile.
- **Reasoning**: Latency gates are meaningless if teams choose different traffic, data volume, cache state, or sample count.
- **Downstream**: Setup commits scenarios and seed manifests; validation reports environment, checksum, plans, samples, percentiles, and errors.
- **Reversibility**: High.

### DEC-092: Runtime contracts close the final architecture implementation seams (2026-08-02)

- **Timestamp**: 2026-08-03T00:40:00.000Z
- **Agent**: codex
- **Source**: audit-ambiguity architecture fresh rerun 1
- **Tags**: decision, architecture-audit, fresh-rerun

- **Decision**: Lock the CSS rationale and rejected alternatives; add explicit Hono/Queue-to-domain protocols and domain failure fallback; select repository-owned @wejammin/observability as the typed newline-delimited JSON runtime logger; fix client deadlines at 8 seconds for reads, 15 seconds for commands, 2 seconds for job acceptance, 30 seconds no-byte upload idle, and 15 minutes signed-upload expiry; and require every route/consumer to register exactly one SLO/async tier with CI coverage.
- **Reasoning**: Fresh implementer simulation proved that guidance without an import contract, approximate deadlines, implicit in-process arrows, unregistered SLO tiers, and unexplained CSS rejection still allowed incompatible conforming implementations.
- **Downstream**: Decomposition and later specs must use the named logger port, service-call direction, exact deadlines, route/consumer registry, and selected CSS governance. Alternatives require architecture evolution and equivalent contract tests.
- **Reversibility**: Medium; implementations can evolve behind stable ports and registries, but wire deadlines and monitoring assignments require propagated contract changes.

### DEC-093: Every technology axis and component arrow has one normative contract (2026-08-02)

- **Timestamp**: 2026-08-03T00:50:00.000Z
- **Agent**: codex
- **Source**: audit-ambiguity architecture fresh rerun 2
- **Tags**: decision, architecture-audit, fresh-rerun

- **Decision**: Add an exhaustive launch technology matrix naming each axis, selection, project-specific rationale, and rejected alternatives; replace the communication matrix with one row for every component-diagram arrow and preserve transport → domain port → infrastructure adapter direction.
- **Reasoning**: Fresh rerun 2 found that scattered rationale did not satisfy every selected axis and grouped protocol rows contradicted the diagram by allowing Hono to bypass domain persistence ports.
- **Downstream**: Decomposition and all architecture/backend specs must preserve the technology matrix and one-to-one path contracts. Any technology substitution or diagram/path change requires an originating architecture decision and synchronized matrix update.
- **Reversibility**: Medium; rows can evolve through explicit propagation, but silent local substitution is prohibited.

### DEC-094: Workers Paid is the selected shared staging and production tier (2026-08-02)

- **Timestamp**: 2026-08-03T01:00:00.000Z
- **Agent**: codex
- **Source**: audit-ambiguity architecture fresh rerun 3
- **Tags**: decision, architecture-audit, fresh-rerun, cloudflare, cost

- **Decision**: Cloudflare Workers Paid is required beginning with shared staging at /setup-workspace and remains the production tier. Pre-setup repository/local work and disposable Free-tier evaluation remain $0 and cannot carry shared staging, production data, or production traffic. Procurement and dated price verification are deferred; tier selection is not.
- **Reasoning**: Fresh rerun 3 found an explicit deferred-tier statement that contradicted the integration and cost models already reserving the Workers Paid floor and left setup teams free to choose incompatible postures.
- **Downstream**: Setup provisions Workers Paid within the $50 staging ceiling, verifies current pricing/limits, and configures 80/90% alerts before shared staging. Production promotion retains the selected tier unless an architecture change is propagated.
- **Reversibility**: High through a future hosting architecture decision, provided availability, queues, abuse controls, cost, and migration evidence remain satisfied.

### DEC-095: Design verification is local, first-party, and warm-light-only at launch (2026-08-02)

- **Timestamp**: 2026-08-03T01:10:00.000Z
- **Agent**: codex
- **Source**: audit-ambiguity architecture fresh rerun 4
- **Tags**: decision, architecture-audit, fresh-rerun, design-system

- **Decision**: Use a local/CI-only static Astro apps/docs catalog importing packages/ui; run tagged Playwright screenshots and @axe-core/playwright inside pnpm test:e2e; self-host approved immutable WOFF2 fonts through Cloudflare deploy assets without launch subsetting; launch only the warm-light theme and require /evolve-feature for dark theme.
- **Reasoning**: Fresh rerun 4 found that Storybook or equivalent, font delivery/subsetting, visual regression, and dark-theme admission were still selectable at setup, allowing different services, privacy/CSP posture, cost, accessibility scope, and visual coverage.
- **Downstream**: Setup pins the selected package/font versions, builds apps/docs without production deployment, creates reviewed baselines, and proves CI. Frontend specs enumerate catalog states and may not add font origins or themes outside this decision.
- **Reversibility**: Medium; tooling can evolve behind the same local/CI evidence contract, while font origin and theme changes require propagated security/accessibility/design updates.

### DEC-096: Provider effects are local-intent-first cross-store operations (2026-08-02)

- **Timestamp**: 2026-08-03T01:20:00.000Z
- **Agent**: codex
- **Source**: audit-ambiguity architecture fresh rerun 5
- **Tags**: decision, architecture-audit, fresh-rerun, persistence, integrations

- **Decision**: Every payment, email, registry, identity-adjacent, or other provider-backed operation uses a PostgreSQL operation/transaction UUID as canonical identity; commits local pending intent, idempotency, audit, and outbox before the provider effect; reads local state normally; reconciles unknown outcomes through signed webhook or bounded poll; and revokes locally before provider cancel/delete/suppress with retained evidence or exception.
- **Reasoning**: Fresh rerun 5 found that integration fallbacks did not supply the full canonical ID, creation order, failure recovery, deletion cascade, and read join required for every multi-store entity.
- **Downstream**: Every provider adapter and backend spec instantiates this lifecycle and may narrow retention/deletion only through its approved legal/provider contract. Blind retry and provider-authoritative rendering are prohibited.
- **Reversibility**: Low for operation ordering and canonical ownership; individual providers remain replaceable behind adapters.

### DEC-097: Decompose approved architecture into 43 dependency-ordered IA shards (2026-08-02)

- **Timestamp**: 2026-08-03T01:24:45.515Z
- **Agent**: codex
- **Source**: decompose-architecture
- **Tags**: decision, architecture, decomposition, ia, approved

Owner approved the recommended architecture decomposition: 43 total IA shards comprising 00-infrastructure plus 42 feature-domain shards. Mandatory splits M01-M13, recommended splits R01-R02, and keep-together decisions for domains 04, 05, 07, 08, 09, 12, 16, 20, 21, and 24 are locked. Dependencies must point only to lower-numbered shards. The canonical boundary table is .memory/wiki/specs/ia/decomposition-plan.md. Downstream IA, BE, FE, phase, setup, and implementation work must preserve these boundaries unless /remediate-shard-split or /propagate-decision is run.

### DEC-098: Shard 04 delivery eligibility learns dispute/rights/licence state by inbound command, not upward read (2026-08-05)

- **Timestamp**: 2026-08-05T06:54:22.708Z
- **Agent**: claude
- **Source**: /resolve-ambiguity all ia — gap A-25
- **Tags**: decision, ia, architecture, dependencies

- **Problem**: Shard 04 (CMS delivery and media) gates delivery eligibility on dispute, takedown, rights and licence state owned by Shards 06, 10 and 20. Those dependencies were undeclared, cited no section, and were absent from the Section Contract Map. Declaring them directly would point 04 at higher-numbered shards, which DEC-097 forbids, and 04 -> 06 closes a real cycle through Shard 05.
- **Options considered**: (A) inbound-command inversion — Shard 04 exposes protected delivery commands that 06/10/20 call; (B) upward event consumption via the Shard 00 envelope, amending DEC-097; (C) broker everything through Shard 05; (D) renumber the shards.
- **Decision**: Option A. Shard 04 exposes protected delivery commands (apply/release delivery hold, revoke delivery eligibility) that write `TakedownCaseLink` and set `AssetRight.state`. Shards 06, 10 and 20 call them. Every new edge points downward (06 -> 04, 10 -> 04, 20 -> 04), so DEC-097 and the acyclicity guarantee both survive unamended — 06 -> 04 already held transitively via 05, and 10 and 20 are not in 04's closure {00, 01, 03}. Shard 04 never adjudicates; it executes. Rejected B because Shard 00's events are identifier-only envelopes, so the consumer must still read producer state, reintroducing the upward edge the amendment was meant to remove. Rejected C because Shard 05's declared dependencies are 00, 01, 03, 04 — it cannot read Shard 10 or 20 either, and it would park adjudicated legal state in the admin shard. Rejected D because DEC-097 locks the 43-shard boundary table and renumbering rewrites every reference across 83 IA documents for no product benefit.
- **Downstream**: Shards 06, 10 and 20 each gain a Shard 04 integration section and a reciprocal Cross-Shard Section Contract Map entry. Shard 04 gains the protected command contracts and drops its undeclared upward dependencies. Sets the precedent for every future cross-shard need that would otherwise point upward: invert to an inbound command rather than amend DEC-097.
- **Reversibility**: Medium. The command surface is additive, but three shards take integration sections that would need unwinding.

### DEC-099: Vault access binds to a per-role vault_role_class, shipped as non-enforceable profile_version 0 with a review floor (2026-08-05)

- **Timestamp**: 2026-08-05T06:54:22.747Z
- **Agent**: claude
- **Source**: /resolve-ambiguity all ia — gap A-10
- **Tags**: decision, ia, access-control, vault

- **Problem**: Shard 09's PRJ-07 resolves vault access as roster roles intersected with asset sensitivity against an 'approved role-profile version', but nothing in the IA layer, its deep dive, or the architecture states what the profile binds to or what a roster role the profile does not name receives. DEC-016 makes the six ideation profiles non-enforceable candidates until practitioner validation approves a version, and assigned the profile-versioning and enforcement-rollout design to `/create-prd-security` — an assignment never discharged (the architecture design has zero hits for `sensitivity`, `role profile`, `role-derived` or `profile version`). PRJ-07 must still ship.
- **Options considered**: (A) per-`role_version` `vault_role_class` attribute, ideation rows shipped as draft `profile_version: 0`, unclassified roles floor to `review`; (B) bind to `role_version.family_id`; (C) owner and Producer only for v1; (D) defer the matrix to the BE layer.
- **Decision**: Option A. Add a `vault_role_class` attribute per `role_version` in Shard 07's taxonomy, valued from `SensitivityClass` (`roster | review | stems | takes | restricted`). Ship the six ideation candidate rows as `profile_version: 0`, explicitly marked non-enforceable draft. Any `role_version` with no `vault_role_class` — including every `pending_role_alias` — defaults to the lowest class (`review`) with an explained denial. Rejected B because role families are grouped for discography presentation, not confidentiality: mix engineer and mastering engineer share a family yet require opposite grants, which is the counter-intuitive case DT-01 says the feature exists for. Rejected C because it deletes the feature's value and reproduces the DT-02 failure the design exists to prevent. Rejected D because the BE layer was deleted in commit 5c4e712, so there is no downstream spec to defer into, and deferring reproduces this exact defect one layer down.
- **Precedent**: follows DEC-047 (P-01 stage vocabulary) — candidate values are evidence, not contract; the gate is in force, so no draft label becomes a downstream contract. Same disposition as the DAW-parsing and vault-profile calls.
- **Downstream**: Shard 07 takes a reciprocal taxonomy-model edit and changelog entry for `vault_role_class`; shard 09 keys `ResolveVaultAccess` on it. Classifying newly admitted DDEX roles becomes ongoing taxonomy-admin work, harmless by default because unclassified floors to `review`. DEC-016's boundaries hold: no per-asset ACLs, no project-wide grants, no owner-configured-only model. `/create-prd-security` still owes the profile-versioning and enforcement-rollout design.
- **Reversibility**: High while `profile_version` is 0 — nothing is enforceable until an approved version lands.

### DEC-100: Shard 02 accepts bounded inbound evidence and policy commands without upward store reads (2026-08-28)

- **Timestamp**: 2026-08-28T19:00:00-04:00
- **Agent**: codex
- **Source**: /write-be-spec Shard 02
- **Tags**: decision, backend, shard-02, dependency-direction, events

- **Problem**: Shard 02 profile, credential and trader projections consume media, credit, attendance, consent, policy and marketplace evidence canonically owned by later-numbered shards. Direct reads into those stores would reverse dependency direction, couple availability and let this shard reinterpret producer truth.
- **Options considered**: (A) direct request-time reads from higher-numbered stores; (B) duplicate canonical truth in Shard 02; (C) accept bounded, versioned producer observations and protected commands through transactional outbox, signed ingress and idempotent inbox contracts.
- **Decision**: Option C. Later shards retain canonical ownership and deliver only allowlisted, versioned observations or policy commands. Shard 02 authenticates the producer, validates the exact schema and monotonic source version, stores the bounded local projection, and never reads a higher-numbered store. Critical consequences use protected commands rather than advisory events. Shard 05 may operate generic governed publication, while 02c owns qualification and trader policy semantics, rule versions and evaluation behavior.
- **Downstream**: 02a consumes party, proof and Shard 06 outcome inputs; 02b consumes Shard 04 media, Shard 07 credit, Shard 17 attendance and Shard 20 consent observations; 02c consumes governed Shard 05 policy publication and bounded marketplace signals. Producers use at-least-once delivery, idempotent inboxes, version fencing, retry and DLQ recovery.
- **Reversibility**: Medium. Producer schemas and adapters can evolve version by version, but changing canonical ownership or permitting request-time upward reads requires rerunning the originating architecture stage and cascading downstream.

### DEC-101: AC266 moves to a post-Phase-2 production-readiness gate without being passed or waived (2026-09-21)

- **Timestamp**: 2026-09-21T00:38:00-04:00
- **Agent**: codex
- **Source**: /propagate-decision AC266
- **Tags**: decision, phase-2, slice-09, accessibility, production-readiness, propagation

- **Problem**: Slice 09 counted AC266 real-device VoiceOver/Safari and NVDA/Firefox evidence in its implementation-completion denominator even though the owner cannot practically access both required devices. Keeping that unavailable manual attestation in the implementation sequence blocks every later Phase 2 slice, while treating automation, simulation, or deferral as acceptance would fabricate evidence.
- **Options considered**: (A) keep AC266 in Slice 09 completion and halt Phase 2; (B) mark AC266 passed or waived; (C) preserve all authored IDs and fail-closed evidence contracts, exclude AC266 from Phase 2 implementation completion, and retain it as a mandatory post-Phase-2 production-readiness and release gate.
- **Decision**: Option C. Phase 2 retains 2,000 authored criteria and 1,999 implementation-completion criteria. Slice 09 retains 283 contiguous authored IDs and uses a 282-criterion implementation-completion denominator. AC266 remains authored, unchecked, owner-deferred, and must never be represented as passed, waived, simulated, or inferred. Slice 10 remains locked until AC209, AC211, and AC265 pass.
- **Downstream**: The Phase 2 plan, Slice 09 and aggregate progress records, architecture map, release-evidence runbook, policy tests, and progress validator distinguish implementation completion from production readiness. Existing AC266 contracts, protected workflows, and real macOS/Safari/VoiceOver plus Windows/Firefox/NVDA requirements remain unchanged and must pass before production readiness or release.
- **Reversibility**: High for implementation sequencing, but no production release may erase or weaken the deferred real-device evidence obligation without a new owner decision and full downstream propagation.

### DEC-102: Browser gates run Google Chrome only, on the engine-family wire contract (2026-09-24)

- **Timestamp**: 2026-09-24T12:20:00-04:00
- **Agent**: codex
- **Source**: Owner instruction - Chrome-only browser gates (branch codex/chrome-only-browser-gates)
- **Tags**: decision, ci, playwright, accessibility, tooling, owner-directive

- **Problem**: Every Playwright project installed and launched Playwright's bundled Chromium download, including the protected staging AC266 automated-axe collector. Local runs, CI, and release evidence could therefore validate a browser build the owner never uses, while the desktop of record runs the installer-provided Google Chrome. The project Playwright skill named Chromium as the pull-request baseline, so the repository had no single statement of which browser the gates must exercise.
- **Options considered**: (A) keep bundled Chromium and treat Google Chrome as a manual-only check; (B) install Google Chrome dynamically inside the workflows so any runner could satisfy the gate; (C) run the installer-provided Google Chrome through Playwright's Chrome channel (channel: 'chrome') and fail closed on a runner that lacks it.
- **Decision**: Option C. Owner-scoped: the browser automation and CI gates for this project run Google Chrome only, and no Chromium fallback is provided. All three Playwright entry points (playwright.config.ts, playwright.s09-real.config.ts, tests/e2e/support/ac265-hosted-config.ts) declare channel: 'chrome', and infra/workflows/verify-system-chrome.sh asserts the binary before any gate runs. The AC266 automated-axe artifact keeps its locked name: 'chromium' engine-family literal and its ac266-automated-axe-v1 schema version, because that field records the render engine rather than the distributor build; Google Chrome is Chromium-based, so no retained or deployed evidence interpretation changes and no new device acceptance is claimed. The Playwright skill mirrors were deliberately left unedited for this change.
- **Downstream**: CI and staging verification now depend on the official Google Chrome package being present on the runner; a runner without it fails closed instead of silently degrading. Verified on the self-hosted fleet - three wejammin runners on this host, Chrome 154.0.8037.57 - with 101/101 functional checks reported as [chrome], the production-built S09 real-route suite, 100% coverage across 4,835 tests, and pnpm validate exit 0. Launched processes resolved to /opt/google/chrome/chrome. The GitHub-hosted ubuntu-24.04 image already ships Google Chrome (152.0.7977.82, image 20260907.300.1), so the AC265 authorization-foundation preflight passes there, with a hosted/local Chrome version skew of 152 versus 154 that matters for evidence reproducibility. The AC266 real-device VoiceOver/NVDA obligation is untouched: this decision covers automated browser gates only and claims no hosted acceptance.
- **Reversibility**: High. Reverting to bundled Chromium means restoring the playwright install chromium steps and dropping the channel pin; the fail-closed preflight is the only new runner requirement.

### DEC-103: AC265 staging identities come from Cloud Identity Free, with exactly one narrow expiring CMS read grant (2026-09-25)

- **Timestamp**: 2026-09-25T15:52:00-04:00
- **Agent**: codex
- **Source**: Owner decision - Cloud Identity Free source for dedicated AC265 staging test identities, plus a single narrow read-grant exception (branch codex/ac265-free-identity-decision)
- **Tags**: decision, ac265, identity, staging, authorization, owner-directive

- **Problem**: Slice 09 could not provision the dedicated AC265 staging test identities because two gates were open. The identity source was undecided (Cloud Identity Free on the owner-controlled `wejamm.in` domain versus an existing Google organization) under a cost ceiling that excludes paid Workspace seats, and the sole-admin/no-other-CMS-authority rule had no dated exception. Separately, the locked `entitled_read` role requires an actor holding `cms.schema_registry.read` without `cms.schema_designer`, because the deployed server resolver selects `ownerFull` first whenever `cms.schema_designer` is present, so the role cannot be produced by the sole admin account.
- **Options considered**: (A) leave both gates open and continue to hold the matrix; (B) source identities from paid Google Workspace or an existing organization; (C) source them from Cloud Identity Free on `wejamm.in` with no paid Workspace, keep the existing account as sole admin, and approve exactly one narrowly scoped, expiring `cms.schema_registry.read` staging grant as an explicit exception.
- **Decision**: Option C. Dedicated AC265 staging test identities come from **Cloud Identity Free** on `wejamm.in` with **no paid Google Workspace**. The existing owner account remains the **sole admin**, and exactly one narrowly scoped, expiring `cms.schema_registry.read` staging test-account grant is authorized as an explicit exception; no test account receives `cms.schema_designer` or admin/design permission. Recorded in the [2026-09-25 decision record](../pipeline/progress/verification/2026-09-25-ac265-free-identity-and-read-grant-decision.md), which resolves gates 1-2 of the [2026-09-23 dedicated-accounts record](../pipeline/progress/verification/2026-09-23-ac265-dedicated-staging-test-accounts-decision.md) and leaves its privileged-admin-question gate unanswered. **Nothing is provisioned and no criterion closes**: Google-side Cloud Identity account/administrator creation, `wejamm.in` domain verification, and terms acceptance remain owner-performed and outstanding.
- **Downstream**: Unblocks owner-performed provisioning of the nonprivileged staging identities and the single expiring read grant, with the sole-admin decision retained rather than superseded. `admin_step_up` still needs a confirmed enrolled factor and a completed current-context step-up (the staging dashboard showed App Authenticator `Enabled` on the Free plan, but enrolled factors were not confirmed), and the step-up surface decision remains open. `staff_case_scoped` stays a Slice 09 scope blocker, not an account blocker. The runner contract still forbids the runner from creating identities, grants, mandates, organizations, cases, content schemas, or prerequisites, so provisioning happens outside the runner under owner control. Resolves the stale `supabase/config.toml` claim that MFA requires the Supabase Pro plan.
- **Reversibility**: Medium. The identity source and the single narrow grant can be changed by a new dated owner record, but hosted AC265 acceptance remains contingent on genuine provisioned identities, a confirmed enrolled factor, and the unprovisioned broker/evidence services, none of which this decision supplies.

### DEC-104: AC209 and AC211 move to post-implementation production-evidence gates without being passed or waived (2026-09-25)

- **Timestamp**: 2026-09-25T20:30:00-04:00
- **Agent**: codex
- **Source**: /propagate-decision AC209/AC211 prelaunch production-evidence rescope
- **Tags**: decision, phase-2, slice-09, production-evidence, operational-slo, propagation, owner-directive

- **Problem**: The owner cannot produce genuine production evidence before the product exists. Slice 09 required a live-delivery receipt for `P2-S09-AC-209` and a complete-UTC-day Tier 2 SLO report for `P2-S09-AC-211`, but the pipeline is prelaunch with no production deployment carrying the exact release and no genuine production traffic. Keeping both inside the active implementation-completion denominator blocked Slice 09 and every dependent slice on evidence that cannot exist yet, which is circular; treating the absence as acceptance would fabricate evidence.
- **Options considered**: (A) keep AC209 and AC211 as active Slice 09 implementation gates and halt Phase 2 until production exists; (B) mark both passed, waived, or satisfied by staging, synthetic, or fixture evidence; (C) preserve all 283 authored IDs and their fail-closed evidence contracts, exclude both from the active implementation denominators, and retain them as mandatory production-evidence gates on distinct timelines.
- **Decision**: Option C. Phase 2 implementation completion uses a **1997-criterion denominator** and Slice 09 uses a **280-criterion denominator**; Slice 09 is **279/280 active** with all 283 authored IDs retained. `P2-S09-AC-265` is the **only** Slice 10 implementation prerequisite, and it is staging-only by contract. AC209 and AC211 remain authored and unchecked and must never be represented as passed, waived, simulated, or inferred. This supersedes DEC-101's Slice 10 dependency sentence; DEC-101's AC266 deferral otherwise stands.
- **Distinct gate timing**: AC209 is a **production-rollout/post-deployment evidence gate**. It does not gate Slice 10 implementation or the initial controlled production deployment needed to produce its evidence; it must pass before alerting is declared ready. AC211 is **post-launch operational SLO acceptance**. It does not gate the initial launch and is mandatory after initial launch, once genuine production traffic spans a complete UTC day; it requires the natural floors of 200 commands, 200 protected RPCs, 200 acceptances, and one queue first attempt plus all five locked SLO results. AC266 remains the separate **pre-release** real-device accessibility gate. AC209 and AC211 are not pre-release blockers, and AC266's pre-release label must not be copied onto them.
- **Downstream**: The Phase 2 plan, Phase 2 and Slice 09 trackers, overall index, spec-pipeline tracker, progress blockers, architecture map, release-evidence runbook, progress-consistency validator, focused policy tests, session record, and propagation record now distinguish implementation completion from production acceptance across these three timelines. The alert policy, alert boundaries, SLO thresholds, DLQ and queue definitions, the protected AC211 collector, and their tests remain Slice 09 implementation scope and stay in the tree unchanged.
- **AC265 boundary and remaining work**: AC265 remains the only Slice 10 implementation prerequisite and is an active implementation gate, but it **cannot close prelaunch** as currently implemented. Its contract is staging-only, yet its declared acceptance route requires the combined release-evidence verifier, which pins `alerting.deploymentId` and `slo.deploymentId` to `expected.productionDeploymentId` while the evidence shape requires all four members. Closing AC265 therefore requires production-bound AC209/AC211 evidence, which is the circularity this decision removes.
- **Follow-up (not delivered here)**: implement a hosted-scope acceptance route: add a hosted-scope evidence shape and hosted-only expected identity (`{artifact, hostedE2e, accessibility, verifiedAt}` without `productionDeploymentId`/`productionDeployedAt`) and route AC265 and AC266 acceptance through the retained hosted-report verifier plus the existing axe and manual verifiers. `alerting` and `slo` remain mandatory in the production sidecar for AC209 and AC211. Delivered as a separate follow-up PR so this rescope stays a policy and record correction.
- **Reversibility**: High for implementation sequencing, but no production release may erase or weaken the deferred production-evidence obligations, and no initial launch may be represented as alerting-ready before AC209 passes, without a new owner decision and full downstream propagation.

### DEC-105: AC265 hosted acceptance is a mandatory pre-release gate, not a Slice 10 implementation prerequisite (2026-09-26)

- **Timestamp**: 2026-09-26T18:02:36.994Z
- **Agent**: codex
- **Source**: Owner decision - move P2-S09-AC-265 to pre-release
- **Tags**: decision, phase-2, slice-09, ac265, pre-release, propagation, owner-directive

- **Problem**: AC265's genuine hosted staging matrix and exact-artifact provenance remain open, but requiring that external acceptance before Slice 10 implementation recreates a dependency lock while the product is still in development.
- **Options considered**: Keep AC265 as the active implementation prerequisite; claim it passed or waive its evidence; or retain every authored evidence requirement and move acceptance timing to pre-release while allowing implementation to proceed.
- **Decision**: Move P2-S09-AC-265 to a mandatory pre-release production-readiness/release gate. It is excluded only from the Slice 09 and Phase 2 active implementation-completion denominators. Slice 09 is 279/279 active with 283 authored IDs; Phase 2 has 1,996 active of 2,000 authored IDs. Slice 10 implementation has no AC265 prerequisite. AC265 remains authored and unchecked and must not be called passed, waived, simulated, or inferred. Its nine real staging role sessions, ten scenarios, signed exact artifact provenance, retained hosted report, and authenticated receipt remain necessary before release.
- **Other gates**: AC266 remains a separate pre-release real-device accessibility gate. AC209 remains a production-rollout/post-deployment alerting-readiness gate. AC211 remains post-launch operational SLO acceptance. No gate is deleted, and this decision does not authorize launch while AC265 or AC266 is unproven.
- **Downstream**: Update the Phase 2 plan, active progress records, architecture/runbooks, validator, and focused tests. Retain dated historical records and prior decisions; this decision supersedes DEC-104's sentence that AC265 is the only Slice 10 prerequisite, not DEC-104's AC209/AC211 timing.
- **Reversibility**: A future timing change requires a new owner decision and propagation. The hosted evidence requirements remain fail-closed.

### DEC-106: CMS authors need protected entry bootstrap and draft-detail reads (2026-09-26)

- **Timestamp**: 2026-09-26T19:16:50Z
- **Agent**: codex
- **Source**: Owner approval of protected entry-create and draft-detail API contracts for Slice 10
- **Tags**: decision, phase-2, slice-10, cms, editorial, api, propagation, owner-directive

- **Problem**: IA03 CMS-05 promises creation and editing of content entries, but BE03b defines only `POST /api/v1/cms/entries/{entryId}/revisions`, which requires an existing active entry and a positive readable base revision. Its history GET returns summaries and hashes, not editable values. Direct browser database access is revoked. Consequently the current contracts cannot bootstrap the first revision or load an existing draft for the editor.
- **Options considered**: Keep Slice 10 limited to out-of-band pre-provisioned entries and leave create/edit incomplete; or add protected entry-create and draft-detail routes with server-derived identity, assignment, active-schema validation, and a complete authorization boundary.
- **Decision**: Add protected initial-entry-create and authorized draft-detail-read contracts to the locked CMS specifications and Slice 10 implementation scope. Initial creation must atomically create an active entry, its attributable first draft revision, assignment, audit/idempotency/outbox effects, and return an authorized canonical resource; retries may not duplicate effects. Draft detail must return only the caller-authorized editable values and provenance, with hidden entries concealed as 404 and visible-but-unauthorized entries denied as 403. Neither route may trust caller-supplied owner, acting party, capability, or authority. Browser direct table access stays revoked.
- **Downstream**: Propagate through IA03/deep dive, BE03b route registry and Zod/authorization/data/error contracts, FE03 loader/form mapping, Phase 2 Slice 10 acceptance criteria and trackers, code, tests, runbooks, and spec graph. Preserve existing CMS-03B-01 through -09 operation IDs and existing Slice 09 evidence gates. Do not mark new criteria complete until implemented and verified.
- **Reversibility**: Medium. Any removal of protected bootstrap or detail reads would again require an owner decision and downstream propagation because CMS-05 cannot otherwise fulfill its locked create/edit outcome.

### DEC-107: CMS-06 conflict resolution requires a private durable conflict record (2026-09-26)

- **Timestamp**: 2026-09-26T20:35:12Z
- **Agent**: codex
- **Source**: Owner approval of durable private CMS conflict record for Slice 10
- **Tags**: decision, phase-2, slice-10, cms, conflict, database, propagation, owner-directive

- **Problem**: BE03b defines CMS-03B-02 conflict resolution with conflictId, current unresolved-conflict lookup, and atomic close, but its eleven-table canonical model contains no conflict record, field envelope, RLS boundary, or index. A wire-only conflictId cannot safely support durable resolution.
- **Options considered**: Add a twelfth private canonical conflict table and propagate the locked BE03b model; or defer CMS-06 until an alternate persistence design is approved.
- **Decision**: Add the private conflict table. The record must bind entry and base/theirs/yours revision identities, changed paths and safe hashes, open/resolved/superseded state, version and timestamps, one open conflict per entry, current actor/assignment and RLS authority, and atomic resolution with the resulting revision/audit/outbox. No browser table grants or caller authority assertions.
- **Downstream**: Amend BE03b canonical records and all table counts, conflict data flow, authorization and tests; check IA03/FE03 references and Phase 2 Slice 10 plan for impact; add a forward migration and pgTAP tests. Preserve all eleven existing table definitions and operation IDs. Keep CMS-06 criteria unchecked until route, RPC, UI and evidence pass.
- **Reversibility**: Medium. Replacing the durable record with a different persistence design requires another owner decision and propagation.

### DEC-108: Complete CMS schema activation with private review and real prerequisite producers (2026-10-02)

- **Timestamp**: 2026-10-02T02:06:54Z
- **Agent**: codex
- **Source**: Owner approval of Slice 09 activation producer amendment
- **Tags**: decision, phase-2, slice-09, cms, activation, security, propagation, owner-directive

- **Problem**: CMS-04 requires independently approved immutable schema activation, but BE03a's eight-operation registry has no successor/dry-run/review producers, installed activation misuses CFG setting-value review ownership, and real source/template producers follow Slice 09.
- **Decision**: Approve the exact amendment recorded in .memory/pipeline/progress/verification/2026-10-02-slice-09-activation-amendment-approval.md, approved source SHA-256 e481bb9046703bbbd5ace3ef60b30d75bf21fb766f77477481e8a4cfcdaf33ca. Add CMS-owned private review, append-only decisions and bounded assignments; protected CMS-03A-09 through -14; approval-only cms.schema_review and owner-only cms.schema_review.assign; stable server-derived private binding evidence; actual successor/dry-run/scan/transform producers. Move only minimum protected source-row and immutable compatible-template prerequisites into Slice 09. Existing owner remains sole admin.
- **Downstream**: Cascade IA03/deep dive, BE03a/03b/03c prerequisite references, FE03, capability/route/OpenAPI contracts, Phase 2 plan and progress. Add open criteria and recompute depth floor before implementation acceptance. Existing private-binding transport and independently verified AC250 are retained.
- **Boundaries**: Approval creates no real account, assignment, grant, provider enrollment, paid service, deployment or acceptance receipt. All 17 activation criteria and new criteria remain open. AC209/AC211 remain post-deployment/post-launch and AC265/AC266 mandatory pre-release, authored and unchecked. Remaining Slice 10/12 scope stays gated. Public template activation is a separate Slice 12 gap, not AC169's prerequisite.
- **Reversibility**: Medium. Changing private ownership, reviewer authority or dependency scope requires owner decision and downstream cascade.

### DEC-109: Editorial workflow policies come from a code-owned versioned registry (2026-10-02)

- **Timestamp**: 2026-10-02T03:58:16.473Z
- **Agent**: claude
- **Source**: implement-slice (Slice 09 DEC-108 cascade)
- **Tags**: decision, cms, slice-09, slice-10

- **Problem**: CMS-03B-10 entry create refuses because `platform_private.cms_editorial_workflow_policy_evidence` returns NULL; DEC-108 needs real entries for the second activation path and no editorial policy source existed (BE03b DEC-108 attribution; propagation-scan-2026-09-28-cms-editorial-policy-source).
- **Options considered**: (A) code-owned versioned registry seeded by forward migration, shared shape with the DEC-108 schema-review registry; (B) owner-enrolled append-only persisted registry with a new protected enrollment operation/UI; (C) Slice 07 protected typed settings.
- **Decision**: A, chosen by the owner 2026-10-02. One versioned policy module in code (key, version, policyHash, riskClass, requiredDecisionCount 1..8, requiredCapabilities); a forward-only migration seeds immutable rows; each content-type version binds one policy key/version at activation; the evidence seam resolves the bound immutable row and returns NULL on absence, ambiguity or malformed data. Caller-supplied policy is never authority. Supersedes the scan proposal of owner enrollment with no default rows.
- **Downstream**: BE03b/IA03 policy-source text, entry authority migration, Slice 09 prerequisite path, Slice 10 editorial review, Slice 11 publication preflight.
- **Reversibility**: Medium (a later persisted registry can replace the seam).

### DEC-110: Protected workflow policies are four disclosure classes with their own specialist reviewer capabilities (2026-10-02)

- **Timestamp**: 2026-10-02T03:58:16.474Z
- **Agent**: claude
- **Source**: implement-slice (Slice 09 DEC-108 cascade)
- **Tags**: decision, cms, slice-09

- **Problem**: the registry allowlist held only ordinary keys (editorial, editorial.default, cms.content.workflow, cms.standard), so the protected path (P2-S09-AC-091) was unreachable; IA03 Risk review and BE03b protected-review rules require policy/legal/security/financial disclosure classes with two distinct humans and a named specialist capability.
- **Options considered**: (A) four protected class keys each with its own specialist capability; (B) four keys sharing one specialist capability; (C) one generic protected key.
- **Decision**: A, chosen by the owner 2026-10-02. Existing four keys stay ordinary (one independent reviewer). Add protected keys cms.disclosure.policy, cms.disclosure.legal, cms.disclosure.security, cms.disclosure.financial at version 1, each requiring at least two distinct human decisions including one holder of the class specialist capability cms.reviewer.policy, cms.reviewer.legal, cms.reviewer.security or cms.reviewer.financial respectively. DEC-108 schema reviews follow the same key risk class: ordinary needs one cms.schema_review reviewer, protected needs two.
- **Downstream**: code-owned policy registry members, capability registry, BE03a/BE03b/IA03 registry text, Slice 09 AC091 protected path, Slice 10/11 editorial review tests.
- **Reversibility**: Medium.

### DEC-111: Step-up MFA is delivered by server-mediated Worker operations and a protected step-up page (2026-10-02)

- **Timestamp**: 2026-10-02T03:59:51.269Z
- **Agent**: claude
- **Source**: implement-slice (Slice 09 DEC-108 cascade)
- **Tags**: decision, auth, mfa, slice-09

- **Problem**: DEC-108 decisions/assignments/activation (and later S11 publish, S14 revoke, S15 holds, S16 lifecycle) require recent MFA and answer 401 STEP_UP_REQUIRED, but no surface lets a signed-in user complete an MFA challenge. BE01a keeps Supabase Auth as MFA authority; the Worker only reads amr MFA timestamps (apps/worker/src/authentication/production-token.ts); the 2026-09-25 free-identity record left the surface open.
- **Options considered**: (A) server-mediated step-up challenge/verify operations that call Supabase MFA server-side and rotate the first-party session to an aal2 token, with a protected step-up page and safe returnTo; (B) browser supabase-js MFA then token exchange; (C) full re-sign-in with a new step_up intent.
- **Decision**: A, chosen by the owner 2026-10-02. The browser never handles Supabase tokens; one reusable surface serves every later slice. Includes TOTP factor enrollment if no enrollment surface exists.
- **Downstream**: BE01a/FE01 new operations and page, BE00 STEP_UP_REQUIRED recovery routing, Slice 09 prerequisite scope (first consumer), Slices 11/14/15/16.
- **Reversibility**: Medium.

### DEC-112: CMS rich text uses an owned versioned rich_text.v1 AST (2026-10-02)

- **Timestamp**: 2026-10-02T04:00:41.858Z
- **Agent**: claude
- **Source**: implement-slice (Phase 2 decision queue)
- **Tags**: decision, cms, slice-10

- **Problem**: architecture/IA03 require rich_text as an approved structured AST, never executable HTML, but no grammar, validator or renderer was chosen; migration 20260927540000 refuses every non-null rich_text value (propagation-scan-2026-09-30-cms-rich-text-ast).
- **Options considered**: (A) own minimal versioned grammar; (B) allowlisted TipTap/ProseMirror JSON; (C) Portable Text subset.
- **Decision**: A, chosen by the owner 2026-10-02. rich_text.v1 blocks: paragraph, heading levels 2-4, bulleted list, numbered list, list item, quote; marks: bold, italic, code; links limited to https, mailto and internal first-party routes; no inline embeds (media stays in governed blocks). Shared TypeScript and PostgreSQL validators, RFC 8785/JCS canonical hash, typed React renderer, constrained native editor. Bounds (depth/children/bytes) follow the BE03b JSON caps.
- **Downstream**: architecture/IA03/BE03a validator registry/BE03b/FE03 cascade; replaces the 20260927540000 refusal after RED to GREEN; Slice 10 AC031 and AC050-052.
- **Reversibility**: Medium (versioned grammar allows v2).

### DEC-113: Template and pattern activation is reviewer-gated through generalized CMS review machinery (2026-10-02)

- **Timestamp**: 2026-10-02T04:01:00.277Z
- **Agent**: claude
- **Source**: implement-slice (Phase 2 decision queue)
- **Tags**: decision, cms, slice-12

- **Problem**: BE03c records template activation as an unresolved contract gap (BE03c:226-230; propagation-scan-2026-09-28-cms-template-activation); IA03 requires create and activate for templates and patterns; no authority was chosen.
- **Options considered**: (A) reviewer-gated, generalizing the DEC-108 review/decision/assignment machinery to template and pattern subjects; (B) designer-only activation with recent MFA; (C) split by risk.
- **Decision**: A, chosen by the owner 2026-10-02. A designer submits; independent assigned reviewer(s) decide with recent MFA (DEC-111 step-up); an atomic CAS switch emits cms.template.activated.v1 (pattern equivalent). Required decision count = strictest DEC-110 workflow policy among the bound content types (ordinary 1, protected 2 with class specialist). Same-key serialization, exact replay, no event on refusal, 403/404 concealment.
- **Downstream**: IA03/BE03c/FE03 cascade, new protected operations, Slice 12 criteria, Slices 11 and 15 safe publication.
- **Reversibility**: Medium.

### DEC-114: Build the scope-locked CMS-15/16 and CFG-05C-01 flows in Phase 2 instead of moving their criteria (2026-10-02)

- **Timestamp**: 2026-10-02T04:01:35.112Z
- **Agent**: claude
- **Source**: implement-slice (Phase 2 decision queue)
- **Tags**: decision, scope, slice-12, slice-16

- **Problem**: the Phase 2 scope lock (phases/phase-2.md Scope lock) defers CMS-15 localization, CMS-16 related content and config import/export/restore, while the approved plan carries Phase 2 criteria for them (Slice 12 AC033-038; Slice 16 AC011-013, AC017, AC019-021).
- **Options considered**: (A) un-defer and build the flows those criteria require; (B) count-preserving move of the criteria out of Phase 2; (C) contract-level fail-closed satisfaction.
- **Decision**: A, chosen by the owner 2026-10-02, consistent with the more-work-now default. Implement exactly the flows the criteria require per BE03c/BE05c, close their spec gaps first (related-content eligible-target authority, locale source-stale fan-out bound and event key), and amend the scope-lock line.
- **Downstream**: phases/phase-2.md scope lock, IA03/IA05, BE03c/BE05c/FE03/FE05 cascades, Slices 12 and 16 size.
- **Reversibility**: Low once shipped.

### DEC-115: Navigation, route/slug and discovery-metadata candidates are approved through generalized CMS review (2026-10-02)

- **Timestamp**: 2026-10-02T04:01:55.869Z
- **Agent**: claude
- **Source**: implement-slice (Phase 2 decision queue)
- **Tags**: decision, delivery, slice-13

- **Problem**: BE04a Menu/MenuVersion/RouteRecord/RedirectRecord/DiscoveryMetadataVersion use draft-review-approved-active and DLV-NAV-API-02 requires an approved previewed candidate, but no submit/review/approve operation exists.
- **Options considered**: (A) generalized DEC-108/DEC-113 CMS review machinery with nav/route/metadata subjects; (B) publish-is-approval; (C) Slice 08 admin task-inbox approval.
- **Decision**: A, chosen by the owner 2026-10-02. Editor submits, an assigned independent reviewer approves with recent MFA (records approved_by_person_id/approved_at), and a publisher activates via DLV-NAV-API-02. Count from the code-owned policy registry (DEC-109/110; ordinary 1).
- **Downstream**: BE04a/FE04/IA04 cascade, new submit/decide operations, Slice 13 criteria.
- **Reversibility**: Medium.

### DEC-116: Media scanning and renditions are $0 self-operated; Phase 2 hosted per-file cap is 50 MiB (2026-10-02)

- **Timestamp**: 2026-10-02T04:02:56.243Z
- **Agent**: claude
- **Source**: implement-slice (Phase 2 decision queue)
- **Tags**: decision, media, slice-14

- **Problem**: Slice 14 needs a malware scanner and image-rendition transforms (ENGINEERING-STANDARDS upload safety; BE04b ingest/verification), no providers were chosen, and BE04b allows 5 GiB uploads while hosted Supabase Free caps files at 50 MiB. Only Workers Paid is an authorized paid service.
- **Options considered**: (A) self-operated ClamAV scanner container pulling identifier-only jobs over an authenticated channel, WASM image renditions in Workers, 50 MiB Phase 2 cap as a plan-limit profile; (B) Supabase Pro plus a paid scanning API; (C) quarantine-only hosted pipeline.
- **Decision**: A, chosen by the owner 2026-10-02. Uploads above 50 MiB refuse with a typed error under a recorded plan-limit profile; the 5 GiB rule remains the contract ceiling for a later plan upgrade. Local tests use a scanner sandbox with the same contract.
- **Downstream**: architecture provider table, BE04b/FE04 limits and scanner contract, Slice 14 criteria, operations runbook for the scanner host.
- **Reversibility**: High (provider seam).

### DEC-117: Slice 13 AC171 screen-reader smoke is automated, and AC266 real-device scope extends to S13 delivery surfaces (2026-10-02)

- **Timestamp**: 2026-10-02T04:03:34.994Z
- **Agent**: claude
- **Source**: implement-slice (Phase 2 decision queue)
- **Tags**: decision, accessibility, slice-13

- **Problem**: P2-S13-AC-171 requires a VoiceOver/NVDA smoke; Slices 03/05/07 closed identical wording with automated Chrome accessibility-tree smoke, while DEC-101 keeps real VoiceOver/Safari and NVDA/Firefox as the mandatory pre-release AC266 gate outside the Phase 2 denominator.
- **Options considered**: (A) automated smoke plus extending AC266 real-device scope to S13 public delivery surfaces; (B) automated only; (C) split the clause into a deferred real-device gate.
- **Decision**: A, chosen by the owner 2026-10-02. AC171 closes on automated Chrome accessibility-tree screen-reader smoke (roles, names, landmarks, focus order) with evidence stated as automated; AC266 stays authored, unchecked and outside the denominator, and its pre-release real-device scope and runbook now include S13 public delivery surfaces. Never represent automated smoke as real-device evidence.
- **Downstream**: S13 AC171 evidence wording, AC266 plan/tracker/runbook scope.
- **Reversibility**: High.

### DEC-118: Slice 17 observability and backup gates use the scoped staging/configuration reading (2026-10-02)

- **Timestamp**: 2026-10-02T04:04:03.280Z
- **Agent**: claude
- **Source**: implement-slice (Phase 2 decision queue)
- **Tags**: decision, phase-close, slice-17

- **Problem**: P2-S17-AC-008/009 require verify-infrastructure across observability/backup/rollback and recovery runbooks, an earlier verify-infrastructure run marked logging/alerting BLOCKED for lack of AC209/AC211 evidence, those criteria are outside the Phase 2 denominator, and ENGINEERING-STANDARDS says Supabase Free has no PITR and local restore drills are diagnostic only.
- **Options considered**: (A) scoped reading on staging + configuration + diagnostic local restore drill; (B) wait for AC209 production alerting evidence; (C) buy Supabase Pro PITR first.
- **Decision**: A, chosen by the owner 2026-10-02. Slice 17 passes on staging and configuration evidence (structured logs, alert rules configured and test-fired in staging, rollback exercised) plus a local restore drill recorded as diagnostic with no RPO/RTO claim. AC209/AC211 stay on their own timelines; protected production writes stay disabled per ENGINEERING-STANDARDS Availability and Recovery.
- **Downstream**: Slice 17 verify-infrastructure scope, runbook evidence wording.
- **Reversibility**: High.

### DEC-119: A protected owner CMS grant operation grants, renews and revokes bounded CMS capabilities (2026-10-02)

- **Timestamp**: 2026-10-02T04:05:36.213Z
- **Agent**: claude
- **Source**: implement-slice (Phase 2 decision queue)
- **Tags**: decision, cms, authority, slice-09

- **Problem**: the one-shot owner bootstrap (20260910023405) grants only cms.schema_registry.read and cms.schema_designer (plus two admin reads), each expiring within seven days with no renewal, and no command grants cms.author, cms.editor, cms.template_designer, publisher or the DEC-110 specialist reviewer capabilities; CMS checks organization_actor_grant and never consults Slice 08 admin_capability_grants. Hosted CMS would stop working a week after bootstrap.
- **Options considered**: (A) protected owner CMS grant operation plus console form; (B) route CMS authority through Slice 08 admin grants; (C) operator SQL runbook.
- **Decision**: A, chosen by the owner 2026-10-02. The receipt-derived owner, with DEC-111 step-up MFA, grants, renews and revokes bounded-duration CMS capabilities on organization_actor_grant to existing humans in the organization, including renewing their own designer/assign authority; fully audited with idempotency, CAS and outbox; confers no admin or delegation authority; creates no identity. The owner remains sole admin.
- **Downstream**: IA03/BE03a (or owning CMS shard)/FE03 cascade, capability registry, Slice 09/10 prerequisite scope, hosted CMS operation.
- **Reversibility**: Medium.

### DEC-120: Standing CMS capability grants last up to 90 days; schema-review assignments stay at most 7 days (2026-10-02)

- **Timestamp**: 2026-10-02T13:01:11.147Z
- **Agent**: claude
- **Source**: implement-slice (Phase 2 decision queue)
- **Tags**: decision, cms, authority, slice-09

- **Problem**: the DEC-119 owner grant operation was specified with a 7 UTC day maximum borrowed from the DEC-108 assignment bound; no source sets a standing-role limit, so every author/editor/reviewer/designer grant would need weekly renewal and schedules beyond a grant end would fail closed.
- **Options considered**: 90 days; keep 7 days; 365 days; per-capability terms.
- **Decision**: 90 days, chosen by the owner 2026-10-02. Standing CMS grants (author, editor, reviewer and specialists, designer, publisher, curators, navigation/media) may run up to 90 UTC days and are renewable with step-up; revocation stays immediate. DEC-108 schema-review assignments remain at most 7 days.
- **Downstream**: BE03a CMS-03A-15/16 validThrough bound, grant contracts and DB CHECK, FE03 grant console validation, S11 schedule authority recheck.
- **Reversibility**: High.

### DEC-121: Stale fallback-permitted locale fields keep serving the last approved translation (2026-10-02)

- **Timestamp**: 2026-10-02T14:05:32.572Z
- **Agent**: claude
- **Source**: implement-slice (Phase 2 decision queue)
- **Tags**: decision, cms, localization, slice-12

- **Problem**: CMS-15 localization (DEC-114) marks fallback-permitted translated fields stale when the source changes; IA03 only blocks no_fallback fields and says unchanged fields keep approval, but never says what public readers see for a stale field.
- **Options considered**: (A) block the locale until every stale field is revalidated; (B) keep serving the last approved translation, marked stale for editors; (C) resolve stale fields through the fallback chain to the default locale.
- **Decision**: B, chosen by the owner 2026-10-02. Public delivery keeps the last approved translation; editorial reads and the cms_locale_stale_total metric expose stale state until revalidation; no_fallback fields still block publication when missing.
- **Downstream**: BE03c/FE03/IA03 localization contract, Slice 12 AC033-035, Slice 15 delivery resolution.
- **Reversibility**: High.

### DEC-122: Orchestrator criterion rulings for Slice 09 evidence gaps (AC300, AC678, AC774, AC1031, AC1166) (2026-10-02)

- **Timestamp**: 2026-10-02T22:05:55.966Z
- **Agent**: claude
- **Source**: implement-slice (Slice 09 evidence)
- **Tags**: decision, slice-09, evidence

- **Problem**: evidence lanes found five Slice 09 criteria whose text disagreed with locked infrastructure or slice ownership.
- **Options considered**: implement the literal text; reword to the locked source; move scope to the owning slice.
- **Decision** (orchestrator, owner may override): AC300 follows BE00 actor-scoped idempotency bindings (changed actor is a distinct binding; changed path with the same key is 409); AC678 records the provisional fingerprint object in cms_schema_migration_plans.dry_run_report with the sealed report as authority; AC774 refusals roll back and auth_mfa_registry_sweep persists expiry; AC1031 Slice 09 covers only its own step-up routes and the CMS-03B-06/07/09 step-up recovery is carried by Slice 11 criteria; AC1166 Slice 09 covers no_fallback declaration/storage and resolution semantics are Slice 12/15 delivery scope. Moved scope must appear in the receiving tracker.
- **Downstream**: Slice 09/11/12 trackers and plan rows, evidence index.
- **Reversibility**: High.

### DEC-122 (ratified): Owner ratifies nine Slice 09 criterion rewordings (2026-10-02)

- **Timestamp**: 2026-10-03T03:11:22.121Z
- **Agent**: claude
- **Source**: implement-slice (Slice 09 evidence)
- **Tags**: decision, slice-09, ratified

- **Problem**: nine Slice 09 criteria contradicted locked BE00/BE03a/BE05b sections or slice ownership; they had been reworded as orchestrator rulings and an independent audit noted they needed owner ratification.
- **Options considered**: ratify all; review each individually; implement the literal original text with spec amendments.
- **Decision**: ratified by the owner 2026-10-02: AC300 (idempotency actor-scoped per BE00), AC678 (plan provisional dry-run fingerprint; sealed report authority), AC774 (expired-enrollment refusal rolls back; sweep persists expiry), AC1031 (Slice 09 covers its own step-up routes; CMS-03B-06/07/09 step-up recovery moves to Slice 11), AC1166 (no_fallback resolution moves to Slice 12/15), AC285 (successor request includes the OD-4 locale pair), AC431 (403 when readable, 404 when concealed), AC942 (schema violations 400 per BE05b, self-target 422), AC1049 (revoke sends the review expectedVersion). Moved scope (AC1031, AC1166) must appear as explicit receiving criteria in the Slice 11/12 plans.
- **Downstream**: Slice 09/11/12 plan and tracker rows, ledger rewording table.
- **Reversibility**: High.

### DEC-123: New content types bind a default template through their first successor, not at creation (2026-10-03)

- **Timestamp**: 2026-10-03T06:14:38.884Z
- **Agent**: claude
- **Source**: implement-slice (Slice 09 evidence)
- **Tags**: decision, cms, slice-09, slice-12

- **Problem**: Slice 09 AC003/045/049 required CMS-03A-01 to atomically bind a default template at type creation, but the template-compatibility guard and the BE03c exact contentTypeId resolver require the template to list the type id, which is generated inside the create call.
- **Options considered**: (A) bind on the first successor version; (B) compatibility by content-type key; (C) a type-id reservation operation.
- **Decision**: A, chosen by the owner 2026-10-03. A new type initial version is created without a template binding; once the type exists, a template declares compatibility with its id and the binding is added through a successor version reviewed and activated as usual. AC003/045/049 positive clauses are reworded accordingly; the exact-id compatibility model and resolver stay unchanged.
- **Downstream**: BE03a CMS-03A-01 template-binding text, FE03 create form, Slice 09 AC003/045/049, Slice 12 template binding flows.
- **Reversibility**: High.

### DEC-124: Owner ratifies 16 Slice 09 criterion rewordings (2026-10-03)

- **Timestamp**: 2026-10-03T17:11:54.903Z
- **Agent**: claude
- **Source**: implement-slice phase-2 slice-09 R14 owner ratification
- **Tags**: decision, owner

- **Problem**: Audit #3 found 16 Slice 09 criteria checked on orchestrator rewordings never ratified by the owner, some with defects (AC658 contradicted its own test, AC025 contradicted BE00, AC685 said "exactly eighteen" while 51 RPCs are executable, AC181 said "immutable" while the helper is STABLE).
- **Options considered**: ratify all proposed corrected texts; review each individually; reject and keep originals (several false against the amended scope).
- **Decision**: Owner ratified the proposed texts verbatim for AC005, AC007, AC025, AC034, AC037, AC180, AC181, AC233, AC246, AC282, AC356, AC431 (refinement), AC658, AC685, AC708, AC1147. Each proposed text claims only what code and tests prove. Criteria re-check only on evidence.
- **Downstream**: Slice 09 plan and tracker criterion text; verification ledger rewording rows; S09 closure.
- **Reversibility**: High
- **Source**: scratchpad/decisions/r14-ratification-bundle.md (copied to the verification ledger)

### DEC-125: AC185 legal-hold and incident-fence enforcement over CMS records belongs to Slice 16 (2026-10-03)

- **Timestamp**: 2026-10-03T17:11:54.903Z
- **Agent**: claude
- **Source**: implement-slice phase-2 slice-09 R14 owner ratification
- **Tags**: decision, owner

- **Problem**: AC185 said legal hold and incident fencing block purge of CMS definitions, plans and reports, but no CMS purge path exists.
- **Options considered**: Slice 16 lifecycle foundation (receiving S16-AC029); build hold checks in Slice 09 over a nonexistent purge path; add a CMS purge path now.
- **Decision**: Slice 16 lifecycle foundation owns the enforcement (S16-AC029); Slice 09 states no purge path exists for CMS definitions, plans or reports.
- **Downstream**: AC185 text; Slice 16 AC029; P-04 author-where-owned.
- **Reversibility**: High
- **Source**: scratchpad/decisions/r14-ratification-bundle.md (copied to the verification ledger)

### DEC-126: CMS-03A-09 keeps the optional workflowKey/workflowVersion pair (2026-10-03)

- **Timestamp**: 2026-10-03T17:11:54.904Z
- **Agent**: claude
- **Source**: implement-slice phase-2 slice-09 R14 owner ratification
- **Tags**: decision, owner

- **Problem**: AC390's protected-to-ordinary successor case had no API producer; an optional pair was added to the CMS-03A-09 request contract without owner approval.
- **Options considered**: keep the optional pair; remove it (AC390 unprovable); a separate change-workflow-policy operation.
- **Decision**: Keep the pair: both absent or null keep the source member, both present replace it with a seeded registry member, anything else returns 422; review still uses the strictest-of policy.
- **Downstream**: BE03a CMS-03A-09 contract, OpenAPI, Worker, DB, AC390 text.
- **Reversibility**: Medium
- **Source**: scratchpad/decisions/r14-ratification-bundle.md (copied to the verification ledger)

### DEC-127: Rollback RPC may fail a dry_running schema migration plan (2026-10-03)

- **Timestamp**: 2026-10-03T17:11:54.904Z
- **Agent**: claude
- **Source**: implement-slice phase-2 slice-09 R14 owner ratification
- **Tags**: decision, owner

- **Problem**: No dry-run could end failed, so activationPreparation dryRunRef.failureCode (AC641) could never be produced from a real attempt.
- **Options considered**: cms_rollback_schema_migration fails a dry_running plan; a separate fail-dry-run RPC; no failed dry-runs.
- **Decision**: Keep the rollback RPC behaviour: on a dry_running plan it marks the latest attempt failed with the code and blocks the plan; recovery is a new CMS-03A-10 dry-run.
- **Downstream**: BE03a migration worker protocol, AC641 text, operator runbooks.
- **Reversibility**: Medium
- **Source**: scratchpad/decisions/r14-ratification-bundle.md (copied to the verification ledger)

### DEC-128: AC906 projections refetch AUTH-API-16 under the pull model (2026-10-03)

- **Timestamp**: 2026-10-03T17:11:54.904Z
- **Agent**: claude
- **Source**: implement-slice phase-2 slice-09 R14 owner ratification
- **Tags**: decision, owner

- **Problem**: AC906's "projections refetch AUTH-API-16" assumed an event consumer, but no MFA factor projection cache exists in Phase 2.
- **Options considered**: pull model, proven by a no-cache guard and a real multi-tab refetch test; build an event consumer with nothing to invalidate; defer.
- **Decision**: Pull model: AUTH-API-16 returns canonical state and a new ETag on every read; a guard proves no MFA projection cache exists; the multi-tab refetch is tested without a stubbed BroadcastChannel. A future cache owner must add an event consumer.
- **Downstream**: AC906 text; web MFA tests; any future projection cache.
- **Reversibility**: High
- **Source**: scratchpad/decisions/r14-ratification-bundle.md (copied to the verification ledger)

### DEC-129: Delete the CMS-03A-05 'unknown release target is 404' clause (2026-10-03)

- **Timestamp**: 2026-10-03T21:45:03.750Z
- **Agent**: claude
- **Source**: implement-slice phase-2 slice-09 R14b DB3 ruling
- **Tags**: decision, owner

- **Problem**: BE03a rows for CMS-03A-05 (block release registration) required 404 for an unknown release target, but no target is defined: references are 422 per the field matrix, an unregistered release key is 401 WEBHOOK_REJECTED, and the block key/version is created by the command.
- **Options considered**: delete the clause; define a release-channel registry to give it meaning; keep it open.
- **Decision**: Owner chose deletion. BE03a drops the A05 unknown-target 404 (changelog row); CMS-03A-08 keeps its 404 for unknown block versions.
- **Downstream**: BE03a rows ~164/1825/2219, Worker A05 refusal rows, AC034-adjacent evidence.
- **Reversibility**: High

### DEC-130: AC1122 admin MFA reset errors are proven per branch (2026-10-03)

- **Timestamp**: 2026-10-03T21:56:49.084Z
- **Agent**: claude
- **Source**: implement-slice phase-2 slice-09 R14b web ruling
- **Tags**: decision, owner

- **Problem**: AC1122 required the self-target copy plus schema field errors for one 422 MFA_RESET_INVALID response; production sends MFA_RESET_INVALID only for self-targeting and VALIDATION_FAILED for schema-invalid input, so no response carries both.
- **Options considered**: reword to each branch; make the API send both (new envelope variant outside BE00); leave open.
- **Decision**: Owner chose rewording: self-target gives 422 MFA_RESET_INVALID shown with the self-target copy; schema-invalid input gives VALIDATION_FAILED shown as field errors from the schema.
- **Downstream**: AC1122 text; admin MFA reset form tests.
- **Reversibility**: High
