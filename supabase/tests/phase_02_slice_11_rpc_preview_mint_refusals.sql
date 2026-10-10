-- Slice 11 lane S11-3c: cms_mint_preview refusals (CMS-03B-08, E5; tracker P2-S11-AC-024, AC-025,
-- AC-026, AC-027, AC-089, AC-117).  Every refusal is the reason token as the whole P0001 message
-- (structured members ride in a JSON DETAIL: the pointer array of a validation failure, the
-- expected/current versions of a stale If-Match) and commits nothing: no token row, reservation,
-- settings snapshot, audit record or event.  The contract, the committed effects and the replay are
-- in phase_02_slice_11_rpc_preview_mint.sql.  RED before 20261005017860.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(27);

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
\ir phase_02_slice_11_rpc_review/030-submit.sqlinc
\ir phase_02_slice_11_rpc_preview/000-world.sqlinc

create temp table r11_snap(label text primary key, effects text not null) on commit drop;

select pg_temp.r11p_key();
select pg_temp.r11_entry('mr-1');
select pg_temp.r11_entry('mr-2');
select pg_temp.r11_entry('mr-3');
select pg_temp.r11_entry('mr-4');
select pg_temp.r11_entry('mr-5');
select pg_temp.r11_entry('mr-6');
select pg_temp.r11_entry('mr-other');
-- A sibling revision (number 2) of entry mr-4, inserted before any review of it.
select pg_temp.h11w_revision('mr-4b', 'creatorPerson', 'en-US', '[]'::jsonb, 'mr-4', 2);

create or replace function pg_temp.r11p_label_failures(p_prefix text, p_expected text)
returns text
language sql
stable
as $body$
  select coalesce(string_agg(probe.label || '=' || pg_temp.r11_out(probe.label) || coalesce('/' || probe.detail, ''), ' ' order by probe.label), '')
    from r11_probe probe
   where probe.label like p_prefix || '%'
     and (pg_temp.r11_out(probe.label) || coalesce('/' || probe.detail, '')) is distinct from p_expected
$body$;

-- Look up the owner snapshot already initialized by the world saved-resource fixture.
select pg_temp.r11p_vs('mr-1');
insert into r11_snap(label, effects) values ('before', pg_temp.r11p_effects());

-- ---------------------------------------------------------------------------
-- Structure.
-- ---------------------------------------------------------------------------
select pg_temp.r11p_mcall('st-no-key', 'owner', pg_temp.r11p_mreq('mr-1', '{}', array['idempotencyKey']), false);
select pg_temp.r11p_mcall('st-no-set', 'owner', pg_temp.r11p_mreq('mr-1', '{}', array['versionSet']), false);
select pg_temp.r11p_mcall('st-no-route', 'owner', pg_temp.r11p_mreq('mr-1', '{}', array['route']), false);
select pg_temp.r11p_mcall('st-no-version', 'owner', pg_temp.r11p_mreq('mr-1', '{}', array['expectedVersion']), false);
select pg_temp.r11p_mcall('st-evidence', 'owner', pg_temp.r11p_mreq('mr-1', '{"evidence":null}'), false);
select pg_temp.r11p_mcall('st-owner', 'owner', pg_temp.r11p_mreq('mr-1', jsonb_build_object('ownerId', pg_temp.s11_id('org'))), false);
select pg_temp.r11p_mcall('st-capability', 'owner', pg_temp.r11p_mreq('mr-1', '{"capability":"cms.publisher"}'), false);
select pg_temp.r11p_mcall('st-entry-type', 'owner', pg_temp.r11p_mreq('mr-1', '{"entryId":7}'), false);
select pg_temp.r11p_mcall('st-entry-bad', 'owner', pg_temp.r11p_mreq('mr-1', '{"entryId":"nope"}'), false);
select pg_temp.r11p_mcall('st-entry-upper', 'owner', pg_temp.r11p_mreq('mr-1', jsonb_build_object('entryId', upper(pg_temp.h11w_uuid('mr-1:entry')::text))), false);
select pg_temp.r11p_mcall('st-revision-bad', 'owner', pg_temp.r11p_mreq('mr-1', '{"revisionId":"nope"}'), false);
select pg_temp.r11p_mcall('st-disagree', 'owner', pg_temp.r11p_mreq('mr-1', '{"ifMatch":"2"}'), false);
select pg_temp.r11p_mcall('st-null-request', 'owner', 'null'::jsonb, false);
select is(pg_temp.r11p_label_failures('st-', 'P0001:INVALID_REQUEST'), '',
  'a missing, unknown (evidence, owner, capability) or malformed member, a non-uuid id and a disagreeing If-Match/expectedVersion are INVALID_REQUEST [P2-S11-AC-024]');

