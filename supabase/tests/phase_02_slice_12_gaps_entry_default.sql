-- Slice 12 gap lane claude_s12_gaps_db2: DEC-202 initial-revision default template (BE03b CMS-03B-10; P2-S12-AC-286, AC-287, AC-295
-- clause 0).  Real producers throughout: real owner grants, real active compiled content types and successors (the 03a chain), real
-- governed templates (CMS-03C-01 / -06 / -07 / -08 / -09), and the real public platform_api.cms_create_entry through the same driver
-- as phase_02_slice_12_entry_default_template.sql (005-edt-driver.sqlinc is a verbatim copy of its s12edt_* functions).
--   gx  no default, bindings [T2]                   -> a first revision pins NULL: neither a binding, nor another compatible active
--                                                      template, nor a newer template version of a compatible lineage is a fallback
--   gy  default T1b, first binding T2               -> a first revision pins the default T1b, never the first binding T2
--   gz  v2 default T1b                              -> a first revision pins T1b; no later writer reads the type default
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_12_governed_submit/000-fixtures.sqlinc
\ir phase_02_slice_12_governed_assignment/000-world.sqlinc
\ir phase_02_slice_12_governed_activation/000-world.sqlinc

select is(pg_temp.s09d_grant_via_rpc('owner', 'cms.template_designer'), 'OK', 'setup: real owner template-designer grant [P2-S12-AC-286]');
select is(pg_temp.s09d_grant_via_rpc('owner', 'cms.author'), 'OK', 'setup: real owner entry-author grant [P2-S12-AC-286]');
select pg_temp.s09d_create_type('gx-base', 'gapxbase');
select pg_temp.s09d_to_active('gx-base');
select pg_temp.s09d_create_type('gy-base', 'gapybase');
select pg_temp.s09d_to_active('gy-base', array['rev2']);
select pg_temp.s09d_create_type('gz-base', 'gapzbase');
select pg_temp.s09d_to_active('gz-base', array['rev2']);
select ok(pg_temp.s09d_outcome('gx-base:activate') = 'OK' and pg_temp.s09d_outcome('gy-base:activate') = 'OK' and pg_temp.s09d_outcome('gz-base:activate') = 'OK',
  'setup: three real active compiled content types without any template default [P2-S12-AC-286]');
select is(pg_temp.s12ga_grant('rev1', 'cms.reviewer'), 'OK', 'setup: independent template-reviewer grant [P2-S12-AC-286]');
update s09d_actor set party_id = pg_temp.s09d_id('ownerOrg') where key = 'rev1';
insert into s12gov_ids values ('gx', pg_temp.s09d_id('gx-base:type')::text), ('gy', pg_temp.s09d_id('gy-base:type')::text),
  ('gz', pg_temp.s09d_id('gz-base:type')::text), ('typeA', pg_temp.s09d_id('gx-base:type')::text);

-- T1 (and its newer version T1b) and T2: governed templates compatible with all three types, activated.
select pg_temp.s12gb_approved('gapt1', array['gx', 'gy', 'gz']);
select pg_temp.s12gb_act('gapt1-act', 'owner', pg_temp.s12ga_review('gapt1'), 'activate');
select pg_temp.s12gb_approved('gapt2', array['gx', 'gy', 'gz']);
select pg_temp.s12gb_act('gapt2-act', 'owner', pg_temp.s12ga_review('gapt2'), 'activate');
select pg_temp.s12gb_successor('gapt1b', 'gapt1', array['gx', 'gy', 'gz']);
select pg_temp.s12gb_approve('gapt1b');
select pg_temp.s12gb_act('gapt1b-act', 'owner', pg_temp.s12ga_review('gapt1b'), 'activate');
select ok(pg_temp.s12ga_out('gapt1-act') = 'ok' and pg_temp.s12ga_out('gapt2-act') = 'ok' and pg_temp.s12ga_out('gapt1b-act') = 'ok'
    and (select state = 'superseded' from platform_private.cms_template_versions where id = pg_temp.s12ga_subject('gapt1'))
    and (select state = 'active' and version = 2 from platform_private.cms_template_versions where id = pg_temp.s12ga_subject('gapt1b'))
    and (select state = 'active' from platform_private.cms_template_versions where id = pg_temp.s12ga_subject('gapt2')),
  'setup: T2 is active, T1 is superseded by its newer active version T1b of the same lineage [P2-S12-AC-287]');

-- gx stays its own v1: NO default and NO bindings, while T2 (another compatible active template) and T1b (a newer version of T1) exist.
-- A no-default type with a NONEMPTY bindings list is not constructible: the successor request pairs defaultTemplateVersionId and
-- templateBindings (both null or both present, 20261002216000), and a type cannot name a template at creation (DEC-123).
-- gy: default T1b, first binding T2
select pg_temp.s09d_successor('gy-bound', 'gy-base', p_default_template => pg_temp.s12ga_subject('gapt1b'),
  p_bindings => jsonb_build_array(jsonb_build_object('templateVersionId', pg_temp.s12ga_subject('gapt2'))));
