-- Slice 11 predicate RLS: positive and negative row-level-security proof for the nine Slice 11 tables of BE03b plus the DEC-159
-- accessibility audit summary written by the same commands
-- (BE03b "Permission, RLS and grants": "RLS predicates use verified session, acting party, relationship/assignment,
-- capability ..." and "positive/negative RLS tests"; tracker P2-S11-AC-007, AC-013, AC-019, AC-025, AC-031,
-- AC-119; review finding A-M2).  Before 20261010169000 every table carried exactly one policy, the CMS RPC-context
-- gate, which proves a transaction is inside a named RPC and nothing about the caller.  RED before 20261010169000.
--
-- `postgres` (the session of this suite) has BYPASSRLS, so the behavioural proofs switch to a non-bypass probe
-- role exactly as phase_02_slice_09_r3_rls_session_scope.sql does.  The verified session is published the way
-- platform_private.cms_acting_party() publishes it (app.cms_session_actor / app.cms_session_party); the gate
-- (app.cms_rpc) is on, so every row seen or refused here is the SESSION predicate's doing.
--
-- What is proved, per role of the world (owner = receipt-derived owner, editor = submitter, outsider = a member with
-- no CMS capability, rvA = reviewer, pub = publisher, stranger = not a member):
--   * READ: every confirmed member of the acting party reads the party's rows of every table (the relationship
--     scopes - the five review scopes, the read scopes - are enforced in the definer RPC bodies and proved in
--     their suites; see the migration header for why they are not row predicates); a non-member, a member acting
--     in another party, a member whose tenure ended and a half-published session read nothing; a transaction with
--     no published session (the service paths) is admitted by the gate alone; the gate still applies.
--   * WRITE: no row can be written (INSERT/UPDATE) or deleted outside the session's party; the exclusive writers
--     (submitter, decider, creator, minter, grantor) must name the session person; assignments need the owner.
--   * The registry is readable by every gated session and writable only under the system scope.
--   * Composition: the real definer commands still run (and refuse) under the policies.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(57);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_11_rpc_review/000-world.sqlinc
\ir phase_02_slice_11_rpc_review/020-decision.sqlinc
\ir phase_02_slice_11_rpc_review/030-submit.sqlinc
\ir phase_02_slice_11_rpc_preview/000-world.sqlinc
\ir phase_02_slice_11_rpc_publication/000-world.sqlinc

-- ----------------------------------------------------------------------------------------------- fixture --
-- rls1: an APPROVED review (assignment of rvA, decision of rvA) plus a schedule, a dependency row, a publication
-- version and a preview token; rls2: a second approved review the composition schedules through the real command.
select pg_temp.p11_approved('rls1');
select pg_temp.p11_approved('rls2');
select pg_temp.p11_schedule_row('s-rls1', 'rls1');
select pg_temp.h11r_raw_insert('platform_private.cms_editorial_review_dependencies',
  pg_temp.s11_dependency_row(jsonb_build_object('review_id', pg_temp.s11_id('rv-rls1'))));
select pg_temp.h11r_raw_insert('platform_private.cms_publication_versions', pg_temp.s11_publication_row(jsonb_build_object(
  'id', 'a9500000-0000-4000-8000-000000000001'::uuid, 'publication_id', 'a9500000-0000-4000-8000-000000000001'::uuid,
  'entry_id', pg_temp.h11w_uuid('rls1:entry'), 'revision_id', pg_temp.h11w_uuid('rls1:revision'),
  'publisher_person_id', pg_temp.s11_id('pub'), 'publication_hash', pg_temp.h11_sha256('rls1-publication'))));
select pg_temp.r11p_token('t-rls1', 'rls1', 'owner');
-- The accessibility audit summary of a command (DEC-159 (5)): it names an existing audit event.
select pg_temp.h11_raw_exec('platform_private.cms_command_accessibility_evidence', format(
  $q$insert into platform_private.cms_command_accessibility_evidence(
       owner_id, state, version, operation_id, subject_id, revision_id, audit_event_id, correlation_id,
       checker_key, checker_version, outcome, blocking_count, input_hash, created_at, updated_at)
     select %L, 'recorded', 1, 'CMS-03B-05', %L, %L, event.id, extensions.gen_random_uuid(),
            'cms.a11y.structural', 1, 'healthy', 0, %L, pg_catalog.transaction_timestamp(), pg_catalog.transaction_timestamp()
       from audit_private.audit_events event order by event.id limit 1$q$,
  pg_temp.s11_id('org'), pg_temp.s11_id('rv-rls1'), pg_temp.h11w_uuid('rls1:revision'), repeat('a', 64)));

