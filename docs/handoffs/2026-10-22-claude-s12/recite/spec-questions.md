# Slice 12 spec-vs-code questions raised by the re-citation lanes (root research, 2026-10-24)

Each item: what the spec says (lines), what the code does, root's reading, recommendation. Items marked PROPAGATION are a
tracker or row that drifted from a newer BE03c rule — root fixes them mechanically. Items marked OWNER need a ruling.

## Q1 AC-026#3 — malformed body `revisionId`/`patternId` on CMS-03C-02: 400 or 422?

- Spec: BE03c field matrix row CMS-03C-02 `revisionId/patternId` → "400/404" (line 382); AC-026 copies "400/404".
- Convention elsewhere: CMS-03C-02 is `POST /api/v1/cms/compositions/pattern-instances` (line 163), so both ids are BODY
  fields. Every other body-field UUID in BE03c fails 422 (CMS-03C-01 `compatibleTypeIds`, CMS-03C-05 pins/exclusions,
  CMS-03C-12 `compatibleTypeIds`); BE03b CMS-03B-10 body UUIDs fail 422; 400 is kept for PATH ids (BE03b D-11) and
  transport (CMS-03C-07 "422 body, 400 transport"). The Worker's shared `decodeJson` answers every body schema failure 422.
- Root reading: the 400 in line 382 is an outlier from a path-id row template. Recommendation: amend line 382 to
  "422/404" and AC-026 "400/404" → "422/404" (no code change).

## Q2 AC-055#4 — unsupported `locale` on CMS-03C-04 POST: 404 or 422?

- Spec conflict inside BE03c: Route Registry line 165 "hidden entry/locale is 404" and AC-055 "a hidden or absent entry,
  locale or source revision is 404"; but the field matrix CMS-03C-04 row says `locale` must be a member of
  `supportedLocales` → 422, and the error matrix row CMS-03C-04 lists 404 = "hidden/absent entry/source" only and 422 =
  "BCP 47/field/fallback/no_fallback schema". The read route `cmsLocaleVariantRead` deliberately answers an unsupported
  locale with the policy-safe 404.
