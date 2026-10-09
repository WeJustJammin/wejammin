-- Slice 11 lane S11-3c: platform_api.cms_get_entry_workflow (CMS-03B-15; tracker P2-S11-AC-049 .. AC-054,
-- AC-089, AC-096).  The entry workflow and submission-preparation read for an entry assignee, an owner-party
-- publisher or a reviewer assignee: the entry meta, the revision with its derived state (E2), a nullable
-- recomputed preparation (rebuilt manifest and version set, risk class, the 17-result submit-phase preflight),
-- the latest review with its frozen candidate, up to 16 schedules and 64 publications from one snapshot, and the
-- permitted next actions.  A safe read: nothing is written and nothing it computes is stored.  RED before
-- 20261005017900.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(33);

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
\ir phase_02_slice_11_rpc_reads/000-world.sqlinc

create temp table r11_snap(label text primary key, effects text not null) on commit drop;

select pg_temp.r11_entry(tag) from (values ('wf-draft'), ('wf-open'), ('wf-appr'), ('wf-pub'), ('wf-sib'), ('wf-held'), ('wf-arch'), ('wf-other'), ('wf-sched')) as t(tag);
-- A sibling revision (number 2) of wf-sib: it becomes the current draft; its payload hash is made the true projection hash.
select pg_temp.h11w_revision('wf-sib2', 'creatorPerson', 'en-US', '[]'::jsonb, 'wf-sib', 2);
select pg_temp.h11_raw_exec('platform_private.cms_entry_revisions', format(
  $$update platform_private.cms_entry_revisions set payload_hash = platform_private.cms_draft_content_hash(id, locale) where id = %L$$,
  pg_temp.h11w_uuid('wf-sib2:revision')));
select pg_temp.h11_raw_exec('platform_private.cms_content_entries',
  format($$update platform_private.cms_content_entries set lifecycle = 'held' where id = %L$$, pg_temp.h11w_uuid('wf-held:entry')));
select pg_temp.h11_raw_exec('platform_private.cms_content_entries',
  format($$update platform_private.cms_content_entries set lifecycle = 'archived' where id = %L$$, pg_temp.h11w_uuid('wf-arch:entry')));
-- wf-open: an open review with rvA assigned; wf-appr: an approved review (rvA approved).
select pg_temp.r11r_review('wfo', 'wf-open', 'editor');
select pg_temp.r11_assign_now('wfo-rvA', 'wfo', 'rvA');
select pg_temp.r11r_review('wfa', 'wf-appr', 'editor');
select pg_temp.r11_assign_now('wfa-rvA', 'wfa', 'rvA');
select pg_temp.r11_decide_now('wfa-dec', 'wfa', 'rvA', 'wfa-rvA', 'approve');
-- wf-sched: an approved review with a pending publish schedule (the revision is derived `scheduled`).
select pg_temp.r11r_review('wfs', 'wf-sched', 'editor');
select pg_temp.r11_assign_now('wfs-rvA', 'wfs', 'rvA');
select pg_temp.r11_decide_now('wfs-dec', 'wfs', 'rvA', 'wfs-rvA', 'approve');
select pg_temp.h11r_raw_insert('platform_private.cms_publication_schedules', pg_temp.s11_schedule_row(jsonb_build_object(
  'entry_id', pg_temp.h11w_uuid('wf-sched:entry'), 'revision_id', pg_temp.h11w_uuid('wf-sched:revision'), 'review_id', pg_temp.s11_id('wfs'),
  'dependency_hash', (select dependency_hash from platform_private.cms_editorial_reviews where id = pg_temp.s11_id('wfs')),
  'audience', 'public', 'state', 'pending', 'version', 1)));
