-- Slice 11 criteria: P2-S11-AC-004, "Publish only after current revocation, accessibility, settings, schema,
-- template, block, media, relation, route, locale, and privacy gates re-pass."  The older suites prove the
-- gates through the SUBMIT phase of the shared evaluator and, at publish, only revocation, accessibility and
-- media.  This suite drives the two publishing commands themselves, CMS-03B-09 (publish) and the CMS-03B-20
-- executor, with each remaining gate failing, and asserts the exact refusal and the durable effects.
--
-- Two layers reject a drifted dependency (BE03b "Frozen dependency manifest build and version set (E1, E7)",
-- "Publication preflight registry (D19)", DEC-157, DEC-159):
--   * the frozen-identity currency check that runs BEFORE the preflight (BE03b "Frozen dependency manifest build and
--     version set (E1, E7)": a non-current frozen identity or a differing hash is 409 version_set_stale and the
--     review is invalidated `dependency_changed`, committed with the refusal envelope): a retired template, a
--     withdrawn block, a changed settings snapshot and a superseded schema version;
--   * the publish-phase / execute-phase preflight proper (all seventeen categories, no short circuit): a
--     template no longer compatible, a block-policy relation whose target left `active` or moved past its pin,
--     an internal rich-text link (route), a `no_fallback` field (locale) and a held / deletion_pending relation
--     target (privacy).
-- Every fixture is an APPROVED review frozen from the real manifest; the gate breaks after approval (or, for the
-- reference gates, is part of the approved revision).  The effect oracle is the complete fourteen-table digest.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(35);

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
\ir phase_02_slice_11_rpc_publication/000-world.sqlinc
\ir phase_02_slice_11_helpers/003-registry.sqlinc
\ir phase_02_slice_11_criteria/000-effect-digest.sqlinc

-- A second, retirable template and a withdrawable block (the registry ones are shared with other fixtures).
select pg_temp.h11_raw_insert('platform_private.cms_template_versions', jsonb_build_object(
  'id', 'a9200000-0000-4000-8000-0000000d0011', 'owner_id', pg_temp.h11w_org(), 'state', 'active',
  'version', 1, 'template_key', 'c11-template-retired',
  'compatible_type_ids', jsonb_build_array((select value from h11w_ids where key = 'typeId')),
  'slots', jsonb_build_array(jsonb_build_object('key', 'primary', 'required', false, 'maxCount', 4,
    'allowedBlocks', jsonb_build_array(jsonb_build_object('blockKey', 'h11.first', 'blockVersion', 1)))),
  'reserved_regions', jsonb_build_array('header', 'now', 'record', 'detail', 'provenance'),
  'bindings', '{}'::jsonb, 'locale', 'en-US', 'audience', 'public',
  'content_hash', repeat('8', 64), 'block_registry_digest', repeat('1', 64),
  'created_by', (select value::uuid from s10_ids where key = 'creatorAuth'),
  'created_at', timestamptz '2026-10-08T12:00:00Z', 'updated_at', timestamptz '2026-10-08T12:00:00Z'));
select pg_temp.h11m_block('a9200000-0000-4000-8000-0000000b0011', 'c11.withdrawn', repeat('e', 64));

-- An approved review of a fresh entry (the CMS-03B-06 flow's end state: the real manifest frozen, rvA's approve
-- recorded, review version 2).  p_kind prepares the revision BEFORE the freeze.
create or replace function pg_temp.c11_fixture(p_tag text, p_kind text)
returns uuid
language plpgsql
as $body$
declare
  revision uuid;
  target_entry uuid := pg_temp.h11w_uuid(p_tag || '-t:entry');
  manifest jsonb;
  policy jsonb;
  rich jsonb := pg_temp.h11w_rich('see', jsonb_build_object('kind', 'internal', 'route', '/news/a'));
