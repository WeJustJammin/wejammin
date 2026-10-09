-- Slice 11 lane S11-3c: platform_api.cms_load_quality_gate_input (DEC-159(4), BE05c checker Inputs, BE03b
-- "Accessibility provider"; tracker P2-S11-AC-101).  The ONE read-only RPC load of a revision for the
-- cms.a11y.structural checker, exactly the Worker's AccessibilityCheckerInput: revision identity and locale, the
-- revision content hash, the dependency hash the evidence binds to (per phase), the render-plan hash and the
-- nodes in render order (top-level rich_text values, then live composition instances).  Authorized by the
-- CMS-03B-15 read scope; any hidden, absent, unauthorized or unreadable target is one NOT_FOUND.  Writes nothing.
-- RED before 20261005017910.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(36);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_11_helpers/003-registry.sqlinc
\ir phase_02_slice_11_rpc_review/000-world.sqlinc
\ir phase_02_slice_11_rpc_review/020-decision.sqlinc
\ir phase_02_slice_11_rpc_review/030-submit.sqlinc
\ir phase_02_slice_11_rpc_reads/000-world.sqlinc

create temp table r11_snap(label text primary key, effects text not null) on commit drop;

select pg_temp.r11_entry(tag) from (values ('gt-1'), ('gt-2'), ('gt-3'), ('gt-big'), ('gt-arch'), ('gt-held'), ('gt-other')) as t(tag);
create or replace function pg_temp.r11g_rq(p_phase text, p_tag text, p_extra jsonb default '{}'::jsonb)
returns jsonb language sql as $body$
  select jsonb_build_object('phase', p_phase, 'entryId', pg_temp.h11w_uuid(p_tag || ':entry'), 'context', pg_temp.r11_ctx()) || p_extra
$body$;
create or replace function pg_temp.r11g_call(p_label text, p_actor text, p_request jsonb, p_keep boolean default true)
returns void language sql as $body$
  select pg_temp.r11r_call(p_label, 'cms_load_quality_gate_input', p_actor, p_request, p_keep)
$body$;
create or replace function pg_temp.r11g_nodes(p_label text, p_kind text)
returns text language sql stable as $body$
  select coalesce(string_agg(coalesce(node->>'fieldId', node->>'pointer'), ',' order by ordinality), '')
    from jsonb_array_elements(pg_temp.r11_resp(p_label)->'nodes') with ordinality n(node, ordinality)
   where node->>'kind' = p_kind
$body$;

-- gt-1 composition: three blocks without a template, one superseded and one pending_diff instance (not rendered); gt-2 carries a block the registry does not know.
select pg_temp.h11m_instance('gt-i2', pg_temp.h11w_uuid('gt-1:revision'), '/b/2', 'h11.first');
select pg_temp.h11m_instance('gt-i1', pg_temp.h11w_uuid('gt-1:revision'), '/b/1', 'h11.second');
select pg_temp.h11m_instance('gt-i0', pg_temp.h11w_uuid('gt-1:revision'), '/b/0', 'h11.slotonly', null, 'active');
select pg_temp.h11m_instance('gt-i9', pg_temp.h11w_uuid('gt-1:revision'), '/b/9', 'h11.first', null, 'superseded');
select pg_temp.h11m_instance('gt-i8', pg_temp.h11w_uuid('gt-1:revision'), '/b/8', 'h11.first', null, 'pending_diff');
select pg_temp.h11m_lifecycle('a9200000-0000-4000-8000-0000000b0002'::uuid, 'h11.second', 'withdrawn');
-- Name rules: h11.first requires a name and defines the accessible_name prop; the instance /b/2 carries one.
select pg_temp.h11_raw_exec('platform_private.cms_block_definition_versions', format(
  $q$update platform_private.cms_block_definition_versions
        set accessibility_contract = '{"nameRequired":true,"keyboard":true,"focusOrder":"document","statusAnnouncement":false}'::jsonb,
            props_schema_snapshot = '{"schemaVersion":"1","fields":[{"name":"accessible_name","kind":"short_text","required":false}],"additionalProperties":false}'::jsonb
      where id = %L$q$, 'a9200000-0000-4000-8000-0000000b0001'));