select pg_temp.r11p_mcall('vf-ver-0', 'owner', pg_temp.r11p_mreq('mr-1', '{"expectedVersion":"0","ifMatch":"0"}'), false);
select pg_temp.r11p_mcall('vf-ver-text', 'owner', pg_temp.r11p_mreq('mr-1', '{"expectedVersion":"abc","ifMatch":"abc"}'), false);
select pg_temp.r11p_mcall('vf-ver-number', 'owner', pg_temp.r11p_mreq('mr-1', '{"expectedVersion":1,"ifMatch":"1"}'), false);
select pg_temp.r11p_mcall('vf-ver-big', 'owner', pg_temp.r11p_mreq('mr-1', '{"expectedVersion":"9223372036854775808","ifMatch":"9223372036854775808"}'), false);
select is(pg_temp.r11p_label_failures('vf-ver', 'P0001:VALIDATION_FAILED/["/expectedVersion"]'), '',
  'a zero, non-decimal, non-string or over-int64 expectedVersion is VALIDATION_FAILED at /expectedVersion [P2-S11-AC-024]');
select pg_temp.r11p_mcall('vf-if-0', 'owner', pg_temp.r11p_mreq('mr-1', '{"ifMatch":"0"}'), false);
select pg_temp.r11p_mcall('vf-if-text', 'owner', pg_temp.r11p_mreq('mr-1', '{"ifMatch":"x1"}'), false);
select is(pg_temp.r11p_label_failures('vf-if', 'P0001:VALIDATION_FAILED/["/ifMatch"]'), '',
  'a zero or non-decimal ifMatch is VALIDATION_FAILED at /ifMatch [P2-S11-AC-024]');
select pg_temp.r11p_mcall('vf-loc-1', 'owner', pg_temp.r11p_mreq('mr-1', '{"locale":"e"}'), false);
select pg_temp.r11p_mcall('vf-loc-2', 'owner', pg_temp.r11p_mreq('mr-1', '{"locale":"en_US"}'), false);
select pg_temp.r11p_mcall('vf-loc-3', 'owner', pg_temp.r11p_mreq('mr-1', jsonb_build_object('locale', 'en-' || repeat('a', 33))), false);
select pg_temp.r11p_mcall('vf-loc-4', 'owner', pg_temp.r11p_mreq('mr-1', '{"locale":5}'), false);
select is(pg_temp.r11p_label_failures('vf-loc', 'P0001:VALIDATION_FAILED/["/locale"]'), '',
  'a malformed locale (one letter, underscore, 36 characters, non-string) is VALIDATION_FAILED at /locale [P2-S11-AC-024]');
select pg_temp.r11p_mcall('vf-aud-1', 'owner', pg_temp.r11p_mreq('mr-1', '{"audience":"Public"}'), false);
select pg_temp.r11p_mcall('vf-aud-2', 'owner', pg_temp.r11p_mreq('mr-1', '{"audience":" public"}'), false);
select pg_temp.r11p_mcall('vf-aud-3', 'owner', pg_temp.r11p_mreq('mr-1', '{"audience":""}'), false);
select pg_temp.r11p_mcall('vf-aud-4', 'owner', pg_temp.r11p_mreq('mr-1', jsonb_build_object('audience', repeat('a', 49))), false);
select pg_temp.r11p_mcall('vf-aud-5', 'owner', pg_temp.r11p_mreq('mr-1', '{"audience":"a b"}'), false);
select is(pg_temp.r11p_label_failures('vf-aud', 'P0001:VALIDATION_FAILED/["/audience"]'), '',
  'an audience outside ^[a-z0-9_-]{1,48}$ (case, padding, empty, 49 characters, space) is VALIDATION_FAILED at /audience, matched as submitted [P2-S11-AC-024]');

