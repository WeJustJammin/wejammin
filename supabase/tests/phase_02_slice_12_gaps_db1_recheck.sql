-- Slice 12 gap lane claude_s12_gaps_db1: P2-S12-AC-083 clause 2.  CMS-03C-09 `activate` and `schedule` recheck "the subject
-- hash, the policy basis and every dependency"; a difference commits the invalidation (review invalidated dependency_changed at
-- version + 1, subject back to draft, no event) and answers the stored 409 (BE03c 1479 step 4, 1262).  Only a changed
-- dependency (a superseded bound content type) is reachable through the producers (governed_activation/060); the frozen subject
-- hash and the frozen policy basis are immutable on both sides, so the CURRENT side is substituted at its pinned reader:
-- the test-admin renames the reader aside and installs a transparent wrapper that alters one member while the GUC
-- `gap.fault` names it, then restores both byte for byte.  The recheck function under test (cms_governed_frozen_status), the
-- activation command, the guards and every table are the unmodified product.
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
select pg_temp.s09d_session('owner', 'authenticated');
\ir phase_02_slice_12_governed_submit/000-fixtures.sqlinc
\ir phase_02_slice_12_governed_submit/005-real-type-chains.sqlinc
\ir phase_02_slice_12_governed_assignment/000-world.sqlinc
\ir phase_02_slice_12_governed_activation/000-world.sqlinc

select ok(pg_temp.s12ga_grant('rev1', 'cms.reviewer', 1) = 'OK', 'fixture: rev1 holds the real reviewer grant [P2-S12-AC-083]');
update s09d_actor set party_id = pg_temp.s09d_id('ownerOrg') where key = 'rev1';
select pg_temp.s12gb_approved('h1');
select pg_temp.s12gb_approved('h2');
select pg_temp.s12gb_approved('h3');
select pg_temp.s12gb_approved('h4');
select pg_temp.s12gb_approved('h5');
select ok((select count(*) = 5 and bool_and(state = 'approved' and version = 2) from platform_private.cms_governed_reviews
            where id in (select pg_temp.s12ga_review(t) from unnest(array['h1','h2','h3','h4','h5']) t)),
  'fixture: five real approved reviews (version 2) [P2-S12-AC-083]');

-- ---- the labelled substitution of the CURRENT side of two comparisons ---------------------------------------------------
create temp table gh_saved(name text primary key, def text not null, owner_before text not null, acl_before text, md5_src text not null)
  on commit drop;
create or replace function pg_temp.gh_install() returns void language plpgsql as $body$
declare
  v_resolve constant regprocedure := 'platform_private.cms_governed_subject_resolve(text,uuid,boolean)'::regprocedure;
  v_basis constant regprocedure := 'platform_private.cms_governed_policy_basis(text,uuid,jsonb)'::regprocedure;
begin
  if current_user <> 'postgres' then raise exception 'substitution requires the test-admin'; end if;
  insert into gh_saved select 'resolve', pg_get_functiondef(p.oid), pg_get_userbyid(p.proowner), p.proacl::text, md5(p.prosrc)
    from pg_proc p where p.oid = v_resolve;
  insert into gh_saved select 'basis', pg_get_functiondef(p.oid), pg_get_userbyid(p.proowner), p.proacl::text, md5(p.prosrc)
    from pg_proc p where p.oid = v_basis;
  alter function platform_private.cms_governed_subject_resolve(text,uuid,boolean) rename to cms_governed_subject_resolve_orig;
  alter function platform_private.cms_governed_policy_basis(text,uuid,jsonb) rename to cms_governed_policy_basis_orig;
  execute $f$
    create function platform_private.cms_governed_subject_resolve(p_kind text, p_id uuid, p_lock boolean default false)
    returns jsonb language plpgsql security definer set search_path = '' as $g$
    declare r jsonb;
    begin
      r := platform_private.cms_governed_subject_resolve_orig(p_kind, p_id, p_lock);
      if r is not null and pg_catalog.current_setting('gap.fault', true) = 'hash' then
        r := r || pg_catalog.jsonb_build_object('contentHash', pg_catalog.repeat('0', 64));
      end if;
      return r;
    end;
    $g$ $f$;
  execute $f$
    create function platform_private.cms_governed_policy_basis(p_kind text, p_owner_id uuid, p_subject jsonb)
    returns jsonb language plpgsql stable security definer set search_path = '' as $g$
    declare r jsonb;
    begin
      r := platform_private.cms_governed_policy_basis_orig(p_kind, p_owner_id, p_subject);
      if r is not null and pg_catalog.current_setting('gap.fault', true) = 'policy' then
        r := r || pg_catalog.jsonb_build_object('basisHash', pg_catalog.repeat('0', 64));
      end if;
      return r;
    end;
    $g$ $f$;
