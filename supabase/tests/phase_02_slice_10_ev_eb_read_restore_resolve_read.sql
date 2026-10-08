-- Slice 10 evidence lane EB: CMS-03B-11 draft-detail read (P2-S10-AC-067, AC-069, AC-070).
--
--   * N1 (AC-067 067.2, AC-070 070.1): the resource's entry.version and revision.version ARE the
--     stored row versions, not constants, and they move with a later committed write.
--   * N2 (AC-069 069.2/069.3): an actor holding the CMS read grant and a confirmed tenure but no
--     active assignment on the entry (revoked or absent) is refused FORBIDDEN with nothing written,
--     while a tenant-invisible actor is the same minimal NOT_FOUND as an absent entry.
--   * N3 (AC-070 070.4 browser table grants): the browser roles hold no table privilege on any
--     relation the draft read touches and no EXECUTE on the read functions.
--
-- Probes run through the named worker-facing RPC (platform_api.cms_get_entry_draft) exactly as the
-- Worker calls it.  Every state a probe changes (an assignment, a grant, a tenure, a stored
-- version) is changed inside a rolled-back subtransaction, except the final real append of N1.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_rpc/009-restore-policy-binding.sqlinc

-- ---------------------------------------------------------------------------------------
-- Helpers (all pg_temp, all prefixed eb_).
-- ---------------------------------------------------------------------------------------

-- One draft read request for the seeded entry (or p_entry), with the acting-party context the
-- Worker projects.
create or replace function pg_temp.eb_read_sql(p_entry text default null)
returns text
language sql
stable
as $body$
  select 'select platform_api.cms_get_entry_draft(' || quote_literal(jsonb_build_object(
    'entryId', coalesce(p_entry, (select value from s10_ids where key = 'entryId')),
    'context', jsonb_build_object(
      'actingPartyId', (select value from s10_ids where key = 'organization'),
      'actingContextId', 'a9100000-0000-4000-8000-000000000094',
      'correlationId', 'a9100000-0000-4000-8000-000000000095'))::text) || '::jsonb)'
$body$;

\ir phase_02_slice_10_ev_eb/000-helpers.sqlinc

-- ---------------------------------------------------------------------------------------
-- N1 (CMS-03B-11 canonical versions; AC-067 067.2 / AC-070 070.1)
-- ---------------------------------------------------------------------------------------
select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization'));

-- Baseline: the seeded rows carry version 1 and the resource reports exactly the stored value.
select pg_temp.eb_probe('n1-baseline', null, pg_temp.eb_read_sql());
select is(
  pg_temp.eb_obs('n1-baseline')->'response'->'entry'->>'version',
  (select entry_row.version::text from platform_private.cms_content_entries entry_row
    where entry_row.id = (select value::uuid from s10_ids where key = 'entryId')),
  'EB draft read versions: entry.version equals the stored cms_content_entries.version'
);
select is(
  pg_temp.eb_obs('n1-baseline')->'response'->'revision'->>'version',
  (select revision_row.version::text from platform_private.cms_entry_revisions revision_row
    where revision_row.id = (select value::uuid from s10_ids where key = 'entryRevisionId')),
  'EB draft read versions: revision.version equals the stored cms_entry_revisions.version of the current draft'
);

-- The stored versions are moved to values no constant can match; the resource follows both.
create or replace function pg_temp.eb_move_versions()
returns void
language plpgsql
as $body$
begin
  perform set_config('app.cms_rpc', 'true', true);
  update platform_private.cms_content_entries
     set version = 5
   where id = (select value::uuid from s10_ids where key = 'entryId');
  -- A revision snapshot is immutable; only the trigger-skipping replica role can move it.
  set local session_replication_role = replica;
  update platform_private.cms_entry_revisions
     set version = 7
   where id = (select value::uuid from s10_ids where key = 'entryRevisionId');
  set local session_replication_role = origin;
end;
$body$;

select pg_temp.eb_probe('n1-moved', $s$select pg_temp.eb_move_versions()$s$, pg_temp.eb_read_sql());
select is(
  pg_temp.eb_obs('n1-moved')->'response'->'entry'->>'version', '5',
  'EB draft read versions: entry.version follows a moved stored entry version (5), it is not a constant'
);
select is(
  pg_temp.eb_obs('n1-moved')->'response'->'revision'->>'version', '7',
  'EB draft read versions: revision.version follows a moved stored revision version (7), it is not a constant'
);
select is(
  pg_temp.eb_obs('n1-moved')->'response'->'revision'->>'id',
  (select value from s10_ids where key = 'entryRevisionId'),
  'EB draft read versions: the moved versions are reported on the same entry and revision identities'
);

