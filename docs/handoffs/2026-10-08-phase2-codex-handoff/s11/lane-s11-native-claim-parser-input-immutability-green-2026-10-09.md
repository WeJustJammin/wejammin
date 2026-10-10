# Native private claim parser input immutability — narrow GREEN

Actual frozen schema QA418:84failed334passed. Request175:27failed148passed;
response243:57failed186passed. Rejections themselves occur, but invalid raw
objects/arrays are frozen and writable/configurable descriptors change (66
assertion failures), malformed null/undefined shapes throw in typed relations
(16 TypeErrors), and fractional/scientific event versions throw (2 SyntaxErrors).
All
tests/support remain frozen301/122/375/259 after parent formatting; no weaker
snapshot assertion or pre-freezing fixtures. No SQL/API/acceptance proof.

Root personally read installed Zod4.4.3 v4/core/schemas.js:2034–2054:
handleReadonlyResult unconditionally Object.freeze(payload.value), even when an
inner pipe aborted with issues and retained the original raw value. Its pipe
handlePipeResult skips downstream transforms when issues exist. Existing
MigrationPlanRecordSchema validates and allocates toMigrationPlanRecord output;
its parser/output/type and QueueEnvelopeSchema remain byte-frozen.
Non-aborting own-shape refinements leave raw malformed values available to later
typed refinements. Make own-shape rejection abort subsequent checks. Safely
validate raw aggregateVersion through existing CmsVersionSchema before delegating
to QueueEnvelopeSchema: platform-events.ts:20 currently BigInt-converts despite
regex failure. Preserve its domain/literals/range; do not edit shared events or
invent a new version primitive. A private invalid-version issue may use fixed
message/path; no raw value echo or blanket catch masking unrelated errors.

Checkpoint/push/exact-origin BEFORE nativegpt6astra/high author. ONLY root
`/home/rob/.codex/worktrees/phase2-slice11/WeJammin`. PURE ctx JavaScript fs/path
reads plus native apply_patch ONLY. NO commands/exec/shell/child_process/scripts/
runtime/tests/DB/network/format/lint/TSC/Git/packages/nestedagents. Sole source:

- apps/worker/src/content-schema-registry/schema-dry-run-claim-request.ts
- apps/worker/src/content-schema-registry/schema-dry-run-claim-response.ts
- apps/worker/src/content-schema-registry/schema-dry-run-claim-shape.ts

Read all three sources, actual four QA files, existing plan parser/output/type,
and the above installed Zod readonly/pipe implementation. Remove unconditional
readonly wrappers that can freeze original invalid input. Preserve inferred
readonly output and freezing of valid ALLOCATED parsed objects through a
success-only transform, e.g. `.transform((value) => Object.freeze(value))`.
No broad helper/rewrite, unsafe cast, validation bypass or dependency change.
Nested strict objects must also freeze only successful allocated output. The
plan success transform must retain actual existing validated output, not raw
input. Event parser remains reused, not replaced or policy-tightened.

All owncount/hasOwn predicates, 15 response relations, exact key sets, primitive
policies, null-source/completed/legacy-token compatibility, error paths/messages,
request event/aggregate narrowing stay unchanged. No time/lease/report completion
policy, contextual request binding, RPC/new SQL, factory/effect/receiving change.
Schema files <=150 formatted; helper <=300; no new files. All tests/support,
README/tracking/barrels/config/SQL outside these three files frozen.
Before this author wave, sole request UUID-v7 compatibility amendment must be
executed on unchanged production and checkpointed. All old418 assertions remain.

Freeze/report UNRUN exact diff/counts. Parent amended419 actual GREEN, related491,
format/ESLint/type/contracts/progress, independent6.1 production/oracle review,
then owncount/hasOwn/event/aggregate and each15 equality mutants independently;
exact source restoration and final GREEN before next checkpoint/author wave.
0/122/genuineAPI7RED/full/owner/external gates remain open.
