# DEC-203 pinned CLI source inventory

Root public-source research, 2026-10-18T03:23Z. Not native execution evidence.
No Docker command, daemon request, provider activation, reset or package change
was performed to obtain these facts.

Official Supabase CLI tag `v2.116.0` resolves to commit
`997a1e69a4a83466964ed874d3a604c88a7b3866`, tree
`656e3836031e686f10cc6f6ca41e90724c8029d5`, in the GitHub commit response.
Public source hashes do not prove reproducibility of the installed binary.
Keep its existing independent executable identity and package checks.

## Exact fetched inputs

URLs below use the release tag; the commit above also identifies the source.
Each SHA256 covers the complete raw fetched bytes, not converted Markdown.

| Source | Bytes | SHA256 |
| --- | ---: | --- |
| [reset.layers.ts](https://raw.githubusercontent.com/supabase/cli/v2.116.0/apps/cli/src/legacy/commands/db/reset/reset.layers.ts) | 5372 | `1f706af2b690a05b393d0a2868aaa9599e23d5d7b99415290462da26db368937` |
| [legacy-container-cli.ts](https://raw.githubusercontent.com/supabase/cli/v2.116.0/apps/cli/src/legacy/shared/legacy-container-cli.ts) | 13634 | `75fec02290c3f332fd8c9a185e2ab8b4587dab60fc8f31dc6b07c45547ae7068` |
| [container-lifecycle.ts](https://raw.githubusercontent.com/supabase/cli/v2.116.0/apps/cli/src/legacy/shared/db-bootstrap/container-lifecycle.ts) | 38201 | `937dc01a0f4ee2a18bda08265d1cde0e474a9ad7e0e96591c9bbf9e23043cc6a` |
| [recreate-local-database.ts](https://raw.githubusercontent.com/supabase/cli/v2.116.0/apps/cli/src/legacy/shared/db-bootstrap/recreate-local-database.ts) | 25097 | `1220ff75f4f319ae6b7ec4dac7d50eb462985fed8ac12091b9eabc66ede8f755` |
| [legacy-docker-run.args.ts](https://raw.githubusercontent.com/supabase/cli/v2.116.0/apps/cli/src/legacy/shared/legacy-docker-run.args.ts) | 3344 | `97b78edf316c5aeef568a5072a2924c518d6228bfac3dd4c1ae667ca3d5f81a8` |

These are indexed under root context labels `DEC203 Supabase2116 exact ...`.
Other agent sessions must not assume their context indexes share these bytes.

## Verified source facts, not a complete operation policy

The actual `legacyCreateContainer` function body, container-lifecycle824–900,
sets project and workdir labels, provisions named volumes outside the Bitbucket
branch, applies the existing filter, and creates the container. It then copies
secret files, extracts pre-start archives, and only then starts the container.
The pre-start-archive error path attempts a forced container/volume removal.
The private producer must account for those branches; three invented reset
commands cannot replace their real history.

Secret files travel in an stdin tar archive. Never retain archive content,
container environment values or plaintext request bodies as tracing evidence.
Do not equate a filename or payload digest with authority or secret safety.

The create path removes container-facing Docker-client environment selectors
from its explicit environment. Its spawned Docker client otherwise extends
the parent environment, so the reviewed private child DOCKER_HOST must already
be correct. Keep immutable upstream and private ingress distinct.

The shared container CLI helper can attempt Podman after Docker failure.
That public fallback does not authorize an unattested executable or a second
daemon in this project. Native admission must refuse unregistered work.

## Still open

These five source files alone do not establish every transitive reset branch,
the installed Docker client's negotiated API version, exact wire paths/query
and body schemas, HTTP upgrade headers, or complete runtime operation history.
Public Docker Engine/API sources and actual bounded native evidence are still
required. No request-forwarding implementation is released by this inventory.

The proposed operation-policy 8MiB whole-stream cap is not selected: existing
migration bytes plus tar overhead can exceed a guessed bound. Derive limits
from the real workload or use bounded-memory opaque streaming with explicit
time/counter/terminal controls. Do not reject valid work using an invented
product limit, or log secret-bearing streams merely to discover their size.

## Transitive container environment source — root follow-up03:57Z

[postgres.service.ts](https://raw.githubusercontent.com/supabase/cli/v2.116.0/apps/cli/src/legacy/shared/db-bootstrap/postgres.service.ts),
28669bytes, SHA256
`554edbc3b60a9f3090a7bcc4ddcf9b9f8da4268fb71dc9b780f0bd240e54f2fb`.
The public `legacyBuildPostgresStartContainerSpec` function starts357;
its environment record starts366 and is returned389. Source key names373–376
include POSTGRES_PASSWORD, POSTGRES_HOST, JWT_SECRET and JWT_EXP. Root printed
only declaration/key identifiers, no values or local configuration/secrets.
This proves a blanket PGAPPNAME-only rule cannot cover container-create Env;
that restriction belongs to the separately approved exec invocation. Exact
create fields/values and opaque handling remain source-gated; the source is not
authority to retain, hash or disclose secret-bearing configuration.

## Reset database transport — root follow-up18:25Z

The same pinned `recreate-local-database.ts` source imports
`LegacyDbConnection` from `../legacy-db-connection.service.ts` at94. Its PG14
branch defines `connectAs` at449–453 using the supplied hostname and dbPort,
then connects as supabase_admin/template1 at458, supabase_admin/postgres at466,
and postgres/postgres at511. The replication-slot helper issues a session
query at282–283. These are source-level database-session calls, not evidence
that every reset backend is created through Docker API exec.

The default service implementation, PG15/current-default path, transitive
setup/migration callers and actual installed-binary behavior remain under
review. Until resolved, do not infer complete SQL/backend coverage from the
existing local wrapper's `docker exec … psql` transport. No live connection,
reset, daemon request, protocol payload or secret was obtained in this review.

## Default reset routes — independent inventory and root checks18:28Z

The independent source inventory resolves the default route, with root also
fetching the reset layer, active connection-layer export, setup connection,
`Pg.Pool` construction and internal-URL helper. These raw tag-source hashes are
additional immutable review inputs, not installed-binary or runtime receipts:

| Source under `apps/cli/src/legacy/` | SHA256 |
| --- | --- |
| [reset.handler.ts](https://raw.githubusercontent.com/supabase/cli/v2.116.0/apps/cli/src/legacy/commands/db/reset/reset.handler.ts) | `a207160252cf9792539109282ae6f16f766fa5e193d1176ee5733fdd5d799a96` |
| [reset-local-database.ts](https://raw.githubusercontent.com/supabase/cli/v2.116.0/apps/cli/src/legacy/shared/db-bootstrap/reset-local-database.ts) | `652098636f6e46e7033a703e7da6ade2e5a36db0604671f9eda3bcb070d727e6` |
| [legacy-hostname.ts](https://raw.githubusercontent.com/supabase/cli/v2.116.0/apps/cli/src/legacy/shared/legacy-hostname.ts) | `314be1a50a65670753e4c1ddb981965a0fa08ce8aa967d089c401a783803f047` |
| [db-setup.ts](https://raw.githubusercontent.com/supabase/cli/v2.116.0/apps/cli/src/legacy/shared/db-bootstrap/db-setup.ts) | `358a9219851cbef4b90264ae4d3cf8364eff3140731f8c923705d94183190831` |
| [internal-db-connection.ts](https://raw.githubusercontent.com/supabase/cli/v2.116.0/apps/cli/src/legacy/shared/db-bootstrap/internal-db-connection.ts) | `7bcfed3ad6b21a2ad8fc315b46dcdb0f8a92a903c430758026034d5c8d81551e` |
| [legacy-db-connection.layer.ts](https://raw.githubusercontent.com/supabase/cli/v2.116.0/apps/cli/src/legacy/shared/legacy-db-connection.layer.ts) | `a7c3cc66917468755bb49d1887834975140d7e40b4ee6a3101faf551b73c11bc` |
| [legacy-db-connection.service.ts](https://raw.githubusercontent.com/supabase/cli/v2.116.0/apps/cli/src/legacy/shared/legacy-db-connection.service.ts) | `de1c2a8764f7ee4ae36301d83d54d5cf37b6e73c86b8fb6ac857eff393b044d4` |
| [legacy-db-connection.sql-pg.layer.ts](https://raw.githubusercontent.com/supabase/cli/v2.116.0/apps/cli/src/legacy/shared/legacy-db-connection.sql-pg.layer.ts) | `90d2032c3c73849e9baf24a63dc9668d358e879b77209124ab8179a41e9f843c` |

`reset.layers.ts`81–105 composes the active database connection and Docker-run
layers. The active export is the SQL-PG implementation, not Docker exec.
`db-setup.ts`1325–1340 connects using the resolved hostname and published dbPort;
the SQL-PG implementation constructs `new Pg.Pool` at815–828. This is a direct
host-facing database client (ordinary local TCP; the driver separately supports
absolute Unix-socket hosts). Do not equate its lifetime with a traced psql exec.

PG15+ reset calls fresh setup after recreating the database container.
`db-setup.ts`631–703 describes/builds foreground one-shot service migration jobs
on the database Docker network. Their internal database host is supplied
at1467–1473; the internal URL helper78–79 targets that host on port5432. These
container jobs are additional causal backend sources, not the host-facing pool.
No secret-bearing URL, environment value or request body is retained here.

Finality must close both direct client and job producers as well as Docker exec
clients before the complete final census. Reviewed source does not yet prove
their actual ownership, complete wire history, terminal state or absence of
background work. Native producer/admission and finality evidence remain OPEN;
no network interception, configuration change or new service is selected here.

## Recurring healthcheck source — root follow-up18:45Z

The same pinned `postgres.service.ts` source configures a recurring healthcheck
at416–420: pg_isready with postgres, loopback and port5432; interval/timeout/retry
constants are supplied there. The shadow-container spec repeats it at541–545.
This is another candidate daemon-owned process/connection source, not an exec
invocation necessarily visible to the private Docker API listener. Actual backend
creation/lifetime and target relevance remain unproved. The finality producer must
account for it rather than assume that all work ends with the host CLI or migration
jobs. No healthcheck was run, disabled or reconfigured; no default-stack change or
mandatory PostgreSQL birth-tracing architecture is inferred from this source alone.
