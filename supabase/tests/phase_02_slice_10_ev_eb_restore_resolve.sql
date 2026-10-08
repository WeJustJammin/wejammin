-- Slice 10 evidence lane EB: CMS-03B-04 restore and CMS-03B-02 resolve under authority loss, archive, absence and
-- concealment, plus the immutability of the restore-chain manifest.
--
--   * Immutable manifest (AC-056): the restore-chain manifest a restore wrote can be neither updated nor deleted.
--   * Revocation (AC-057, AC-054): a restore or a resolve by an actor whose entry assignment was revoked, whose
--     tenure ended or whose cms grant was revoked is refused and writes nothing (an open conflict stays open).
--   * Deletion (AC-057): a restore of an archived entry is a typed transition refusal; an absent entry is the
--     concealed NOT_FOUND.
--   * Concealment (AC-054): a tenant-invisible actor resolving a known conflict gets the same minimal NOT_FOUND as
--     an absent conflict id.
--
-- Probes run through the named worker-facing RPC (platform_api.*) in rolled-back subtransactions; a refusal is
-- checked against a fingerprint of every table a command could touch (conflict states included).

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_restore_transform/000-restore-fixtures.sqlinc
\ir phase_02_slice_10_rpc/009-restore-policy-binding.sqlinc
\ir phase_02_slice_10_ev_eb/000-helpers.sqlinc

-- ---------------------------------------------------------------------------------------
-- Authority-loss seams (the committed shape of each revocation).
-- ---------------------------------------------------------------------------------------
create or replace function pg_temp.eb_revoke_assignment(p_entry uuid, p_person_key text)
returns void
language plpgsql
as $body$
begin
  perform set_config('app.cms_rpc', 'true', true);
  update platform_private.cms_entry_assignments
     set state = 'revoked', version = version + 1
   where entry_id = p_entry
     and assignee_person_id = (select value::uuid from s10_ids where key = p_person_key);
end;
$body$;

create or replace function pg_temp.eb_end_tenure(p_person_key text)
returns void
language plpgsql
as $body$
begin
  update identity_private.membership_tenure
     set state = 'ended', revoked_at = clock_timestamp(), updated_at = clock_timestamp()
   where organization_id = (select value::uuid from s10_ids where key = 'organization')
     and person_id = (select value::uuid from s10_ids where key = p_person_key);
end;
$body$;

create or replace function pg_temp.eb_revoke_grants(p_person_key text)
returns void
language plpgsql
as $body$
begin
  update identity_private.organization_actor_grant
     set active = false
   where organization_id = (select value::uuid from s10_ids where key = 'organization')
     and person_id = (select value::uuid from s10_ids where key = p_person_key)
     and capability_code in ('cms.author', 'cms.editor');
end;
$body$;

-- ---------------------------------------------------------------------------------------
-- R. Restore (CMS-03B-04): control, immutable manifest, revocation, archive, absence.
-- ---------------------------------------------------------------------------------------
create or replace function pg_temp.eb_forge_sql()
returns text
language sql
stable
as $body$
  select $sql$select pg_temp.s10r_forge(jsonb_build_object('a9100000-0000-4000-8000-000000000601', 'Source title'))$sql$
$body$;

create or replace function pg_temp.eb_restore_sql(p_key text, p_slot integer default 0, p_version bigint default null)
returns text
language sql
stable
as $body$
  -- The request is built when the statement RUNS (after the probe forged the source), not when this text is built.
  select format('select platform_api.cms_restore_revision(pg_temp.s10r_request(%L, %s, null, %s))',
    p_key, p_slot, coalesce(p_version::text, 'null::bigint'))
$body$;

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization'));

select pg_temp.eb_probe('eb-restore-control', pg_temp.eb_forge_sql(), pg_temp.eb_restore_sql('eb-restore-control-0001'));
select is(
  pg_temp.eb_obs('eb-restore-control')->>'state', '00000',
  'EB restore control: the assigned creator restores the forged source onto the active schema'
);