select pg_temp.h11_raw_exec('platform_private.cms_composition_instances',
  format($$update platform_private.cms_composition_instances set props = '{"accessible_name":"Primary navigation"}'::jsonb where id = %L$$, pg_temp.h11w_uuid('gt-i2')));

-- The binding-hash vector of the accessibility module (an independent oracle).
select pg_temp.h11r_raw_insert('platform_private.cms_entry_revisions', pg_temp.s11_revision_row(jsonb_build_object(
  'id', '11111111-1111-4111-8111-111111111111'::uuid, 'revision_number', 77, 'payload_hash', repeat('a', 64))));

select ok(pg_temp.h11_private_definer('cms_load_quality_gate_input(jsonb)')
    and pg_temp.h11_private_definer('cms_accessibility_checker_input(uuid, text)')
    and pg_temp.r11_posture('platform_api', 'cms_load_quality_gate_input(jsonb)'),
  'the load and its input builder are private SECURITY DEFINERs nobody can execute; the platform_api wrapper is executable by service_role only, never a browser route [P2-S11-AC-101]');
select is(platform_private.cms_accessibility_binding_hash('11111111-1111-4111-8111-111111111111'::uuid, repeat('e', 64)),
  '1199f04e59a554a54cd0ffc893eebeba79f75a4833882ea4d5ff027ce2171289',
  'the SQL binding hash reproduces the independent vector of the accessibility module (revision 1111..., content hash a*64, dependency hash e*64) [P2-S11-AC-101]');

select pg_temp.r11_manifest(pg_temp.h11w_uuid('gt-1:revision'));

-- ---------------------------------------------------------------------------
-- The submit phase: shape, hashes, nodes.
-- ---------------------------------------------------------------------------
select pg_temp.r11g_call('submit', 'owner', pg_temp.r11g_rq('submit', 'gt-1'));
select is(pg_temp.r11_out('submit'), '00000:', 'an entry assignee loads their revision for the submit phase [P2-S11-AC-101]');
select is(pg_temp.r11_keys(pg_temp.r11_resp('submit')),
  'dependencyHash,locale,nodes,renderPlanHash,revisionContentHash,revisionId,revisionNumber',
  'the answer is exactly AccessibilityCheckerInput [P2-S11-AC-101]');
select ok(
  pg_temp.r11_resp('submit')->>'revisionId' = pg_temp.h11w_uuid('gt-1:revision')::text
    and pg_temp.r11_resp('submit')->>'revisionNumber' = '1' and pg_temp.r11_resp('submit')->>'locale' = 'en-US'
    and pg_temp.r11_resp('submit')->>'revisionContentHash' = (select payload_hash from platform_private.cms_entry_revisions where id = pg_temp.h11w_uuid('gt-1:revision'))
    and pg_temp.r11_resp('submit')->>'dependencyHash' = platform_private.cms_jcs_sha256(pg_temp.r11_manifest(pg_temp.h11w_uuid('gt-1:revision')))
    and pg_temp.r11_resp('submit')->>'renderPlanHash' ~ '^[a-f0-9]{64}$',
  'revision identity, locale and content hash come from the revision; the submit-phase dependency hash is the manifest rebuilt now [P2-S11-AC-101]');
select ok(
  platform_private.cms_accessibility_binding_hash(pg_temp.h11w_uuid('gt-1:revision'), pg_temp.r11_resp('submit')->>'dependencyHash')
        = pg_temp.h11_sha256('{"checkerKey":"cms.a11y.structural","checkerVersion":"1","dependencyHash":"' || (pg_temp.r11_resp('submit')->>'dependencyHash')
            || '","revisionContentHash":"' || (pg_temp.r11_resp('submit')->>'revisionContentHash') || '","revisionId":"' || (pg_temp.r11_resp('submit')->>'revisionId') || '"}'),
  'the evidence bound to this document verifies: the database binding hash over the document equals the JCS hash the Worker computes [P2-S11-AC-101]');