end;
$body$;
create or replace function pg_temp.gh_restore() returns boolean language plpgsql as $body$
declare ok_resolve boolean; ok_basis boolean;
begin
  perform set_config('gap.fault', '', true);
  drop function platform_private.cms_governed_subject_resolve(text,uuid,boolean);
  drop function platform_private.cms_governed_policy_basis(text,uuid,jsonb);
  alter function platform_private.cms_governed_subject_resolve_orig(text,uuid,boolean) rename to cms_governed_subject_resolve;
  alter function platform_private.cms_governed_policy_basis_orig(text,uuid,jsonb) rename to cms_governed_policy_basis;
  select md5(p.prosrc) = s.md5_src and pg_get_userbyid(p.proowner) = s.owner_before and p.proacl::text is not distinct from s.acl_before
    into ok_resolve from pg_proc p, gh_saved s
   where s.name = 'resolve' and p.oid = 'platform_private.cms_governed_subject_resolve(text,uuid,boolean)'::regprocedure;
  select md5(p.prosrc) = s.md5_src and pg_get_userbyid(p.proowner) = s.owner_before and p.proacl::text is not distinct from s.acl_before
    into ok_basis from pg_proc p, gh_saved s
   where s.name = 'basis' and p.oid = 'platform_private.cms_governed_policy_basis(text,uuid,jsonb)'::regprocedure;
  return coalesce(ok_resolve, false) and coalesce(ok_basis, false);
end;
$body$;

select pg_temp.gh_install();
create or replace function pg_temp.gh_act(p_label text, p_tag text, p_action text, p_fault text) returns void language plpgsql as $body$
begin
  perform set_config('gap.fault', p_fault, true);
  perform pg_temp.s12gb_act(p_label, 'owner', pg_temp.s12ga_review(p_tag), p_action);
  perform set_config('gap.fault', '', true);
end;
$body$;

-- control: with the wrappers installed and no fault named, an activation is unaffected
select pg_temp.gh_act('gh-control', 'h5', 'activate', '');
select ok(pg_temp.s12ga_out('gh-control') = 'ok' and pg_temp.s12ga_body('gh-control')->>'subjectState' = 'active'
    and pg_temp.s12gb_events('h5') = 1,
  'control: with the transparent wrappers installed and no fault named the approved review activates normally [P2-S12-AC-083]');

select pg_temp.gh_act('gh-h1', 'h1', 'activate', 'hash');
select pg_temp.gh_act('gh-h2', 'h2', 'schedule', 'hash');
select pg_temp.gh_act('gh-h3', 'h3', 'activate', 'policy');
select pg_temp.gh_act('gh-h4', 'h4', 'schedule', 'policy');

create or replace function pg_temp.gh_refused(p_label text, p_tag text) returns boolean language sql stable as $body$
  select pg_temp.s12ga_out(p_label) = 'ok'
     and pg_temp.s12ga_body(p_label) = '{"kind": "refusal", "details": {}, "reasonCode": "dependency_changed"}'::jsonb
     and (select review.state = 'invalidated' and review.invalidated_reason = 'dependency_changed' and review.version = 3
                 and review.decided_at is null and review.activated_at is null
            from platform_private.cms_governed_reviews review where review.id = pg_temp.s12ga_review(p_tag))
     and (select subject.state = 'draft' and subject.activated_at is null
            from platform_private.cms_template_versions subject where subject.id = pg_temp.s12ga_subject(p_tag))
     and pg_temp.s12gb_events(p_tag) = 0
     and not exists (select 1 from platform_private.cms_governed_activation_schedules s where s.review_id = pg_temp.s12ga_review(p_tag))
     and exists (select 1 from platform_private.idempotency_records record
                  where record.operation = 'CMS-03C-09' and record.key_hash = platform_private.cms_key_hash('s12ga-' || p_label)
                    and record.state = 'completed' and record.response_ref->>'status' = '409')
$body$;
select ok(pg_temp.gh_refused('gh-h1', 'h1'),
  'activate with a subject hash that differs from the frozen one commits the invalidation: dependency_changed, review version 3, subject back to draft, no event, stored 409 [P2-S12-AC-083]');
select ok(pg_temp.gh_refused('gh-h2', 'h2'),
  'schedule with a subject hash that differs from the frozen one commits the same invalidation and creates no schedule [P2-S12-AC-083]');
select ok(pg_temp.gh_refused('gh-h3', 'h3'),
  'activate with a workflow-policy basis that differs from the frozen one commits the same invalidation [P2-S12-AC-083]');
select ok(pg_temp.gh_refused('gh-h4', 'h4'),
  'schedule with a workflow-policy basis that differs from the frozen one commits the same invalidation and creates no schedule [P2-S12-AC-083]');
select is(pg_temp.gh_restore()::text, 'true',
  'control: both pinned readers are restored byte for byte (source, owner, ACL) and the wrappers are gone [P2-S12-AC-083]');
select ok(not exists (select 1 from pg_proc where proname in ('cms_governed_subject_resolve_orig', 'cms_governed_policy_basis_orig')),
  'control: no renamed-aside reader remains [P2-S12-AC-083]');

select finish();
rollback;