-- ---------------------------------------------------------------------------------------
-- N2 (CMS-03B-11 authority: grant and tenure without an entry assignment; AC-069)
-- ---------------------------------------------------------------------------------------

-- Controls first: the editor holds the cms.editor grant, a confirmed tenure and an active
-- assignment, and reads the draft.
select pg_temp.eb_probe('n2-editor-control', pg_temp.eb_as_sql('editorAuth'), pg_temp.eb_read_sql());
select is(
  pg_temp.eb_obs('n2-editor-control')->>'state', '00000',
  'EB draft read authority control: the editor with grant, tenure and an active assignment reads the draft'
);

-- Revoked assignment: only the editor's entry assignment is revoked (the committed shape of the
-- revocation seams); the grant and the tenure stay intact.
create or replace function pg_temp.eb_revoke_editor_assignment()
returns void
language plpgsql
as $body$
begin
  perform set_config('app.cms_rpc', 'true', true);
  update platform_private.cms_entry_assignments
     set state = 'revoked', version = version + 1
   where entry_id = (select value::uuid from s10_ids where key = 'entryId')
     and assignee_person_id = (select value::uuid from s10_ids where key = 'editorPerson');
end;
$body$;

select pg_temp.eb_probe(
  'n2-assignment-revoked',
  pg_temp.eb_as_sql('editorAuth') || '; select pg_temp.eb_revoke_editor_assignment()',
  pg_temp.eb_read_sql());
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('n2-assignment-revoked')), 'P0001|FORBIDDEN|-|-',
  'EB draft read authority: a grant and tenure holder whose entry assignment is revoked is refused FORBIDDEN with no detail or hint'
);
select is(
  (select (a.is_revoked and a.grant_active and a.tenure_confirmed)
     from (select
       exists (select 1 from identity_private.organization_actor_grant actor_grant
         where actor_grant.person_id = (select value::uuid from s10_ids where key = 'editorPerson')
           and actor_grant.capability_code = 'cms.editor' and actor_grant.active) as grant_active,
       exists (select 1 from identity_private.membership_tenure tenure
         where tenure.person_id = (select value::uuid from s10_ids where key = 'editorPerson')
           and tenure.state = 'confirmed') as tenure_confirmed,
       true as is_revoked) a),
  true,
  'EB draft read authority fixture: the refused editor really holds an active cms.editor grant and a confirmed tenure'
);
select is(
  pg_temp.eb_obs('n2-assignment-revoked')->>'after', pg_temp.eb_obs('n2-assignment-revoked')->>'before',
  'EB draft read authority: the refused revoked-assignment read wrote no entry, revision, value, relation, conflict, reservation, outbox, audit or assignment change'
);

-- Absent assignment: the outsider is a confirmed member who is granted cms.editor but was never
-- assigned to this entry.
create or replace function pg_temp.eb_grant_outsider_editor()
returns void
language plpgsql
as $body$
begin
  insert into identity_private.organization_actor_grant(
    organization_id, person_id, capability_code, valid_from, valid_through, active
  ) values (
    (select value::uuid from s10_ids where key = 'organization'),
    (select value::uuid from s10_ids where key = 'outsiderPerson'),
    'cms.editor', current_date, current_date + 1, true);
end;
$body$;
create or replace function pg_temp.eb_assign_outsider_editor()
returns void
language plpgsql
as $body$
begin
  perform set_config('app.cms_rpc', 'true', true);
  insert into platform_private.cms_entry_assignments(
    owner_id, entry_id, assignee_person_id, capability_key, state, version
  ) values (
    (select value::uuid from s10_ids where key = 'organization'),
    (select value::uuid from s10_ids where key = 'entryId'),
    (select value::uuid from s10_ids where key = 'outsiderPerson'),
    'cms.editor', 'active', 1);
end;
$body$;

select pg_temp.eb_probe(
  'n2-assignment-absent',
  pg_temp.eb_as_sql('outsiderAuth') || '; select pg_temp.eb_grant_outsider_editor()',
  pg_temp.eb_read_sql());
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('n2-assignment-absent')), 'P0001|FORBIDDEN|-|-',
  'EB draft read authority: a grant and tenure holder with no assignment row on the entry is refused FORBIDDEN with no detail or hint'
);
select is(
  pg_temp.eb_obs('n2-assignment-absent')->>'after', pg_temp.eb_obs('n2-assignment-absent')->>'before',
  'EB draft read authority: the refused absent-assignment read wrote nothing'
);
select pg_temp.eb_probe(
  'n2-assignment-added',
  pg_temp.eb_as_sql('outsiderAuth')
    || '; select pg_temp.eb_grant_outsider_editor(); select pg_temp.eb_assign_outsider_editor()',
  pg_temp.eb_read_sql());
