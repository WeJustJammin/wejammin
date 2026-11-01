-- Slice 11 shared helper: platform_private.cms_acting_context_version
-- (BE03b "Preview token and verification (CMS-03B-08, CMS-03B-19)": the
-- capability snapshot hash; tracker P2-S11-AC-118).  RED before
-- 20261005017500, GREEN after.
--
-- cms_acting_context_version(person, acting_party) is the lowercase SHA-256 of
-- the JCS { actingPartyId, capabilities, personId } where capabilities is the
-- bytewise-sorted list of the person's active cms.* capability keys in the
-- acting party.  The expected values below are rebuilt here from literal JSON
-- text, never through the production hash function.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(27);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc

-- Literal JCS oracle: keys in bytewise order (actingPartyId, capabilities,
-- personId), no whitespace, capabilities in the order supplied.
create or replace function pg_temp.h11_ctx_expected(
  p_party uuid, p_person uuid, p_caps text[]
)
returns text
language sql
immutable
as $body$
  select pg_temp.h11_sha256(
    '{"actingPartyId":'
    || case when p_party is null then 'null' else '"' || p_party::text || '"' end
    || ',"capabilities":['
    || coalesce((select string_agg('"' || c || '"', ',' order by ord) from unnest(p_caps) with ordinality as t(c, ord)), '')
    || '],"personId":"' || p_person::text || '"}'
  )
$body$;

create temp table h11_ids(key text primary key, value text not null) on commit drop;
insert into h11_ids(key, value)
select 'org', value from s10_ids where key = 'organization'
union all select 'creator', value from s10_ids where key = 'creatorPerson'
union all select 'editor', value from s10_ids where key = 'editorPerson'
union all select 'outsider', value from s10_ids where key = 'outsiderPerson'
union all select 'stranger', value from s10_ids where key = 'strangerPerson';

create or replace function pg_temp.h11_id(p_key text)
returns uuid language sql stable as $body$
  select value::uuid from h11_ids where key = p_key
$body$;

create or replace function pg_temp.h11_ctx(p_person text, p_party text)
returns text
language sql
as $body$
  select pg_temp.h11_text(format(
    'select platform_private.cms_acting_context_version(%L::uuid, %L::uuid)',
    case when p_person is null then null else pg_temp.h11_id(p_person)::text end,
    case when p_party is null then null else pg_temp.h11_id(p_party)::text end
  ))
$body$;

-- ---------------------------------------------------------------------------
-- Shape, privileges.
-- ---------------------------------------------------------------------------
select ok(
  pg_temp.h11_private_definer('cms_acting_context_version(uuid, uuid)'),
  'cms_acting_context_version is a private SECURITY DEFINER function of the CMS definer with an empty search_path and no API-role execute [P2-S11-AC-118]'
);

select is(
  pg_temp.h11_rettype('cms_acting_context_version(uuid, uuid)'), 'text',
  'cms_acting_context_version returns text [P2-S11-AC-118]'
);

select is(
  pg_temp.h11_volatility('cms_acting_context_version(uuid, uuid)'), 's',
  'cms_acting_context_version is STABLE (a pure read of committed authority) [P2-S11-AC-118]'
);

-- ---------------------------------------------------------------------------
-- Capability snapshot values.
-- ---------------------------------------------------------------------------
select is(
  pg_temp.h11_ctx('creator', 'org'),
  pg_temp.h11_ctx_expected(
    pg_temp.h11_id('org'), pg_temp.h11_id('creator'),
    array['cms.author', 'cms.editor', 'cms.schema_designer']
  ),
  'the creator hash is the SHA-256 of the literal JCS with the three sorted cms.* keys [P2-S11-AC-118]'
);

select is(
  pg_temp.h11_ctx('editor', 'org'),
  pg_temp.h11_ctx_expected(
    pg_temp.h11_id('org'), pg_temp.h11_id('editor'), array['cms.editor']
  ),
  'the editor hash covers exactly cms.editor [P2-S11-AC-118]'
);

select is(
  pg_temp.h11_ctx('outsider', 'org'),
  pg_temp.h11_ctx_expected(
    pg_temp.h11_id('org'), pg_temp.h11_id('outsider'), array[]::text[]
  ),
  'a confirmed member with no CMS grant hashes the empty capability list [P2-S11-AC-118]'
);