-- The manifest a restore wrote is immutable: the restore commits it, then no UPDATE or DELETE may touch it.
select pg_temp.eb_probe(
  'eb-manifest-written', pg_temp.eb_forge_sql() || '; ' || pg_temp.eb_restore_sql('eb-restore-manifest-0001'),
  $sql$select jsonb_build_object('manifests', (select count(*) from platform_private.cms_restore_chain_manifests))$sql$);
select is(
  pg_temp.eb_obs('eb-manifest-written')->'response'->>'manifests', '1',
  'EB restore manifest fixture: the restore wrote exactly one chain manifest row'
);
select pg_temp.eb_probe(
  'eb-manifest-update', pg_temp.eb_forge_sql() || '; ' || pg_temp.eb_restore_sql('eb-restore-manifest-0002') || '; select set_config(''app.cms_rpc'', ''true'', true)',
  $sql$select pg_temp.eb_exec('update platform_private.cms_restore_chain_manifests set plan_ids = plan_ids')$sql$);
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-manifest-update')), 'P0001|IMMUTABLE_RECORD|-|-',
  'EB restore manifest immutability: an UPDATE of a committed chain manifest row is refused even inside the CMS RPC context'
);
select is(
  pg_temp.eb_obs('eb-manifest-update')->>'after', pg_temp.eb_obs('eb-manifest-update')->>'before',
  'EB restore manifest immutability: the refused UPDATE changed nothing'
);
select pg_temp.eb_probe(
  'eb-manifest-delete', pg_temp.eb_forge_sql() || '; ' || pg_temp.eb_restore_sql('eb-restore-manifest-0003') || '; select set_config(''app.cms_rpc'', ''true'', true)',
  $sql$select pg_temp.eb_exec('delete from platform_private.cms_restore_chain_manifests')$sql$);
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-manifest-delete')), 'P0001|IMMUTABLE_RECORD|-|-',
  'EB restore manifest immutability: a DELETE of a committed chain manifest row is refused even inside the CMS RPC context'
);
select is(
  pg_temp.eb_obs('eb-manifest-delete')->>'after', pg_temp.eb_obs('eb-manifest-delete')->>'before',
  'EB restore manifest immutability: the refused DELETE changed nothing'
);

-- Revocation of each authority source: refused, nothing written.
select pg_temp.eb_probe(
  'eb-restore-assignment-revoked',
  pg_temp.eb_forge_sql() || '; select pg_temp.eb_revoke_assignment(pg_temp.s10r_id(0, 1), ''creatorPerson'')',
  pg_temp.eb_restore_sql('eb-restore-revoked-assignment-0001'));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-restore-assignment-revoked')), 'P0001|FORBIDDEN|-|-',
  'EB restore revocation: an actor whose entry assignment was revoked is refused FORBIDDEN'
);
select is(
  pg_temp.eb_obs('eb-restore-assignment-revoked')->>'after', pg_temp.eb_obs('eb-restore-assignment-revoked')->>'before',
  'EB restore revocation: the revoked-assignment restore wrote no revision, value, reservation, manifest, audit or outbox row'
);
select pg_temp.eb_probe(
  'eb-restore-grant-revoked',
  pg_temp.eb_forge_sql() || '; select pg_temp.eb_revoke_grants(''creatorPerson'')',
  pg_temp.eb_restore_sql('eb-restore-revoked-grant-0001'));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-restore-grant-revoked')), 'P0001|FORBIDDEN|-|-',
  'EB restore revocation: an actor whose cms grants were revoked is refused FORBIDDEN'
);
select is(
  pg_temp.eb_obs('eb-restore-grant-revoked')->>'after', pg_temp.eb_obs('eb-restore-grant-revoked')->>'before',
  'EB restore revocation: the revoked-grant restore wrote nothing'
);
select pg_temp.eb_probe(
  'eb-restore-tenure-ended',
  pg_temp.eb_forge_sql() || '; select pg_temp.eb_end_tenure(''creatorPerson'')',
  pg_temp.eb_restore_sql('eb-restore-ended-tenure-0001'));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-restore-tenure-ended')), 'P0001|NOT_FOUND|-|-',
  'EB restore revocation: an actor whose organization tenure ended no longer sees the entry (concealed NOT_FOUND)'
);
select is(
  pg_temp.eb_obs('eb-restore-tenure-ended')->>'after', pg_temp.eb_obs('eb-restore-tenure-ended')->>'before',
  'EB restore revocation: the ended-tenure restore wrote nothing'
);