begin
  perform set_config('app.cms_rpc', 'true', true);
  revision := pg_temp.r11_entry(p_tag, 'creator', 'Title of ' || p_tag, '[]'::jsonb);
  if p_kind in ('tpl-incompat', 'tpl-retired') then
    perform pg_temp.h11_raw_exec('platform_private.cms_entry_revisions', format(
      $q$update platform_private.cms_entry_revisions set template_version_id = %L::uuid where id = %L::uuid$q$,
      case p_kind when 'tpl-incompat' then 'a9200000-0000-4000-8000-0000000d0001'
                  else 'a9200000-0000-4000-8000-0000000d0011' end, revision));
  elsif p_kind = 'blk-withdrawn' then
    perform pg_temp.h11m_instance(p_tag || ':i1', revision, '/a', 'c11.withdrawn');
  elsif p_kind in ('rel-unavail', 'rel-version') then
    perform pg_temp.h11w_revision(p_tag || '-t');
    perform pg_temp.h11w_relation(revision, 'rel_block', target_entry, 1, 0, 'block');
  elsif p_kind in ('priv-held', 'priv-del') then
    perform pg_temp.h11w_revision(p_tag || '-t');
    perform pg_temp.h11w_relation(revision, 'rel_omit', target_entry, null, 0, 'omit');
    -- The target leaves `active` BEFORE the freeze: an omit-policy relation to an unavailable target is not part of
    -- the manifest, so the frozen and the rebuilt manifests stay equal and only the privacy gate objects.
    update platform_private.cms_content_entries
       set lifecycle = case p_kind when 'priv-held' then 'held' else 'deletion_pending' end, version = version + 1
     where id = target_entry;
  elsif p_kind = 'route' then
    perform pg_temp.h11_raw_exec('platform_private.cms_entry_field_values', format(
      $q$update platform_private.cms_entry_field_values
            set value = %L::jsonb, value_hash = platform_private.cms_jcs_sha256(%L::jsonb)::char(64)
          where revision_id = %L::uuid and field_id = %L::uuid$q$,
      rich::text, rich::text, revision, pg_temp.h11w_fid('body')));
  end if;
  manifest := pg_temp.r11_manifest(revision);
  if p_kind = 'settings' then
    manifest := jsonb_set(manifest, '{settings,hash}', to_jsonb(repeat('0', 64)));
  end if;
  policy := manifest->'schema'->'workflowPolicy';
  perform pg_temp.h11r_review('rv-' || p_tag, jsonb_build_object(
    'revision_id', revision, 'entry_id', pg_temp.h11w_uuid(p_tag || ':entry'),
    'frozen_hash', (select revision_item.payload_hash from platform_private.cms_entry_revisions revision_item where revision_item.id = revision),
    'dependency_manifest', manifest, 'dependency_hash', platform_private.cms_jcs_sha256(manifest),
    'activation_evidence', manifest->'schema'->'activationEvidence',
    'workflow_policy_key', policy->>'key', 'workflow_policy_version', (policy->>'version')::bigint,
    'workflow_policy_hash', policy->>'policyHash', 'risk_class', policy->>'riskClass',
    'required_decision_count', (policy->>'requiredDecisionCount')::integer,
    'required_capabilities', policy->'requiredCapabilities',
    'approval_evidence_hash', policy->>'approvalEvidenceHash',
    'submitted_by', pg_temp.s11_id('editor')));
  perform pg_temp.r11_assign_now('rv-' || p_tag || '-asg', 'rv-' || p_tag, 'rvA');
  perform pg_temp.r11_decide_now('rv-' || p_tag || '-dec', 'rv-' || p_tag, 'rvA', 'rv-' || p_tag || '-asg', 'approve');
  return revision;
end;
$body$;

-- The non-passing categories the evaluator reports for a fixture in a phase ('category:outcome:reason,...').
create or replace function pg_temp.c11_bad(p_tag text, p_phase text)
returns text
language plpgsql
as $body$
declare
  review platform_private.cms_editorial_reviews := pg_temp.p11_review(p_tag);
  report jsonb;