select is(
  pg_temp.h11_ctx('stranger', 'org'),
  pg_temp.h11_ctx_expected(
    pg_temp.h11_id('org'), pg_temp.h11_id('stranger'), array[]::text[]
  ),
  'a person with no tenure in the acting party hashes the empty capability list [P2-S11-AC-118]'
);

select is(
  pg_temp.h11_ctx('creator', null),
  pg_temp.h11_ctx_expected(
    null, pg_temp.h11_id('creator'), array[]::text[]
  ),
  'a null acting party hashes actingPartyId null with no capabilities [P2-S11-AC-118]'
);

select ok(
  pg_temp.h11_ctx('creator', 'org') ~ '^[a-f0-9]{64}$'
    and pg_temp.h11_ctx('creator', 'org') = pg_temp.h11_ctx('creator', 'org'),
  'the value is lowercase 64-hex and deterministic [P2-S11-AC-118]'
);

select ok(
  pg_temp.h11_ctx('creator', 'org') <> pg_temp.h11_ctx('editor', 'org')
    and pg_temp.h11_ctx('editor', 'org') <> pg_temp.h11_ctx('outsider', 'org')
    and pg_temp.h11_ctx('creator', 'org') <> pg_temp.h11_ctx('creator', null),
  'different persons, capability sets and acting parties yield different versions [P2-S11-AC-118]'
);

-- ---------------------------------------------------------------------------
-- Negative controls: only ACTIVE, in-window cms.* grants of a CONFIRMED,
-- in-window tenure count.  Each probe changes one row of the editor and shows
-- the hash move to the empty-capability value, then restores it.
-- ---------------------------------------------------------------------------
select set_config('app.cms_rpc', 'true', true);

update identity_private.organization_actor_grant
   set active = false
 where organization_id = pg_temp.h11_id('org')
   and person_id = pg_temp.h11_id('editor') and capability_code = 'cms.editor';
select is(
  pg_temp.h11_ctx('editor', 'org'),
  pg_temp.h11_ctx_expected(pg_temp.h11_id('org'), pg_temp.h11_id('editor'), array[]::text[]),
  'a deactivated grant leaves the capability set [P2-S11-AC-118]'
);
update identity_private.organization_actor_grant
   set active = true
 where organization_id = pg_temp.h11_id('org')
   and person_id = pg_temp.h11_id('editor') and capability_code = 'cms.editor';

update identity_private.organization_actor_grant
   set valid_from = current_date - 3, valid_through = current_date - 1
 where organization_id = pg_temp.h11_id('org')
   and person_id = pg_temp.h11_id('editor') and capability_code = 'cms.editor';
select is(
  pg_temp.h11_ctx('editor', 'org'),
  pg_temp.h11_ctx_expected(pg_temp.h11_id('org'), pg_temp.h11_id('editor'), array[]::text[]),
  'a grant whose valid_through day has passed leaves the capability set [P2-S11-AC-118]'
);

update identity_private.organization_actor_grant
   set valid_from = current_date + 1, valid_through = current_date + 2
 where organization_id = pg_temp.h11_id('org')
   and person_id = pg_temp.h11_id('editor') and capability_code = 'cms.editor';
select is(
  pg_temp.h11_ctx('editor', 'org'),
  pg_temp.h11_ctx_expected(pg_temp.h11_id('org'), pg_temp.h11_id('editor'), array[]::text[]),
  'a grant that has not started is not in the capability set [P2-S11-AC-118]'
);

update identity_private.organization_actor_grant
   set valid_from = current_date, valid_through = null
 where organization_id = pg_temp.h11_id('org')
   and person_id = pg_temp.h11_id('editor') and capability_code = 'cms.editor';
select is(
  pg_temp.h11_ctx('editor', 'org'),
  pg_temp.h11_ctx_expected(pg_temp.h11_id('org'), pg_temp.h11_id('editor'), array['cms.editor']),
  'control: an open-ended grant that started today is in the capability set [P2-S11-AC-118]'
);

insert into identity_private.organization_actor_grant(
  organization_id, person_id, capability_code, valid_from, valid_through, active
) values
  (pg_temp.h11_id('org'), pg_temp.h11_id('editor'), 'billing.admin', current_date, null, true),
  (pg_temp.h11_id('org'), pg_temp.h11_id('editor'), 'cmsx.editor', current_date, null, true),
  (pg_temp.h11_id('org'), pg_temp.h11_id('editor'), 'cms-editor', current_date, null, true);
