# Single bounded audit: terminal refusal at census

2026-10-22 UTC. Human grant call_83b29a533835441fa07af2cd22f5d2e2 is consumed.
No retry, fallback, privilege, process inspection, lock or service change followed.
This diagnostic supplies no native-finality, database or Phase 2 acceptance.

## Reviewed preparation

Frozen plan: 2026-10-22-native-finality-audit-frozen-plan.json,
SHA-256 021667eb556a3c62855dc900e87094cc1a04032c4ab40ef4990a12263868c156.
Consumption reserved before first daemon read at approximately 03:39:02 UTC.
Source and executable pins matched; all sixteen native v3 pins unchanged.
The fixed Docker no-config path and all new result paths were absent beforehand.

Actual mocked helper controls initially failed 10/21 due to inconsistent parser
refusal envelopes. Corrected before the live audit. Final scoped session37753
CLOSED0: 610/610 pass, zero fail/pending; format/lint/syntax, supplementary strict
test typing, configured type-check and progress consistency passed. Supplementary
typing used Node25.9.5 declarations, not a Node22 compatibility proof.
Scoped receipt .lane-logs/s12-finality-metadata-scoped-green-20261022.json,
SHA-256 f99db2a06e8f408a577db0732d408879acccdb3fa01f091f78f0e9c2137e7c7f.
Helper: 300 formatted LF, SHA-256
ef654bab4fff8a2647dbf74b05d337f2f5bc2e6f1c19a755ba89966974dc4af6.

## Actual window

1. Selected inspect closed0, signalnull, stdout285 bytes, stderr0. Exact target
   name/running/project-label/schema validation passed. Container ID
   426291fe29f74115758b9ceeb4733b18a4e9d0e77b2991f91e1dc22847c1c78b,
   image sha256:28f0e16a019e648089fc1a6d333549a55548f6019c15ae4bd7cd58b989027518,
   initPID4316. Both selected project labels equal wejammin_ev.
2. The single fixed Docker exec census command closed2, signalnull, stdout0,
   stderr48 bytes: `psql: error: definition of service "" not found`.
   Capture wrapper closed1 because captureOk=false. No census document returned.
3. Stopped immediately. Derived target file was not created; metadata helper
   was not called; no task /proc/sysfs reads and no post-inspect took place.
   No command was left running or restarted. No signal was sent.

Receipts (under repository root):

- .lane-logs/s12-finality-audit-inspect-before-20261022.json,
  SHA-256 11c60966b4438efe9f6708501a18784e457b52660fc41fb0a32bd43682014c13.
- .lane-logs/s12-finality-audit-census-20261022.json,
  SHA-256 7830bf488ea79a62d0119de5c98836acbb43d5afbee6313d9b17607f0f01fd23.

## Diagnosis and next authority boundary

The selected command set PGSERVICE to an empty string instead of removing it.
Current primary libpq source treats a non-null getenv("PGSERVICE") result as a
service name even if empty. This explains the exact observed error; the installed
container libpq artifact/version was not inspected, so source-version equivalence
and server/backend activity are not asserted. This is not proof that the host
cannot support the required identity mapping. No usable backend census, mapping,
held backend handle, lifecycle history or finality evidence was obtained.

Any fresh window requires a new explicit human grant and reviewed/pinned commands.
A proposed correction is container-side /usr/bin/env -i with only a literal PATH,
locale/TZ, diagnostic PGAPPNAME and PGPASSFILE=/dev/null, then the same psql -X -w
fixed Unix socket/database/readonly SQL. Do not pass an empty PGSERVICE. This has
not run and is not approved by the consumed grant. No alternate auth, password,
new identity, different target or secret read is proposed.

Full factory/RUN_ACK, native080, db:verify and validate remain HELD. Phase2 stays
9/17; Slice12 stays0/296; canonical receipt absent. Existing work preserved.

Primary references: https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/interfaces/libpq/fe-connect.c
and https://www.gnu.org/software/coreutils/manual/html_node/env-invocation.html.