select is(
  pg_temp.eb_obs('n2-assignment-added')->>'state', '00000',
  'EB draft read authority control: the same granted member reads the draft once an active assignment exists, so the assignment alone was missing'
);

-- Tenure ended: the entry is no longer visible to the actor, which is concealment, not a refusal.
create or replace function pg_temp.eb_end_editor_tenure()
returns void
language plpgsql
as $body$
begin
  update identity_private.membership_tenure
     set state = 'ended', revoked_at = clock_timestamp(), updated_at = clock_timestamp()
   where organization_id = (select value::uuid from s10_ids where key = 'organization')
     and person_id = (select value::uuid from s10_ids where key = 'editorPerson');
end;
$body$;
select pg_temp.eb_probe(
  'n2-tenure-ended',
  pg_temp.eb_as_sql('editorAuth') || '; select pg_temp.eb_end_editor_tenure()',
  pg_temp.eb_read_sql());
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('n2-tenure-ended')), 'P0001|NOT_FOUND|-|-',
  'EB draft read authority: an actor whose confirmed tenure ended is concealed as NOT_FOUND, not told FORBIDDEN'
);

-- Concealment shape: a tenant-invisible actor and an absent entry are indistinguishable.
select pg_temp.eb_probe('n2-stranger', pg_temp.eb_as_sql('strangerAuth'), pg_temp.eb_read_sql());
select pg_temp.eb_probe(
  'n2-absent-entry', pg_temp.eb_as_sql('creatorAuth'),
  pg_temp.eb_read_sql('a9100000-0000-4000-8000-0000000003a9'));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('n2-stranger')), 'P0001|NOT_FOUND|-|-',
  'EB draft read concealment: a non-member of the owning tenant is refused NOT_FOUND with no detail or hint'
);
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('n2-stranger')), pg_temp.eb_shape(pg_temp.eb_obs('n2-absent-entry')),
  'EB draft read concealment: a non-member read and an absent-entry read have the identical SQLSTATE, token, detail and hint'
);
select is(
  pg_temp.eb_obs('n2-stranger')->>'after', pg_temp.eb_obs('n2-stranger')->>'before',
  'EB draft read concealment: the concealed non-member read wrote nothing'
);

-- ---------------------------------------------------------------------------------------
-- N3 (CMS-03B-11 browser table grants; AC-070 070.4 facet B)
-- ---------------------------------------------------------------------------------------
-- The relation set cms_get_entry_draft reads: the editorial entry, revision, value, relation,
-- assignment and conflict tables, the 03a content type / version / schema artifact / field
-- definition / relation definition tables it types the draft against, and the two identity
-- tables the authority helpers consult.  The list is explicit on purpose.
create temp table eb_read_relations(relation text primary key) on commit drop;
insert into eb_read_relations values
  ('platform_private.cms_content_entries'),
  ('platform_private.cms_entry_revisions'),
  ('platform_private.cms_entry_field_values'),
  ('platform_private.cms_entry_relations'),
  ('platform_private.cms_entry_assignments'),
  ('platform_private.cms_conflict_records'),
  ('platform_private.cms_content_types'),
  ('platform_private.cms_content_type_versions'),
  ('platform_private.cms_schema_artifacts'),
  ('platform_private.cms_field_definition_versions'),
  ('platform_private.cms_relation_definitions'),
  ('identity_private.organization_actor_grant'),
  ('identity_private.membership_tenure');

select is(
  (select count(*)::integer from eb_read_relations read_relation
    where to_regclass(read_relation.relation) is not null
      and (select class_row.relkind from pg_class class_row
             where class_row.oid = to_regclass(read_relation.relation)) = 'r'),
  13,
  'EB draft read grants: all 13 listed relations exist as ordinary tables'
);

select is(
  (select string_agg(roles.role_name || ' ' || privileges.privilege || ' ' || read_relation.relation,
      ', ' order by roles.role_name, read_relation.relation, privileges.privilege)
     from eb_read_relations read_relation
     cross join (values ('anon'), ('authenticated')) roles(role_name)
     cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) privileges(privilege)
    where has_table_privilege(roles.role_name, read_relation.relation, privileges.privilege)),
  null,
  'EB draft read grants: anon and authenticated hold no SELECT, INSERT, UPDATE or DELETE table privilege on any relation the draft read touches'
);

