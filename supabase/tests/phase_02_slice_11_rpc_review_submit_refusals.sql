-- Slice 11 lane S11-3a: cms_submit_review refusals (CMS-03B-05; tracker P2-S11-AC-006, AC-007,
-- AC-009, AC-035, AC-094 .. AC-097, AC-102).  Every refusal is the reason token as the whole P0001
-- message (structured members ride in a JSON-object DETAIL: the current dependencyHash, the
-- preflight entries, the preflight-unavailable class) and commits nothing: no review, dependency
-- row, reservation, settings snapshot, audit record or event.  The contract and the committed
-- effects are in phase_02_slice_11_rpc_review_submit.sql.  RED before 20261005017640.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(25);

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

create temp table r11_snap(label text primary key, effects text not null) on commit drop;

-- One entry per scenario (each submission consumes the entry's current draft).
select pg_temp.r11_entry(tag) from (values ('ref-base'), ('ref-live'), ('ref-approved'), ('ref-rejected'),
  ('ref-old'), ('ref-hash'), ('ref-dep'), ('ref-pre'), ('ref-evi'), ('ref-arch'), ('ref-cap'), ('ref-big'), ('ref-ver')) as t(tag);
select pg_temp.r11_entry('ref-tax', 'creator', 'Tagged', jsonb_build_array(extensions.gen_random_uuid()));
select pg_temp.r11_entry('ref-other');

-- Live and terminal reviews (frozen from the real manifest) for the not-submittable cases.
create or replace function pg_temp.r11_review_of(p_key text, p_tag text, p_state text)
returns void
language plpgsql
as $body$
declare
  revision uuid := pg_temp.h11w_uuid(p_tag || ':revision');
  manifest jsonb := pg_temp.r11_manifest(revision);
  policy jsonb := manifest->'schema'->'workflowPolicy';
begin
  perform pg_temp.h11r_review(p_key, jsonb_build_object(
    'revision_id', revision, 'entry_id', pg_temp.h11w_uuid(p_tag || ':entry'),
    'frozen_hash', (select payload_hash from platform_private.cms_entry_revisions where id = revision),
    'dependency_manifest', manifest, 'dependency_hash', platform_private.cms_jcs_sha256(manifest),
    'activation_evidence', manifest->'schema'->'activationEvidence',
    'workflow_policy_key', policy->>'key', 'workflow_policy_version', (policy->>'version')::bigint,
    'workflow_policy_hash', policy->>'policyHash', 'risk_class', policy->>'riskClass',
    'required_decision_count', (policy->>'requiredDecisionCount')::integer,
    'required_capabilities', policy->'requiredCapabilities',
    'approval_evidence_hash', policy->>'approvalEvidenceHash', 'submitted_by', pg_temp.s11_id('editor')));
  if p_state in ('approved', 'rejected') then
    perform pg_temp.r11_assign_now(p_key || '-asg', p_key, 'rvA');
    perform pg_temp.r11_decide_now(p_key || '-dec', p_key, 'rvA', p_key || '-asg',
      case p_state when 'approved' then 'approve' else 'reject' end);
  end if;
end;
$body$;
select pg_temp.r11_review_of('rvLive', 'ref-live', 'open');
select pg_temp.r11_review_of('rvApproved', 'ref-approved', 'approved');
select pg_temp.r11_review_of('rvRejected', 'ref-rejected', 'rejected');

-- ref-old: a newer revision supersedes the one under test as the current draft.
select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_entry_revisions(
  id, owner_id, entry_id, revision_number, schema_version_id, template_version_id, taxonomy_version_ids,
  parent_revision_ids, locale, payload_hash, author_person_id, acting_party_id, state, version,
  validation_state, validation_report, created_at, updated_at)
select pg_temp.h11w_uuid('ref-old:revision2'), revision.owner_id, revision.entry_id, 2, revision.schema_version_id, null, '[]'::jsonb,
       jsonb_build_array(revision.id), 'en-US', revision.payload_hash, revision.author_person_id, revision.acting_party_id,
       'draft', 1, 'valid', '{}'::jsonb, statement_timestamp(), statement_timestamp()
  from platform_private.cms_entry_revisions revision where revision.id = pg_temp.h11w_uuid('ref-old:revision');
update platform_private.cms_content_entries
   set current_draft_revision_id = pg_temp.h11w_uuid('ref-old:revision2')
 where id = pg_temp.h11w_uuid('ref-old:entry');

select ok(
  (select count(*) = 3 from platform_private.cms_editorial_reviews where entry_id in
     (pg_temp.h11w_uuid('ref-live:entry'), pg_temp.h11w_uuid('ref-approved:entry'), pg_temp.h11w_uuid('ref-rejected:entry')))
    and platform_private.cms_revision_effective_state(pg_temp.h11w_uuid('ref-live:revision')) = 'submitted'
    and platform_private.cms_revision_effective_state(pg_temp.h11w_uuid('ref-approved:revision')) = 'approved'
    and platform_private.cms_revision_effective_state(pg_temp.h11w_uuid('ref-rejected:revision')) = 'rejected',
  'control: three revisions are under an open, approved and rejected review (derived state submitted, approved, rejected)');
insert into r11_snap(label, effects) values ('start', pg_temp.r11_effects());

-- ---------------------------------------------------------------------------
-- Structure.
-- ---------------------------------------------------------------------------
select pg_temp.r11_scall('m-risk', 'owner', pg_temp.r11_sreq('ref-base', jsonb_build_object('riskClass', 'ordinary')), false);
select pg_temp.r11_scall('m-no-hash', 'owner', pg_temp.r11_sreq('ref-base', '{}'::jsonb, array['frozenHash']), false);
select pg_temp.r11_scall('m-no-manifest', 'owner', pg_temp.r11_sreq('ref-base', '{}'::jsonb, array['dependencyManifest']), false);
select pg_temp.r11_scall('m-entry', 'owner', pg_temp.r11_sreq('ref-base', jsonb_build_object('entryId', 'nope')), false);
select pg_temp.r11_scall('m-revision', 'owner', pg_temp.r11_sreq('ref-base', jsonb_build_object('revisionId', 7)), false);
select pg_temp.r11_scall('m-ifmatch', 'owner', pg_temp.r11_sreq('ref-base', jsonb_build_object('ifMatch', '2')), false);
select pg_temp.r11_scall('m-owner-key', 'owner', pg_temp.r11_sreq('ref-base', jsonb_build_object('ownerId', pg_temp.s11_id('org'))), false);
select is(
  (select string_agg(label || '=' || pg_temp.r11_out(label), ';' order by label)
     from (values ('m-risk'), ('m-no-hash'), ('m-no-manifest'), ('m-entry'), ('m-revision'), ('m-ifmatch'), ('m-owner-key')) as v(label)),
  'm-entry=P0001:INVALID_REQUEST;m-ifmatch=P0001:INVALID_REQUEST;m-no-hash=P0001:INVALID_REQUEST;m-no-manifest=P0001:INVALID_REQUEST;m-owner-key=P0001:INVALID_REQUEST;m-revision=P0001:INVALID_REQUEST;m-risk=P0001:INVALID_REQUEST',
  'a caller riskClass or owner, a missing member, a malformed id and an If-Match that disagrees with the entry version are INVALID_REQUEST [P2-S11-AC-006]');
select pg_temp.r11_scall('m-hash-format', 'owner', pg_temp.r11_sreq('ref-base', jsonb_build_object('frozenHash', upper(repeat('a', 64)))), false);
select pg_temp.r11_scall('m-manifest-type', 'owner', pg_temp.r11_sreq('ref-base', jsonb_build_object('dependencyManifest', '[]'::jsonb)), false);
select pg_temp.r11_scall('m-manifest-big', 'owner', pg_temp.r11_sreq('ref-big', jsonb_build_object('dependencyManifest',
  jsonb_set(pg_temp.r11_manifest(pg_temp.h11w_uuid('ref-big:revision')), '{terms}',
    (select jsonb_agg(jsonb_build_object('id', extensions.gen_random_uuid(), 'hash', repeat('a', 64))) from generate_series(1, 300))))), false);
select pg_temp.r11_scall('m-version', 'owner', pg_temp.r11_sreq('ref-base', jsonb_build_object('expectedVersion', 'x')), false);
select is(
  (select string_agg(label || '=' || pg_temp.r11_out(label) || coalesce(pg_temp.r11_detail(label), ''), ';' order by label)
     from (values ('m-hash-format'), ('m-manifest-type'), ('m-manifest-big'), ('m-version')) as v(label)),
  'm-hash-format=P0001:VALIDATION_FAILED["/frozenHash"];m-manifest-big=P0001:VALIDATION_FAILED["/dependencyManifest"];m-manifest-type=P0001:VALIDATION_FAILED["/dependencyManifest"];m-version=P0001:VALIDATION_FAILED["/expectedVersion"]',
  'a non-lowercase-hex hash, a non-object or over-bound manifest and a non-decimal version are VALIDATION_FAILED at their pointer [P2-S11-AC-006]');

-- ---------------------------------------------------------------------------
-- Concealment (404) and the assignee gate (403).
-- ---------------------------------------------------------------------------
select pg_temp.r11_scall('h-stranger', 'stranger', pg_temp.r11_sreq('ref-base'), false);
select pg_temp.r11_scall('h-absent', 'owner', pg_temp.r11_sreq('ref-base', jsonb_build_object('entryId', extensions.gen_random_uuid())), false);
select pg_temp.r11_scall('h-party', 'owner', pg_temp.r11_sreq('ref-base', jsonb_build_object('context', pg_temp.r11_ctx(interval '60 seconds', true, pg_temp.s11_id('creator')))), false);
select pg_temp.r11_scall('h-foreign-revision', 'owner', pg_temp.r11_sreq('ref-base', jsonb_build_object('revisionId', pg_temp.h11w_uuid('ref-other:revision'))), false);
select pg_temp.r11_scall('h-absent-revision', 'owner', pg_temp.r11_sreq('ref-base', jsonb_build_object('revisionId', extensions.gen_random_uuid())), false);
select is(
  (select count(distinct pg_temp.r11_out(label) || '|' || coalesce(pg_temp.r11_detail(label), 'null'))::text || ':' || min(pg_temp.r11_out(label))
     from (values ('h-stranger'), ('h-absent'), ('h-party'), ('h-foreign-revision'), ('h-absent-revision')) as v(label)),
  '1:P0001:NOT_FOUND',
  'a non-member, an absent entry, another acting party, a revision of another entry and an absent revision are one indistinguishable NOT_FOUND [P2-S11-AC-007]');
select pg_temp.r11_scall('f-outsider', 'outsider', pg_temp.r11_sreq('ref-base'), false);
select pg_temp.r11_scall('f-reviewer', 'rvA', pg_temp.r11_sreq('ref-base'), false);
select pg_temp.r11_scall('f-publisher', 'pub', pg_temp.r11_sreq('ref-base'), false);
select is(
  (select string_agg(label || '=' || pg_temp.r11_out(label) || '|' || coalesce(pg_temp.r11_detail(label), 'null'), ';' order by label)
     from (values ('f-outsider'), ('f-reviewer'), ('f-publisher')) as v(label)),
  'f-outsider=P0001:capability_missing|null;f-publisher=P0001:capability_missing|null;f-reviewer=P0001:capability_missing|null',
  'a visible entry with no assignment is 403 capability_missing [P2-S11-AC-007]');

-- ---------------------------------------------------------------------------
-- The entry CAS and the revision gates.
-- ---------------------------------------------------------------------------
select pg_temp.r11_scall('v-stale', 'owner', pg_temp.r11_sreq('ref-ver', jsonb_build_object('expectedVersion', '2', 'ifMatch', '2')), false);
select ok(pg_temp.r11_out('v-stale') = 'P0001:VERSION_MISMATCH'
    and pg_temp.r11_detail('v-stale')::jsonb = '{"expectedVersion":"2","currentVersion":"1"}'::jsonb,
  'a stale entry version is VERSION_MISMATCH with the expected and current versions [P2-S11-AC-008]');
select pg_temp.r11_scall('n-old', 'owner', pg_temp.r11_sreq('ref-old'), false);
select pg_temp.r11_scall('n-live', 'owner', pg_temp.r11_sreq('ref-live'), false);
select pg_temp.r11_scall('n-approved', 'owner', pg_temp.r11_sreq('ref-approved'), false);
select pg_temp.r11_scall('n-rejected', 'owner', pg_temp.r11_sreq('ref-rejected'), false);
select is(
  (select string_agg(label || '=' || pg_temp.r11_out(label), ';' order by label)
     from (values ('n-old'), ('n-live'), ('n-approved'), ('n-rejected')) as v(label)),
  'n-approved=P0001:revision_not_submittable;n-live=P0001:revision_not_submittable;n-old=P0001:revision_not_submittable;n-rejected=P0001:revision_not_submittable',
  'a superseded revision and a revision under an open, approved or rejected review are 409 revision_not_submittable [P2-S11-AC-005]');
select pg_temp.r11_scall('x-hash', 'owner', pg_temp.r11_sreq('ref-hash', jsonb_build_object('frozenHash', repeat('1', 64))), false);
select is(pg_temp.r11_out('x-hash') || pg_temp.r11_detail('x-hash'), 'P0001:VALIDATION_FAILED["/frozenHash"]',
  'a frozen hash that is not the stored payload hash is VALIDATION_FAILED at /frozenHash [P2-S11-AC-005]');

-- ---------------------------------------------------------------------------
-- The manifest must be rebuilt bit for bit.
-- ---------------------------------------------------------------------------
select pg_temp.r11_scall('d-settings', 'owner', pg_temp.r11_sreq('ref-dep', jsonb_build_object('dependencyManifest',
  jsonb_set(pg_temp.r11_manifest(pg_temp.h11w_uuid('ref-dep:revision')), '{settings,hash}', to_jsonb(repeat('9', 64))))), false);
select pg_temp.r11_scall('d-extra', 'owner', pg_temp.r11_sreq('ref-dep', jsonb_build_object('dependencyManifest',
  pg_temp.r11_manifest(pg_temp.h11w_uuid('ref-dep:revision')) || '{"extra":true}'::jsonb)), false);
select pg_temp.r11_scall('d-checker', 'owner', pg_temp.r11_sreq('ref-dep', jsonb_build_object('dependencyManifest',
  jsonb_set(pg_temp.r11_manifest(pg_temp.h11w_uuid('ref-dep:revision')), '{checker,version}', '"2"'))), false);
select ok(
  (select bool_and(pg_temp.r11_out(label) = 'P0001:dependency_changed'
                   and pg_temp.r11_detail(label)::jsonb = jsonb_build_object('dependencyHash',
                       platform_private.cms_jcs_sha256(pg_temp.r11_manifest(pg_temp.h11w_uuid('ref-dep:revision')))))
     from (values ('d-settings'), ('d-extra'), ('d-checker')) as v(label)),
  'a submitted manifest that differs from the rebuilt one in any member is 409 dependency_changed carrying only the CURRENT dependencyHash [P2-S11-AC-005]');

-- ---------------------------------------------------------------------------
-- The preflight registry (submit phase).
-- ---------------------------------------------------------------------------
select pg_temp.r11_scall('p-failed', 'owner', pg_temp.r11_sreq('ref-tax'), false);
select ok(
  pg_temp.r11_out('p-failed') = 'P0001:preflight_failed'
    and jsonb_array_length(pg_temp.r11_detail('p-failed')::jsonb->'preflight') = 17
    and pg_temp.r11_keys(pg_temp.r11_detail('p-failed')::jsonb) = 'preflight'
    and (select bool_and(pg_temp.r11_keys(entry) = 'category,outcome,reasonCode')
           from jsonb_array_elements(pg_temp.r11_detail('p-failed')::jsonb->'preflight') entry)
    and (pg_temp.r11_detail('p-failed')::jsonb->'preflight') @>
        '[{"category":"taxonomy","outcome":"failed","reasonCode":"provider_unbuilt_reference"}]'::jsonb
    and (select count(*) from jsonb_array_elements(pg_temp.r11_detail('p-failed')::jsonb->'preflight') entry
          where entry->>'outcome' = 'passed') = 16,
  'a failed category refuses 422 preflight_failed; the DETAIL lists all 17 {category, outcome, reasonCode} entries and nothing else [P2-S11-AC-097]');
select pg_temp.r11_scall('p-no-evidence', 'owner', pg_temp.r11_sreq('ref-pre', jsonb_build_object('evidence', null)), false);
select pg_temp.r11_scall('p-failed-run', 'owner', pg_temp.r11_sreq('ref-pre', jsonb_build_object('evidence',
  pg_temp.r11_evidence(pg_temp.h11w_uuid('ref-pre:revision'), 'failed'))), false);
select pg_temp.r11_scall('p-blocked-run', 'owner', pg_temp.r11_sreq('ref-pre', jsonb_build_object('evidence',
  pg_temp.r11_evidence(pg_temp.h11w_uuid('ref-pre:revision'), 'blocked'))), false);
select ok(
  pg_temp.r11_out('p-no-evidence') = 'P0001:DEPENDENCY_UNAVAILABLE'
    and pg_temp.r11_detail('p-no-evidence')::jsonb = '{"dependencyClass":"preflight"}'::jsonb
    and pg_temp.r11_out('p-failed-run') = 'P0001:DEPENDENCY_UNAVAILABLE'
    and pg_temp.r11_detail('p-failed-run')::jsonb = '{"dependencyClass":"preflight"}'::jsonb,
  'absent evidence and a failed checker run make accessibility unavailable: 503 DEPENDENCY_UNAVAILABLE with dependencyClass preflight (DEC-159: the Worker adds retryable) [P2-S11-AC-097]');
select ok(
  pg_temp.r11_out('p-blocked-run') = 'P0001:preflight_failed'
    and (pg_temp.r11_detail('p-blocked-run')::jsonb->'preflight') @>
        '[{"category":"accessibility","outcome":"failed","reasonCode":"blocking_finding"}]'::jsonb,
  'a blocked checker run is a failed accessibility category (blocking_finding): 422 preflight_failed [P2-S11-AC-101]');
select pg_temp.r11_scall('e-stale', 'owner', pg_temp.r11_sreq('ref-evi', jsonb_build_object('evidence',
  pg_temp.r11_evidence(pg_temp.h11w_uuid('ref-evi:revision'), 'healthy', interval '90 seconds'))), false);
select pg_temp.r11_scall('e-bound', 'owner', pg_temp.r11_sreq('ref-evi', jsonb_build_object('evidence',
  pg_temp.r11_evidence(pg_temp.h11w_uuid('ref-evi:revision'), 'healthy', interval '0 seconds', jsonb_build_object('bindingHash', repeat('2', 64))))), false);
select pg_temp.r11_scall('e-provider', 'owner', pg_temp.r11_sreq('ref-evi', jsonb_build_object('evidence',
  pg_temp.r11_evidence(pg_temp.h11w_uuid('ref-evi:revision'), 'healthy', interval '0 seconds', jsonb_build_object('providerVersion', '9')))), false);
select ok(
  pg_temp.r11_out('e-stale') = 'P0001:preflight_evidence_stale'
    and pg_temp.r11_out('e-provider') = 'P0001:preflight_evidence_stale'
    and pg_temp.r11_out('e-bound') = 'P0001:dependency_changed'
    and pg_temp.r11_detail('e-bound')::jsonb = jsonb_build_object('dependencyHash',
          platform_private.cms_jcs_sha256(pg_temp.r11_manifest(pg_temp.h11w_uuid('ref-evi:revision')))),
  'evidence older than 60 s or from another provider version is 409 preflight_evidence_stale; evidence bound to other rows is 409 dependency_changed with the current hash [P2-S11-AC-102]');
update platform_private.cms_content_entries set lifecycle = 'archived' where id = pg_temp.h11w_uuid('ref-arch:entry');
select pg_temp.r11_scall('p-archived', 'owner', pg_temp.r11_sreq('ref-arch'), false);
select ok(pg_temp.r11_out('p-archived') = 'P0001:preflight_failed'
    and (pg_temp.r11_detail('p-archived')::jsonb->'preflight') @>
        '[{"category":"revocation","outcome":"failed","reasonCode":"entry_unavailable"}]'::jsonb,
  'an archived entry fails the revocation category (entry_unavailable) [P2-S11-AC-096]');

update identity_private.organization_actor_grant set active = false
 where organization_id = pg_temp.s11_id('org') and person_id = pg_temp.s11_id('creator') and capability_code = 'cms.author';
select pg_temp.r11_scall('f-lapsed-author', 'owner', pg_temp.r11_sreq('ref-cap'), false);
select is(pg_temp.r11_out('f-lapsed-author') || '|' || coalesce(pg_temp.r11_detail('f-lapsed-author'), 'null'),
  'P0001:capability_missing|null',
  'a deactivated cms.author grant revokes the creator''s assignments (DEC-143) and the submit is 403 capability_missing [P2-S11-AC-007]');

select is(pg_temp.r11_effects(), (select effects from r11_snap where label = 'start'),
  'every refusal above left no review, dependency row, reservation, audit record or outbox event behind [P2-S11-AC-009]');

select * from finish();
rollback;