begin
  perform set_config('app.cms_rpc', 'true', true);
  report := platform_private.cms_evaluate_preflight(jsonb_build_object(
    'phase', p_phase, 'revisionId', review.revision_id, 'actingPartyId', pg_temp.s11_id('org'),
    'actorPersonId', pg_temp.s11_id('pub'),
    'effectiveAt', platform_private.auth_iso_time(clock_timestamp() + interval '1 hour'),
    'reviewId', review.id, 'frozenManifest', review.dependency_manifest,
    'evidence', pg_temp.r11_evidence(review.revision_id)));
  return coalesce((
    select string_agg(item->>'category' || ':' || (item->>'outcome') || ':' || coalesce(item->>'reasonCode', '-'),
                      ',' order by ord)
      from jsonb_array_elements(report->'results') with ordinality t(item, ord)
     where item->>'outcome' <> 'passed'), '');
exception when others then
  return 'ERR ' || sqlstate || ':' || sqlerrm;
end;
$body$;

-- The failed categories of a publish refusal's DETAIL, or the committed-refusal envelope, as one string.
create or replace function pg_temp.c11_refusal(p_label text)
returns text
language sql
stable
as $body$
  select pg_temp.r11_out(p_label) || '|' || coalesce(
    case
      when pg_temp.r11_detail(p_label) is not null and pg_temp.r11_detail(p_label)::jsonb ? 'preflight' then (
        select coalesce(string_agg(item->>'category' || ':' || (item->>'outcome') || ':' || coalesce(item->>'reasonCode', '-'),
                                   ',' order by ord) filter (where item->>'outcome' <> 'passed'), '')
               || '|passed=' || (count(*) filter (where item->>'outcome' = 'passed'))::text || '/' || count(*)::text
          from jsonb_array_elements(pg_temp.r11_detail(p_label)::jsonb->'preflight') with ordinality t(item, ord))
      when pg_temp.r11_resp(p_label) is not null and pg_temp.r11_resp(p_label) ? 'kind' then
        (pg_temp.r11_resp(p_label)->>'kind') || ':' || (pg_temp.r11_resp(p_label)->>'reasonCode')
      else '-' end, '-')
$body$;

-- The publish command against fixture gt-<kind>: '<evaluator> | <outcome> | ...'.
create or replace function pg_temp.c11_run_p(p_kind text, p_keep boolean)
returns text
language plpgsql
as $body$
declare
  tag text := 'gt-' || p_kind;
  label text := 'p-' || p_kind;
  req jsonb;
  bad text;
  review platform_private.cms_editorial_reviews;
  extra text := '';
begin
  bad := pg_temp.c11_bad(tag, 'publish');
  req := pg_temp.p11_preq(tag);
  perform pg_temp.c11_take(label);
  perform pg_temp.p11_call(label, 'pub', 'cms_publish_revision', req, p_keep);
  if p_keep then
    perform set_config('app.cms_rpc', 'true', true);
    review := pg_temp.p11_review(tag);
    extra := '|review=' || review.state || '/' || review.version || '/' || coalesce(review.invalidated_reason, '-')
      || '|lineage=' || (select count(*) from platform_private.cms_publication_versions where entry_id = review.entry_id)::text
      || '|events=' || (select count(*) from platform_private.outbox_events event
                         where event.event_type = 'cms.publication.changed.v1'
                           and event.payload->>'entryId' = review.entry_id::text)::text
      || '|reservation=' || pg_temp.p11_reservation(req->>'idempotencyKey')
      || '|details=' || coalesce((pg_temp.r11_resp(label)->'details')::text, '-')
      || '|delta=' || pg_temp.c11_delta(label);
  end if;
  return bad || ' => ' || pg_temp.c11_refusal(label) || extra;
end;
$body$;

-- The executor against the claimed schedule s-gx-<kind>.
create or replace function pg_temp.c11_run_x(p_kind text)
returns text
language plpgsql
as $body$
declare
  tag text := 'gx-' || p_kind;
  label text := 'x-' || p_kind;
  bad text;
  review platform_private.cms_editorial_reviews;
