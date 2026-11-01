# Approved diagnostic audit: fixed command selection

2026-10-22 UTC. Main gpt-6.1-sol/ultra; native execution subagents inherit
gpt-6.1-sol/high. The one human grant and its proposal are recorded in
.memory/pipeline/progress/verification/2026-10-22-native-finality-capability-audit-approval.md.
No live window has started. This is not a backend-handle producer, authority
issuer, production adapter or native-finality TEST. All full-factory gates stay held.

## Shape and sequence

Use a pinned fixed command sequence, not a general inspector. Root alone runs it.
No Docker/SQL call occurs during source preparation or unit tests. Preserve all
existing source, recovery receipts and native v3 pins. No public contracts change.

1. Pin /usr/bin/docker and the selected Node22 binary by canonical regular-file
   identity and SHA-256. Docker currently SHA dea20a67e395f7bf1447601c3c9d4736a503a69252d07a3ec989e55f9b477e40;
   Node22 SHA 93956de2e59480474a7b46571da1651180b1a050cdf32641ebec4ce6e478e068.
2. Use env-i with only PATH=/usr/bin:/bin, LANG=C, LC_ALL=C, TZ=UTC.
   Docker always has --host unix:///run/docker.sock and --config pointing to the
   fixed absent path verification/2026-10-22-native-finality-capability-audit-no-config
   under .memory/pipeline/progress. It must remain absent; do not create it.
   Do not load the user's Docker credential/context config or dump full inspect.
3. First inspect ONLY supabase_db_wejammin_ev. Format exact selected JSON keys:
   id, name, imageId, running, initPid, supabaseProject, composeProject.
   Values come from .Id/.Name/.Image/.State.Running/.State.Pid and only labels
   com.supabase.cli.project/com.docker.compose.project. Require exact container
   name, running=true, id=64 lowercase hex, imageId=sha256:<64 lowercase hex>,
   positive safe PID and project binding
   wejammin_ev. A contradictory present project label refuses; no substitutions.
4. One docker exec psql metadata session at most, only that fixed container/db
   postgres. Use -X -w, ON_ERROR_STOP=1, quiet/unaligned/tuples-only output.
   Pin a UNIX-only local socket /var/run/postgresql and port5432; no network,
   service-file/password-file fallback or password prompt. Override PGPASSFILE
   and PGSERVICEFILE to /dev/null, clear PGSERVICE/PGPASSWORD/PGOPTIONS, and set
   PGAPPNAME=wejammin-finality-feasibility-20261022. Clear PGHOSTADDR so an inherited
   numeric address cannot override the UNIX-only host. Do not read any secret.
   Literal SQL is BEGIN READ ONLY; SELECT a single JSON document; ROLLBACK.
   Document has witness DEC203_FINALITY_CAPABILITY_AUDIT_V1, database,
   databaseOid, observerPid, and backends array. Complete pg_catalog.pg_stat_activity
   census, not a filtered appname/database/070 list: each row only pid,
   databaseOid, databaseName, backendStart, backendType. No query text or user data.
   Maximum64KiB document and256 backend rows. A failed local socket is a refusal,
   not proof that this host or an alternative route is unsupported.
5. Root records the validated inspect document as the fixed target JSON for the
   metadata step. Only then run the reviewed zero-argument metadata helper below.
6. After a successful metadata step, repeat the SAME selected Docker inspect once
   and require identical target fields. Stop the window at the first failure;
   do not run later steps after EACCES/conflict/unsupported mapping. No retry.

## Zero-argument bounded metadata helper

New helper under .memory/pipeline/progress/verification/:
2026-10-22-native-finality-metadata.cjs (<=300 natural lines).
It exports only runMetadataAudit(), zero arguments, no import-time observation.
Actual entry calls that same function. The fixed target file is
2026-10-22-native-finality-audit-target.json in that directory. It contains exact
container/daemon/project and validated id/imageId/initPid; no caller PID/path/FD.
No spawn, Docker, SQL, network, environment, executable/cwd, task-fd or global
/proc read occurs in this helper. Only node:fs/path/assert built-ins as needed.