select ok(
  pg_temp.r11g_nodes('submit', 'field') = pg_temp.h11w_fid('body')::text
    and (select node from jsonb_array_elements(pg_temp.r11_resp('submit')->'nodes') node where node->>'kind' = 'field')
        = jsonb_build_object('kind', 'field', 'fieldId', pg_temp.h11w_fid('body')::text, 'fieldKind', 'rich_text', 'value', pg_temp.h11w_rich('Body of Hello world')),
  'a field node is exactly { kind, fieldId, fieldKind rich_text, value } with the stored rich_text.v1 value verbatim; the short_text title is not a node [P2-S11-AC-101]');
select is(pg_temp.r11g_nodes('submit', 'block'),
  '/composition/' || pg_temp.h11w_uuid('gt-i0') || ',/composition/' || pg_temp.h11w_uuid('gt-i1') || ',/composition/' || pg_temp.h11w_uuid('gt-i2'),
  'block nodes are the live (draft | active) instances, fields first, ordered by path (a superseded and a pending_diff instance are not rendered) [P2-S11-AC-101]');
select ok(
  (select jsonb_build_object('kind', node->>'kind', 'blockKey', node->>'blockKey', 'blockVersion', node->'blockVersion', 'lifecycle', node->>'lifecycle',
            'recordHash', node->>'recordHash')
     from jsonb_array_elements(pg_temp.r11_resp('submit')->'nodes') node where node->>'pointer' = '/composition/' || pg_temp.h11w_uuid('gt-i0'))
    = jsonb_build_object('kind', 'block', 'blockKey', 'h11.slotonly', 'blockVersion', 1, 'lifecycle', 'supported', 'recordHash', repeat('d', 64))
    and pg_temp.r11_keys((select node from jsonb_array_elements(pg_temp.r11_resp('submit')->'nodes') node where node->>'kind' = 'block' limit 1))
        = 'accessibleName,accessibleNameFieldDefined,blockKey,blockVersion,kind,lifecycle,nameRequired,pointer,recordHash',
  'a block node carries its key, integer version, registry release digest, lifecycle (supported by default), name rules and pointer: exactly the nine schema members [P2-S11-AC-101]');
select ok(
  (select node->>'lifecycle' from jsonb_array_elements(pg_temp.r11_resp('submit')->'nodes') node where node->>'pointer' = '/composition/' || pg_temp.h11w_uuid('gt-i1')) = 'withdrawn',
  'a withdrawn block reports withdrawn [P2-S11-AC-101]');
select ok(
  (select node->'nameRequired' = 'true'::jsonb and node->'accessibleNameFieldDefined' = 'true'::jsonb and node->>'accessibleName' = 'Primary navigation'
     from jsonb_array_elements(pg_temp.r11_resp('submit')->'nodes') node where node->>'pointer' = '/composition/' || pg_temp.h11w_uuid('gt-i2'))
    and (select node->'nameRequired' = 'false'::jsonb and node->'accessibleNameFieldDefined' = 'false'::jsonb and node->'accessibleName' = 'null'::jsonb
          from jsonb_array_elements(pg_temp.r11_resp('submit')->'nodes') node where node->>'pointer' = '/composition/' || pg_temp.h11w_uuid('gt-i0')),
  'nameRequired and the accessible_name prop definition come from the registry record and the name from the instance props; absent means false / false / null [P2-S11-AC-101]');
select ok(
  (select bool_and(node->>'kind' in ('field', 'block')) from jsonb_array_elements(pg_temp.r11_resp('submit')->'nodes') node)
    and not (pg_temp.r11_resp('submit')::text like '%"media"%'),
  'no media node ever appears in Phase 2 [P2-S11-AC-101]');
select ok(
  not pg_temp.r11_leaks(pg_temp.r11_resp('submit'), array[pg_temp.s11_id('creator')::text, pg_temp.s11_id('org')::text, (select auth_user_id::text from r11_actor where key = 'owner')]),
  'the document carries no author, owner, party or account identifier [P2-S11-AC-101]');