select is(
  (select string_agg(roles.role_name || ' ' || privileges.privilege || ' column ' || read_relation.relation,
      ', ' order by roles.role_name, read_relation.relation, privileges.privilege)
     from eb_read_relations read_relation
     cross join (values ('anon'), ('authenticated')) roles(role_name)
     cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES')) privileges(privilege)
    where has_any_column_privilege(roles.role_name, read_relation.relation, privileges.privilege)),
  null,
  'EB draft read grants: anon and authenticated hold no column-level privilege on any relation the draft read touches'
);

select is(
  (select string_agg(roles.role_name || ' ' || schemas.schema_name, ', ' order by roles.role_name, schemas.schema_name)
     from (values ('anon'), ('authenticated')) roles(role_name)
     cross join (values ('platform_private'), ('identity_private')) schemas(schema_name)
    where has_schema_privilege(roles.role_name, schemas.schema_name, 'USAGE')),
  null,
  'EB draft read grants: anon and authenticated cannot even resolve the private schemas the draft read lives in'
);

select is(
  (select string_agg(roles.role_name || ' ' || functions.signature, ', '
      order by roles.role_name, functions.signature)
     from (values ('anon'), ('authenticated'), ('public')) roles(role_name)
     cross join (values
       ('platform_api.cms_get_entry_draft(jsonb)'),
       ('platform_private.cms_get_entry_draft(jsonb)')) functions(signature)
    where has_function_privilege(roles.role_name, to_regprocedure(functions.signature), 'EXECUTE')),
  null,
  'EB draft read grants: EXECUTE on both cms_get_entry_draft functions is granted to none of anon, authenticated and PUBLIC'
);

select is(
  has_function_privilege('service_role', 'platform_api.cms_get_entry_draft(jsonb)', 'EXECUTE')
    and not has_function_privilege('service_role', 'platform_private.cms_get_entry_draft(jsonb)', 'EXECUTE'),
  true,
  'EB draft read grants control: only the worker role service_role can execute the platform_api wrapper, never the private function'
);

-- ---------------------------------------------------------------------------------------
-- N1 (continued): a later COMMITTED write moves the entry version and the current draft; the
-- resource reports the new canonical versions.  This is a real append through the named RPC.
-- ---------------------------------------------------------------------------------------
select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization'));
create temp table eb_append_result on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_revision(' || quote_literal(jsonb_build_object(
    'entryId', (select value from s10_ids where key = 'entryId'),
    'baseRevision', '1',
    'changedPaths', jsonb_build_array('/fields/' || (select value from s10_ids where key = 'typeFieldId')),
    'values', jsonb_build_object((select value from s10_ids where key = 'typeFieldId'), 'Second draft title'),
    'locale', 'en-US', 'expectedVersion', '1', 'ifMatch', '1',
    'idempotencyKey', 's10-eb-read-append-0001',
    'context', jsonb_build_object(
      'actingPartyId', (select value from s10_ids where key = 'organization'),
      'actingContextId', 'a9100000-0000-4000-8000-000000000094',
      'correlationId', 'a9100000-0000-4000-8000-000000000095'))::text) || '::jsonb)'
) as response;
select is(
  pg_temp.s10_last_error_state(), '00000',
  'EB draft read fixture: the committed append that moves the entry version succeeds'
);
select pg_temp.eb_probe('n1-after-append', null, pg_temp.eb_read_sql());
select is(
  pg_temp.eb_obs('n1-after-append')->'response'->'entry'->>'version',
  (select entry_row.version::text from platform_private.cms_content_entries entry_row
    where entry_row.id = (select value::uuid from s10_ids where key = 'entryId')),
  'EB draft read versions after a committed append: entry.version equals the advanced stored entry version'
);
select is(
  pg_temp.eb_obs('n1-after-append')->'response'->'entry'->>'version', '2',
  'EB draft read versions after a committed append: the entry version is 2, the version of the append that committed'
);
select is(
  (pg_temp.eb_obs('n1-after-append')->'response'->'revision'->>'id')
    || ':' || (pg_temp.eb_obs('n1-after-append')->'response'->'revision'->>'version'),
  (select (revision_row.id::text || ':' || revision_row.version::text)
     from platform_private.cms_entry_revisions revision_row
    where revision_row.id = (select (response->>'id')::uuid from eb_append_result)),
  'EB draft read versions after a committed append: revision addresses the new current draft with its stored version'
);
select is(
  pg_temp.eb_obs('n1-after-append')->'response'->>'revisionNumber', '2',
  'EB draft read versions after a committed append: the revision number is the server-derived 2'
);

select * from finish();
rollback;