select is(
  pg_temp.h11_ctx('editor', 'org'),
  pg_temp.h11_ctx_expected(pg_temp.h11_id('org'), pg_temp.h11_id('editor'), array['cms.editor']),
  'grants outside the cms.* namespace (billing.admin, cmsx.editor, cms-editor) are never part of the snapshot [P2-S11-AC-118]'
);

insert into identity_private.organization_actor_grant(
  organization_id, person_id, capability_code, valid_from, valid_through, active
) values (pg_temp.h11_id('org'), pg_temp.h11_id('editor'), 'cms.publisher', current_date, null, true);
select is(
  pg_temp.h11_ctx('editor', 'org'),
  pg_temp.h11_ctx_expected(
    pg_temp.h11_id('org'), pg_temp.h11_id('editor'), array['cms.editor', 'cms.publisher']
  ),
  'a newly granted cms.publisher joins the sorted snapshot and the version moves [P2-S11-AC-118]'
);

update identity_private.membership_tenure
   set state = 'ended', revoked_at = clock_timestamp(), ends_on = current_date + 1
 where organization_id = pg_temp.h11_id('org') and person_id = pg_temp.h11_id('editor');
select is(
  pg_temp.h11_ctx('editor', 'org'),
  pg_temp.h11_ctx_expected(pg_temp.h11_id('org'), pg_temp.h11_id('editor'), array[]::text[]),
  'an ended tenure removes every capability: grants alone do not make a snapshot [P2-S11-AC-118]'
);

-- ---------------------------------------------------------------------------
-- Argument discipline.
-- ---------------------------------------------------------------------------
select is(
  pg_temp.h11_outcome('select platform_private.cms_acting_context_version(null, null)'),
  'P0001:INVALID_REQUEST',
  'a null person is a malformed helper call (INVALID_REQUEST) [P2-S11-AC-118]'
);

select is(
  pg_temp.h11_ctx('creator', 'org'),
  pg_temp.h11_ctx_expected(
    pg_temp.h11_id('org'), pg_temp.h11_id('creator'),
    array['cms.author', 'cms.editor', 'cms.schema_designer']
  ),
  'control: the creator snapshot is unaffected by the editor probes [P2-S11-AC-118]'
);

-- Sorting is bytewise (C collation), not locale collation: '.' (0x2E) sorts
-- before '_' (0x5F) and an uppercase-free registry keeps the oracle literal.
insert into identity_private.organization_actor_grant(
  organization_id, person_id, capability_code, valid_from, valid_through, active
) values
  (pg_temp.h11_id('org'), pg_temp.h11_id('outsider'), 'cms.a_b', current_date, null, true),
  (pg_temp.h11_id('org'), pg_temp.h11_id('outsider'), 'cms.a.b', current_date, null, true),
  (pg_temp.h11_id('org'), pg_temp.h11_id('outsider'), 'cms.a-b', current_date, null, true);
select is(
  pg_temp.h11_ctx('outsider', 'org'),
  pg_temp.h11_ctx_expected(
    pg_temp.h11_id('org'), pg_temp.h11_id('outsider'),
    array['cms.a-b', 'cms.a.b', 'cms.a_b']
  ),
  'capabilities sort bytewise ascending (- before . before _) [P2-S11-AC-118]'
);

select is(
  (select count(*)::integer from pg_catalog.pg_proc p
    where p.oid = to_regprocedure('platform_private.cms_acting_context_version(uuid, uuid)')
      and p.provolatile = 's'),
  1,
  'exactly one cms_acting_context_version(uuid, uuid) overload exists [P2-S11-AC-118]'
);

select ok(
  not has_function_privilege('anon', to_regprocedure('platform_private.cms_acting_context_version(uuid, uuid)'), 'execute')
    and not has_function_privilege('authenticated', to_regprocedure('platform_private.cms_acting_context_version(uuid, uuid)'), 'execute')
    and not has_function_privilege('service_role', to_regprocedure('platform_private.cms_acting_context_version(uuid, uuid)'), 'execute'),
  'no API role may execute the helper directly (a preview wrapper is the only caller) [P2-S11-AC-118]'
);

select is(
  pg_temp.h11_ctx('creator', 'org') = pg_temp.h11_ctx_expected(
    pg_temp.h11_id('org'), pg_temp.h11_id('creator'),
    array['cms.schema_designer', 'cms.editor', 'cms.author']
  ),
  false,
  'negative control: the oracle is order-sensitive, so a wrongly ordered capability list would not match [P2-S11-AC-118]'
);

select * from finish();
rollback;