-- The route grammar: one leading slash, a path only, normalized, no control characters.
select pg_temp.r11p_mcall('vf-route-' || t.label, 'owner', pg_temp.r11p_mreq('mr-1', jsonb_build_object('route', t.route)), false)
from (values
  ('empty', ''), ('no-slash', 'preview/article'), ('protocol-relative', '//evil.example/x'),
  ('absolute-url', 'https://evil.example/x'), ('query', '/a?b=1'), ('fragment', '/a#b'),
  ('backslash', '/a\b'), ('nul-like-c0', '/a' || chr(1) || 'b'), ('del', '/a' || chr(127)),
  ('c1', '/a' || chr(133) || 'b'), ('dot', '/a/./b'), ('dotdot', '/a/../b'), ('trailing-dotdot', '/a/..'),
  ('empty-interior', '/a//b'), ('pct-dot', '/a/%2e/b'), ('pct-dot-upper', '/a/%2E%2e/b'),
  ('pct-slash', '/a%2Fb'), ('pct-backslash', '/a%5cb'), ('too-long', '/' || repeat('a', 2048)),
  ('tab', '/a' || chr(9) || 'b'), ('newline', '/a' || chr(10))
) as t(label, route);
select pg_temp.r11p_mcall('vf-route-type', 'owner', pg_temp.r11p_mreq('mr-1', '{"route":7}'), false);
select is(pg_temp.r11p_label_failures('vf-route', 'P0001:VALIDATION_FAILED/["/route"]'), '',
  'a route that is empty, relative, a URL, protocol-relative, carries a query, fragment, backslash, control character, dot or empty segment, percent-encoded dot/slash/backslash, or exceeds 2,048 characters is VALIDATION_FAILED at /route [P2-S11-AC-024]');

select pg_temp.r11p_mcall('ok-route-root', 'owner', pg_temp.r11p_mreq('mr-1', '{"route":"/"}'), false);
select pg_temp.r11p_mcall('ok-route-dir', 'owner', pg_temp.r11p_mreq('mr-1', '{"route":"/a/b/"}'), false);
select pg_temp.r11p_mcall('ok-route-unicode', 'owner', pg_temp.r11p_mreq('mr-1', jsonb_build_object('route', '/caf' || chr(233) || '/' || chr(128512))), false);
select pg_temp.r11p_mcall('ok-route-pct', 'owner', pg_temp.r11p_mreq('mr-1', '{"route":"/a%20b/c%41"}'), false);
select pg_temp.r11p_mcall('ok-route-max', 'owner', pg_temp.r11p_mreq('mr-1', jsonb_build_object('route', '/' || repeat('a', 2047))), false);
select is(pg_temp.r11p_label_failures('ok-route', '00000:'), '',
  'valid routes mint: the root, a directory path with a trailing slash, non-ASCII code points, other percent escapes and exactly 2,048 characters [P2-S11-AC-024]');

select pg_temp.r11p_mcall('vf-set-array', 'owner', pg_temp.r11p_mreq('mr-1', '{"versionSet":[]}'), false);
select pg_temp.r11p_mcall('vf-set-missing', 'owner', pg_temp.r11p_mreq('mr-1', jsonb_build_object('versionSet', pg_temp.r11p_vs('mr-1') - 'compilerVersion')), false);
select pg_temp.r11p_mcall('vf-set-extra', 'owner', pg_temp.r11p_mreq('mr-1', jsonb_build_object('versionSet', pg_temp.r11p_vs('mr-1') || '{"extra":1}')), false);
select pg_temp.r11p_mcall('vf-set-null', 'owner', pg_temp.r11p_mreq('mr-1', '{"versionSet":null}'), false);
select is(pg_temp.r11p_label_failures('vf-set', 'P0001:VALIDATION_FAILED/["/versionSet"]'), '',
  'a version set that is not an object, lacks a member or carries an unknown one is VALIDATION_FAILED at /versionSet [P2-S11-AC-024]');