select pg_temp.s09d_to_active('gy-bound', array['rev3']);
-- gz: v2 default T1b
select pg_temp.s09d_successor('gz-v2', 'gz-base', p_default_template => pg_temp.s12ga_subject('gapt1b'), p_bindings => '[]'::jsonb);
select pg_temp.s09d_to_active('gz-v2', array['rev3']);
select ok(pg_temp.s09d_outcome('gy-bound:successor') = 'OK' and pg_temp.s09d_outcome('gy-bound:activate') = 'OK'
    and pg_temp.s09d_outcome('gz-v2:successor') = 'OK' and pg_temp.s09d_outcome('gz-v2:activate') = 'OK',
  'setup: the two successors (gy default plus binding, gz default T1b) are really created and activated [P2-S12-AC-287]');
select ok((select v.state = 'active' and v.default_template_version_id is null
        and (select count(*) from platform_private.cms_content_type_template_bindings b where b.content_type_version_id = v.id) = 0
        and exists (select 1 from platform_private.cms_template_versions t where t.id in (pg_temp.s12ga_subject('gapt2'), pg_temp.s12ga_subject('gapt1b'))
            and t.state = 'active' and t.compatible_type_ids @> jsonb_build_array(v.content_type_id))
      from platform_private.cms_content_type_versions v where v.id = pg_temp.s09d_id('gx-base:version')),
  'fixture: gx-base is a real active type with NO default and no binding, beside the compatible active templates T2 and T1b [P2-S12-AC-287]');
select ok((select v.state = 'active' and v.default_template_version_id = pg_temp.s12ga_subject('gapt1b')
        and (select b.template_version_id from platform_private.cms_content_type_template_bindings b where b.content_type_version_id = v.id)
            = pg_temp.s12ga_subject('gapt2')
      from platform_private.cms_content_type_versions v where v.id = pg_temp.s09d_id('gy-bound:version')),
  'fixture: gy-bound defaults to T1b while its first (only) binding is the different template T2 [P2-S12-AC-286]');

\ir phase_02_slice_12_gaps_entry/005-edt-driver.sqlinc

-- AC-287: a type with bindings, another compatible active template and a newer template version still pins NULL
select * from pg_temp.s12edt_check('gx-base', 'NO DEFAULT FIRST', null::uuid, null::jsonb);
select ok((select r.template_version_id is null from platform_private.cms_entry_revisions r
      where r.id = (select (response->'revision'->>'id')::uuid from s12edt_out where label = 'gx-base')),
  'a no-default type with another compatible active template (T2) and a newer template version (T1b) of a compatible lineage pins a NULL template on the first revision: neither is a fallback [P2-S12-AC-287]');
-- AC-286 clause 3: the default wins over the first binding
select * from pg_temp.s12edt_check('gy-bound', 'DEFAULT NOT FIRST BINDING', pg_temp.s12ga_subject('gapt1b'), '[]'::jsonb);
select ok((select r.template_version_id = pg_temp.s12ga_subject('gapt1b') and r.template_version_id is distinct from pg_temp.s12ga_subject('gapt2')
      from platform_private.cms_entry_revisions r where r.id = (select (response->'revision'->>'id')::uuid from s12edt_out where label = 'gy-bound')),
  'the first revision pins the stored default T1b and never the first binding T2 [P2-S12-AC-286]');

-- AC-295 (clause 0 and 2): the default is read ONCE, by the entry-create producer, and pinned on the first revision; no later writer
-- initializes or rebinds a pin from the type's current default.  A default change needs a successor schema version, and the
-- successor migration of a type that already holds entries needs the Worker's per-row evidence flow (not built here), so the
-- end-to-end "entry created before the change still pins the old default" is not driven; it is proven structurally: the first revision of
-- gz-v2 pins the default T1b above, and the stored sources of every other revision writer name no default at all.
select * from pg_temp.s12edt_check('gz-v2', 'UNDER DEFAULT T1B', pg_temp.s12ga_subject('gapt1b'), '[]'::jsonb);
select ok((select r.template_version_id = pg_temp.s12ga_subject('gapt1b') from platform_private.cms_entry_revisions r
      where r.id = (select (response->'revision'->>'id')::uuid from s12edt_out where label = 'gz-v2')),
  'the first revision created under default T1b pins T1b [P2-S12-AC-295]');