-- wf-pub: 20 schedules and 70 one-row publication lineages (plus a superseded and a revoked lineage), all raw rows.
select pg_temp.r11r_review('wfp', 'wf-pub', 'editor');
select pg_temp.h11r_raw_insert('platform_private.cms_publication_schedules', pg_temp.s11_schedule_row(jsonb_build_object(
  'entry_id', pg_temp.h11w_uuid('wf-pub:entry'), 'revision_id', pg_temp.h11w_uuid('wf-pub:revision'), 'review_id', pg_temp.s11_id('wfp'),
  'local_datetime', timestamp '2027-02-01 09:00:00' + (n * interval '1 minute'), 'resolved_at_utc', timestamptz '2027-02-01 08:00:00+00' + (n * interval '1 minute'),
  'created_at', timestamptz '2026-10-05 10:00:00+00' + (n * interval '1 minute'), 'updated_at', timestamptz '2026-10-05 10:00:00+00' + (n * interval '1 minute'),
  'audience', 'sched' || lpad(n::text, 2, '0'),
  'state', case when n = 20 then 'blocked' else 'completed' end,
  'reason_code', case when n = 20 then 'preflight_failed' end,
  'actual_at_utc', case when n = 20 then null else timestamptz '2027-02-01 08:00:01+00' + (n * interval '1 minute') end,
  'deviation_seconds', case when n = 20 then null else 1 end)))
  from generate_series(1, 20) n;