-- Determinism and the render-plan hash.
select pg_temp.r11g_call('submit2', 'owner', pg_temp.r11g_rq('submit', 'gt-1'));
select ok(pg_temp.r11_resp('submit2') = pg_temp.r11_resp('submit'), 'loading twice answers the identical document [P2-S11-AC-101]');
select pg_temp.h11_raw_exec('platform_private.cms_composition_instances',
  format($$update platform_private.cms_composition_instances set path = '/b/5' where id = %L$$, pg_temp.h11w_uuid('gt-i0')));
select pg_temp.r11g_call('submit-moved', 'owner', pg_temp.r11g_rq('submit', 'gt-1'));
select ok(pg_temp.r11_resp('submit-moved')->>'renderPlanHash' <> pg_temp.r11_resp('submit')->>'renderPlanHash'
    and pg_temp.r11g_nodes('submit-moved', 'block') = '/composition/' || pg_temp.h11w_uuid('gt-i1') || ',/composition/' || pg_temp.h11w_uuid('gt-i2') || ',/composition/' || pg_temp.h11w_uuid('gt-i0'),
  'moving an instance changes the order and the render-plan hash [P2-S11-AC-101]');
select pg_temp.h11_raw_exec('platform_private.cms_composition_instances',
  format($$update platform_private.cms_composition_instances set path = '/b/0' where id = %L$$, pg_temp.h11w_uuid('gt-i0')));

-- A template orders by slot first; an unknown slot sorts after the template's.
select pg_temp.h11_raw_exec('platform_private.cms_entry_revisions',
  format($$update platform_private.cms_entry_revisions set template_version_id = 'a9200000-0000-4000-8000-0000000d0001' where id = %L$$, pg_temp.h11w_uuid('gt-1:revision')));
select pg_temp.h11_raw_exec('platform_private.cms_composition_instances',
  format($$update platform_private.cms_composition_instances set slot_key = 'sidebar' where id = %L$$, pg_temp.h11w_uuid('gt-i0')));
select pg_temp.r11g_call('submit-template', 'owner', pg_temp.r11g_rq('submit', 'gt-1'));
select ok(pg_temp.r11g_nodes('submit-template', 'block') = '/composition/' || pg_temp.h11w_uuid('gt-i1') || ',/composition/' || pg_temp.h11w_uuid('gt-i2') || ',/composition/' || pg_temp.h11w_uuid('gt-i0'),
  'with a template the instances follow its slot order (primary) and an instance in an unknown slot comes last [P2-S11-AC-101]');

-- ---------------------------------------------------------------------------
-- Phases and the dependency hash.
-- ---------------------------------------------------------------------------
select pg_temp.r11g_call('wread', 'owner', pg_temp.r11g_rq('workflow_read', 'gt-1'));
select ok(pg_temp.r11_resp('wread') = pg_temp.r11_resp('submit-template'),
  'the workflow_read phase is the submit phase: the same document for the same revision [P2-S11-AC-101]');
select pg_temp.r11g_call('no-approved', 'owner', pg_temp.r11g_rq('publish', 'gt-2'), false);
select pg_temp.r11r_review('gt2', 'gt-2', 'editor');
select pg_temp.r11_assign_now('gt2-rvA', 'gt2', 'rvA');
select pg_temp.r11_decide_now('gt2-dec', 'gt2', 'rvA', 'gt2-rvA', 'approve');
select pg_temp.h11_raw_exec('platform_private.cms_editorial_reviews',
  format($$update platform_private.cms_editorial_reviews set dependency_hash = repeat('c', 64) where id = %L$$, pg_temp.s11_id('gt2')));
-- gt-2 gets a block the registry does not know only after its review froze the real manifest (the fixture
-- simulates a registry change after the freeze, so the composition guard of a frozen revision is bypassed).
select pg_temp.h11_raw_exec('platform_private.cms_composition_instances', format(
  $q$select pg_temp.h11m_instance('gt-ghost', %L::uuid, '/b/3', 'h11.ghost')$q$, pg_temp.h11w_uuid('gt-2:revision')));