select is((select array_agg(p.proname order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'platform_private'
        and p.proname in ('cms_create_revision', 'cms_resolve_conflict', 'cms_restore_revision', 'cms_author_locale_variant',
                          'cms_revision_composition_carry', 'cms_restore_composition_plan', 'cms_restore_composition_copy')
        and p.prosrc ~* 'default_template_version_id'),
  null::name[],
  'revision append, conflict resolution, restore and locale-variant carry never read the type default: no historical pin is initialized or rebound from it [P2-S12-AC-295]');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'platform_private'
        and p.proname in ('cms_create_revision', 'cms_resolve_conflict', 'cms_restore_revision', 'cms_author_locale_variant', 'cms_revision_composition_carry')),
  5, 'control: the five carry writers named above all exist, so the empty reference list is not an absence of the functions [P2-S12-AC-295]');
select ok((select p.prosrc ~* 'default_template_version_id' from pg_proc p where p.oid = 'platform_private.cms_create_entry(jsonb)'::regprocedure),
  'control: the entry-create producer is the writer that reads the stored default [P2-S12-AC-295]');

-- AC-292 clause 2: a completed idempotency key reused under another acting party or actor (scope) gains no replay authority.
-- gap-author is an alias of the existing real human rev2 (labelled actor selection, not a new identity) holding a real cms.author grant.
insert into s09d_actor(key, auth_user_id, person_id, party_id)
select 'gap-author', actor.auth_user_id, actor.person_id, pg_temp.s09d_id('ownerOrg') from s09d_actor actor where actor.key = 'rev2';
select is(pg_temp.s09d_grant_via_rpc('gap-author', 'cms.author'), 'OK', 'setup: the second actor holds a real cms.author grant [P2-S12-AC-292]');
select ok(pg_temp.s09d_try($sql$select pg_temp.s09d_bind_context('gap-author')$sql$), 'setup: the second actor selects the owner organization through identity_context_bind [P2-S12-AC-292]');
create temp table g2e_replay(label text primary key, state text, message text, response jsonb, idem_before jsonb, idem_after jsonb,
  entries_before bigint, entries_after bigint) on commit drop;
create function pg_temp.g2e_replay(p_label text, p_source text, p_actor text) returns void language plpgsql security invoker as $body$
declare
  request jsonb := (select r.request from s12edt_out r where r.label = p_source) || jsonb_build_object('context', pg_temp.s09d_context(p_actor, true));
  key_hash text := platform_private.cms_key_hash(request->>'idempotencyKey');
  idem_before jsonb; answer jsonb; code text := '00000'; msg text; prior_role text := current_setting('role');
  entries_before bigint := (select count(*) from platform_private.cms_content_entries);
begin
  select coalesce(jsonb_agg(to_jsonb(i) order by i.id), '[]'::jsonb) into idem_before
    from platform_private.idempotency_records i where i.key_hash = platform_private.cms_key_hash(request->>'idempotencyKey');
  perform pg_temp.s09d_session(p_actor, 'service_role');
  begin
    set local role service_role;
    begin
      answer := platform_api.cms_create_entry(request);
    exception when others then get stacked diagnostics code = returned_sqlstate, msg = message_text;
    end;
    perform set_config('role', prior_role, true);
  exception when others then perform set_config('role', prior_role, true); raise;
  end;
  insert into g2e_replay values (p_label, code, msg, answer, idem_before,
    (select coalesce(jsonb_agg(to_jsonb(i) order by i.id), '[]'::jsonb) from platform_private.idempotency_records i
      where i.key_hash = platform_private.cms_key_hash(request->>'idempotencyKey')),
    entries_before, (select count(*) from platform_private.cms_content_entries));
end;
$body$;
-- control: the SAME actor replaying the SAME key and body gets the stored response (the key is replayable in its own scope)
select pg_temp.g2e_replay('same-actor', 'gy-bound', 'owner');
select ok((select state = '00000' and response = (select o.response from s12edt_out o where o.label = 'gy-bound') and entries_after = entries_before from g2e_replay where label = 'same-actor'),
  'control: the owner replaying its completed key and body receives the stored response and creates nothing [P2-S12-AC-292]');
select pg_temp.g2e_replay('other-actor', 'gy-bound', 'gap-author');
select ok((select response is distinct from (select o.response from s12edt_out o where o.label = 'gy-bound') from g2e_replay where label = 'other-actor'),
  'the same completed key under another actor never returns the original response body [P2-S12-AC-292]');
select ok((select state = '00000' and response->'entry'->>'id' is distinct from (select o.response->'entry'->>'id' from s12edt_out o where o.label = 'gy-bound')
          and entries_after = entries_before + 1
      from g2e_replay where label = 'other-actor'),
  'the key is scoped to the actor: the other actor creates its own distinct entry (a scoped miss, one new entry) and never replays the original [P2-S12-AC-292]');