-- The helpers' own catalog posture, captured BEFORE the probe harness below grants its probe role EXECUTE on every
-- function of the schema (a fixture grant, not part of the migration's posture).
create temp table s11rls_helper_posture on commit drop as
select p.proname::text as proname
  from pg_proc p
 where p.pronamespace = 'platform_private'::regnamespace
   and p.proname in ('cms_s11_session_unbound', 'cms_s11_session_owner', 'cms_s11_session_person', 'cms_s11_session_is_owner')
   and (not p.prosecdef or p.provolatile <> 's'
        or pg_get_userbyid(p.proowner) <> 'wejammin_cms_definer'
        or not (coalesce(p.proconfig, array[]::text[]) @> array['search_path=""'])
        or exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
                    where acl.privilege_type = 'EXECUTE' and acl.grantee <> p.proowner));

-- ------------------------------------------------------------------------------------------ probe harness --
-- A non-bypass probe role: the platform `postgres` role is BYPASSRLS, so only a role without that attribute
-- actually evaluates the policies (the helpers are SECURITY DEFINER of the CMS definer, itself non-bypass).
create role s11_rls_probe nologin nobypassrls;
grant s11_rls_probe to postgres with set true;
grant usage on schema platform_private, extensions to s11_rls_probe;
grant select, insert, update, delete on all tables in schema platform_private to s11_rls_probe;
grant execute on all functions in schema platform_private to s11_rls_probe;
select is((select rolbypassrls from pg_roles where rolname = 's11_rls_probe'), false,
  'fixture: the probe role does not bypass RLS');

-- Publishes (or clears) the verified CMS session exactly as cms_acting_party() does.
create or replace function pg_temp.s11rls_publish(p_actor text, p_party text)
returns void
language plpgsql
as $body$
begin
  perform set_config('app.cms_session_actor', coalesce(p_actor, ''), true);
  perform set_config('app.cms_session_party', coalesce(p_party, ''), true);
end;
$body$;

create or replace function pg_temp.s11rls_auth(p_key text)
returns text
language sql
stable
as $body$
  select auth_user_id::text from r11_actor where key = p_key
$body$;

-- The tables whose rows are tenant-scoped (owner_id = the acting party), then the registry.
create temp table s11rls_tables(tbl text primary key, short text not null) on commit drop;
insert into s11rls_tables values
  ('cms_editorial_reviews', 'reviews'), ('cms_editorial_review_assignments', 'assignments'),
  ('cms_editorial_decisions', 'decisions'), ('cms_editorial_review_dependencies', 'dependencies'),
  ('cms_publication_settings_snapshots', 'snapshots'), ('cms_publication_schedules', 'schedules'),
  ('cms_publication_versions', 'versions'), ('cms_preview_tokens', 'tokens'),
  ('cms_command_accessibility_evidence', 'evidence');

-- Row counts of the nine tenant tables and the registry, as the session sees them.  p_probe true runs the
-- counts as the non-bypass probe role under the published session; false is the unrestricted oracle.
create or replace function pg_temp.s11rls_counts(
  p_actor text, p_party text, p_probe boolean default true, p_gate boolean default true
)
returns text
language plpgsql
as $body$
declare
  result text;
  statement text;
begin
  statement := 'select concat_ws('';'', '
    || (select string_agg(format('%L || (select count(*) from platform_private.%I)', t.short || '=', t.tbl), ', ' order by t.short) from s11rls_tables t)
    || ', ''registry='' || (select count(*) from platform_private.cms_preflight_registry))';
  perform pg_temp.s11rls_publish(p_actor, p_party);
  perform set_config('app.cms_rpc', case when p_gate then 'true' else '' end, true);
  if p_probe then
    set local role s11_rls_probe;
  end if;
  begin
    execute statement into result;
  exception when others then
    result := 'ERR:' || sqlstate;
  end;
  reset role;
  perform set_config('app.cms_rpc', 'true', true);
  perform pg_temp.s11rls_publish(null, null);
  return result;
end;
$body$;