Read only init and then members of its validated container cgroup. Per task,
read bounded stat/status/cgroup plus ns/pid link. Each frame brackets stat identity
before/after; include only PID/PPID/start-time/group/session, UID tuple, NSpid,
namespace and cgroup. Match PID/PPID across stat/status; canonical positive PIDs,
lossless decimal start time, exact required unique status fields, no Z/X task.
Namespace must be literal pid:[decimal]. Read file bytes with hard limits, reject
truncation and close every original read handle even on failure; never use an
unbounded readFile as a bounded-read claim. Preserve first error and close errors.

Require one canonical cgroup-v2 0::/absolute/path record, no dot/traversal/empty
segments. Its leaf must be the exact Docker ID or docker-<ID>.scope. Reject root
or foreign/ambiguous cgroup. Resolve only the derived path beneath /sys/fs/cgroup,
require canonical no-escape identity, then read its cgroup.procs (<=256 distinct
positive safe PIDs; init included). No global process enumeration or fallback.
Every member must match the init namespace and exact cgroup. Two metadata frames
per selected task maximum; no retries. Initial/final membership must match. Unknown
or changed identities, ENOENT, EACCES, unsupported v1/namespace, parser/close error,
overflow or cgroup escape aborts immediately with no further task reads.
The result is diagnostic frames only, never backend lifetime/finality proof.

## Contract-first source execution and review

Before helper implementation, source-only tests may be authored in exactly:
tests/contracts/phase-02-slice-12-native-finality-metadata.test.ts (<=400 lines)
and its optional focused helper tests/contracts/helpers/dec203-finality-metadata-fixture.ts
(<=300 lines). VM/mock only the external node:fs boundary, strict planned paths;
no actual proc/sysfs, native child, Docker or SQL. Require valid two-frame literal
control, exact path/byte/read/close audit, namespace/cgroup/identity/membership
drift refusals, EACCES immediate stop, caps and malformed input controls. Missing
module/API RED is only staging evidence, not a native functional refusal.
Root runs RED; only then releases the helper. Tests do not mint authority.
Root reviews, tests actual helper with mocked I/O, formats/lints/syntax-checks,
checks current v3 pins/progress, and freezes command/helper/artifact bytes before
consuming the one grant. Root retains every actual command handle through closure;
no timeout signal, restart, silent detach or cleanup. Add verification/README.md
only to document the evidence/helper extension pattern; don't alter old receipts.

## Exact metadata helper and fixture interface

The fixed target JSON has exactly seven keys: container, project, database, daemon,
id, imageId, initPid. The four literal values are supabase_db_wejammin_ev,
wejammin_ev, postgres, unix:///run/docker.sock respectively. id is64 lowercasehex;
imageId is sha256: followed by64 lowercasehex; initPid is a positive safe integer.
No .Name/.Running/labels are in this derived file; root validates them in inspect.

runMetadataAudit() is synchronous and returns exactly:
{kind:'diagnostic-only-native-finality-metadata',state:'complete'|'refused',
 target:null|validatedTarget,members:number[],frames:Frame[],failure:null|Failure}.
Frame exact keys: round (0 or1), pid, ppid, group, session (positive safe integers),
startTime (lossless canonical positive decimal string), uids (four nonnegative safe
integers), nspid (nonempty positive safe integer array, first===pid), namespace,
cgroup (the canonical absolute cgroup path, without 0:: or /sys/fs/cgroup).
Failure exact keys: code,stage,secondaryCodes (strings/string[] only).
Do not throw ordinary observation errors past this envelope. Keep partial validated
frames and members, and the first error code. Internal stage strings identify only
the fixed file/phase or selected numeric PID, never environment/raw error payloads.