-- Deletion: an archived entry and an absent entry.
create or replace function pg_temp.eb_archive_entry(p_entry uuid)
returns void
language plpgsql
as $body$
begin
  perform set_config('app.cms_rpc', 'true', true);
  set local session_replication_role = replica;
  update platform_private.cms_content_entries set lifecycle = 'archived' where id = p_entry;
  set local session_replication_role = origin;
end;
$body$;
select pg_temp.eb_probe(
  'eb-restore-archived',
  pg_temp.eb_forge_sql() || '; select pg_temp.eb_archive_entry(pg_temp.s10r_id(0, 1))',
  pg_temp.eb_restore_sql('eb-restore-archived-0001'));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-restore-archived')), 'P0001|INVALID_TRANSITION|-|-',
  'EB restore deletion: restoring a revision of an archived entry is the typed INVALID_TRANSITION refusal'
);
select is(
  pg_temp.eb_obs('eb-restore-archived')->>'after', pg_temp.eb_obs('eb-restore-archived')->>'before',
  'EB restore deletion: the archived-entry refusal wrote nothing'
);
select pg_temp.eb_probe(
  'eb-restore-absent', null,
  pg_temp.eb_restore_sql('eb-restore-absent-0001', 5, 1));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-restore-absent')), 'P0001|NOT_FOUND|-|-',
  'EB restore deletion: restoring on an entry that does not exist is the concealed NOT_FOUND'
);
select is(
  pg_temp.eb_obs('eb-restore-absent')->>'after', pg_temp.eb_obs('eb-restore-absent')->>'before',
  'EB restore deletion: the absent-entry refusal wrote nothing'
);

-- ---------------------------------------------------------------------------------------
-- S. Resolve (CMS-03B-02): a genuinely committed open conflict, then authority loss and concealment.
-- ---------------------------------------------------------------------------------------
select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization'));
select pg_temp.s10_rpc_probe_persist('eb-resolve-append-a', null, pg_temp.eb_append_sql('eb-resolve-append-a-0001'));
select pg_temp.s10_rpc_probe_persist(
  'eb-resolve-append-b', null,
  pg_temp.eb_append_sql('eb-resolve-append-b-0001', jsonb_build_object(
    'expectedVersion', '2', 'ifMatch', '2',
    'values', jsonb_build_object((select value from s10_ids where key = 'typeFieldId'), 'EB concurrent title from the old base'))));
select is(
  pg_temp.s10_probe_response('eb-resolve-append-b')->>'kind', 'conflict',
  'EB resolve fixture: a same-field save from the old base commits one open conflict through the named RPC'
);

create or replace function pg_temp.eb_resolve_sql(p_key text, p_patch jsonb default '{}'::jsonb)
returns text
language sql
stable
as $body$
  select format('select platform_api.cms_resolve_conflict(%L::jsonb)', (select jsonb_build_object(
    'entryId', conflict.entry_id,
    'conflictId', conflict.id,
    'baseRevision', '1',
    'choices', jsonb_build_array(jsonb_build_object('path', conflict.changed_paths->>0, 'choice', 'theirs')),
    'expectedVersion', '2',
    'ifMatch', '2',
    'idempotencyKey', p_key,
    'context', pg_temp.eb_context()) || p_patch
    from platform_private.cms_conflict_records conflict
   where conflict.entry_id = (select value::uuid from s10_ids where key = 'entryId') and conflict.state = 'open')::text)