-- A fresh image of the first row of a table with overrides, inserted (or updated / deleted) as the probe role
-- under the published session with every USER trigger of the table off (the guards are proved elsewhere; this
-- isolates the row-level-security verdict).  Answers 'rls' when row-level security refused the statement
-- (SQLSTATE 42501), 'rows:N' for an UPDATE or DELETE that touched N rows, 'ok' when an INSERT passed row-level
-- security and everything after it, and 'pass:<sqlstate>' when it passed row-level security and a later check
-- (unique, foreign key) refused it.  Nothing it does survives (a sentinel rolls it back).
create or replace function pg_temp.s11rls_write(
  p_table text, p_verb text, p_overrides jsonb, p_actor text, p_party text, p_claim_role text default null
)
returns text
language plpgsql
as $body$
declare
  outcome text;
  image jsonb;
  touched bigint;
  saved_claims text := coalesce(current_setting('request.jwt.claims', true), '');
begin
  perform set_config('app.cms_rpc', 'true', true);
  execute format('select to_jsonb(t) from platform_private.%I t limit 1', p_table) into image;
  -- The fixture rows carry deferred constraint events; run them now so the trigger switch is allowed.
  set constraints all immediate;
  execute format('alter table platform_private.%I disable trigger user', p_table);
  perform pg_temp.s11rls_publish(p_actor, p_party);
  if p_claim_role is not null then
    perform pg_temp.set_jwt_claim('role', p_claim_role, true);
  end if;
  set local role s11_rls_probe;
  begin
    if p_verb = 'insert' then
      execute format('insert into platform_private.%I select * from jsonb_populate_record(null::platform_private.%I, %L::jsonb)',
        p_table, p_table, (image || p_overrides)::text);
      outcome := 'ok';
    elsif p_verb = 'update' then
      execute format('update platform_private.%I set updated_at = updated_at', p_table);
      get diagnostics touched = row_count;
      outcome := 'rows:' || touched;
    elsif p_verb = 'delete' then
      execute format('delete from platform_private.%I', p_table);
      get diagnostics touched = row_count;
      outcome := 'rows:' || touched;
    else
      raise exception 'unknown verb %', p_verb;
    end if;
    raise exception 'S11RLS_ROLLBACK' using errcode = 'P0001';
  exception when others then
    if sqlerrm <> 'S11RLS_ROLLBACK' then
      outcome := case when sqlstate = '42501' then 'rls' else 'pass:' || sqlstate end;
    end if;
  end;
  reset role;
  execute format('alter table platform_private.%I enable trigger user', p_table);
  perform set_config('request.jwt.claims', saved_claims, true);
  perform pg_temp.s11rls_publish(null, null);
  return outcome;
end;
$body$;

-- Control: every table has rows of the party, and the unrestricted oracle sees them all.
create temp table s11rls_full(counts text not null) on commit drop;
insert into s11rls_full select pg_temp.s11rls_counts(null, null, false);
-- What a session that reads no tenant row sees (the code-owned registry stays readable), and what no gate leaves.
create temp table s11rls_denied(counts text not null) on commit drop;
insert into s11rls_denied
select regexp_replace(split_part(counts, ';registry=', 1), '=[0-9]+', '=0', 'g') || ';registry=' || split_part(counts, ';registry=', 2)
  from s11rls_full;
create temp table s11rls_gated_off(counts text not null) on commit drop;
insert into s11rls_gated_off select regexp_replace(counts, '=[0-9]+', '=0', 'g') from s11rls_full;
select ok(
  (select counts !~ '=0(;|$)' from s11rls_full),
  'fixture: all nine tenant tables and the registry hold rows (the world builds a review, an assignment, a decision, a dependency, a snapshot, a schedule, a publication, a token and an accessibility audit summary)');

-- ---------------------------------------------------------------------------------------------- structure --
select is(
  (select string_agg(t.tbl, ',' order by t.tbl)
     from s11rls_tables t
    where not exists (
      select 1 from pg_policies p
       where p.schemaname = 'platform_private' and p.tablename = t.tbl
         and p.policyname = t.tbl || '_session_scope'
         and p.permissive = 'RESTRICTIVE' and p.cmd = 'ALL'
         and p.qual ~ 'cms_s11_session_unbound' and p.qual ~ 'cms_s11_session_owner'
         and p.with_check ~ 'cms_s11_session_unbound' and p.with_check ~ 'cms_s11_session_owner')),
  null,
  'every tenant-scoped Slice 11 table carries a RESTRICTIVE policy for ALL commands that reads and re-checks the verified session party in USING and WITH CHECK [P2-S11-AC-119]');