select pg_temp.r11g_call('schedule', 'pub', pg_temp.r11g_rq('schedule', 'gt-2'));
select pg_temp.r11g_call('publish', 'pub', pg_temp.r11g_rq('publish', 'gt-2'));
select pg_temp.r11g_call('submit-gt2', 'owner', pg_temp.r11g_rq('submit', 'gt-2'), false);
select ok(pg_temp.r11_out('no-approved') = 'P0001:NOT_FOUND'
    and pg_temp.r11_resp('schedule')->>'dependencyHash' = repeat('c', 64) and pg_temp.r11_resp('publish')->>'dependencyHash' = repeat('c', 64)
    and pg_temp.r11_out('submit-gt2') = 'P0001:DEPENDENCY_UNAVAILABLE',
  'the schedule and publish phases bind to the approved review''s FROZEN dependency hash (NOT_FOUND when there is no approved review) and need no manifest build; the submit phase of a revision whose manifest cannot be built (an unregistered block) is DEPENDENCY_UNAVAILABLE [P2-S11-AC-101]');
select ok(pg_temp.r11_resp('schedule') = pg_temp.r11_resp('publish')
    and (select node->>'lifecycle' || '/' || (node->>'recordHash') || '/' || (node->>'blockKey')
           from jsonb_array_elements(pg_temp.r11_resp('publish')->'nodes') node where node->>'pointer' = '/composition/' || pg_temp.h11w_uuid('gt-ghost'))
        = 'unregistered/' || repeat('a', 64) || '/h11.ghost',
  'the schedule and publish phases load the same document; a block key/version missing from the registry reports unregistered with the digest the instance recorded [P2-S11-AC-101]');

-- The sweep (request B): a service call for a schedule, no context.
select pg_temp.h11r_raw_insert('platform_private.cms_publication_schedules', pg_temp.s11_schedule_row(jsonb_build_object(
  'entry_id', pg_temp.h11w_uuid('gt-2:entry'), 'revision_id', pg_temp.h11w_uuid('gt-2:revision'), 'review_id', pg_temp.s11_id('gt2'),
  'dependency_hash', repeat('c', 64), 'audience', 'public', 'state', 'pending')));
create or replace function pg_temp.r11g_sched()
returns uuid language sql stable as $body$
  select id from platform_private.cms_publication_schedules where revision_id = pg_temp.h11w_uuid('gt-2:revision') limit 1
$body$;
select pg_temp.s10_rpc_clear_actor();
select pg_temp.r11_try('exec-ok', format('select platform_api.cms_load_quality_gate_input(%L::jsonb)', jsonb_build_object(
  'phase', 'execute', 'scheduleId', pg_temp.r11g_sched(), 'revisionId', pg_temp.h11w_uuid('gt-2:revision'), 'dependencyHash', repeat('c', 64))::text));
select pg_temp.r11_try('exec-hash', format('select platform_api.cms_load_quality_gate_input(%L::jsonb)', jsonb_build_object(
  'phase', 'execute', 'scheduleId', pg_temp.r11g_sched(), 'revisionId', pg_temp.h11w_uuid('gt-2:revision'), 'dependencyHash', repeat('d', 64))::text), false);
select pg_temp.r11_try('exec-schedule', format('select platform_api.cms_load_quality_gate_input(%L::jsonb)', jsonb_build_object(
  'phase', 'execute', 'scheduleId', extensions.gen_random_uuid(), 'revisionId', pg_temp.h11w_uuid('gt-2:revision'), 'dependencyHash', repeat('c', 64))::text), false);
select pg_temp.r11_try('exec-revision', format('select platform_api.cms_load_quality_gate_input(%L::jsonb)', jsonb_build_object(
  'phase', 'execute', 'scheduleId', pg_temp.r11g_sched(), 'revisionId', pg_temp.h11w_uuid('gt-1:revision'), 'dependencyHash', repeat('c', 64))::text), false);
select pg_temp.r11_try('exec-context', format('select platform_api.cms_load_quality_gate_input(%L::jsonb)', jsonb_build_object(
  'phase', 'execute', 'scheduleId', pg_temp.r11g_sched(), 'revisionId', pg_temp.h11w_uuid('gt-2:revision'), 'dependencyHash', repeat('c', 64),
  'context', pg_temp.r11_ctx())::text), false);