-- ---------------------------------------------------------------------------
-- Concealment (404) versus capability (403).
-- ---------------------------------------------------------------------------
select pg_temp.r11p_mcall('nf-stranger', 'stranger', pg_temp.r11p_mreq('mr-1'), false);
select pg_temp.r11p_mcall('nf-absent', 'owner', pg_temp.r11p_mreq('mr-1', jsonb_build_object('entryId', extensions.gen_random_uuid())), false);
select pg_temp.r11p_mcall('nf-other-entry-revision', 'owner',
  pg_temp.r11p_mreq('mr-1', jsonb_build_object('revisionId', pg_temp.h11w_uuid('mr-other:revision'))), false);
select pg_temp.r11p_mcall('nf-absent-revision', 'owner',
  pg_temp.r11p_mreq('mr-1', jsonb_build_object('revisionId', extensions.gen_random_uuid())), false);
select pg_temp.r11_session('owner', pg_temp.s11_id('creator'));
select pg_temp.r11_try('nf-other-party', format('select platform_api.cms_mint_preview(%L::jsonb)',
  jsonb_set(pg_temp.r11p_mreq('mr-1'), '{context,actingPartyId}', to_jsonb(pg_temp.s11_id('creator')))::text), false);
select pg_temp.h11_raw_exec('platform_private.cms_content_entries',
  format($$update platform_private.cms_content_entries set lifecycle = 'archived' where id = %L$$, pg_temp.h11w_uuid('mr-2:entry')));
select pg_temp.h11_raw_exec('platform_private.cms_content_entries',
  format($$update platform_private.cms_content_entries set lifecycle = 'held' where id = %L$$, pg_temp.h11w_uuid('mr-3:entry')));
select pg_temp.r11p_mcall('nf-archived', 'owner', pg_temp.r11p_mreq('mr-2'), false);
select pg_temp.r11p_mcall('nf-held', 'owner', pg_temp.r11p_mreq('mr-3'), false);
select is(pg_temp.r11p_label_failures('nf-', 'P0001:NOT_FOUND'), '',
  'a non-member, an absent entry, a revision of another entry, an absent revision, another acting party and an archived or held entry are the one concealed NOT_FOUND with no detail [P2-S11-AC-025]');

select pg_temp.r11p_mcall('cap-outsider', 'outsider', pg_temp.r11p_mreq('mr-1'), false);
select pg_temp.r11p_mcall('cap-reviewer-unassigned', 'rvA', pg_temp.r11p_mreq('mr-1'), false);
-- A reviewer assigned to a review of revision 1 of mr-4 has scope on that revision only.
select pg_temp.h11r_review('mr-review', jsonb_build_object(
  'revision_id', pg_temp.h11w_uuid('mr-4:revision'), 'entry_id', pg_temp.h11w_uuid('mr-4:entry')));
select pg_temp.h11r_assign('mr-review-asg', 'mr-review', 'rvA');
select pg_temp.r11p_mcall('cap-reviewer-sibling', 'rvA',
  pg_temp.r11p_mreq('mr-4', jsonb_build_object('revisionId', pg_temp.h11w_uuid('mr-4b:revision'), 'versionSet', pg_temp.r11p_vs('mr-4b'))), false);
select pg_temp.r11p_mcall('cap-reviewer-own', 'rvA', pg_temp.r11p_mreq('mr-4'), false);
select pg_temp.h11_raw_exec('platform_private.cms_editorial_review_assignments',
  format($$update platform_private.cms_editorial_review_assignments set state = 'revoked', version = version + 1 where id = %L$$,
         pg_temp.s11_id('mr-review-asg')));