select is(
  (select string_agg(x.tbl || '.' || x.policy, ',' order by x.tbl, x.policy)
     from (values
       ('cms_editorial_reviews', 'cms_editorial_reviews_session_submitter'),
       ('cms_editorial_decisions', 'cms_editorial_decisions_session_decider'),
       ('cms_publication_schedules', 'cms_publication_schedules_session_creator'),
       ('cms_preview_tokens', 'cms_preview_tokens_session_minter'),
       ('cms_editorial_review_assignments', 'cms_editorial_review_assignments_session_grantor'),
       ('cms_editorial_review_assignments', 'cms_editorial_review_assignments_session_owner_update'))
       as x(tbl, policy)
    where not exists (
      select 1 from pg_policies p
       where p.schemaname = 'platform_private' and p.tablename = x.tbl and p.policyname = x.policy
         and p.permissive = 'RESTRICTIVE' and p.cmd in ('INSERT', 'UPDATE'))),
  null,
  'the exclusive writers are bound by RESTRICTIVE INSERT policies (submitter, decider, creator, minter, grantor) and the assignment revoke by a RESTRICTIVE UPDATE policy [P2-S11-AC-119]');
select is(
  (select string_agg(c.cmd, ',' order by c.cmd)
     from (values ('INSERT'), ('UPDATE'), ('DELETE')) c(cmd)
    where not exists (
      select 1 from pg_policies p
       where p.schemaname = 'platform_private' and p.tablename = 'cms_preflight_registry'
         and p.permissive = 'RESTRICTIVE' and p.cmd = c.cmd
         and coalesce(p.qual, '') || coalesce(p.with_check, '') ~ 'cms_session_scope_ok_system')),
  null,
  'the release-seeded preflight registry is written only under the system scope: RESTRICTIVE INSERT, UPDATE and DELETE policies [P2-S11-AC-119]');
select is(
  (select string_agg(t.tbl, ',' order by t.tbl)
     from (select tbl from s11rls_tables union all select 'cms_preflight_registry') t
    where not exists (
      select 1 from pg_policies p
       where p.schemaname = 'platform_private' and p.tablename = t.tbl
         and p.policyname = t.tbl || '_rpc_policy' and p.permissive = 'PERMISSIVE'
         and p.qual = 'platform_private.cms_rpc_context_valid()'
         and p.with_check = 'platform_private.cms_rpc_context_valid()')),
  null,
  'the CMS RPC-context gate is still present on all ten tables: the session policies are in addition to it, never instead [P2-S11-AC-119]');
select is(
  (select string_agg(proname, ',' order by proname) from s11rls_helper_posture),
  null,
  'the four session-scope helpers exist as STABLE SECURITY DEFINER functions of the CMS definer with an empty search_path and no EXECUTE for anyone else [P2-S11-AC-119]');
select is(
  (select count(*)::integer from pg_proc p
    where p.pronamespace = 'platform_private'::regnamespace
      and p.proname in ('cms_s11_session_unbound', 'cms_s11_session_owner', 'cms_s11_session_person', 'cms_s11_session_is_owner')),
  4, 'exactly one overload of each session-scope helper exists [P2-S11-AC-119]');
select ok(
  (select bool_and(c.relrowsecurity and c.relforcerowsecurity)
     from (select tbl from s11rls_tables union all select 'cms_preflight_registry') t
     join pg_class c on c.oid = to_regclass('platform_private.' || t.tbl)),
  'row-level security stays enabled and forced on all ten tables [P2-S11-AC-119]');

-- --------------------------------------------------------------------------- reads: who sees which rows --
select is(pg_temp.s11rls_counts(pg_temp.s11rls_auth('owner'), pg_temp.s11_id('org')::text),
  (select counts from s11rls_full),
  'READ allowed: the receipt-derived owner acting in its party reads every row of the nine tenant tables and the registry [P2-S11-AC-007]');
select is(pg_temp.s11rls_counts(pg_temp.s11rls_auth('editor'), pg_temp.s11_id('org')::text),
  (select counts from s11rls_full),
  'READ allowed: the submitter (cms.editor) reads the party''s rows [P2-S11-AC-013]');