begin
  bad := pg_temp.c11_bad(tag, 'execute');
  perform pg_temp.c11_take(label);
  perform pg_temp.p11_exec(label, pg_temp.p11_xreq('s-' || tag));
  review := pg_temp.p11_review(tag);
  return bad || ' => ' || pg_temp.r11_out(label) || '|' || coalesce(pg_temp.r11_resp(label)->>'outcome', '-') || ':'
    || coalesce(pg_temp.r11_resp(label)->>'reasonCode', '-')
    || '|schedule=' || pg_temp.p11_sched('s-' || tag)
    || '|review=' || review.state || '/' || review.version || '/' || coalesce(review.invalidated_reason, '-')
    || '|lineage=' || (select count(*) from platform_private.cms_publication_versions where entry_id = review.entry_id)::text
    || '|events=' || (select count(*) from platform_private.outbox_events event
                       where event.event_type = 'cms.publication.changed.v1'
                         and event.payload->>'entryId' = review.entry_id::text)::text
    || '|delta=' || pg_temp.c11_delta(label);
end;
$body$;

-- ---------------------------------------------------------------------------
-- Fixtures: one approved review per (command, gate), the executor's schedules claimed before the world drifts.
-- ---------------------------------------------------------------------------
select pg_temp.c11_fixture(prefix || kind, kind)
  from (values ('gt-'), ('gx-')) p(prefix)
  cross join (values ('ctl'), ('tpl-incompat'), ('tpl-retired'), ('blk-withdrawn'), ('rel-unavail'), ('rel-version'),
                     ('route'), ('priv-held'), ('priv-del'), ('settings'), ('locale'), ('schema')) k(kind);
select pg_temp.p11_schedule_row('s-gx-' || kind, 'gx-' || kind)
  from (values ('ctl'), ('tpl-incompat'), ('tpl-retired'), ('blk-withdrawn'), ('rel-unavail'), ('rel-version'),
               ('route'), ('priv-held'), ('priv-del'), ('settings'), ('locale'), ('schema')) k(kind);
select pg_temp.p11_claim('claim', '100'::jsonb);
select is(
  (select count(*)::text from jsonb_array_elements(pg_temp.r11_resp('claim')))
    || '|' || (select string_agg(distinct review.state || '/' || review.version, ',')
                 from platform_private.cms_editorial_reviews review where review.id::text in (select value from s11_ids where key like 'rv-g%')),
  '12|approved/2',
  'control: twenty-four approved reviews (version 2), twelve schedules claimed and executing before the world drifts [P2-S11-AC-004]');

-- The world drifts AFTER approval and after the claim.
select pg_temp.h11_raw_exec('platform_private.cms_template_versions',
  $$update platform_private.cms_template_versions set compatible_type_ids = '["a9200000-0000-4000-8000-0000000fffff"]'::jsonb
     where id = 'a9200000-0000-4000-8000-0000000d0001'$$);
select pg_temp.h11_raw_exec('platform_private.cms_template_versions',
  $$update platform_private.cms_template_versions set state = 'retired' where id = 'a9200000-0000-4000-8000-0000000d0011'$$);
select pg_temp.h11m_lifecycle('a9200000-0000-4000-8000-0000000b0011', 'c11.withdrawn', 'withdrawn');
update platform_private.cms_content_entries set lifecycle = 'archived', version = version + 1
 where id in (pg_temp.h11w_uuid('gt-rel-unavail-t:entry'), pg_temp.h11w_uuid('gx-rel-unavail-t:entry'));
update platform_private.cms_content_entries set version = version + 1
 where id in (pg_temp.h11w_uuid('gt-rel-version-t:entry'), pg_temp.h11w_uuid('gx-rel-version-t:entry'));

