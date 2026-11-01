# Review: claude_s12_template_digest (CMS-03C-01 `block_registry_digest_mismatch`, full stack)

Reviewer: independent adversarial reviewer (I did not author this work). Worktree HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`, 2026-10-15 ~13:20Z.
Target: `lane-template-digest-report.md` sha256 `6c79bf8d…cca4` (re-verified, 108 lines), brief `briefs/template-digest.md`, `lane-hardening-5-report.md:45-58`.

## Status
No blocker or major findings. Three minor findings (citation accuracy, a landing dependency, a designer branch no first-party UI can reach) and four info notes.
Every claim I was allowed to check holds.

## Claims re-verified
- All 20 file SHA-256s in the report's Files table match the files on disk.
- TAP hashes match: `082719-1202327` f9ad6e2f…, `083034-1221992` 9e6af347…, `083605-1252617` 3ebafc31…, `083742-1261791` 28cf1a14….
- The baseline and the final run fail the same tests. I read both TAPs. The final run (`083742`) and the promoted-only baseline (`083605`, `lane=none promoted=456 wip=0`)
  fail the same 12 tests with the same names and numbers: r8_api_surface 4, 13, 14; governed_activation 27, 47, 96, 97, 108, 112, 113, 117;
  governed_reads 18. After normalizing UUIDs, timestamps and hashes, every `ok`/`not ok`/`#` diagnostic line of those 3 files is identical (25/140/61 lines).