select ok(pg_temp.r11_out('exec-ok') = '00000:' and pg_temp.r11_resp('exec-ok') = pg_temp.r11_resp('schedule'),
  'the execute phase loads the schedule''s revision for the sweep with no session, bound to the hash it was given [P2-S11-AC-101]');
select is(pg_temp.r11_out('exec-hash') || ' ' || pg_temp.r11_out('exec-schedule') || ' ' || pg_temp.r11_out('exec-revision') || ' ' || pg_temp.r11_out('exec-context'),
  'P0001:NOT_FOUND P0001:NOT_FOUND P0001:NOT_FOUND P0001:INVALID_REQUEST',
  'a hash other than the schedule''s frozen one, an absent schedule and a revision that is not the schedule''s are NOT_FOUND; a context member on the service shape is INVALID_REQUEST [P2-S11-AC-101]');

-- ---------------------------------------------------------------------------
-- Authorization: one uniform NOT_FOUND.
-- ---------------------------------------------------------------------------
select pg_temp.r11g_call('a-pub', 'pub', pg_temp.r11g_rq('submit', 'gt-1'));
select pg_temp.r11r_review('gt1', 'gt-1', 'editor');
select pg_temp.r11_assign_now('gt1-rvA', 'gt1', 'rvA');
select pg_temp.r11g_call('a-rvA', 'rvA', pg_temp.r11g_rq('workflow_read', 'gt-1'));
select ok(pg_temp.r11_out('a-pub') = '00000:' and pg_temp.r11_out('a-rvA') = '00000:',
  'an owner-party publisher and a reviewer assignee of a review of the revision hold the read scope [P2-S11-AC-101]');
select pg_temp.r11g_call('n-outsider', 'outsider', pg_temp.r11g_rq('submit', 'gt-3'), false);
select pg_temp.r11g_call('n-rvA', 'rvA', pg_temp.r11g_rq('submit', 'gt-3'), false);
select pg_temp.r11g_call('n-stranger', 'stranger', pg_temp.r11g_rq('submit', 'gt-3'), false);
select pg_temp.r11g_call('n-absent', 'owner', jsonb_build_object('phase', 'submit', 'entryId', extensions.gen_random_uuid(), 'context', pg_temp.r11_ctx()), false);
select pg_temp.r11g_call('n-foreign-revision', 'owner', pg_temp.r11g_rq('submit', 'gt-3', jsonb_build_object('revisionId', pg_temp.h11w_uuid('gt-other:revision'))), false);
select pg_temp.h11_raw_exec('platform_private.cms_content_entries',
  format($$update platform_private.cms_content_entries set lifecycle = 'archived' where id = %L$$, pg_temp.h11w_uuid('gt-arch:entry')));
select pg_temp.h11_raw_exec('platform_private.cms_content_entries',
  format($$update platform_private.cms_content_entries set lifecycle = 'held' where id = %L$$, pg_temp.h11w_uuid('gt-held:entry')));
select pg_temp.r11g_call('n-archived', 'owner', pg_temp.r11g_rq('submit', 'gt-arch'), false);
select pg_temp.r11g_call('n-party', 'owner', jsonb_set(pg_temp.r11g_rq('submit', 'gt-3'), '{context,actingPartyId}', to_jsonb(pg_temp.s11_id('creator'))), false);
select is(
  (select count(distinct pg_temp.r11_out(label) || '|' || coalesce(pg_temp.r11_detail(label), 'null'))::text || ':' || min(pg_temp.r11_out(label))
     from (values ('n-outsider'), ('n-rvA'), ('n-stranger'), ('n-absent'), ('n-foreign-revision'), ('n-archived'), ('n-party')) as v(label)),
  '1:P0001:NOT_FOUND',
  'a member with no scope, an unassigned reviewer, a non-member, an absent entry, a revision of another entry, an archived entry and another acting party are ONE indistinguishable NOT_FOUND [P2-S11-AC-101]');
