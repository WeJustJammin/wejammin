# S11 workflow frozen-candidate digest fixture correction

Status: selected source-backed sole QA amendment, author UNRUN until current gate,
canonical receipt and clean pushed checkpoint. Production remains frozen.

Root owns all execution/DB/format/Git/canonical memory. Native author uses
apply_patch only; source reads allowed, no commands/scripts/tests/network/DB.
Sole claim tests/postgrest/phase-02-slice-11-read-workflow-scopes.apispec.ts.
Hard400/target350. No other QA/production/migration edits or acceptance changes.

## Source and exact change

Old full-gate failure172 compared parsed.review.frozen.dependencyManifest with
preparation.dependencyManifest. Digest inequality gives no actual field identity.
Source proves frozen response member nonexistent: locked BE03b1317-1323,
FrozenCandidateSchema review-resources.ts27-33 and SQL17900:178-182 expose exactly
frozenHash/dependencyHash/versionSet; preparation workflow-read.ts87-96 exposes
manifest AND dependencyHash. No browser manifest extension is authorized.

Only the selected leaf at132:
[CMS-03B-15] assignee publisher and reviewer scopes read the same frozen candidate and submission moves the composite ETag
Replace its two dependencyManifest operands with dependencyHash, and replace
label 'frozen manifest equals served preparation' with exact digest-equality label.
Keep original title and all other statements byte/token exact after formatting.

submitForReview flow52-63 refetches actual preparation and echoes unchanged manifest;
B05 17640:199-203 compares rebuilt JCS hash, stores manifest253. No canonical
dependency rewrite is demonstrated; no source-backed producer repair selected.
Maintain all reader identities/scopes, preparation-null, submitted state, exact
review ID, version-set equality, composite ETag and whole14-effect no-effects.
Do not drop an assertion, use partial match, constant/recomputed fake digest,
add grants/accounts/observer or change helper/response schema.

Return FROZEN/UNRUN/released, exact three text changes and source mapping/caps.
Root actual focused regression verifies any later failure; no full-manifest
storage acceptance claim from browser digest equality alone.