select is(pg_temp.s11rls_counts(pg_temp.s11rls_auth('rvA'), pg_temp.s11_id('org')::text),
  (select counts from s11rls_full),
  'READ allowed: an assigned reviewer reads the party''s rows (the five review scopes are the RPC layer''s: the recount a decision runs must see every assignment and decision) [P2-S11-AC-013]');
select is(pg_temp.s11rls_counts(pg_temp.s11rls_auth('pub'), pg_temp.s11_id('org')::text),
  (select counts from s11rls_full),
  'READ allowed: the publisher reads the party''s rows [P2-S11-AC-019]');
select is(pg_temp.s11rls_counts(pg_temp.s11rls_auth('outsider'), pg_temp.s11_id('org')::text),
  (select counts from s11rls_full),
  'READ allowed at the row level: a confirmed member with no CMS capability reads the party''s rows (its 403 is the definer RPCs'' capability check, proved in their suites) [P2-S11-AC-025]');
select is(pg_temp.s11rls_counts(pg_temp.s11rls_auth('stranger'), pg_temp.s11_id('org')::text),
  (select counts from s11rls_denied),
  'READ denied: a caller who is not a member of the acting party reads no row of any tenant table (the code-owned registry stays readable) [P2-S11-AC-007]');
select is(pg_temp.s11rls_counts(pg_temp.s11rls_auth('owner'), pg_temp.s11_id('creator')::text),
  (select counts from s11rls_denied),
  'READ denied: the owner acting in ANOTHER party (its own person party) reads no row of the organization [P2-S11-AC-031]');

-- A member whose tenure ended is no longer a member.
select pg_temp.h11_raw_exec('identity_private.membership_tenure', format(
  $q$update identity_private.membership_tenure set state = 'ended', revoked_at = clock_timestamp(), ends_on = current_date + 1
      where organization_id = %L and person_id = %L$q$, pg_temp.s11_id('org'), pg_temp.s11_id('editor')));
select is(pg_temp.s11rls_counts(pg_temp.s11rls_auth('editor'), pg_temp.s11_id('org')::text),
  (select counts from s11rls_denied),
  'READ denied: a member whose membership tenure ended reads no row (the predicate re-resolves the membership on every statement) [P2-S11-AC-013]');
select pg_temp.h11_raw_exec('identity_private.membership_tenure', format(
  $q$update identity_private.membership_tenure set state = 'confirmed', revoked_at = null, ends_on = null
      where organization_id = %L and person_id = %L$q$, pg_temp.s11_id('org'), pg_temp.s11_id('editor')));
select is(pg_temp.s11rls_counts(pg_temp.s11rls_auth('editor'), pg_temp.s11_id('org')::text),
  (select counts from s11rls_full),
  'READ allowed again: once the tenure is confirmed again the same session reads the party''s rows (the verdict is per statement, not remembered) [P2-S11-AC-013]');

select is(
  pg_temp.s11rls_counts(pg_temp.s11rls_auth('owner'), null)
    || ' | ' || pg_temp.s11rls_counts(null, pg_temp.s11_id('org')::text)
    || ' | ' || pg_temp.s11rls_counts(pg_temp.s11rls_auth('owner'), 'not-a-uuid'),
  (select counts || ' | ' || counts || ' | ' || counts from s11rls_denied),
  'READ denied: a session published for only one of actor and party, or with a malformed party, is not "no session": it reads nothing [P2-S11-AC-031]');
select is(pg_temp.s11rls_counts(null, null),
  (select counts from s11rls_full),
  'READ allowed: a transaction with NO published session (the service paths: sweep, recheck, verifier, takedown) is admitted by the RPC-context gate alone, as before [P2-S11-AC-019]');
select is(pg_temp.s11rls_counts(pg_temp.s11rls_auth('owner'), pg_temp.s11_id('org')::text, true, false),
  (select counts from s11rls_gated_off),
  'READ denied: the owner''s own session sees nothing outside a CMS RPC context - the gate still applies in addition to the session policy [P2-S11-AC-025]');