select pg_temp.r11g_call('held', 'owner', pg_temp.r11g_rq('submit', 'gt-held'));
select pg_temp.r11g_call('by-revision', 'owner', jsonb_build_object('phase', 'submit', 'revisionId', pg_temp.h11w_uuid('gt-3:revision'), 'context', pg_temp.r11_ctx()));
select pg_temp.r11g_call('by-neither', 'owner', jsonb_build_object('phase', 'submit', 'context', pg_temp.r11_ctx()), false);
select ok(pg_temp.r11_out('held') = '00000:' and pg_temp.r11_out('by-revision') = '00000:'
    and pg_temp.r11_resp('by-revision')->>'revisionId' = pg_temp.h11w_uuid('gt-3:revision')::text
    and pg_temp.r11_out('by-neither') = 'P0001:INVALID_REQUEST',
  'a held entry loads; a revision id alone resolves its entry; neither an entry nor a revision is INVALID_REQUEST [P2-S11-AC-101]');

-- ---------------------------------------------------------------------------
-- Structure, the size bound and the safe-read guarantee.
-- ---------------------------------------------------------------------------
select pg_temp.r11g_call('x-phase', 'owner', pg_temp.r11g_rq('review', 'gt-1'), false);
select pg_temp.r11g_call('x-no-phase', 'owner', jsonb_build_object('entryId', pg_temp.h11w_uuid('gt-1:entry'), 'context', pg_temp.r11_ctx()), false);
select pg_temp.r11g_call('x-extra', 'owner', pg_temp.r11g_rq('submit', 'gt-1', '{"evidence":null}'), false);
select pg_temp.r11g_call('x-no-context', 'owner', jsonb_build_object('phase', 'submit', 'entryId', pg_temp.h11w_uuid('gt-1:entry')), false);
select pg_temp.r11g_call('x-bad-entry', 'owner', jsonb_build_object('phase', 'submit', 'entryId', 'nope', 'context', pg_temp.r11_ctx()), false);
select is(
  (select string_agg(label || '=' || pg_temp.r11_out(label), ' ' order by label) from r11_probe where label like 'x-%'),
  'x-bad-entry=P0001:INVALID_REQUEST x-extra=P0001:INVALID_REQUEST x-no-context=P0001:INVALID_REQUEST x-no-phase=P0001:INVALID_REQUEST x-phase=P0001:INVALID_REQUEST',
  'an unknown phase, a missing phase or context, an unknown member and a malformed id are INVALID_REQUEST [P2-S11-AC-101]');
select pg_temp.h11_raw_exec('platform_private.cms_entry_field_values', format(
  $q$update platform_private.cms_entry_field_values set value = %L::jsonb where revision_id = %L and field_id = %L$q$,
  pg_temp.h11w_rich(repeat('a', 1100000))::text, pg_temp.h11w_uuid('gt-big:revision'), pg_temp.h11w_fid('body')));
select pg_temp.r11g_call('big', 'owner', pg_temp.r11g_rq('submit', 'gt-big'), false);
select is(pg_temp.r11_out('big'), 'P0001:NOT_FOUND', 'a document above 1 MiB is the uniform NOT_FOUND (the Worker then sends no evidence) [P2-S11-AC-101]');
insert into r11_snap(label, effects) values ('final', pg_temp.r11r_effects());
select pg_temp.r11g_call('f1', 'owner', pg_temp.r11g_rq('submit', 'gt-1'));
select pg_temp.r11g_call('f2', 'pub', pg_temp.r11g_rq('publish', 'gt-2'));
select pg_temp.r11g_call('f3', 'rvA', pg_temp.r11g_rq('workflow_read', 'gt-1'));
select pg_temp.r11g_call('f4', 'owner', pg_temp.r11g_rq('submit', 'gt-big'), false);
select ok(pg_temp.r11r_effects() = (select effects from r11_snap where label = 'final'),
  'the load writes nothing: no audit record, event, reservation, review, schedule or publication is created or changed [P2-S11-AC-101]');

select * from finish();
rollback;
