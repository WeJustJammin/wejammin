# DEC-198 pending comparison — guarded GREEN source handoff

Native `gpt-6.1-sol` / `ultra`. Author execution UNRUN. Exactly two NEW paths:

- `supabase/migrations-wip/dec193/20261016042900_cms_revision_comparison_pending_dec198.sql`
- this report.

Root owns formatting, SQL parsing/staging/execution, complete TAP, catalog
readback and independent review. No author formatter, parser, tests, Worker/SQL
runtime, DB, process execution, network or Git. Existing419 and every test stay
frozen. No production API, helper, table, status enum, grant or public DTO added.

## Authority and observed RED supplied by root

Locked BE03c `03c-composition-taxonomy-localization.md:1487` says an unanswered
pending_diff instance renders its pinned version. BE03b
`03b-editorial-workflow-publication.md:1709` requires D5 block side hashes to
represent the recorded visible composition content; NULL-tree rows retain the
defined seven-field pinned image, nonnull trees use canonical detached content.
DEC-198 preserves newest pending rows on ordinary copy, but this amendment only
fixes the comparison reader; it does not implement or prove a copy producer.

Root reports corrected consumer924:810 PASS,114 FAIL, complete TAP/no abort.
CB-D5-P02 and pending-only CB-D5-Q05 are meaningful RED. Q's fresh guarded read
image has exactly one pending version1 row and no older active fallback. Its B
pin remains1 with pending target2; a separately placed active T is different.
The actual public history reader must report independent literal B/T hashes,
not an absent pending side or early target adoption. This is read-fixture proof,
not actual scan/carry production. Shared root log SHA-256:
`e3103d071e7aa00ec15a15ce87c3cd008e402312067b179782266b98cdbf4b6d`.
These are root receipts, not this author's execution or GREEN evidence.

## Narrow source amendment

Target is the installed `platform_private.cms_list_revisions(jsonb)` AFTER419.
429 replaces only the two exact `latest.state = 'active'` predicates with
`latest.state in ('active', 'pending_diff')`: first the 256-character block
pointer guard, then the block-side hash eligibility. Both existing newest-head
CTEs remain unchanged: distinct revision/path, version descending then ID.
Retired/superseded heads stay excluded; no historical active row is resurrected.
The full-tree/content-image helper and legacy NULL-tree hash bytes are untouched.
No auth, concealment, locale, field/relation, cursor/HMAC, bound or error branch
is copied or changed.

Fail-closed migration guards require the existing CMS-definer PL/pgSQL JSONB
function attributes, one419 marker, exactly two old predicate occurrences, no
new predicate, and exactly one canonical path/hash anchor each. Each anchor
pair must itself differ only by the predicate. The contextual replacement must
equal the global two-token replacement and invert to the full original source.
Only then is the live pg_get_functiondef amended, with one exact source match.
After CREATE OR REPLACE, OID, full pg_proc row except prosrc (including owner,
ACL/config/return/argument/security attributes), expected prosrc and comment
must match; any mismatch raises55000 inside the transaction. Timeouts match the
guard style of419/417. No grant or comment mutation is performed.

Static text readback found each old anchor once in419's checked-in replacement
block and no new anchor there. This is source evidence only, not an executed
pg_proc/catalog or migration claim. Root must stage429 after419 and verify
public pending comparisons, existing D5 cases, unchanged catalog properties,
complete consumer TAP and independent source review before accepting GREEN.
Manifest/render/checker, revision-aware digest/currentness, actual copy,
hosted transport and external acceptance remain separate gates.

## Freeze manifest

429:99 physical lines; SHA-256
`d4eab7c4adbf2c5a53f25c78b7d06418c7c91955537ab538ddc11d7f13b97dfd`.
Report self-hash supplied externally. No passing or release claim.
