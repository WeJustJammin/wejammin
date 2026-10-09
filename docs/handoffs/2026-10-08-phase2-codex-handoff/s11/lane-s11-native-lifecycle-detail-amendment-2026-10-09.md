# Native fixture amendment — actual schema GET detail resource

Root only `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, native author
gpt-6-astra/high, parent/review6.1/ultra. Parent checkpoint/push before dispatch.
Actual parent lifecycle7-case RED includes two `Lifecycle resource lacks version`
errors at schema-lifecycle.ts193 after sealed ready. Source confirms fixture
reads full CMS03A07 detail as flat version resource. Actual exported
ContentSchemaRegistryDetailSchema is strict `{resourceKind,resource,...}`;
canonical version is `resource.version`. POST resources and review GET remain
flat and unchanged. This is fixture-contract correction, not production repair.

Edit ONLY `tests/postgrest/support/phase-02-slice-11-schema-lifecycle.ts`.
At all THREE schema-version GET consumers (before successor at158, after dry-run
at188, activation request at248), parse actual detail using exported real
ContentSchemaRegistryDetailSchema and consume its canonical `.resource`.
Use exact public returned version for expectedVersion and matching If-Match;
no fallback/invented/SQL-derived version, generic permissive envelope unwrap,
any/cast bypass, changed status expectations, removed original assertions or
disabled auth/approval/activation guards. Preserve generic read/post and review
GET shape, diagnostics, operands, literal seven cases and all immutable evidence.
Keep helper<=300 lines (currently287). No other file changes; ask exact extra
scope before touching more. Parent owns documentation and runtime validation.

Read actual resources-aggregates.ts/resources-core.ts/route contract and complete
existing helper before editing. PURE ctx JavaScript fs/path + native apply_patch
only. NO commands/exec/write_stdin/shell/child_process/scripts/tests/DB/network/
format/lint/TSC/git/packages/commits/nested agents. Source UNRUN; freeze sole file.
Parent reruns real lifecycle only after independent source review and required
producer repairs; genuine authority/stage completion remain unproven.