-- ---------------------------------------------------------------------------
-- Control: an undrifted approval publishes and executes (the refusals below are the drift, nothing else).
-- ---------------------------------------------------------------------------
select pg_temp.p11_call('p-ctl', 'pub', 'cms_publish_revision', pg_temp.p11_preq('gt-ctl'));
select is(
  pg_temp.r11_out('p-ctl') || '|' || coalesce(pg_temp.r11_resp('p-ctl')->>'action', '-') || '|' || coalesce(pg_temp.r11_resp('p-ctl')->>'state', '-')
    || '|' || pg_temp.p11_head('gt-ctl') || '|' || pg_temp.c11_bad('gt-ctl', 'publish'),
  '00000:|publish|active|publish/active/1|',
  'control: the undrifted approved revision publishes (202 lineage row, active head) with every category passing [P2-S11-AC-004]');
select pg_temp.p11_exec('x-ctl', pg_temp.p11_xreq('s-gx-ctl'));
select is(
  pg_temp.r11_out('x-ctl') || '|' || coalesce(pg_temp.r11_resp('x-ctl')->>'outcome', '-') || '|' || pg_temp.p11_sched('s-gx-ctl')
    || '|' || pg_temp.p11_head('gx-ctl'),
  '00000:|completed|completed/3/0/-/-|publish/active/1',
  'control: the undrifted claimed schedule executes to completed and appends the active head [P2-S11-AC-004]');

-- ---------------------------------------------------------------------------
-- CMS-03B-09, the publish-phase preflight: exactly the drifted category fails, the other sixteen pass.
-- ---------------------------------------------------------------------------
select pg_temp.c11_take('raised');
select is(pg_temp.c11_run_p('tpl-incompat', false),
  'template:failed:template_incompatible => P0001:preflight_failed|template:failed:template_incompatible|passed=16/17',
  'template gate: a template no longer compatible with the content type refuses the publication 422 preflight_failed, template failed, 16 of 17 passed [P2-S11-AC-004]');
select is(pg_temp.c11_run_p('rel-unavail', false),
  'relation:failed:relation_target_unavailable => P0001:preflight_failed|relation:failed:relation_target_unavailable|passed=16/17',
  'relation gate: a block-policy relation whose target left active refuses 422 preflight_failed (relation_target_unavailable) [P2-S11-AC-004]');
select is(pg_temp.c11_run_p('rel-version', false),
  'relation:failed:relation_version_changed => P0001:preflight_failed|relation:failed:relation_version_changed|passed=16/17',
  'relation gate: a pinned relation target whose version moved refuses 422 preflight_failed (relation_version_changed) [P2-S11-AC-004]');
select is(pg_temp.c11_run_p('route', false),
  'route:failed:provider_unbuilt_reference => P0001:preflight_failed|route:failed:provider_unbuilt_reference|passed=16/17',
  'route gate: an internal rich-text link refuses 422 preflight_failed (route, provider_unbuilt_reference) [P2-S11-AC-004]');
select is(pg_temp.c11_run_p('priv-held', false),
  'privacy:failed:provider_unbuilt_reference => P0001:preflight_failed|privacy:failed:provider_unbuilt_reference|passed=16/17',
  'privacy gate: a held relation target refuses 422 preflight_failed (privacy) while revocation and relation still pass [P2-S11-AC-004]');
select is(pg_temp.c11_run_p('priv-del', false),
  'privacy:failed:provider_unbuilt_reference => P0001:preflight_failed|privacy:failed:provider_unbuilt_reference|passed=16/17',
  'privacy gate: a deletion_pending relation target refuses 422 preflight_failed (privacy) [P2-S11-AC-004]');
select is(pg_temp.c11_delta('raised'), '',
  'every raised publish refusal above left no lineage row, review change, schedule, reservation, event, audit record, snapshot or evidence summary behind [P2-S11-AC-004]');

-- ---------------------------------------------------------------------------
-- CMS-03B-20, the execute-phase preflight: the schedule is blocked preflight_failed and nothing is published.
-- ---------------------------------------------------------------------------
select is(pg_temp.c11_run_x('tpl-incompat'),
  'template:failed:template_incompatible => 00000:|blocked:preflight_failed|schedule=blocked/3/0/preflight_failed/-|review=approved/2/-|lineage=0|events=0|delta=audit_events,cms_command_accessibility_evidence,cms_publication_schedules',
  'template gate: the executor blocks a schedule whose template is no longer compatible [P2-S11-AC-004]');