-- -------------------------------------------------------------------------------- writes: UPDATE and DELETE --
select is(
  (select string_agg(t.short || '=' || pg_temp.s11rls_write(t.tbl, 'update', '{}'::jsonb, pg_temp.s11rls_auth('owner'), pg_temp.s11_id('org')::text), ';' order by t.short)
     from s11rls_tables t),
  (select string_agg(t.short || '=rows:' || (select (regexp_match((select counts from s11rls_full), t.short || '=([0-9]+)'))[1]), ';' order by t.short)
     from s11rls_tables t),
  'WRITE allowed: the owner''s session updates every row of its party in all nine tenant tables [P2-S11-AC-007]');
select is(
  (select string_agg(t.short || '=' || pg_temp.s11rls_write(t.tbl, 'update', '{}'::jsonb, pg_temp.s11rls_auth('stranger'), pg_temp.s11_id('org')::text), ';' order by t.short)
     from s11rls_tables t),
  (select string_agg(t.short || '=rows:0', ';' order by t.short) from s11rls_tables t),
  'WRITE denied: a non-member acting in the party updates no row of any tenant table [P2-S11-AC-007]');
select is(
  (select string_agg(t.short || '=' || pg_temp.s11rls_write(t.tbl, 'update', '{}'::jsonb, pg_temp.s11rls_auth('owner'), pg_temp.s11_id('creator')::text), ';' order by t.short)
     from s11rls_tables t),
  (select string_agg(t.short || '=rows:0', ';' order by t.short) from s11rls_tables t),
  'WRITE denied: the owner acting in another party updates no row of the organization [P2-S11-AC-031]');
select is(
  (select string_agg(t.short || '=' || pg_temp.s11rls_write(t.tbl, 'delete', '{}'::jsonb, pg_temp.s11rls_auth('stranger'), pg_temp.s11_id('org')::text), ';' order by t.short)
     from s11rls_tables t),
  (select string_agg(t.short || '=rows:0', ';' order by t.short) from s11rls_tables t),
  'WRITE denied: a non-member deletes no row of any tenant table [P2-S11-AC-007]');
select is(
  (select string_agg(t.short || '=' || pg_temp.s11rls_write(t.tbl, 'update', '{}'::jsonb, null, null), ';' order by t.short)
     from s11rls_tables t),
  (select string_agg(t.short || '=rows:' || (select (regexp_match((select counts from s11rls_full), t.short || '=([0-9]+)'))[1]), ';' order by t.short)
     from s11rls_tables t),
  'WRITE allowed: with no published session (a service path) the gate alone admits the update, as before [P2-S11-AC-019]');

-- ----------------------------------------------------------------------------------- writes: INSERT bounds --
select is(
  (select string_agg(t.short || '=' || pg_temp.s11rls_write(t.tbl, 'insert',
            jsonb_build_object('id', extensions.gen_random_uuid(), 'owner_id', extensions.gen_random_uuid()),
            pg_temp.s11rls_auth('owner'), pg_temp.s11_id('org')::text), ';' order by t.short)
     from s11rls_tables t),
  (select string_agg(t.short || '=rls', ';' order by t.short) from s11rls_tables t),
  'INSERT denied: the owner''s session cannot write a row owned by another party into any tenant table (WITH CHECK) [P2-S11-AC-031]');
select is(
  (select string_agg(t.short || '=' || pg_temp.s11rls_write(t.tbl, 'insert',
            jsonb_build_object('id', extensions.gen_random_uuid()),
            pg_temp.s11rls_auth('owner'), pg_temp.s11_id('org')::text), ';' order by t.short)
     from s11rls_tables t
    where t.short in ('dependencies', 'snapshots', 'versions')) ~ 'rls',
  false,
  'INSERT allowed: a row of the session''s own party passes row-level security where no exclusive writer is bound (dependencies, snapshots, publication versions) [P2-S11-AC-019]');

-- The exclusive writers must name the session person.
select is(
  pg_temp.s11rls_write('cms_editorial_reviews', 'insert',
    jsonb_build_object('id', extensions.gen_random_uuid(), 'submitted_by', pg_temp.s11_id('stranger')),
    pg_temp.s11rls_auth('editor'), pg_temp.s11_id('org')::text),
  'rls',
  'INSERT denied: a review is written for the session person only - the submitter cannot attribute a submission to someone else [P2-S11-AC-013]');
select isnt(
  pg_temp.s11rls_write('cms_editorial_reviews', 'insert',
    jsonb_build_object('id', extensions.gen_random_uuid(), 'submitted_by', pg_temp.s11_id('editor')),
    pg_temp.s11rls_auth('editor'), pg_temp.s11_id('org')::text),
  'rls',
  'INSERT allowed: the same review naming the session person passes row-level security [P2-S11-AC-013]');