select pg_temp.r11p_mcall('cap-reviewer-revoked', 'rvA', pg_temp.r11p_mreq('mr-4'), false);
select pg_temp.h11_raw_exec('platform_private.cms_entry_assignments',
  format($$update platform_private.cms_entry_assignments set state = 'revoked', version = version + 1
            where entry_id = %L and assignee_person_id = %L$$, pg_temp.h11w_uuid('mr-5:entry'), pg_temp.s11_id('editor')));
select pg_temp.r11p_mcall('cap-editor-revoked', 'editor', pg_temp.r11p_mreq('mr-5'), false);
select pg_temp.h11_raw_exec('identity_private.organization_actor_grant',
  format($$update identity_private.organization_actor_grant set valid_from = current_date - 5, valid_through = current_date - 1
            where organization_id = %L and person_id = %L and capability_code = 'cms.author'$$,
         pg_temp.s11_id('org'), pg_temp.s11_id('creator')));
select pg_temp.r11p_mcall('cap-grant-lapsed', 'owner', pg_temp.r11p_mreq('mr-6'), false);
-- Restore the grant so the creator's later calls are judged on their own merits.
select pg_temp.h11_raw_exec('identity_private.organization_actor_grant',
  format($$update identity_private.organization_actor_grant set valid_from = current_date, valid_through = null
            where organization_id = %L and person_id = %L and capability_code = 'cms.author'$$,
         pg_temp.s11_id('org'), pg_temp.s11_id('creator')));
select is(
  (select coalesce(string_agg(label || '=' || pg_temp.r11_out(label) || coalesce('/' || detail, ''), ' ' order by label), '')
     from r11_probe where label like 'cap-%' and label <> 'cap-reviewer-own'
      and (pg_temp.r11_out(label) || coalesce('/' || detail, '')) is distinct from 'P0001:capability_missing'),
  '',
  'a member with no scope, an unassigned reviewer, a reviewer assigned to another revision, a revoked reviewer assignment, a revoked entry assignment and a lapsed standing grant are 403 capability_missing with no detail [P2-S11-AC-025]');
select is(pg_temp.r11_out('cap-reviewer-own'), '00000:',
  'control: before its assignment is revoked the same reviewer does mint on the revision of its review (so the revoked-assignment refusal above is about the revocation) [P2-S11-AC-025]');

-- ---------------------------------------------------------------------------
-- CAS and version set (after the scope: a caller without scope learns nothing about versions).
-- ---------------------------------------------------------------------------
select pg_temp.h11_raw_exec('platform_private.cms_content_entries',
  format($$update platform_private.cms_content_entries set version = version + 1 where id = %L$$, pg_temp.h11w_uuid('mr-1:entry')));
select pg_temp.r11p_mcall('cas-stale', 'owner', pg_temp.r11p_mreq('mr-1', '{"expectedVersion":"1","ifMatch":"1"}'), false);
select ok(pg_temp.r11_out('cas-stale') = 'P0001:VERSION_MISMATCH'
    and pg_temp.r11_detail('cas-stale')::jsonb = '{"expectedVersion":"1","currentVersion":"2"}'::jsonb,
  'a stale entry If-Match is VERSION_MISMATCH carrying the expected and current versions only [P2-S11-AC-026]');
select pg_temp.r11p_mcall('cas-stale-first', 'owner',
  pg_temp.r11p_mreq('mr-1', jsonb_build_object('expectedVersion', '1', 'ifMatch', '1', 'versionSet', pg_temp.r11p_vs('mr-1') || '{"compilerVersion":"stale"}')), false);
select is(pg_temp.r11_out('cas-stale-first'), 'P0001:VERSION_MISMATCH',
  'the entry-version check runs before the version-set check (a stale CAS wins over a stale set) [P2-S11-AC-026]');
select pg_temp.r11p_mcall('set-hash', 'owner', pg_temp.r11p_mreq('mr-1', jsonb_build_object(
  'expectedVersion', '2', 'ifMatch', '2', 'versionSet', jsonb_set(pg_temp.r11p_vs('mr-1'), '{schemaHash}', to_jsonb(repeat('0', 64))))), false);
