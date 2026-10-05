\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 R8 (re-audit AC1191, OD-4): CMS-03A-04 "recomputes localeConfigHash
-- from the candidate row and returns 409 CONFLICT when it differs from the
-- review's frozen localeConfigHash, mutating nothing".  The earlier proof
-- tampered the review's frozen hash column, which an implementation comparing
-- two stored hash columns would also refuse.  Here the candidate's locale
-- COLUMNS change while both stored hash columns (candidate and review) stay
-- intact, so only a real recomputation from the candidate row can notice; and
-- "mutating nothing" is shown across every table the activation writes.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

select pg_temp.s09d_create_type('h', 'r8recompute', 'editorial', 'owner',
  '["en-US","fr-FR"]', '{"fr-FR":["en-US"]}');
select pg_temp.s09d_dry_run('h');
select pg_temp.s09d_seal('h');
select pg_temp.s09d_submit('h');
select pg_temp.s09d_assign('h', 'rev1');
select pg_temp.s09d_decide('h', 'rev1');
create temp table r8r_hash on commit drop as
select review.locale_config_hash as review_hash, version_row.locale_config_hash as candidate_hash
  from platform_private.cms_schema_reviews review
  join platform_private.cms_content_type_versions version_row on version_row.id = review.content_type_version_id
 where review.id = pg_temp.s09d_id('h:review');
select ok((select review_hash = candidate_hash from r8r_hash)
    and (select state from platform_private.cms_schema_reviews where id = pg_temp.s09d_id('h:review')) = 'approved',
  'fixture: an approved review froze the candidate hash through the real chain [P2-S09-AC-1191]');

-- The candidate's locale COLUMNS drift; both stored hash columns stay as they were.
set constraints all immediate;
select ok(pg_temp.s09d_timewarp('cms_content_type_versions', format(
  $q$update platform_private.cms_content_type_versions
        set supported_locales = '["en-US","fr-FR","pt-BR"]'::jsonb where id = %L$q$, pg_temp.s09d_id('h:version'))),
  'fixture: the candidate''s supported_locales column drifts while its stored locale_config_hash stays (guard triggers off for one statement)');
select ok((select r.review_hash = (select locale_config_hash from platform_private.cms_content_type_versions where id = pg_temp.s09d_id('h:version'))
             and r.review_hash is distinct from platform_private.cms_locale_config_hash(
               version_row.source_locale, version_row.default_locale, version_row.supported_locales, version_row.fallback_chains)
    from r8r_hash r, platform_private.cms_content_type_versions version_row where version_row.id = pg_temp.s09d_id('h:version')),
  'the two stored hash columns still agree with each other but no longer equal the hash recomputed from the candidate row');
set constraints all deferred;
create temp table r8r_baseline on commit drop as select pg_temp.s09d_fingerprint(true) as fingerprint;
select pg_temp.s09d_activate('h', 'owner', '{}'::jsonb, 'h:activate-drift');
select is(pg_temp.s09d_outcome('h:activate-drift'), 'CONFLICT',
  'CMS-03A-04 recomputes localeConfigHash from the candidate row and refuses with CONFLICT when it differs from the frozen hash, even though the stored hash columns agree [P2-S09-AC-1191]');
select ok(pg_temp.s09d_fingerprint(true) = (select fingerprint from r8r_baseline)
    and pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('h:version')) = 'approved'
    and (select count(*) = 0 from platform_private.outbox_events where event_type = 'cms.schema.activated.v1'
          and aggregate_id = pg_temp.s09d_id('h:version')),
  'the refused activation mutated nothing: reviews, decisions, versions, idempotency, audit and outbox are unchanged and no activation event exists [P2-S09-AC-1191]');

-- Control: restore the column; the same activation now succeeds.
set constraints all immediate;
select ok(pg_temp.s09d_timewarp('cms_content_type_versions', format(
  $q$update platform_private.cms_content_type_versions
        set supported_locales = '["en-US","fr-FR"]'::jsonb where id = %L$q$, pg_temp.s09d_id('h:version'))),
  'fixture: the candidate''s supported_locales column is restored');
set constraints all deferred;
select pg_temp.s09d_activate('h', 'owner', '{}'::jsonb, 'h:activate');
select is(pg_temp.s09d_outcome('h:activate'), 'OK',
  'control: with the columns restored the same activation succeeds, so the drifted column alone was the refusal [P2-S09-AC-1191]');

select * from finish();
rollback;
