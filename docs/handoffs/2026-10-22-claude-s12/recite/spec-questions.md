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

## Q6 AC-086 — "a preflight failure (422)" at CMS-03C-09 activation — OWNER (verify first)

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

## Q7 AC-105 — "a cycle, depth or node-count refusal inline with the node path" (FE03 885) — verify

- Lane b says the server names no node. But 422 refusals carry `violations[]` with a JSON pointer path; check whether the
  CMS-03C-12 depth/node-count 422 violations point at the offending node (`/blockTree/…`) and what 409 `pattern_cycle`
  carries. Separate implementation gaps found by lane b: `CmsPatternNestedPicker.tsx` is a disabled placeholder
  (AC-105 "nested pattern nodes from CmsPatternSelector"); `use-composition-insert.ts` `loadMore` has no 409 restart
  (AC-110). Spec exists for both → implement (boundary rule), not owner questions.

## Still to research

AC-086 "preflight failure" (422) at activation; AC-105 "node path" in a nested-pattern refusal; AC-207#1
`template_not_active` vs `WITHDRAWN`; AC-128#1–2 (test gap only: the Worker maps P0001 `NOT_FOUND`/`CONFLICT` through
`mapCmsEditorialRpcFailure`, but no CMS-03C-16 test feeds the real token form — PAT-031 class, add tests).
