# S11 E7 writer observer privilege repair and healthy duplicate control

Status: next narrow QA amendment, author UNRUN until current producer first full
gate, canonical receipt and clean pushed checkpoint. Producer212 frozen.
Root owns all commands/tests/DB/format/Git/canonical memory. Native author
apply_patch only; source reads allowed, no execution/network/DB.

Only claims: supabase/tests/phase_02_slice_11_e7_settings_writer_tail.sql (plan),
supabase/tests/phase_02_slice_11_e7_settings/002-review-atomicity.sqlinc.
Hard400/target350 each. Other two includes, lookup54, all old QA and production
frozen. Keep original70 assertions/titles; no skips/only/guard or authority changes.

## Actual observer defect

Producer migration applied0/lint0; fresh catalog7 metadata identical, generic
cms_complete body/definition unchanged, six intended definitions changed.
Lookup54 PASS. Writer70 68PASS/2FAIL at66-67:
actual 42501:permission denied for function cms_key_hash, rather than test fault.
Rollback assertions pass for that observer failure; this is NOT intended P7E01
causal fault proof. No production EXECUTE grant is authorized.
cms_key_hash returns bytea SHA256 (20260902080000 authority219-226), legitimately
called by postgres-owned cms_reserve at2351 inside its SECDEF authority.

Compute the known test key hash outside the CMS invoker trigger under the existing
root/test setup, using existing cms_key_hash; encode as hex into app.e7_key_hash.
Trigger decodes this exact test-target locator through pg_catalog.decode/current_setting
and compares idempotency.key_hash directly. GUC is only row locator, not authority,
fake response or predicate bypass. No new observer/helper/grant/owner/function
permission. Retain full independent exact completed201 response_ref, all seven
checkpoint facts and exact P7E01 identity/whole-row rollback.

## Missing healthy existing-hash control

Current70 duplicate fault happens BEFORE INSERT, and exact replay returns before
the tail. Add a genuine second ordinary authorized B01 using a NEW key, AFTER the
first healthy B01 initializes one snapshot and BEFORE manifest/B05. Use actual
current entry/baseRevision operands from existing e7_request; never hardcode CAS
or pre-reserve completion. Capture actual second return/new resource/CAS and exact
complete snapshot row images before/after this healthy existing-hash write.
Add two explicit assertions: actual successful fresh-key successor/CAS, and all
snapshot images including IDs/timestamps/versions/ordinals/values/hash unchanged.
Require one actual existing row (initial immediate-B01 oracle remains).
Then continue real manifest/preflight17/B05/current open review and fault, using
actual current canonical rows. Existing pre/post-first-B01 and post-B05 images
must still match. Increase plan by exact added2 =>72; retain all70 originals.
All assertions outside rolled-back savepoint; captured actual facts pre-rollback.

This proves healthy conflict reuse/readback path executes successfully and gains
no durable row/ordinal, not canonical-owner-field mutation sensitivity or checker
E2E/schema activation/global lock proof. Metadata/grant boundaries unchanged.
Return FROZEN/UNRUN/release2 claims, plan/title/cap/source mapping; root executes.