select is(pg_temp.c11_run_x('rel-unavail'),
  'relation:failed:relation_target_unavailable => 00000:|blocked:preflight_failed|schedule=blocked/3/0/preflight_failed/-|review=approved/2/-|lineage=0|events=0|delta=audit_events,cms_command_accessibility_evidence,cms_publication_schedules',
  'relation gate: the executor blocks a schedule whose block-policy relation target left active [P2-S11-AC-004]');
select is(pg_temp.c11_run_x('rel-version'),
  'relation:failed:relation_version_changed => 00000:|blocked:preflight_failed|schedule=blocked/3/0/preflight_failed/-|review=approved/2/-|lineage=0|events=0|delta=audit_events,cms_command_accessibility_evidence,cms_publication_schedules',
  'relation gate: the executor blocks a schedule whose pinned relation target moved [P2-S11-AC-004]');
select is(pg_temp.c11_run_x('route'),
  'route:failed:provider_unbuilt_reference => 00000:|blocked:preflight_failed|schedule=blocked/3/0/preflight_failed/-|review=approved/2/-|lineage=0|events=0|delta=audit_events,cms_command_accessibility_evidence,cms_publication_schedules',
  'route gate: the executor blocks a schedule whose revision carries an internal link [P2-S11-AC-004]');
select is(pg_temp.c11_run_x('priv-held'),
  'privacy:failed:provider_unbuilt_reference => 00000:|blocked:preflight_failed|schedule=blocked/3/0/preflight_failed/-|review=approved/2/-|lineage=0|events=0|delta=audit_events,cms_command_accessibility_evidence,cms_publication_schedules',
  'privacy gate: the executor blocks a schedule whose relation target is held [P2-S11-AC-004]');
select is(pg_temp.c11_run_x('priv-del'),
  'privacy:failed:provider_unbuilt_reference => 00000:|blocked:preflight_failed|schedule=blocked/3/0/preflight_failed/-|review=approved/2/-|lineage=0|events=0|delta=audit_events,cms_command_accessibility_evidence,cms_publication_schedules',
  'privacy gate: the executor blocks a schedule whose relation target is deletion_pending [P2-S11-AC-004]');

-- ---------------------------------------------------------------------------
-- The frozen-identity currency check runs before the preflight: the review is invalidated dependency_changed and
-- the invalidation COMMITS (DEC-157, DEC-159); the publication is not appended.
-- ---------------------------------------------------------------------------
select is(pg_temp.c11_run_p('tpl-retired', true),
  'template:failed:template_not_active => 00000:|refusal:version_set_stale|review=invalidated/3/dependency_changed|lineage=0|events=0|reservation=completed/409|details={}|delta=audit_events,cms_editorial_reviews,idempotency_records,outbox_events',
  'template gate: a retired template invalidates the review dependency_changed, commits the 409 version_set_stale refusal and appends nothing [P2-S11-AC-004]');
select is(pg_temp.c11_run_p('blk-withdrawn', true),
  'block:failed:block_withdrawn => 00000:|refusal:version_set_stale|review=invalidated/3/dependency_changed|lineage=0|events=0|reservation=completed/409|details={}|delta=audit_events,cms_editorial_reviews,idempotency_records,outbox_events',
  'block gate: a withdrawn block invalidates the review dependency_changed, commits the 409 version_set_stale refusal and appends nothing [P2-S11-AC-004]');
select is(pg_temp.c11_run_p('settings', true),
  'settings:failed:settings_changed => 00000:|refusal:version_set_stale|review=invalidated/3/dependency_changed|lineage=0|events=0|reservation=completed/409|details={}|delta=audit_events,cms_editorial_reviews,idempotency_records,outbox_events',
  'settings gate: a settings snapshot that differs from the frozen one invalidates the review dependency_changed and commits the 409 version_set_stale refusal [P2-S11-AC-004]');