select pg_temp.h11r_raw_insert('platform_private.cms_publication_versions', pg_temp.s11_publication_row(jsonb_build_object(
  'id', ('a9400000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'publication_id', ('a9400000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'entry_id', pg_temp.h11w_uuid('wf-pub:entry'), 'revision_id', pg_temp.h11w_uuid('wf-pub:revision'),
  'audience', 'aud' || lpad(n::text, 2, '0'), 'publication_hash', pg_temp.h11_sha256('wf-pub-' || n),
  'created_at', timestamptz '2026-10-05 12:00:00+00' + (n * interval '1 minute'), 'updated_at', timestamptz '2026-10-05 12:00:00+00' + (n * interval '1 minute'))))
  from generate_series(1, 70) n;
-- Lineage x1: v1 publish then v2 publish (v1 is derived `superseded`); lineage x2: v1 publish then v2 unpublish (v2 `revoked`).
select pg_temp.h11r_raw_insert('platform_private.cms_publication_versions', pg_temp.s11_publication_row(jsonb_build_object(
  'id', v.id, 'publication_id', v.lineage, 'audience', v.audience, 'version', v.version, 'supersedes_id', v.supersedes,
  'action', v.action, 'state', case when v.action = 'publish' then 'active' else 'revoked' end,
  'activated_at', case when v.action = 'publish' then timestamptz '2026-10-05 13:00:00+00' end,
  'revoked_at', case when v.action = 'publish' then null else timestamptz '2026-10-05 13:00:00+00' end,
  'entry_id', pg_temp.h11w_uuid('wf-pub:entry'), 'revision_id', pg_temp.h11w_uuid('wf-pub:revision'),
  'publication_hash', pg_temp.h11_sha256(v.id::text),
  'created_at', v.created, 'updated_at', v.created)))
  from (values
    ('a9400000-0000-4000-8000-0000000a0001'::uuid, 'a9400000-0000-4000-8000-0000000a0001'::uuid, 'x1', 1, null::uuid, 'publish', timestamptz '2026-10-05 15:00:01+00'),
    ('a9400000-0000-4000-8000-0000000a0002'::uuid, 'a9400000-0000-4000-8000-0000000a0001'::uuid, 'x1', 2, 'a9400000-0000-4000-8000-0000000a0001'::uuid, 'publish', timestamptz '2026-10-05 15:00:02+00'),
    ('a9400000-0000-4000-8000-0000000b0001'::uuid, 'a9400000-0000-4000-8000-0000000b0001'::uuid, 'x2', 1, null::uuid, 'publish', timestamptz '2026-10-05 15:00:03+00'),
    ('a9400000-0000-4000-8000-0000000b0002'::uuid, 'a9400000-0000-4000-8000-0000000b0001'::uuid, 'x2', 2, 'a9400000-0000-4000-8000-0000000b0001'::uuid, 'unpublish', timestamptz '2026-10-05 15:00:04+00')
  ) as v(id, lineage, audience, version, supersedes, action, created);

create or replace function pg_temp.r11w_rq(p_tag text, p_extra jsonb default '{}'::jsonb, p_evidence_mode text default 'healthy')
returns jsonb language sql as $body$
  select jsonb_build_object('entryId', pg_temp.h11w_uuid(p_tag || ':entry'), 'context', pg_temp.r11_ctx()) || p_extra
    || case p_evidence_mode
         when 'healthy' then jsonb_build_object('evidence', pg_temp.r11_evidence(pg_temp.h11w_uuid(p_tag || ':revision')))
         when 'null' then '{"evidence":null}'::jsonb
         when 'stale' then jsonb_build_object('evidence', pg_temp.r11_evidence(pg_temp.h11w_uuid(p_tag || ':revision'), 'healthy', interval '90 seconds'))
         when 'wrong-provider' then jsonb_build_object('evidence', pg_temp.r11_evidence(pg_temp.h11w_uuid(p_tag || ':revision'), 'healthy', interval '0 seconds', '{"providerVersion":"9"}'))
         when 'misbound' then jsonb_build_object('evidence', pg_temp.r11_evidence(pg_temp.h11w_uuid(p_tag || ':revision'), 'healthy', interval '0 seconds', jsonb_build_object('bindingHash', repeat('9', 64))))
         when 'blocked' then jsonb_build_object('evidence', pg_temp.r11_evidence(pg_temp.h11w_uuid(p_tag || ':revision'), 'blocked'))
         else '{}'::jsonb end
$body$;
create or replace function pg_temp.r11w_a11y(p_label text)
returns text language sql stable as $body$
  select result->>'outcome' || '/' || coalesce(result->>'reasonCode', '-')
    from jsonb_array_elements(pg_temp.r11_resp(p_label)#>'{preparation,preflight,results}') result
   where result->>'category' = 'accessibility'
$body$;

select ok(pg_temp.r11_posture('platform_private', 'cms_get_entry_workflow(jsonb)')
    and pg_temp.r11_posture('platform_api', 'cms_get_entry_workflow(jsonb)')
    and pg_temp.h11_private_definer('cms_workflow_read_scopes(uuid, uuid, uuid, uuid)')
    and pg_temp.h11_private_definer('cms_review_next_actions(uuid, uuid, uuid, text[])'),
  'cms_get_entry_workflow and its scope and action helpers are private SECURITY DEFINERs of the CMS definer nobody can execute; the platform_api wrapper is executable by service_role only [P2-S11-AC-052]');
insert into r11_snap(label, effects) values ('before', pg_temp.r11r_effects());

-- ---------------------------------------------------------------------------
-- The assignee reads a draft: the preparation.
-- ---------------------------------------------------------------------------
select pg_temp.r11r_call('draft', 'cms_get_entry_workflow', 'owner', pg_temp.r11w_rq('wf-draft'));
select is(pg_temp.r11_out('draft'), '00000:', 'an entry assignee reads the workflow of a draft entry [P2-S11-AC-049]');
select is(pg_temp.r11_keys(pg_temp.r11_resp('draft')), 'entry,permittedNextActions,preparation,publications,review,revision,schedules',
  'the document is exactly EntryWorkflowResource (7 members) [P2-S11-AC-049]');
select ok(
  pg_temp.r11_keys(pg_temp.r11_resp('draft')->'entry') = 'createdAt,id,updatedAt,version'
    and pg_temp.r11_resp('draft')#>>'{entry,version}' = '1' and pg_temp.r11_resp('draft')#>>'{entry,id}' = pg_temp.h11w_uuid('wf-draft:entry')::text
    and pg_temp.r11_keys(pg_temp.r11_resp('draft')->'revision') = 'contentHash,id,isCurrentDraft,locale,revisionNumber,schemaVersionId,state,validationState'
    and pg_temp.r11_resp('draft')#>>'{revision,state}' = 'draft' and (pg_temp.r11_resp('draft')#>>'{revision,isCurrentDraft}')::boolean
    and pg_temp.r11_resp('draft')#>>'{revision,revisionNumber}' = '1' and pg_temp.r11_resp('draft')#>>'{revision,validationState}' = 'valid'
    and pg_temp.r11_resp('draft')#>>'{revision,schemaVersionId}' = pg_temp.h11w_version()::text
    and pg_temp.r11_resp('draft')#>>'{revision,contentHash}' = (select payload_hash from platform_private.cms_entry_revisions where id = pg_temp.h11w_uuid('wf-draft:revision')),
  'the entry meta carries the aggregate version (the If-Match operand) and the revision its derived state, true content hash, locale, schema version and current-draft flag [P2-S11-AC-049]');
select ok(
  pg_temp.r11_keys(pg_temp.r11_resp('draft')->'preparation') = 'dependencyHash,dependencyManifest,frozenHash,preflight,riskClass,versionSet,workflowPolicy'
    and pg_temp.r11_resp('draft')#>'{preparation,dependencyManifest}' = pg_temp.r11_manifest(pg_temp.h11w_uuid('wf-draft:revision'))
    and pg_temp.r11_resp('draft')#>>'{preparation,dependencyHash}' = platform_private.cms_jcs_sha256(pg_temp.r11_manifest(pg_temp.h11w_uuid('wf-draft:revision')))
    and pg_temp.r11_resp('draft')#>>'{preparation,frozenHash}' = pg_temp.r11_resp('draft')#>>'{revision,contentHash}'
    and pg_temp.r11_resp('draft')#>'{preparation,versionSet}' = platform_private.cms_revision_version_set(
         pg_temp.h11w_uuid('wf-draft:revision'), pg_temp.r11_manifest(pg_temp.h11w_uuid('wf-draft:revision')))
    and pg_temp.r11_resp('draft')#>>'{preparation,riskClass}' = 'ordinary'
    and pg_temp.r11_resp('draft')#>'{preparation,workflowPolicy}' = pg_temp.r11_manifest(pg_temp.h11w_uuid('wf-draft:revision'))#>'{schema,workflowPolicy}',
  'the preparation serves the manifest, its hash, the version set, the risk class and the workflow policy exactly as the server rebuilds them, so a form can echo them unmodified [P2-S11-AC-089]');
select ok(
  jsonb_array_length(pg_temp.r11_resp('draft')#>'{preparation,preflight,results}') = 17
    and pg_temp.r11_resp('draft')#>>'{preparation,preflight,passed}' = 'true'
    and (select array_agg(result->>'category' order by ordinality) from jsonb_array_elements(pg_temp.r11_resp('draft')#>'{preparation,preflight,results}') with ordinality r(result, ordinality))
        = array['contract','schema','template','block','pattern','taxonomy','settings','relation','privacy','security','accessibility','media','route','locale','migration','domain_binding','revocation'],
  'the submit-phase preflight lists all seventeen categories in registry order and passes with healthy evidence [P2-S11-AC-096]');
select ok(
  pg_temp.r11_resp('draft')->'review' = 'null'::jsonb and pg_temp.r11_resp('draft')->'schedules' = '[]'::jsonb
    and pg_temp.r11_resp('draft')->'publications' = '[]'::jsonb
    and pg_temp.r11_resp('draft')->'permittedNextActions' = '["submit_review", "preview"]'::jsonb,
  'a draft with no review, schedule or publication offers the assignee submit_review and preview [P2-S11-AC-049]');
select ok(
  not pg_temp.r11_leaks(pg_temp.r11_resp('draft'), array[pg_temp.s11_id('creator')::text, pg_temp.s11_id('editor')::text,
    pg_temp.s11_id('org')::text, (select auth_user_id::text from r11_actor where key = 'owner')]),
  'the document carries no author, assignee, owner, party or account identifier [P2-S11-AC-051]');

-- Evidence: absent, stale, from another provider version, bound to other rows, or blocking.
select pg_temp.r11r_call('ev-null', 'cms_get_entry_workflow', 'owner', pg_temp.r11w_rq('wf-draft', '{}', 'null'));
select pg_temp.r11r_call('ev-absent', 'cms_get_entry_workflow', 'owner', pg_temp.r11w_rq('wf-draft', '{}', 'absent'));
select pg_temp.r11r_call('ev-stale', 'cms_get_entry_workflow', 'owner', pg_temp.r11w_rq('wf-draft', '{}', 'stale'));
select pg_temp.r11r_call('ev-provider', 'cms_get_entry_workflow', 'owner', pg_temp.r11w_rq('wf-draft', '{}', 'wrong-provider'));
select pg_temp.r11r_call('ev-misbound', 'cms_get_entry_workflow', 'owner', pg_temp.r11w_rq('wf-draft', '{}', 'misbound'));
select pg_temp.r11r_call('ev-blocked', 'cms_get_entry_workflow', 'owner', pg_temp.r11w_rq('wf-draft', '{}', 'blocked'));
select ok(
  pg_temp.r11w_a11y('ev-null') = 'unavailable/checker_failed' and pg_temp.r11w_a11y('ev-absent') = 'unavailable/checker_failed'
    and pg_temp.r11w_a11y('ev-stale') = 'unavailable/checker_failed' and pg_temp.r11w_a11y('ev-provider') = 'unavailable/checker_failed'
    and pg_temp.r11w_a11y('ev-misbound') = 'unavailable/checker_failed'
    and pg_temp.r11_out('ev-stale') = '00000:' and pg_temp.r11_out('ev-misbound') = '00000:'
    and pg_temp.r11_resp('ev-null')#>>'{preparation,preflight,passed}' = 'false',
  'absent, stale, other-provider and mis-bound evidence degrade the accessibility result to unavailable / checker_failed inside the report and never fail the read [P2-S11-AC-053]');
select ok(pg_temp.r11w_a11y('ev-blocked') = 'failed/blocking_finding' and pg_temp.r11_resp('ev-null')#>>'{preparation,frozenHash}' = pg_temp.r11_resp('draft')#>>'{preparation,frozenHash}',
  'blocked evidence is a failed blocking_finding and the rest of the preparation is identical whatever the proof [P2-S11-AC-096]');

-- ---------------------------------------------------------------------------
-- Other readers.
-- ---------------------------------------------------------------------------
select pg_temp.r11r_call('pub-draft', 'cms_get_entry_workflow', 'pub', pg_temp.r11w_rq('wf-draft'));
select ok(pg_temp.r11_out('pub-draft') = '00000:' and pg_temp.r11_resp('pub-draft')->'preparation' = 'null'::jsonb
    and pg_temp.r11_resp('pub-draft')->'permittedNextActions' = '["preview"]'::jsonb,
  'an owner-party publisher reads the draft but gets no preparation (only an assignee may submit) and may preview [P2-S11-AC-051]');
select pg_temp.r11r_call('editor-draft', 'cms_get_entry_workflow', 'editor', pg_temp.r11w_rq('wf-draft'));
select ok(pg_temp.r11_out('editor-draft') = '00000:' and pg_temp.r11_resp('editor-draft')->'preparation' <> 'null'::jsonb
    and pg_temp.r11_resp('editor-draft')->'permittedNextActions' = '["submit_review", "preview"]'::jsonb,
  'an entry editor assignee gets the preparation too [P2-S11-AC-051]');

-- The open review: a reviewer assignee reads, decides; the owner assigns.
select pg_temp.r11r_call('rvA-open', 'cms_get_entry_workflow', 'rvA', pg_temp.r11w_rq('wf-open', '{}', 'absent'));
select pg_temp.r11r_call('owner-open', 'cms_get_entry_workflow', 'owner', pg_temp.r11w_rq('wf-open', '{}', 'absent'));
select ok(
  pg_temp.r11_out('rvA-open') = '00000:' and pg_temp.r11_resp('rvA-open')#>>'{revision,state}' = 'submitted'
    and pg_temp.r11_resp('rvA-open')->'preparation' = 'null'::jsonb
    and pg_temp.r11_resp('rvA-open')#>>'{review,id}' = pg_temp.s11_id('wfo')::text
    and (pg_temp.r11_resp('rvA-open')->'review') - 'frozen' = platform_private.cms_editorial_review_resource(pg_temp.s11_id('wfo'))
    and pg_temp.r11_keys(pg_temp.r11_resp('rvA-open')#>'{review,frozen}') = 'dependencyHash,frozenHash,versionSet'
    and pg_temp.r11_resp('rvA-open')#>>'{review,frozen,frozenHash}' = pg_temp.r11_resp('rvA-open')#>>'{review,frozenHash}'
    and pg_temp.r11_resp('rvA-open')->'permittedNextActions' = '["record_decision", "preview"]'::jsonb,
  'a reviewer assignee reads the entry: the revision is derived `submitted`, the latest review is served with its frozen candidate, and they may record a decision and preview [P2-S11-AC-051]');
select ok(pg_temp.r11_resp('owner-open')->'permittedNextActions' = '["assign_reviewer", "preview"]'::jsonb
    and pg_temp.r11_resp('owner-open')->'preparation' = 'null'::jsonb,
  'the owner of the entry (an assignee) sees assign_reviewer and preview, and no preparation for a revision under review [P2-S11-AC-054]');

-- The approved review: derived states and the publisher.
select pg_temp.r11r_call('pub-appr', 'cms_get_entry_workflow', 'pub', pg_temp.r11w_rq('wf-appr', '{}', 'absent'));
select ok(pg_temp.r11_resp('pub-appr')#>>'{revision,state}' = 'approved'
    and pg_temp.r11_resp('pub-appr')->'permittedNextActions' = '["schedule", "preview", "publish"]'::jsonb,
  'an approved revision offers its owner-party publisher schedule, preview and publish [P2-S11-AC-054]');
select pg_temp.r11r_call('pub-sched', 'cms_get_entry_workflow', 'pub', pg_temp.r11w_rq('wf-sched', '{}', 'absent'));
select ok(pg_temp.r11_resp('pub-sched')#>>'{revision,state}' = 'scheduled'
    and jsonb_array_length(pg_temp.r11_resp('pub-sched')->'schedules') = 1
    and pg_temp.r11_keys(pg_temp.r11_resp('pub-sched')->'schedules'->0) = 'action,audience,id,reasonCode,resolvedUtc,state,version'
    and pg_temp.r11_resp('pub-sched')->'schedules'->0->>'state' = 'pending' and pg_temp.r11_resp('pub-sched')->'schedules'->0->'reasonCode' = 'null'::jsonb
    and pg_temp.r11_resp('pub-sched')->'permittedNextActions' = '["preview", "publish"]'::jsonb,
  'a pending publish schedule makes the revision `scheduled` (E2): the schedule is listed, schedule is no longer offered but publish still is [P2-S11-AC-054]');

-- Bounds, derived publication state and E2 `published`.
select pg_temp.r11r_call('pub-bounds', 'cms_get_entry_workflow', 'pub', pg_temp.r11w_rq('wf-pub', '{}', 'absent'));
select ok(
  jsonb_array_length(pg_temp.r11_resp('pub-bounds')->'schedules') = 16 and jsonb_array_length(pg_temp.r11_resp('pub-bounds')->'publications') = 64
    and pg_temp.r11_resp('pub-bounds')#>>'{revision,state}' = 'published'
    and pg_temp.r11_resp('pub-bounds')->'schedules'->0->>'audience' = 'sched20' and pg_temp.r11_resp('pub-bounds')->'schedules'->0->>'state' = 'blocked'
    and pg_temp.r11_resp('pub-bounds')->'schedules'->0->>'reasonCode' = 'preflight_failed'
    and pg_temp.r11_resp('pub-bounds')->'schedules'->15->>'audience' = 'sched05',
  'at most 16 schedules (newest first, a blocked one with its reason code) and 64 publications are served; a published revision is derived `published` [P2-S11-AC-050]');
select ok(
  pg_temp.r11_keys(pg_temp.r11_resp('pub-bounds')->'publications'->0) = 'action,audience,createdAt,locale,projectionState,publicationHash,publicationId,publicationVersionId,revisionId,state,version'
    and (select bool_and(item->>'projectionState' = 'pending') from jsonb_array_elements(pg_temp.r11_resp('pub-bounds')->'publications') item)
    and (select count(*) from jsonb_array_elements(pg_temp.r11_resp('pub-bounds')->'publications') item where item->>'audience' in ('x1', 'x2')) = 4
    and (select item->>'state' from jsonb_array_elements(pg_temp.r11_resp('pub-bounds')->'publications') item
          where item->>'audience' = 'x1' and item->>'version' = '1') = 'superseded'
    and (select item->>'state' from jsonb_array_elements(pg_temp.r11_resp('pub-bounds')->'publications') item
          where item->>'audience' = 'x1' and item->>'version' = '2') = 'active'
    and (select item->>'state' from jsonb_array_elements(pg_temp.r11_resp('pub-bounds')->'publications') item
          where item->>'audience' = 'x2' and item->>'version' = '2') = 'revoked',
  'a publication row carries its lineage id, own id, sequence, derived state (superseded / active / revoked), action, hash and projectionState pending (never converged) [P2-S11-AC-050]');

-- The revisionId parameter and the default.
select pg_temp.r11r_call('sib-default', 'cms_get_entry_workflow', 'owner', pg_temp.r11w_rq('wf-sib', '{}', 'absent'));
select pg_temp.r11r_call('sib-first', 'cms_get_entry_workflow', 'owner',
  pg_temp.r11w_rq('wf-sib', jsonb_build_object('revisionId', pg_temp.h11w_uuid('wf-sib:revision')), 'absent'));
select ok(
  pg_temp.r11_resp('sib-default')#>>'{revision,id}' = pg_temp.h11w_uuid('wf-sib2:revision')::text
    and (pg_temp.r11_resp('sib-default')#>>'{revision,isCurrentDraft}')::boolean
    and pg_temp.r11_resp('sib-first')#>>'{revision,id}' = pg_temp.h11w_uuid('wf-sib:revision')::text
    and not (pg_temp.r11_resp('sib-first')#>>'{revision,isCurrentDraft}')::boolean
    and pg_temp.r11_resp('sib-first')->'preparation' = 'null'::jsonb
    and pg_temp.r11_resp('sib-default')->'preparation' <> 'null'::jsonb,
  'no revisionId serves the current draft; an older revision is served with isCurrentDraft false and no preparation [P2-S11-AC-050]');

-- ---------------------------------------------------------------------------
-- Concealment, capability, lifecycle.
-- ---------------------------------------------------------------------------
select pg_temp.r11r_call('c-rvA', 'cms_get_entry_workflow', 'rvA', pg_temp.r11w_rq('wf-draft'), false);
select pg_temp.r11r_call('c-outsider', 'cms_get_entry_workflow', 'outsider', pg_temp.r11w_rq('wf-draft'), false);
select is(pg_temp.r11_out('c-rvA') || '|' || coalesce(pg_temp.r11_detail('c-rvA'), 'null') || ' ' || pg_temp.r11_out('c-outsider') || '|' || coalesce(pg_temp.r11_detail('c-outsider'), 'null'),
  'P0001:capability_missing|null P0001:capability_missing|null',
  'a confirmed member with no workflow read scope (an unassigned reviewer, a member with no capability) is 403 capability_missing [P2-S11-AC-051]');
select pg_temp.r11r_call('h-stranger', 'cms_get_entry_workflow', 'stranger', pg_temp.r11w_rq('wf-draft'), false);
select pg_temp.r11r_call('h-absent', 'cms_get_entry_workflow', 'owner', jsonb_build_object('entryId', extensions.gen_random_uuid(), 'context', pg_temp.r11_ctx()), false);
select pg_temp.r11r_call('h-foreign-revision', 'cms_get_entry_workflow', 'owner',
  pg_temp.r11w_rq('wf-draft', jsonb_build_object('revisionId', pg_temp.h11w_uuid('wf-other:revision')), 'absent'), false);
select pg_temp.r11r_call('h-absent-revision', 'cms_get_entry_workflow', 'owner',
  pg_temp.r11w_rq('wf-draft', jsonb_build_object('revisionId', extensions.gen_random_uuid()), 'absent'), false);
select pg_temp.r11r_call('h-archived', 'cms_get_entry_workflow', 'owner', pg_temp.r11w_rq('wf-arch', '{}', 'absent'), false);
select pg_temp.r11r_call('h-party', 'cms_get_entry_workflow', 'owner',
  jsonb_set(pg_temp.r11w_rq('wf-draft', '{}', 'absent'), '{context,actingPartyId}', to_jsonb(pg_temp.s11_id('creator'))), false);
select is(
  (select count(distinct pg_temp.r11_out(label) || '|' || coalesce(pg_temp.r11_detail(label), 'null'))::text || ':' || min(pg_temp.r11_out(label))
     from (values ('h-stranger'), ('h-absent'), ('h-foreign-revision'), ('h-absent-revision'), ('h-archived'), ('h-party')) as v(label)),
  '1:P0001:NOT_FOUND',
  'a non-member, an absent entry, a revision of another entry, an absent revision, an archived entry and another acting party are one indistinguishable NOT_FOUND [P2-S11-AC-051]');
select pg_temp.r11r_call('held', 'cms_get_entry_workflow', 'owner', pg_temp.r11w_rq('wf-held'));
select ok(pg_temp.r11_out('held') = '00000:' and pg_temp.r11_resp('held')->'permittedNextActions' = '[]'::jsonb
    and (select (result->>'outcome') || '/' || (result->>'reasonCode')
           from jsonb_array_elements(pg_temp.r11_resp('held')#>'{preparation,preflight,results}') result where result->>'category' = 'revocation') = 'failed/entry_unavailable',
  'a held entry is readable, offers no action and reports the revocation category as entry_unavailable [P2-S11-AC-051]');

-- ---------------------------------------------------------------------------
-- Structure, then the safe-read guarantee.
-- ---------------------------------------------------------------------------
select pg_temp.r11r_call('s-extra', 'cms_get_entry_workflow', 'owner', pg_temp.r11w_rq('wf-draft', '{"limit":2}'), false);
select pg_temp.r11r_call('s-missing', 'cms_get_entry_workflow', 'owner', jsonb_build_object('context', pg_temp.r11_ctx()), false);
select pg_temp.r11r_call('s-bad-id', 'cms_get_entry_workflow', 'owner', jsonb_build_object('entryId', 'nope', 'context', pg_temp.r11_ctx()), false);
select pg_temp.r11r_call('s-bad-rev', 'cms_get_entry_workflow', 'owner', pg_temp.r11w_rq('wf-draft', '{"revisionId":"nope"}', 'absent'), false);
select pg_temp.r11r_call('s-evidence', 'cms_get_entry_workflow', 'owner', pg_temp.r11w_rq('wf-draft', '{"evidence":"x"}', 'absent'), false);
select is(
  (select string_agg(label || '=' || pg_temp.r11_out(label), ' ' order by label) from r11_probe where label like 's-%'),
  's-bad-id=P0001:INVALID_REQUEST s-bad-rev=P0001:INVALID_REQUEST s-evidence=P0001:INVALID_REQUEST s-extra=P0001:INVALID_REQUEST s-missing=P0001:INVALID_REQUEST',
  'an unknown member, a missing or malformed id and a non-object proof are INVALID_REQUEST [P2-S11-AC-050]');
select ok(pg_temp.r11r_effects() = (select effects from r11_snap where label = 'before'),
  'the read writes nothing: reviews, assignments, decisions, reservations, audit, events, tokens, schedules, publications and entry versions are unchanged by every read above [P2-S11-AC-053]');

select * from finish();
rollback;
