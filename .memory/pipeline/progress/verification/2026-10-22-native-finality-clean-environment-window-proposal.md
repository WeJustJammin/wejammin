# Fresh diagnostic window proposal: clean container-side environment

UNAPPROVED. The prior single window is consumed and closed; see
2026-10-22-native-finality-capability-audit-result.md. Nothing in this proposal
authorizes another Docker, SQL or task-metadata operation. No retry has run.

## Command defect and bounded correction

The prior census returned only `definition of service "" not found`.
The selected command incorrectly set PGSERVICE='' instead of removing it.
Current libpq source tests getenv("PGSERVICE") for null, not for an empty name.
No usable census or namespace/cgroup mapping was obtained. This says nothing
about whether this host supports the eventual native-finality contract.

For a fresh owner-approved window, select one Docker exec of this shape only:

    /usr/bin/docker --config <fixed-absent-config> --host unix:///run/docker.sock exec supabase_db_wejammin_ev /usr/bin/env -i PATH=/usr/bin:/bin LANG=C LC_ALL=C TZ=UTC PGAPPNAME=wejammin-finality-feasibility-cleanenv-20261022 PGPASSFILE=/dev/null psql -X -w -h /var/run/postgresql -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -q -A -t -c <same-literal-readonly-census-SQL>

No empty PGSERVICE, inherited PGHOSTADDR, password, service file or PGOPTIONS.
env always executes the literal psql command; it never prints environment data.
No alternate env/psql binary or connection route if this exact command fails.
The container-side binary versions have not been inspected or proved equivalent
to the primary references; failure remains a refusal, not a compatibility claim.

Primary libpq source also warns that /dev/null is not a regular password file.
The proposed capture admits only empty stderr or this exact single line, together
with exit0, signalnull and a complete schema-valid bounded census document:

    WARNING: password file "/dev/null" is not a plain file

That warning is recorded, not suppressed. Any different/additional stderr, missing
census, overflow, SQL/command error or unknown condition stops the window. This
is diagnostic-output classification only, never a native/phase acceptance gate.
No secret, fake password, authentication fallback or new identity is permitted.

## Requested one-window scope

Same fixed target supabase_db_wejammin_ev, project wejammin_ev, database postgres,
daemon unix:///run/docker.sock. Require initial selected identity to match the
prior immutable container ID and image ID in the terminal result. A different
container/image is a conflict; no substitution. Fresh initPID must be derived
only from that selected inspection, never reused from a historical snapshot.

Before any live use, root reviews and freezes exact new command/output paths,
executable/source identities and hashes; source/mock checks do not consume a
grant. Reserve a new consumption record before the first daemon/task read.

One initial selected Docker identity inspection; at most one clean-environment
readonly pg_stat_activity metadata census with BEGIN READ ONLY and ROLLBACK;
then the already reviewed bounded metadata helper for only that container's init
and validated cgroup task set, at most256 PIDs and two frames each. One identical
post-inspect only if every prior step completes. Stop at first EACCES, conflict,
unsupported mapping or other failure; no retry, fallback or replacement target.

Preserve all prior receipts and partial results. No global process enumeration,
cmdline/environment/secret reads, privilege, pidfd/ptrace, signals, task-FD reads,
locks, services, stacks, resets, migrations, DDL/DML, data writes or acceptance
credit. SQL diagnostic client creation is limited to that single readonly session.
Full-factory/RUN_ACK, backend lifetime/finality, native080, db:verify, validate and
Phase2 remain held and require their own actual evidence.

References:
https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/interfaces/libpq/fe-connect.c
https://www.gnu.org/software/coreutils/manual/html_node/env-invocation.html
https://www.postgresql.org/docs/current/libpq-connect.html