select ok((select jsonb_array_length(idem_before) = 1 and idem_after @> idem_before from g2e_replay where label = 'other-actor'),
  'the original owner receipt is byte-identical after the other actor reused its key: no change to the stored response or state [P2-S12-AC-292]');

-- AC-289 clause 1 (gate level): the DEC-202 gate answers an ABSENT stored default and a real template of ANOTHER owner with the identical
-- 404 (SQLSTATE, message, DETAIL) and writes nothing.  The public cms_create_entry cannot be driven to this branch with a stored default
-- that is absent or foreign (the schema compatibility guard and the template registry forbid the state, see the lane report BOUNDARY),
-- so the gate is called directly, the way phase_02_slice_12_entry_default_template/030-policy-gate does.  The foreign template is a
-- direct copy of a real template row under the second organization (labelled fixture).
select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_template_versions
select (jsonb_populate_record(null::platform_private.cms_template_versions, to_jsonb(t) || jsonb_build_object(
    'id', 'a1289000-0000-4000-8000-0000000000a1', 'owner_id', pg_temp.s09d_id('otherOrg'), 'template_key', 'gapt-foreign',
    'state', 'draft', 'version', 1, 'supersedes_id', null, 'template_id', null, 'lifecycle_version', 1, 'activated_at', null,
    'retired_at', null, 'updated_at', t.created_at))).*
  from platform_private.cms_template_versions t where t.id = pg_temp.s12ga_subject('gapt2');
select set_config('app.cms_rpc', '', true);
create temp table g2e_gate(label text primary key, code text, message text, detail text, before_rows jsonb, after_rows jsonb) on commit drop;
create function pg_temp.g2e_gate(p_label text, p_template uuid) returns void language plpgsql as $body$
declare
  prior text := coalesce(current_setting('app.cms_rpc', true), ''); ctx jsonb; actor uuid; code text := '00000'; msg text; det text;
  party uuid := pg_temp.s09d_id('ownerOrg'); before_rows jsonb; answer uuid;
begin
  perform pg_temp.s09d_session('owner', 'service_role');
  ctx := jsonb_build_object('context', pg_temp.s09d_context('owner', true));
  perform set_config('app.cms_rpc', 'true', true);
  actor := platform_private.cms_actor(ctx);
  before_rows := jsonb_build_object('templates', (select count(*) from platform_private.cms_template_versions),
    'entries', (select count(*) from platform_private.cms_content_entries), 'revisions', (select count(*) from platform_private.cms_entry_revisions),
    'audit', (select count(*) from audit_private.audit_events), 'outbox', (select count(*) from platform_private.outbox_events));
  begin
    answer := platform_private.cms_entry_default_template_gate(actor, party, p_template, pg_temp.s09d_id('gy-bound:version'));
  exception when others then
    get stacked diagnostics code = returned_sqlstate, msg = message_text, det = pg_exception_detail;
  end;
  perform set_config('app.cms_rpc', prior, true);
  insert into g2e_gate values (p_label, code, msg, det, before_rows, jsonb_build_object('templates', (select count(*) from platform_private.cms_template_versions),
    'entries', (select count(*) from platform_private.cms_content_entries), 'revisions', (select count(*) from platform_private.cms_entry_revisions),
    'audit', (select count(*) from audit_private.audit_events), 'outbox', (select count(*) from platform_private.outbox_events)));
end;
$body$;
select pg_temp.g2e_gate('absent', extensions.gen_random_uuid());
select pg_temp.g2e_gate('foreign', 'a1289000-0000-4000-8000-0000000000a1');
select pg_temp.g2e_gate('own', pg_temp.s12ga_subject('gapt2'));
select is((select code || ':' || coalesce(message, '') || ':' || coalesce(detail, '') from g2e_gate where label = 'absent'), 'P0001:NOT_FOUND:',
  'an absent stored default is the 404 NOT_FOUND with no detail [P2-S12-AC-289]');
select is((select code || ':' || coalesce(message, '') || ':' || coalesce(detail, '') from g2e_gate where label = 'foreign'), 'P0001:NOT_FOUND:',
  'a real template of another owner is the same 404 NOT_FOUND with no detail [P2-S12-AC-289]');
select is((select (code, message, detail) from g2e_gate where label = 'absent'), (select (code, message, detail) from g2e_gate where label = 'foreign'),
  'the absent and the other-owner defaults are indistinguishable in SQLSTATE, message and DETAIL [P2-S12-AC-289]');
select ok((select bool_and(before_rows = after_rows) from g2e_gate where label in ('absent', 'foreign')),
  'both 404 branches leave the template, entry, revision, audit and event stores unchanged [P2-S12-AC-289]');
select is((select code from g2e_gate where label = 'own'), '00000', 'control: the owner''s own compatible template passes the same gate [P2-S12-AC-289]');

select * from finish();
rollback;