$body$;

select pg_temp.eb_probe('eb-resolve-control', null, pg_temp.eb_resolve_sql('eb-resolve-control-0001'));
select is(
  pg_temp.eb_obs('eb-resolve-control')->>'state', '00000',
  'EB resolve control: the assigned creator resolves the open conflict with an explicit choice'
);
select pg_temp.eb_probe(
  'eb-resolve-assignment-revoked',
  'select pg_temp.eb_revoke_assignment((select value::uuid from s10_ids where key = ''entryId''), ''creatorPerson'')',
  pg_temp.eb_resolve_sql('eb-resolve-revoked-assignment-0001'));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-resolve-assignment-revoked')), 'P0001|FORBIDDEN|-|-',
  'EB resolve revocation: a resolver whose entry assignment was revoked is refused FORBIDDEN'
);
select is(
  pg_temp.eb_obs('eb-resolve-assignment-revoked')->>'after', pg_temp.eb_obs('eb-resolve-assignment-revoked')->>'before',
  'EB resolve revocation: the revoked-assignment resolve appended no revision and left the conflict open'
);
select pg_temp.eb_probe(
  'eb-resolve-grant-revoked', 'select pg_temp.eb_revoke_grants(''creatorPerson'')',
  pg_temp.eb_resolve_sql('eb-resolve-revoked-grant-0001'));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-resolve-grant-revoked')), 'P0001|FORBIDDEN|-|-',
  'EB resolve revocation: a resolver whose cms grants were revoked is refused FORBIDDEN'
);
select is(
  pg_temp.eb_obs('eb-resolve-grant-revoked')->>'after', pg_temp.eb_obs('eb-resolve-grant-revoked')->>'before',
  'EB resolve revocation: the revoked-grant resolve wrote nothing and left the conflict open'
);
select pg_temp.eb_probe(
  'eb-resolve-tenure-ended', 'select pg_temp.eb_end_tenure(''creatorPerson'')',
  pg_temp.eb_resolve_sql('eb-resolve-ended-tenure-0001'));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-resolve-tenure-ended')), 'P0001|NOT_FOUND|-|-',
  'EB resolve revocation: a resolver whose organization tenure ended is concealed from the entry (NOT_FOUND)'
);
select is(
  pg_temp.eb_obs('eb-resolve-tenure-ended')->>'after', pg_temp.eb_obs('eb-resolve-tenure-ended')->>'before',
  'EB resolve revocation: the ended-tenure resolve wrote nothing and left the conflict open'
);

-- Concealment: a tenant-invisible actor and an absent conflict id are one indistinguishable refusal.
select pg_temp.eb_probe('eb-resolve-stranger', pg_temp.eb_as_sql('strangerAuth'), pg_temp.eb_resolve_sql('eb-resolve-stranger-0001'));
select pg_temp.eb_probe(
  'eb-resolve-absent-conflict', null,
  pg_temp.eb_resolve_sql('eb-resolve-absent-0001', jsonb_build_object('conflictId', 'a9100000-0000-4000-8000-0000000009c1')));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-resolve-stranger')), 'P0001|NOT_FOUND|-|-',
  'EB resolve concealment: a tenant-invisible actor resolving a known conflict is refused with the minimal NOT_FOUND'
);
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-resolve-stranger')), pg_temp.eb_shape(pg_temp.eb_obs('eb-resolve-absent-conflict')),
  'EB resolve concealment: the tenant-invisible refusal is identical to the absent-conflict refusal in SQLSTATE, token, detail and hint'
);
select is(
  pg_temp.eb_obs('eb-resolve-stranger')->>'after', pg_temp.eb_obs('eb-resolve-stranger')->>'before',
  'EB resolve concealment: the tenant-invisible resolve wrote nothing and left the conflict open'
);

select * from finish();
rollback;