select is(pg_temp.c11_run_x('tpl-retired'),
  'template:failed:template_not_active => 00000:|blocked:approval_invalidated|schedule=blocked/3/0/approval_invalidated/-|review=invalidated/3/dependency_changed|lineage=0|events=0|delta=audit_events,cms_editorial_reviews,cms_publication_schedules,outbox_events',
  'template gate: the executor finds a retired template, invalidates the review and blocks the schedule approval_invalidated [P2-S11-AC-004]');
select is(pg_temp.c11_run_x('blk-withdrawn'),
  'block:failed:block_withdrawn => 00000:|blocked:approval_invalidated|schedule=blocked/3/0/approval_invalidated/-|review=invalidated/3/dependency_changed|lineage=0|events=0|delta=audit_events,cms_editorial_reviews,cms_publication_schedules,outbox_events',
  'block gate: the executor finds a withdrawn block, invalidates the review and blocks the schedule approval_invalidated [P2-S11-AC-004]');
select is(pg_temp.c11_run_x('settings'),
  'settings:failed:settings_changed => 00000:|blocked:approval_invalidated|schedule=blocked/3/0/approval_invalidated/-|review=invalidated/3/dependency_changed|lineage=0|events=0|delta=audit_events,cms_editorial_reviews,cms_publication_schedules,outbox_events',
  'settings gate: the executor finds a changed settings snapshot, invalidates the review and blocks the schedule [P2-S11-AC-004]');

-- ---------------------------------------------------------------------------
-- World-wide drifts last (they affect every fixture): the locale gate and the schema gate.
-- ---------------------------------------------------------------------------
select pg_temp.h11_raw_exec('platform_private.cms_field_definition_versions',
  $$update platform_private.cms_field_definition_versions set localization_mode = 'no_fallback' where field_key = 'legal'$$);
select is(pg_temp.c11_run_p('locale', false),
  'locale:failed:provider_unbuilt_reference => P0001:preflight_failed|locale:failed:provider_unbuilt_reference|passed=16/17',
  'locale gate: a schema that declares a no_fallback field refuses the publication 422 preflight_failed (locale) [P2-S11-AC-004]');
select is(pg_temp.c11_run_x('locale'),
  'locale:failed:provider_unbuilt_reference => 00000:|blocked:preflight_failed|schedule=blocked/3/0/preflight_failed/-|review=approved/2/-|lineage=0|events=0|delta=audit_events,cms_command_accessibility_evidence,cms_publication_schedules',
  'locale gate: the executor blocks a schedule over a no_fallback field [P2-S11-AC-004]');
select pg_temp.h11_raw_exec('platform_private.cms_field_definition_versions',
  $$update platform_private.cms_field_definition_versions set localization_mode = 'localized' where field_key = 'legal'$$);
select pg_temp.h11_raw_exec('platform_private.cms_content_type_versions',
  format($$update platform_private.cms_content_type_versions set state = 'superseded' where id = %L::uuid$$, pg_temp.h11w_version()));
select is(pg_temp.c11_run_p('schema', true),
  'schema:failed:schema_not_active => 00000:|refusal:version_set_stale|review=invalidated/3/dependency_changed|lineage=0|events=0|reservation=completed/409|details={}|delta=audit_events,cms_editorial_reviews,idempotency_records,outbox_events',
  'schema gate: a superseded schema version invalidates the review dependency_changed, commits the 409 version_set_stale refusal and appends nothing [P2-S11-AC-004]');
select is(pg_temp.c11_run_x('schema'),
  'schema:failed:schema_not_active => 00000:|blocked:approval_invalidated|schedule=blocked/3/0/approval_invalidated/-|review=invalidated/3/dependency_changed|lineage=0|events=0|delta=audit_events,cms_editorial_reviews,cms_publication_schedules,outbox_events',
  'schema gate: the executor finds a superseded schema version, invalidates the review and blocks the schedule [P2-S11-AC-004]');

select * from finish();
rollback;