- Code: the authoring RPC answers 422 (`phase_02_slice_12_locale_config_enforcement.sql`).
- Options: (A) keep 422 for the write (the editor can already read the type's supportedLocales, so nothing is concealed)
  and amend line 165 + AC-055 to "hidden or absent entry or source revision is 404"; (B) make the write match the read
  (404) — code change in the authoring RPC + tests. Recommendation: A (two of three BE03c statements and the code agree).

## Q3 AC-062 — hidden TARGET on CMS-03C-05: 404 or uniform 422? — PROPAGATION

- BE03c (current, DEC-195/D11): Route Registry line 166, error matrix line 1404 and field matrix line 393 all say a
  hidden, absent or ineligible target is the uniform 422 `related_target_ineligible`; 404 is the source only. AC-036 and
  AC-060 agree. AC-062 still says "a hidden source or target (404 …)" — stale. Fix AC-062 text to match BE03c.

## Q4 AC-132#2 / AC-134 — CMS-03C-17 absent vocabulary: 404 or empty 200?

- Spec: BE03c lines 185, 1419, 1656 "a hidden or absent vocabulary is 404". Code: the selector takes no vocabulary id; an
  absent vocabulary/type/field yields an empty 200 page (`050-selector.sqlinc:74-76`); only a hidden owner is 404.
- Research: the request (field matrix line 414) is `typeKey/fieldKey/locale/cursor/limit` — it names NO vocabulary; the
  Route Registry (line 185) defines a scoped list of "the `active` vocabularies of that owner whose allowlist names the
  requested content type key and field key"; the authz matrix (1656) itself says 403 is "not applicable to a scoped list".
  So "hidden/absent vocabulary → 404" in 1419/1656 is a row-template carry-over with no request-level meaning.
- Recommendation (PROPAGATION-grade, root may decide, owner may override): amend 1419/1656 and AC-132#2/AC-134 to "a hidden
  owner scope is 404; no matching vocabulary is an empty page". No code change.

## Q5 AC-138/141 — CMS-03C-18 callers

- Spec: BE03c 187 — `cms_canonical_taxonomy_match` is consumed only by `cms_act_taxonomy_term` and the taxonomy-version
  activation preflight. Code: only `cms_term_overlap_check` (from `cms_act_taxonomy_term`) calls it; the activation
  preflight checks registry `provider_state` (`cms_governed_first_unbuilt_domain`) and never calls the matcher.
- Research: BE03c 1533 (DEC-135) — at taxonomy-version activation the only canonical check is that every declared domain
  has a registered provider (else 422 `canonical_source_unavailable`); term overlap matching runs only on `create`,
  `rename`, `alias`. The matcher would answer `source_unavailable` for an unbuilt domain, so calling it at activation is
  behaviourally identical to the registry `provider_state` read the code does.
- Recommendation (wording; root may decide): amend line 193 and AC-138/141 to "consumed only by `cms_act_taxonomy_term`
  (through `cms_term_overlap_check`); the activation preflight reads the domain registry's `provider_state`". No code
  change. A pgTAP caller inventory (pg_proc.prosrc) then proves the exclusive-caller clause.

## Q6 AC-086 — "a preflight failure (422)" at CMS-03C-09 activation — VERIFIED: spec cleanup, no code change

- Spec: step (4) rechecks subject hash, policy basis and every frozen dependency; a difference COMMITS the invalidation
  and answers 409 `dependency_changed`. Step (5) runs the kind preflight (template: compatibility resolver + block digest;
  pattern: nested pattern state + digest; taxonomy: provider per declared domain, else 422 `canonical_source_unavailable`).
  Error matrix 1410 lists "preflight failure" under 422. Code: step-5 differences fold into the step-4 invalidation (409).
- The behavioural difference: 422 leaves the approved review approved (fix and retry); the 409 path sends the subject
  back to `draft` and through review again.
- To verify before asking: does every input the step-5 template/pattern preflight reads appear in the frozen dependency
  set (`block`, `pattern`, `content_type`, `canonical_domain`)? If yes, a step-5 template/pattern failure is always a
  step-4 difference and the 422 is unreachable except `canonical_source_unavailable` → amend 1410/AC-086 (no code change).
  If no, the code is missing a 422 branch.
- Verified (root, 2026-10-24): `supabase/migrations/20261014070200_cms_governed_activation_core.sql:1-10,36-64` —
  `cms_governed_activation_verdict` checks, under the caller's locks, (taxonomy) every declared domain built → else
  `canonical_source_unavailable`; then `cms_governed_frozen_status` over subject hash, policy basis, dependency identities,
  block digest, nested pattern states and bound content types → else `dependency_changed`. Every input the step-5
  template/pattern preflight reads is in the frozen status, so a step-5 template/pattern failure IS a step-4 difference
  (invalidation, 409) exactly as step (4) prescribes; the matrix's separate 422 "preflight failure" is unreachable.
- Recommendation (root may decide, owner may override): amend BE03c 1410 and AC-086 — 422 lists the time/tzdb/horizon
  failures and `canonical_source_unavailable` only; add one sentence to step (5): "the template and pattern preflight inputs
  are part of the frozen status of step (4), so a difference there is the step (4) invalidation".

## Q7 AC-105 — "a cycle, depth or node-count refusal inline with the node path" (FE03 885) — VERIFIED: implementation gap

- Lane b says the server names no node. But 422 refusals carry `violations[]` with a JSON pointer path; check whether the
  CMS-03C-12 depth/node-count 422 violations point at the offending node (`/blockTree/…`) and what 409 `pattern_cycle`
  carries. Separate implementation gaps found by lane b: `CmsPatternNestedPicker.tsx` is a disabled placeholder
  (AC-105 "nested pattern nodes from CmsPatternSelector"); `use-composition-insert.ts` `loadMore` has no 409 restart
  (AC-110). Spec exists for both → implement (boundary rule), not owner questions.
- Verified (root): `20261014020400_cms_create_pattern_version.sql:211,217,230` raise `pattern_cycle`,
  `pattern_depth_exceeded` and `pattern_nodes_exceeded` with `detail = '["/blockTree"]'` (the tree root). BE03c 1525
  (DEC-210 block rules) puts that operation's refusals "at the offending node's pointer in the request `blockTree`,
  `/blockTree/{i}(/children/{j})*`, like the operation's other `blockTree` refusals", and FE03 885 renders them inline with
  the node path and links the error summary to the node. So the spec asks for node pointers; the code gives the root.
- Spec-silent detail root must write before implementing (root implementation decision): which node is "offending" —
  depth: the first request node (preorder) at level 9; node count: the request node whose expansion first takes the
  expanded total past 512 (a nested pattern node or a block node); cycle: the nested `pattern` node whose lineage closes
  the cycle. Then a SQL + Worker relay + designer change with tests.

## Q8 AC-274 — error statuses for the Worker deadline and unmapped proxy statuses (refute-d)

- Refute-d: AC-274's wording is false as written — the Worker's own deadline answers 504 (not 503) and the browser proxies
  collapse unmapped statuses to 502 (not 500).
- Research: BE03c 212 and 1709 — invalid provider response 502, unavailable/open circuit 503, deadline 504, all
  `DEPENDENCY_UNAVAILABLE`; BE03c 1452 — an unmapped status or foreign message is 500 `INTERNAL_ERROR`, which the Worker
  does (e.g. `taxonomy-definition-response.ts` "a 4xx that carries no product token is a provider fault" → 500). The
  browser proxies are FE-layer code outside AC-274's subject (the Slice 12 catalogs), so their 502 collapse is not
  evidence for or against it.
- Recommendation (PROPAGATION): amend AC-274 "a provider timeout or fault is 503" → "an invalid provider response is
  502, an unavailable provider 503 and a deadline 504 `DEPENDENCY_UNAVAILABLE`"; keep the 500 sentence; cite Worker tests
  only.

## Q9 AC-079 cl 3 — "review version unchanged on revoke" (refute-a)

- Refute-a: false for a revoke of a counted approval; the suite shows the review version advancing to 3 and the review
  invalidated.
- Research: CMS-03C-08 uses "the CMS-03B-18 grammar" (BE03c field matrix). BE03b line 1876 (DEC-161): create and revoke
  "leave the review state and `version` unchanged, except that a revoke of an assignment that authorized a counted
  approve decision on the `open` review invalidates the review `reviewer_authority_changed` in the same transaction". The
  code and `governed_assignment/040-bounds-revoke.sqlinc` follow DEC-161. BE03c line 222 ("assignment create and revoke do
  not advance it") and line 1718 ("assignment create/revoke never changes the review state") and AC-079 dropped the
  exception.
- Recommendation (PROPAGATION): add the DEC-161 exception to BE03c 222 and 1718 and to AC-079. No code change.

## Still to research

AC-086 "preflight failure" (422) at activation; AC-105 "node path" in a nested-pattern refusal; AC-207#1
`template_not_active` vs `WITHDRAWN`; AC-128#1–2 (test gap only: the Worker maps P0001 `NOT_FOUND`/`CONFLICT` through
`mapCmsEditorialRpcFailure`, but no CMS-03C-16 test feeds the real token form — PAT-031 class, add tests).