select is(
  pg_temp.s11rls_write('cms_editorial_decisions', 'insert',
    jsonb_build_object('id', extensions.gen_random_uuid(), 'reviewer_person_id', pg_temp.s11_id('rvB')),
    pg_temp.s11rls_auth('rvA'), pg_temp.s11_id('org')::text),
  'rls',
  'INSERT denied: a decision is written for the session person only - a reviewer cannot record a decision as another reviewer [P2-S11-AC-013]');
select isnt(
  pg_temp.s11rls_write('cms_editorial_decisions', 'insert',
    jsonb_build_object('id', extensions.gen_random_uuid(), 'reviewer_person_id', pg_temp.s11_id('rvA')),
    pg_temp.s11rls_auth('rvA'), pg_temp.s11_id('org')::text),
  'rls',
  'INSERT allowed: the same decision naming the session reviewer passes row-level security [P2-S11-AC-013]');
select is(
  pg_temp.s11rls_write('cms_publication_schedules', 'insert',
    jsonb_build_object('id', extensions.gen_random_uuid(), 'created_by', pg_temp.s11_id('creator')),
    pg_temp.s11rls_auth('pub'), pg_temp.s11_id('org')::text),
  'rls',
  'INSERT denied: a schedule is created for the session person only [P2-S11-AC-019]');
select isnt(
  pg_temp.s11rls_write('cms_publication_schedules', 'insert',
    jsonb_build_object('id', extensions.gen_random_uuid(), 'created_by', pg_temp.s11_id('pub')),
    pg_temp.s11rls_auth('pub'), pg_temp.s11_id('org')::text),
  'rls',
  'INSERT allowed: the same schedule naming the session publisher passes row-level security [P2-S11-AC-019]');
select is(
  pg_temp.s11rls_write('cms_preview_tokens', 'insert',
    jsonb_build_object('id', extensions.gen_random_uuid(), 'token_hash', pg_temp.h11_sha256('rls-other'), 'person_id', pg_temp.s11_id('editor')),
    pg_temp.s11rls_auth('owner'), pg_temp.s11_id('org')::text),
  'rls',
  'INSERT denied: a preview token is minted for the session person only [P2-S11-AC-025]');
select isnt(
  pg_temp.s11rls_write('cms_preview_tokens', 'insert',
    jsonb_build_object('id', extensions.gen_random_uuid(), 'token_hash', pg_temp.h11_sha256('rls-own'), 'person_id', pg_temp.s11_id('creator')),
    pg_temp.s11rls_auth('owner'), pg_temp.s11_id('org')::text),
  'rls',
  'INSERT allowed: the same token naming the session person passes row-level security [P2-S11-AC-025]');

-- The expected row counts of the two unrestricted UPDATE proofs are taken here: a statement that scans a table cannot
-- run a function that alters that table.
create temp table s11rls_expect on commit drop as
select (select count(*) from platform_private.cms_editorial_review_assignments) as assignments,
       (select count(*) from platform_private.cms_preflight_registry) as registry;

-- Reviewer assignments: owner-only, grantor = the session person.
select is(
  pg_temp.s11rls_write('cms_editorial_review_assignments', 'insert',
    jsonb_build_object('id', extensions.gen_random_uuid(), 'grantor_person_id', pg_temp.s11_id('editor'), 'reviewer_person_id', pg_temp.s11_id('rvB')),
    pg_temp.s11rls_auth('editor'), pg_temp.s11_id('org')::text),
  'rls',
  'INSERT denied: a member who is not the receipt-derived owner cannot write a reviewer assignment, even naming itself the grantor (CMS-03B-18 is owner-only) [P2-S11-AC-013]');
select is(
  pg_temp.s11rls_write('cms_editorial_review_assignments', 'insert',
    jsonb_build_object('id', extensions.gen_random_uuid(), 'grantor_person_id', pg_temp.s11_id('editor'), 'reviewer_person_id', pg_temp.s11_id('rvB')),
    pg_temp.s11rls_auth('owner'), pg_temp.s11_id('org')::text),
  'rls',
  'INSERT denied: the owner cannot attribute an assignment to another grantor [P2-S11-AC-013]');