select pg_temp.r11p_mcall('set-block', 'owner', pg_temp.r11p_mreq('mr-1', jsonb_build_object(
  'expectedVersion', '2', 'ifMatch', '2', 'versionSet', jsonb_set(pg_temp.r11p_vs('mr-1'), '{blockVersionIds}',
    jsonb_build_array(extensions.gen_random_uuid())))), false);
select pg_temp.r11p_mcall('set-template', 'owner', pg_temp.r11p_mreq('mr-1', jsonb_build_object(
  'expectedVersion', '2', 'ifMatch', '2', 'versionSet', jsonb_set(jsonb_set(pg_temp.r11p_vs('mr-1'), '{templateVersionId}', to_jsonb(extensions.gen_random_uuid()::text)),
    '{templateHash}', to_jsonb(repeat('1', 64))))), false);
select pg_temp.r11p_mcall('set-settings', 'owner', pg_temp.r11p_mreq('mr-1', jsonb_build_object(
  'expectedVersion', '2', 'ifMatch', '2', 'versionSet', jsonb_set(pg_temp.r11p_vs('mr-1'), '{settingsVersion}', '"999"'))), false);
select is(pg_temp.r11p_label_failures('set-', 'P0001:version_set_stale'), '',
  'a version set that differs from the one recomputed from canonical state (schema hash, block ids, template, settings version) is 409 version_set_stale [P2-S11-AC-089]');
select pg_temp.r11p_mcall('exact-set', 'owner', pg_temp.r11p_mreq('mr-1', '{"expectedVersion":"2","ifMatch":"2"}'), false);
select is(pg_temp.r11_out('exact-set'), '00000:', 'control: the exact recomputed version set at the current entry version mints [P2-S11-AC-089]');

-- ---------------------------------------------------------------------------
-- The signing key.
-- ---------------------------------------------------------------------------
delete from vault.secrets where name = 'cms_editorial_history_cursor_active';
select pg_temp.r11p_mcall('key-noscope', 'outsider', pg_temp.r11p_mreq('mr-6'), false);
select pg_temp.r11p_mcall('key-missing', 'owner', pg_temp.r11p_mreq('mr-6'), false);
select ok(pg_temp.r11_out('key-missing') = 'P0001:DEPENDENCY_UNAVAILABLE'
    and pg_temp.r11_out('key-noscope') = 'P0001:capability_missing',
  'without an active Vault signing key a scoped caller gets DEPENDENCY_UNAVAILABLE (nothing is minted) while a caller without scope still gets only the 403 [P2-S11-AC-027]');

-- ---------------------------------------------------------------------------
-- No partial effect: the whole refusal battery left no row behind.
-- ---------------------------------------------------------------------------
select ok(pg_temp.r11p_effects() = (select effects from r11_snap where label = 'before'),
  'every refusal and every probed success was rolled back: no token, reservation, audit record, event or settings snapshot remains [P2-S11-AC-027]');

-- A refused request leaves no reservation, so the same key is free for the corrected request.
select pg_temp.r11p_key(repeat('c3', 32));
insert into r11_snap(label, effects) values ('reuse', pg_temp.r11p_effects());
create temp table r11_reuse(request jsonb) on commit drop;
insert into r11_reuse select pg_temp.r11p_mreq('mr-6', '{"expectedVersion":"5","ifMatch":"5"}');
select pg_temp.r11p_mcall('reuse-stale', 'owner', (select request from r11_reuse));
select pg_temp.r11p_mcall('reuse-fixed', 'owner', jsonb_set(jsonb_set((select request from r11_reuse), '{expectedVersion}', '"1"'), '{ifMatch}', '"1"'));
select ok(pg_temp.r11_out('reuse-stale') = 'P0001:VERSION_MISMATCH' and pg_temp.r11_out('reuse-fixed') = '00000:',
  'the Idempotency-Key of a refused command is not consumed: the corrected request under the same key mints [P2-S11-AC-026]');

select * from finish();
rollback;