Use these coded parser refusals: AUDIT_INVALID_TARGET, AUDIT_MALFORMED_STAT,
AUDIT_MALFORMED_STATUS, AUDIT_MALFORMED_NAMESPACE, AUDIT_UNSUPPORTED_CGROUP,
AUDIT_CGROUP_ESCAPE, AUDIT_IDENTITY_CHANGED, AUDIT_MEMBERSHIP_CHANGED, AUDIT_LIMIT.
Preserve native FS error codes such as EACCES/ENOENT; unknown/uncoded errors become
AUDIT_FAILED. If close alone fails preserve that code, if primary+close fail retain
primary plus close code in secondaryCodes. All refusals have state refused and
nonnull failure; complete has null failure. Neither is acceptance evidence.

External node:fs methods are only openSync(path,'r'),
readSync(fd,Buffer,offset,length,null), closeSync(fd), readlinkSync(path),
realpathSync(path). No readdir/lstat/stat/readFile, process, child-process or network
port. Bounds: target/stat/cgroup8192 bytes; status/cgroup.procs65536 bytes. Read at
most bound+1 then reject overflow, decode UTF-8 fatally, close the original handle
exactly once. No post-error filesystem call except closing an already-open handle.
No import-time calls, and invalid target causes no proc/sysfs call.

Order: init round0 (stat,status,cgroup,ns/pid,stat bracket), validate derived group
path, then realpathSync('/sys/fs/cgroup'), realpathSync(groupDir) and
realpathSync(groupDir+'/cgroup.procs') must each equal their canonical input.
Read initial membership once, sort numerically, require init present, unique and
1..256 entries. Read round0 for other members ascending, then round1 for all
members ascending. Require identical frame contents except round across each
original task and same init namespace/cgroup for every member. Read final
membership once, same sorted set. Membership change refuses without a third read.
For stat use the actual final ') ' delimiter and require canonical numeric required
fields; status requires unique Pid/PPid/Uid/NSpid with stat agreement. No Z/X task.
Group path is absolute, canonical segments, nonroot, leaf exactly id or docker-id.scope.

The unit fixture must implement that exact FS boundary and audit all calls/handles;
no alternate return envelopes, callback injection API or guessed field conventions.
Because the helper is CommonJS, load its actual bytes in a node:vm wrapper whose
require only returns the planned fs mock or real path/assert built-ins. Do not
rely on vi.mock intercepting CommonJS require. Provide no process, child-process,
network or other ambient observation capability to that VM. Reading the helper's
source with the real FS is allowed; no real proc/sysfs read is. Read offsets may
advance within the bounded Buffer; tests must assert byte/buffer bounds rather
than inventing an offset==0 requirement. A structurally valid different64-hex ID
cannot be called malformed before a proc comparison: root binds the target file
to the actual inspected ID separately. Test invalid ID syntax as an early shape
refusal; a coherent foreign cgroup/namespace remains its own refusal discriminator.
Root additionally releases one cohesive TEST-only VM loader at
tests/contracts/helpers/dec203-finality-metadata-vm.ts (<=300 lines), preserving
the exact fixed-source/require boundary, to keep formatted tests below400 lines.
Missing source must be reported by actual test calls, not twenty pending tests
from an aborting beforeAll. This remains missing-API staging, not functional RED.
The target-file overflow control must use8193 bytes (one above its actual8192 cap),
and an invalid-UTF8 control must exercise the actual fatal decoder via mocked bytes.
CLI/report persistence is not yet released; root captures the returned envelope
once into its approved diagnostic evidence path after source review and pinning.

Primary references: Docker CLI --config documentation and cli/config/config.go
Load behavior; PostgreSQL psql -X/-w documentation. Supabase direct PostgreSQL
diagnostics are permitted by the project data-access skill. No Supabase CLI,
cloud connector, schema change, provider setting or new dependency is selected.
