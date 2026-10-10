# S11 preview verifier canonical person fixture correction

Status: source-reviewed selected next fixture-only design; author UNRUN until
current SQL QA wave freezes, gates/receipt and clean pushed checkpoint.

Sole file: tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts.
Native apply_patch only/purefsJS source inspection; no other edits/commands/
subprocess/tests/scripts/DB/network/Git/format/flush. Root validation.
QA hard400/target350.

BE04c04c-public-delivery-cache.md94 explicitly states actorPersonId AND returned
userId are canonical person id, NEVER Auth UUID. Effective private verifier
20261005017850_cms_verify_preview_token.sql114 returns person_id.
Thus first case exact expected userId at83 must change ONLY:
world.owner.authUserId → world.owner.personId.

Retain strict whole-result equality and complete bound envelope (valid:true,
entry/revision/versionSet/expiry/revoked), token HASH-only forwarded request,
exact wire-result preservation, actor binding/current context and zero-write
fingerprints. All other cases, titles, request/resource operands and assertions
must be byte-/token-exact. Do not change verifier production or use partial match.

Original affected title retained:
[CMS-03B-19] sends only the token hash and returns the complete bound resource without any writes.
Actual old log4669 proves full-result hash inequality only, not actual differing
field or valid:true. Independent source review warrants this one expected operand
correction; successful runtime repair/unwritten effects still require root proof.

Return FROZEN/UNRUN, sole claim released, exact one replacement/inversewholefile
preservation, source citations/cap. No acceptance or production delivery claim.