select isnt(
  pg_temp.s11rls_write('cms_editorial_review_assignments', 'insert',
    jsonb_build_object('id', extensions.gen_random_uuid(), 'grantor_person_id', pg_temp.s11_id('creator'), 'reviewer_person_id', pg_temp.s11_id('rvB')),
    pg_temp.s11rls_auth('owner'), pg_temp.s11_id('org')::text),
  'rls',
  'INSERT allowed: the owner naming itself the grantor passes row-level security [P2-S11-AC-013]');
select is(
  pg_temp.s11rls_write('cms_editorial_review_assignments', 'update', '{}'::jsonb, pg_temp.s11rls_auth('editor'), pg_temp.s11_id('org')::text),
  'rows:0',
  'UPDATE denied: a member who is not the owner revokes (updates) no reviewer assignment [P2-S11-AC-013]');
select is(
  pg_temp.s11rls_write('cms_editorial_review_assignments', 'update', '{}'::jsonb, pg_temp.s11rls_auth('owner'), pg_temp.s11_id('org')::text),
  (select 'rows:' || assignments from s11rls_expect),
  'UPDATE allowed: the owner updates (revokes) the party''s reviewer assignments [P2-S11-AC-013]');

-- ------------------------------------------------------------------------------------------- the registry --
select is(pg_temp.s11rls_write('cms_preflight_registry', 'insert',
    jsonb_build_object('id', extensions.gen_random_uuid()), pg_temp.s11rls_auth('owner'), pg_temp.s11_id('org')::text),
  'rls', 'REGISTRY INSERT denied: no human session may write the release-seeded preflight registry [P2-S11-AC-119]');
select is(pg_temp.s11rls_write('cms_preflight_registry', 'insert',
    jsonb_build_object('id', extensions.gen_random_uuid()), null, null, 'authenticated'),
  'rls', 'REGISTRY INSERT denied: a transaction with no session and no service-role JWT is not the system scope [P2-S11-AC-119]');
select isnt(pg_temp.s11rls_write('cms_preflight_registry', 'insert',
    jsonb_build_object('id', extensions.gen_random_uuid()), null, null, 'service_role'),
  'rls', 'REGISTRY INSERT allowed under the system scope (no human session, verified service-role JWT) [P2-S11-AC-119]');
select is(
  pg_temp.s11rls_write('cms_preflight_registry', 'update', '{}'::jsonb, pg_temp.s11rls_auth('owner'), pg_temp.s11_id('org')::text)
    || ' ' || pg_temp.s11rls_write('cms_preflight_registry', 'delete', '{}'::jsonb, pg_temp.s11rls_auth('owner'), pg_temp.s11_id('org')::text),
  'rows:0 rows:0',
  'REGISTRY UPDATE and DELETE touch no row for a human session [P2-S11-AC-119]');
select is(
  pg_temp.s11rls_write('cms_preflight_registry', 'update', '{}'::jsonb, null, null, 'service_role'),
  (select 'rows:' || registry from s11rls_expect),
  'REGISTRY UPDATE reaches every row under the system scope [P2-S11-AC-119]');

-- ----------------------------------------------------------------------------------------- composition --
-- The real definer commands run as the non-bypass definer role under these policies: the publisher schedules the
-- approved review (reads reviews, assignments, decisions, snapshots; writes a schedule, an audit record, an event)
-- and a non-member is still concealed.
select pg_temp.p11_call('c-schedule', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('rls2'));
select ok(pg_temp.r11_out('c-schedule') = '00000:'
    and (select count(*) = 1 and bool_and(created_by = pg_temp.s11_id('pub'))
           from platform_private.cms_publication_schedules where revision_id = pg_temp.h11w_uuid('rls2:revision')),
  'composition: the real CMS-03B-07 command still schedules an approved review as the publisher under the session policies, attributing the schedule to the publisher [P2-S11-AC-019]');
select pg_temp.p11_call('c-stranger', 'stranger', 'cms_schedule_publication', pg_temp.p11_sreq('rls2'), false);
select is(pg_temp.r11_out('c-stranger') || '|' || coalesce(pg_temp.r11_detail('c-stranger'), 'null'),
  'P0001:NOT_FOUND|null',
  'composition: the same command by a non-member is still the concealed NOT_FOUND under the session policies [P2-S11-AC-019]');

select * from finish();
rollback;