- The two manifests differ by exactly one line: `20261014180000_…sql` at hash `554e654c…`, the current WIP file. All test files were last modified before 08:37:42 local (the final run's start).
- Final counts: template_digest 33/33 and template_authority 70/70 (the extra TAP line is pg_prove's per-file status line). The RED run's #55 has
  `have: CONFLICT / want: block_registry_digest_mismatch`, so the corrected oracle failed for the right reason.
- I re-ran under the quiet lock with the pinned PATH:
  - focused Vitest: 16 files, 158/158 (both new test files, template-errors, template-routes, production-define, `components/cms-composition/`, the Web mutation error-relay and detail tests);
  - `tsc --noEmit -p apps/worker`: exit 0;
  - `astro check`: 0 errors, 0 warnings, 176 hints (the 3 errors from other lanes that the report noted are now gone).
- Not re-verified (not allowed): full Worker and Web Vitest, eslint/prettier, the Worker and Web RED counts.

## Spec conformance (BE03c 323-327, 373, 1273, 1323, 1642; DEC-186 item 2; `refusals.ts` CMS-03C-01 row)
| clause | implemented | tested |
|---|---|---|
| A well-formed differing digest writes nothing and gets the P0001 token | WIP migration, anchored patch at `20261013100200:138-141` | `010-refusals.sqlinc:48-63` (token, DETAIL, zero rows, reservation rolled back); authority `:426-427` |
| 409 `TEMPLATE_VERSION_CONFLICT` with `details` = `{reasonCode}` only ("no other member", 1323) | `cms-composition-production-template-errors.ts:41-47`; `template-respond.ts:68-71`; `conflict-details.ts` | `template-errors.test.ts` (5 rows, through real `compose()`); `template-digest-mismatch.test.ts:48-70,138-171` |
| Token only where the operation's contract row carries it | the list-driven `conflictReasonDetails` (Worker and Web) | Worker `:101-116`, Web `:103-112` (`cmsTemplateLatestRead` drops it) |
| Malformed digest is 422 at `/blockRegistryDigest` | contract layer (`template.ts:152` `CmsHashSchema`); SQL answers `VALIDATION_FAILED` | `template.test.ts:251`; SQL `010:77-81` checks the message only (I1) |
| Stale version, taken key and version ceiling keep `CONFLICT` | unchanged statements | `010:84-93`; ceiling by body identity (`020:10-16`, md5 `d08ff99c…`, which I recomputed and which matches) |
| Web relay and designer | `cms-composition-platform-mutation.ts` 409 branch; `cms-template-designer-submit.ts:111-114`; `CmsTemplateStatus.tsx:25-28` | `…-digest-mismatch.test.ts`, `cms-template-digest-conflict.test.tsx` |

## Answers to root's specific questions
- **Is `20261013100200` the latest definition?** Yes. Only `20260927200000`, `20261003120500` (owner only) and `20261013100200` name
  `platform_private.cms_define_template` among the promoted migrations. No WIP directory touches it, and no later prosrc-patching migration targets it.
- **Anchor:** I counted the anchor in the applied body myself: exactly 1. The body has 4 `CONFLICT` raises, and 3 remain after the patch.
- **`pg_proc` attributes and idempotency:** `to_jsonb(proc) - 'prosrc'` is compared before and after, covering oid, owner, ACL, config, volatility, cost and leakproof.
  A re-run takes the "already applied" return. An unanchored body raises 55000.
- **Replay copies:** the three `do $amend$` copies in `030-replay.sqlinc` are byte-identical to the migration's DO block (I checked by script).
- **DETAIL:** the patch uses `'["/blockRegistryDigest"]'`, the same as the pattern producers (`20261014020400:252`, `20261014110300:165`).
- **Oracle correction (`template_authority.sql:426-427`):** it cites the spec and is strictly stronger (a more specific token on the same request).
  The file's other hunks belong to the block-compat lane. The new suite is non-vacuous: it went RED on the unpatched body (#6, #7, #24) and asserts zero writes, reservation rollback and FORBIDDEN before the digest check.
- **Worker:** the mapping takes the exact `P0001` code plus the exact token with status < 500. 5xx responses, other SQLSTATEs, a structured `code`, upper-cased or padded tokens all fall through (tested).
  `template-respond.ts` relays the token only through the contract list.
  - The context read cannot produce the token: its adapter uses `mapCmsCompositionRpcFailure` (`cms-composition-production.ts:140`), not `mapTemplateRpcFailure`. The report's open item 2 holds.
- **Web:** `safeDetails` 409 matches the Worker. The pattern placement relay has its own `forwardedError` (`cms-composition-platform-pattern.ts:132`), so the CMS-03C-01 default does not govern CMS-03C-02.
- **Is reusing the pattern designer's copy acceptable?** Yes. FE03 contains no occurrence of the token anywhere, so reusing the existing fixed string is the option that invents the least. The string contains no pattern-specific wording, and the test pins it as equal. See m1 and m2 for the caveats.
- **Is "the designer never sends `blockRegistryDigest`" a spec gap?** No; the designer is correct as built.
  - `TemplateDesignerContext` (BE03c 194-200) carries no digest, and the FE03 CMS-11 row (`:1107`) lists no digest input. FE03 `:1790` marks the field optional, and the pattern designer sends none either.
  - Echoing the latest version's digest would raise a false mismatch on any successor that changes its slots. Computing the digest in the browser would duplicate server resolution, which BE03c 316-318 assigns to the server.
  - Consequence: the designer's copy branch is defensive and no first-party UI can reach it (m3). An optional FE03 one-liner ("designers send no digest expectation") would make this explicit.

## Findings
- `apps/web/src/components/cms-composition/CmsTemplateStatus.tsx:25-26`, `cms-template-digest-conflict.test.tsx:17`, report §Scope and §Spec citations — **minor (m1)**
  - Problem: they cite FE03:883 as naming the token on the pattern designer row. FE03:883 says only "the server digest … render inline", and FE03 has 0 occurrences of
    `block_registry_digest_mismatch`. The copy actually comes from code (`cms-pattern-designer/pattern-designer-reasons.ts:50-51`, web-patterns lane), not from the spec.
  - Why it matters: a wrong spec citation misleads later audits about where the copy is owned.
  - Fix direction: cite "FE03 names no copy; reuses `PATTERN_REFUSAL_COPY` (code-owned)".
- `CmsTemplateStatus.tsx:4` — **minor (m2)**
  - Problem: it imports `../cms-pattern-designer/pattern-designer-reasons`, which is untracked (`??`) and owned by another lane. The report's joint-landing note covers only SQL plus Worker/Web.
  - Why it matters: this lane cannot land, or even build, without the web-patterns lane's file. The import also adds a dependency in both directions between the two component directories (`use-pattern-designer.ts` already imports from `cms-composition/`).
    It is not a module cycle: `pattern-designer-reasons.ts` imports nothing.
  - Fix direction: root lands both lanes together, or moves the copy to a shared module.
- `cms-template-designer-submit.ts:111-114` and `CmsTemplateStatus.tsx:25-28` — **minor (m3)**
  - Problem: no first-party UI can reach this branch, because the designer's body never carries `blockRegistryDigest`.
    The copy also says "Reload…", while FE03:1107 asks the designer to "Retain unsent values", and the conflict state machine still offers the version-reconcile path.
  - Why it matters: today, nothing. Root should not count this as user-visible FE behavior.
  - Fix direction: leave as is. If a designer ever sends a digest, revisit the copy and the reconcile path at that point.

## Info (no action required of this lane)
- I1: the SQL malformed-digest branch (`20261013100200:115-118`) still has no DETAIL pointer, unlike `20261014020400:115`. The Worker contract rejects first, so the route never reaches it.
  No Worker route test asserts a 422 violation path of `/blockRegistryDigest`; only the contract test (`template.test.ts:251`) does. This is pre-existing and outside the brief.
- I2: the DEC-186 item 2 parenthetical ("the shipped CMS-03C-01 SQL already behaves so", `decisions.md:2677`) was false. It becomes true once this lands; root may want an erratum.
- I3: `020-identity.sqlinc:15` pins the md5 of the whole body. Any later amendment of the producer must update it. This is an intended tripwire.
- I4: no test composes the real adapter with the define route. The route test stubs the port with the token, and the mapping is tested separately through `compose()`. This matches the key_reserved precedent.
  The glue between them (status and `details`) is small; one composed test would close it.
- Precedence: when a request has both a mismatched digest and a stale version or a taken key, it now answers the token, because the digest check runs before the version lookups.
  Both answers are 409, and BE03c sets no precedence among 409 causes. There is no concealment change: the digest is computed from the caller's request and registry before any key lookup (E14 still holds).
- Security: SECURITY DEFINER with `search_path=''` is preserved. Owner `wejammin_cms_definer`; private EXECUTE is denied to public, anon, authenticated and service_role; the wrapper is service_role only (`020:17-34`).
  No PII, SQL prose or DETAIL is relayed. The digest refusal still comes after authorization (`010:96-101`).
- Conventions: every file is within limits (`mutation.ts` 298, `CmsTemplateStatus.tsx` 108). No `any`, TODO, skip or only. The `as unknown as …Dependencies` casts follow 5 sibling precedents. The READMEs are updated.

VERDICT: CLEAR
