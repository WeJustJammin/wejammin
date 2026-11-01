-- Slice 12 gap lane claude_s12_gaps_db2 (docs/handoffs/2026-10-22-claude-s12/briefs/gap-tests.md).
-- Catalog proofs of the governed persistence clauses and two pattern storage clauses that no earlier suite asserted:
--   AC-189 c1 (all four reserved pattern keys in the table CHECK), AC-191 c1 (the pattern partial unique index),
--   AC-196 (the one governed table set keyed by (subject_kind, subject_id), closed subject_kind, 03a/03b sets apart),
--   AC-251 .. AC-255 (cms_governed_reviews, _review_decisions, _review_assignments, _review_dependencies,
--   _activation_schedules: CHECK / UNIQUE / index definitions, guards, forced RLS, no grants, the only writers).
-- Behavioural direct-write probes for the same tables are in phase_02_slice_12_gaps_governed_world.sql.
-- BE03c "Canonical records" / "Persistence" / "Database Schema" (GovernedReview*, GovernedActivationSchedule).
-- No fixtures: every assertion reads the catalog the migrations built.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- The single-quoted literals of a constraint definition, sorted, so a closed vocabulary compares as an array.
create or replace function pg_temp.g2_lits(p_def text) returns text[]
language sql immutable as $body$
  select coalesce(pg_catalog.array_agg(m[1] order by m[1]), array[]::text[])
    from pg_catalog.regexp_matches(coalesce(p_def, ''), '''([^'']*)''', 'g') m
$body$;
-- The definition of one named constraint of one table (NULL when it does not exist).
create or replace function pg_temp.g2_con(p_table text, p_name text) returns text
language sql stable as $body$
  select pg_catalog.pg_get_constraintdef(c.oid)
    from pg_catalog.pg_constraint c
   where c.conrelid = pg_catalog.to_regclass('platform_private.' || p_table) and c.conname = p_name
$body$;
-- The roles that hold any privilege on the table or any of its columns (PUBLIC reported as 'public').
create or replace function pg_temp.g2_granted(p_table text) returns text[]
language sql stable as $body$
  select coalesce(pg_catalog.array_agg(g.who order by g.who), array[]::text[])
    from (
      select r.rolname::text as who
        from (values ('anon'), ('authenticated'), ('service_role')) r(rolname)
       where pg_catalog.has_table_privilege(r.rolname, 'platform_private.' || p_table,
               'select,insert,update,delete,truncate,references,trigger')
          or pg_catalog.has_any_column_privilege(r.rolname, 'platform_private.' || p_table,
               'select,insert,update,references')
      union all
      select 'public'
       where exists (
         select 1 from pg_catalog.pg_class c,
                pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) a
          where c.oid = pg_catalog.to_regclass('platform_private.' || p_table) and a.grantee = 0)
    ) g
$body$;
-- The qualified names of the functions whose source matches a regular expression.
create or replace function pg_temp.g2_writers(p_regex text) returns text[]
language sql stable as $body$
  select coalesce(pg_catalog.array_agg(n.nspname || '.' || p.proname order by n.nspname, p.proname), array[]::text[])
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('platform_private', 'platform_api')
     and p.prokind = 'f' and p.prosrc ~* p_regex
$body$;
create or replace function pg_temp.g2_trigger_ok(p_table text, p_name text, p_function text, p_events integer)
returns boolean language sql stable as $body$
  select exists (
    select 1 from pg_catalog.pg_trigger t
     where t.tgrelid = pg_catalog.to_regclass('platform_private.' || p_table)
       and t.tgname = p_name and not t.tgisinternal and t.tgenabled = 'O'
       and t.tgfoid = pg_catalog.to_regproc('platform_private.' || p_function)
       and (t.tgtype & 3) = 3                       -- ROW and BEFORE
       and (t.tgtype & 28) = p_events)              -- INSERT=4, DELETE=8, UPDATE=16
$body$;
create or replace function pg_temp.g2_forced_rls(p_table text) returns boolean
language sql stable as $body$
  select c.relrowsecurity and c.relforcerowsecurity
    from pg_catalog.pg_class c where c.oid = pg_catalog.to_regclass('platform_private.' || p_table)
$body$;
create or replace function pg_temp.g2_idx(p_name text) returns text
language sql stable as $body$
  select indexdef from pg_catalog.pg_indexes where schemaname = 'platform_private' and indexname = p_name
$body$;

-- ===================================================================== pattern storage (AC-189, AC-191) ==
-- DEC-232 (nestable-read lane, unpromoted) adds `nestable` as a fifth reserved key: the four AC-189 keys must be present and nothing else may be
-- named except that one, so this proof holds both on the promoted migrations (four literals) and with the amendment (five).
select ok((select array['context', 'new', 'selector', 'versions']::text[] <@ lits and lits <@ array['context', 'nestable', 'new', 'selector', 'versions']::text[]
      from (select pg_temp.g2_lits(pg_temp.g2_con('cms_pattern_versions', 'cms_pattern_versions_pattern_key_not_reserved')) as lits) q),
  'the table CHECK names the reserved pattern route keys context, versions, selector and new, and no other key but the DEC-232 nestable [P2-S12-AC-189]');
select ok(pg_temp.g2_con('cms_pattern_versions', 'cms_pattern_versions_pattern_key_not_reserved') like 'CHECK (%pattern_key <> ALL (ARRAY[%'
  and pg_temp.g2_con('cms_pattern_versions', 'cms_pattern_versions_pattern_key_not_reserved') like '%pattern_key%',
  'the reserved-key CHECK refuses a key equal to ANY of its literals (NOT IN), on the pattern_key column [P2-S12-AC-189]');
select ok(pg_temp.g2_idx('cms_pattern_versions_active_lineage_idx') ~* '^create unique index cms_pattern_versions_active_lineage_idx on platform_private\.cms_pattern_versions using btree \(pattern_id\) where \(state = ''active''(::text)?\)$',
  'the pattern lineage index is UNIQUE on (pattern_id) and PARTIAL WHERE state = active: one active version per lineage [P2-S12-AC-191]');

-- =========================================================== AC-196 the one governed set, closed subject_kind ==
select has_table('platform_private', 'cms_governed_reviews', 'the governed review table exists in platform_private [P2-S12-AC-196]');
select has_table('platform_private', 'cms_governed_review_decisions', 'the governed decision table exists in platform_private [P2-S12-AC-196]');
select has_table('platform_private', 'cms_governed_review_assignments', 'the governed assignment table exists in platform_private [P2-S12-AC-196]');
select has_table('platform_private', 'cms_governed_review_dependencies', 'the governed dependency table exists in platform_private [P2-S12-AC-196]');
select has_table('platform_private', 'cms_governed_activation_schedules', 'the governed activation schedule table exists in platform_private [P2-S12-AC-196]');
select ok(pg_temp.g2_idx('cms_governed_reviews_live_subject_unique') ~* '\(subject_kind, subject_id\)',
  'the review set is keyed by (subject_kind, subject_id): the live-subject unique index is on exactly that pair [P2-S12-AC-196]');
select is((select pg_catalog.array_agg(a.attname::text order by a.attname)
    from pg_catalog.pg_attribute a
   where a.attrelid = 'platform_private.cms_governed_reviews'::regclass
     and a.attname in ('subject_kind', 'subject_id') and not a.attisdropped and a.attnotnull),
  array['subject_id', 'subject_kind']::text[],
  'cms_governed_reviews carries NOT NULL subject_kind and subject_id [P2-S12-AC-196]');
select is((select pg_catalog.array_agg(a.attname::text order by a.attname)
    from pg_catalog.pg_attribute a
   where a.attrelid = 'platform_private.cms_governed_activation_schedules'::regclass
     and a.attname in ('subject_kind', 'subject_id') and not a.attisdropped and a.attnotnull),
  array['subject_id', 'subject_kind']::text[],
  'cms_governed_activation_schedules carries NOT NULL subject_kind and subject_id [P2-S12-AC-196]');
select is(pg_temp.g2_lits(pg_temp.g2_con('cms_governed_reviews', 'cms_governed_reviews_subject_kind_check')),
  array['pattern_version', 'taxonomy_version', 'template_version']::text[],
  'a CHECK closes cms_governed_reviews.subject_kind to exactly template_version, pattern_version and taxonomy_version [P2-S12-AC-196]');
select is(pg_temp.g2_lits(pg_temp.g2_con('cms_governed_activation_schedules', 'cms_governed_activation_schedules_subject_kind_check')),
  array['pattern_version', 'taxonomy_version', 'template_version']::text[],
  'a CHECK closes cms_governed_activation_schedules.subject_kind to the same three kinds [P2-S12-AC-196]');
select is((select pg_catalog.count(*)::integer from pg_catalog.pg_constraint c
   where c.contype = 'f' and c.confrelid = 'platform_private.cms_governed_reviews'::regclass
     and c.conrelid in ('platform_private.cms_governed_review_decisions'::regclass,
       'platform_private.cms_governed_review_assignments'::regclass,
       'platform_private.cms_governed_review_dependencies'::regclass,
       'platform_private.cms_governed_activation_schedules'::regclass)
     and c.conname like '%review_owner_fkey'),
  4, 'the decision, assignment, dependency and schedule tables each hang off the one review row by (review_id, owner_id) [P2-S12-AC-196]');
select is((select pg_catalog.count(*)::integer from pg_catalog.pg_constraint c
   where c.contype = 'f'
     and ((c.conrelid::regclass::text like 'platform_private.cms_governed_%'
           and (c.confrelid::regclass::text like 'platform_private.cms_schema_review%'
             or c.confrelid::regclass::text like 'platform_private.cms_editorial_%'))
       or (c.confrelid::regclass::text like 'platform_private.cms_governed_%'
           and (c.conrelid::regclass::text like 'platform_private.cms_schema_review%'
             or c.conrelid::regclass::text like 'platform_private.cms_editorial_%')))),
  0, 'no foreign key joins the governed review set to the 03a cms_schema_reviews set or the 03b editorial review tables, in either direction [P2-S12-AC-196]');
select is((select pg_catalog.count(*)::integer from pg_catalog.pg_attribute a
   where a.attrelid in ('platform_private.cms_schema_reviews'::regclass,
       'platform_private.cms_editorial_reviews'::regclass,
       'platform_private.cms_editorial_review_assignments'::regclass,
       'platform_private.cms_editorial_review_dependencies'::regclass,
       'platform_private.cms_editorial_decisions'::regclass)
     and a.attname in ('subject_kind', 'subject_id') and not a.attisdropped),
  0, 'the 03a and 03b review tables carry no subject_kind or subject_id: they keep their own keys [P2-S12-AC-196]');

-- ======================================================================== AC-251 cms_governed_reviews ==
select is(pg_temp.g2_lits(pg_temp.g2_con('cms_governed_reviews', 'cms_governed_reviews_state_check')),
  array['approved', 'invalidated', 'open', 'rejected']::text[],
  'cms_governed_reviews.state is closed to open, approved, rejected and invalidated [P2-S12-AC-251]');
select ok(pg_temp.g2_con('cms_governed_reviews', 'cms_governed_reviews_subject_hash_check') like '%^[a-f0-9]{64}$%'
  and pg_temp.g2_con('cms_governed_reviews', 'cms_governed_reviews_subject_hash_check') like '%subject_hash%',
  'subject_hash is 64 lowercase hex [P2-S12-AC-251]');
select ok(pg_temp.g2_con('cms_governed_reviews', 'cms_governed_reviews_policy_basis_hash_check') like '%^[a-f0-9]{64}$%'
  and pg_temp.g2_con('cms_governed_reviews', 'cms_governed_reviews_policy_basis_hash_check') like '%policy_basis_hash%',
  'policy_basis_hash is 64 lowercase hex [P2-S12-AC-251]');
select ok(pg_temp.g2_con('cms_governed_reviews', 'cms_governed_reviews_approval_evidence_check') like '%^[a-f0-9]{64}$%'
  and pg_temp.g2_con('cms_governed_reviews', 'cms_governed_reviews_approval_evidence_check') like '%approval_evidence_hash%',
  'approval_evidence_hash is 64 lowercase hex [P2-S12-AC-251]');
select ok(pg_temp.g2_con('cms_governed_reviews', 'cms_governed_reviews_required_count_check') like '%required_decision_count >= 1%'
  and pg_temp.g2_con('cms_governed_reviews', 'cms_governed_reviews_required_count_check') like '%required_decision_count <= 8%',
  'required_decision_count is 1 to 8 [P2-S12-AC-251]');
select ok(pg_temp.g2_con('cms_governed_reviews', 'cms_governed_reviews_recorded_count_check') like '%recorded_decision_count <= required_decision_count%'
  and pg_temp.g2_con('cms_governed_reviews', 'cms_governed_reviews_recorded_count_check') like '%recorded_decision_count >= 0%',
  'recorded_decision_count is at least 0 and at most required_decision_count [P2-S12-AC-251]');
select ok(pg_temp.g2_con('cms_governed_reviews', 'cms_governed_reviews_capabilities_check') like '%jsonb_array_length(required_capabilities) >= 1%'
  and pg_temp.g2_con('cms_governed_reviews', 'cms_governed_reviews_capabilities_check') like '%jsonb_array_length(required_capabilities) <= 16%',
  'required_capabilities holds 1 to 16 entries [P2-S12-AC-251]');
select ok(pg_temp.g2_con('cms_governed_reviews', 'cms_governed_reviews_policy_basis_check') like '%jsonb_array_length(policy_basis) >= 1%'
  and pg_temp.g2_con('cms_governed_reviews', 'cms_governed_reviews_policy_basis_check') like '%jsonb_array_length(policy_basis) <= 64%',
  'policy_basis holds 1 to 64 entries [P2-S12-AC-251]');
select ok(pg_temp.g2_con('cms_governed_reviews', 'cms_governed_reviews_protected_check') like '%risk_class <> ''protected''%'
  and pg_temp.g2_con('cms_governed_reviews', 'cms_governed_reviews_protected_check') like '%required_decision_count >= 2%'
  and pg_temp.g2_con('cms_governed_reviews', 'cms_governed_reviews_protected_check') like '%jsonb_array_length(required_capabilities) >= 2%',
  'protected ties the review to at least 2 decisions and 2 capabilities [P2-S12-AC-251]');
select ok(pg_temp.g2_con('cms_governed_reviews', 'cms_governed_reviews_invalidated_state_check') like '%state = ''invalidated''::text%'
  and pg_temp.g2_con('cms_governed_reviews', 'cms_governed_reviews_invalidated_state_check') like '%invalidated_reason IS NOT NULL%',
  'invalidated holds exactly when invalidated_reason is stored [P2-S12-AC-251]');
select ok(pg_temp.g2_lits(pg_temp.g2_con('cms_governed_reviews', 'cms_governed_reviews_decided_state_check')) = array['approved', 'rejected']::text[]
  and pg_temp.g2_con('cms_governed_reviews', 'cms_governed_reviews_decided_state_check') like '%decided_at IS NOT NULL%',
  'approved or rejected holds exactly when decided_at is stored [P2-S12-AC-251]');
select ok(pg_temp.g2_idx('cms_governed_reviews_live_subject_unique') ~* '^create unique index cms_governed_reviews_live_subject_unique on platform_private\.cms_governed_reviews using btree \(subject_kind, subject_id\) where \(state = any \(array\[''open''::text, ''approved''::text\]\)\)$',
  'UNIQUE (subject_kind, subject_id) WHERE state IN (open, approved) is the live-subject index [P2-S12-AC-251]');
select ok(pg_temp.g2_trigger_ok('cms_governed_reviews', 'cms_governed_reviews_z_state_guard', 'cms_governed_review_guard', 28),
  'a BEFORE INSERT OR UPDATE OR DELETE row guard polices every cms_governed_reviews write [P2-S12-AC-251]');
select ok((select p.prosrc like '%cms_governed_subject_resolve(new.subject_kind, new.subject_id)%'
      and p.prosrc like '%cms_jcs_sha256%' and p.prosrc like '%''policyBasisHash'', new.policy_basis_hash%'
      and p.prosrc like '%''subjectHash'', new.subject_hash%' and p.prosrc like '%''subjectId'', new.subject_id%'
      and p.prosrc like '%''subjectKind'', new.subject_kind%'
    from pg_catalog.pg_proc p where p.oid = 'platform_private.cms_governed_review_guard'::regproc),
  'the INSERT guard validates the polymorphic subject through cms_governed_subject_resolve and ties approval_evidence_hash to the JCS SHA-256 of { policyBasisHash, subjectHash, subjectId, subjectKind } [P2-S12-AC-251]');
select ok(pg_temp.g2_forced_rls('cms_governed_reviews'), 'cms_governed_reviews has forced row level security [P2-S12-AC-251]');
select is(pg_temp.g2_granted('cms_governed_reviews'), array[]::text[],
  'no table or column privilege on cms_governed_reviews for PUBLIC, anon, authenticated or service_role: direct INSERT, UPDATE and DELETE are revoked [P2-S12-AC-251]');
select is(pg_temp.g2_writers('insert\s+into\s+platform_private\.cms_governed_reviews\M'),
  array['platform_private.cms_submit_governed_review']::text[],
  'cms_governed_reviews rows are inserted only by cms_submit_governed_review [P2-S12-AC-251]');
select is(pg_temp.g2_writers('(update|delete\s+from)\s+platform_private\.cms_governed_reviews\M'),
  array['platform_private.cms_governed_apply_activation', 'platform_private.cms_governed_apply_retirement',
    'platform_private.cms_governed_invalidate_approved_review', 'platform_private.cms_governed_invalidate_open_review',
    'platform_private.cms_record_governed_decision']::text[],
  'only the named governed RPCs and their closed helpers advance cms_governed_reviews, and none deletes a row [P2-S12-AC-251]');

-- ============================================================= AC-252 cms_governed_review_decisions ==
select ok(pg_temp.g2_con('cms_governed_review_decisions', 'cms_governed_review_decisions_state_check') like '%state = ''recorded''::text%'
  and pg_temp.g2_con('cms_governed_review_decisions', 'cms_governed_review_decisions_version_check') like '%version = 1%'
  and pg_temp.g2_con('cms_governed_review_decisions', 'cms_governed_review_decisions_time_check') like '%updated_at = created_at%',
  'a decision row is append-only by its CHECKs: state recorded, version 1, updated_at = created_at [P2-S12-AC-252]');
select ok(pg_temp.g2_trigger_ok('cms_governed_review_decisions', 'cms_governed_review_decisions_immutable_guard', 'cms_immutable_guard', 24),
  'a BEFORE UPDATE OR DELETE immutable guard makes every decision row append-only [P2-S12-AC-252]');
select ok(pg_temp.g2_trigger_ok('cms_governed_review_decisions', 'cms_governed_review_decisions_z_binding_guard', 'cms_governed_decision_guard', 4),
  'a BEFORE INSERT guard binds every decision row to its review [P2-S12-AC-252]');
select ok((select p.prosrc like '%new.reviewer_person_id = review_row.submitted_by%'
      and p.prosrc like '%subject->>''creatorPerson''%' and p.prosrc like '%separation_of_duties%'
    from pg_catalog.pg_proc p where p.oid = 'platform_private.cms_governed_decision_guard'::regproc),
  'the decision BEFORE INSERT guard forbids a reviewer equal to the review submitter or the subject version creator [P2-S12-AC-252]');
select ok(pg_temp.g2_forced_rls('cms_governed_review_decisions'), 'cms_governed_review_decisions has forced row level security [P2-S12-AC-252]');
select is(pg_temp.g2_granted('cms_governed_review_decisions'), array[]::text[],
  'no table or column privilege on cms_governed_review_decisions for PUBLIC, anon, authenticated or service_role [P2-S12-AC-252]');
select is(pg_temp.g2_writers('insert\s+into\s+platform_private\.cms_governed_review_decisions\M'),
  array['platform_private.cms_record_governed_decision']::text[],
  'decision rows are inserted only by cms_record_governed_decision [P2-S12-AC-252]');
select is(pg_temp.g2_writers('(update|delete\s+from)\s+platform_private\.cms_governed_review_decisions\M'),
  array[]::text[], 'no function updates or deletes a decision row [P2-S12-AC-252]');

-- ============================================================ AC-253 cms_governed_review_assignments ==
select is((select pg_catalog.count(*)::integer from pg_catalog.pg_attribute a
   where a.attrelid = 'platform_private.cms_governed_review_assignments'::regclass and not a.attisdropped and a.attnum > 0
     and (a.attname ~* '(acting|delegat|context|authority|on_behalf)')),
  0, 'an assignment stores no acting context and no delegation authority column [P2-S12-AC-253]');
select is(pg_temp.g2_lits(pg_temp.g2_con('cms_governed_review_assignments', 'cms_governed_review_assignments_state_check')),
  array['active', 'revoked']::text[], 'assignment state is closed to active and revoked [P2-S12-AC-253]');
select ok(pg_temp.g2_idx('cms_governed_review_assignments_active_reviewer_unique') ~* '^create unique index cms_governed_review_assignments_active_reviewer_unique on platform_private\.cms_governed_review_assignments using btree \(review_id, reviewer_person_id\) where \(state = ''active''(::text)?\)$',
  'UNIQUE (review_id, reviewer_person_id) WHERE state = active is the one-active-assignment index [P2-S12-AC-253]');
select ok(pg_temp.g2_trigger_ok('cms_governed_review_assignments', 'cms_governed_review_assignments_z_state_guard', 'cms_governed_assignment_guard', 28),
  'a BEFORE INSERT OR UPDATE OR DELETE guard allows only create and active-to-revoked on an assignment [P2-S12-AC-253]');
select ok(pg_temp.g2_forced_rls('cms_governed_review_assignments'), 'cms_governed_review_assignments has forced row level security [P2-S12-AC-253]');
select is(pg_temp.g2_granted('cms_governed_review_assignments'), array[]::text[],
  'direct UPDATE, DELETE and grants on cms_governed_review_assignments are revoked from every API role [P2-S12-AC-253]');
select is(pg_temp.g2_writers('insert\s+into\s+platform_private\.cms_governed_review_assignments\M'),
  array['platform_private.cms_assign_governed_reviewer']::text[],
  'assignment rows are created only by cms_assign_governed_reviewer [P2-S12-AC-253]');
select is(pg_temp.g2_writers('(update|delete\s+from)\s+platform_private\.cms_governed_review_assignments\M'),
  array['platform_private.cms_assign_governed_reviewer']::text[],
  'assignments are revoked only by the assignment command, and none is deleted [P2-S12-AC-253]');

-- ========================================================== AC-254 cms_governed_review_dependencies ==
select is(pg_temp.g2_lits(pg_temp.g2_con('cms_governed_review_dependencies', 'cms_governed_review_dependencies_kind_check')),
  array['block', 'canonical_domain', 'content_type', 'pattern']::text[],
  'dependency kind is closed to block, pattern, content_type and canonical_domain [P2-S12-AC-254]');
select ok(pg_temp.g2_con('cms_governed_review_dependencies', 'cms_governed_review_dependencies_review_kind_ref_key') = 'UNIQUE (review_id, kind, ref_id)',
  'UNIQUE (review_id, kind, ref_id) stores each frozen identity once [P2-S12-AC-254]');
select ok(pg_temp.g2_con('cms_governed_review_dependencies', 'cms_governed_review_dependencies_state_check') like '%state = ''active''::text%'
  and pg_temp.g2_con('cms_governed_review_dependencies', 'cms_governed_review_dependencies_version_check') like '%version = 1%'
  and pg_temp.g2_con('cms_governed_review_dependencies', 'cms_governed_review_dependencies_time_check') like '%updated_at = created_at%',
  'a dependency row is immutable by its CHECKs: state active, version 1, updated_at = created_at [P2-S12-AC-254]');
select ok(pg_temp.g2_trigger_ok('cms_governed_review_dependencies', 'cms_governed_review_dependencies_immutable_guard', 'cms_immutable_guard', 24),
  'a BEFORE UPDATE OR DELETE immutable guard freezes every dependency row [P2-S12-AC-254]');
select ok(pg_temp.g2_idx('cms_governed_review_dependencies_kind_ref_idx') ~* '\(kind, ref_id\)$'
  and pg_temp.g2_idx('cms_governed_review_dependencies_review_idx') ~* '\(review_id\)$',
  'indexes on (kind, ref_id) and (review_id) serve the recheck job [P2-S12-AC-254]');
select ok(pg_temp.g2_forced_rls('cms_governed_review_dependencies'), 'cms_governed_review_dependencies has forced row level security [P2-S12-AC-254]');
select is(pg_temp.g2_granted('cms_governed_review_dependencies'), array[]::text[],
  'cms_governed_review_dependencies has no grants for any API role [P2-S12-AC-254]');
select is(pg_temp.g2_writers('insert\s+into\s+platform_private\.cms_governed_review_dependencies\M'),
  array['platform_private.cms_submit_governed_review']::text[],
  'dependency rows are written only by cms_submit_governed_review [P2-S12-AC-254]');
select is(pg_temp.g2_writers('(update|delete\s+from)\s+platform_private\.cms_governed_review_dependencies\M'),
  array[]::text[], 'no function updates or deletes a dependency row [P2-S12-AC-254]');

-- ======================================================== AC-255 cms_governed_activation_schedules ==
select is(pg_temp.g2_lits(pg_temp.g2_con('cms_governed_activation_schedules', 'cms_governed_activation_schedules_state_check')),
  array['blocked', 'cancelled', 'completed', 'executing', 'failed_retryable', 'pending']::text[],
  'schedule state is closed to pending, executing, completed, failed_retryable, blocked and cancelled [P2-S12-AC-255]');
select is(pg_temp.g2_lits(pg_temp.g2_con('cms_governed_activation_schedules', 'cms_governed_activation_schedules_reason_code_check')),
  array['activation_authority_ended', 'approval_invalidated', 'canonical_source_unavailable', 'dependency_changed', 'retries_exhausted']::text[],
  'reason_code is closed to the five reasons including canonical_source_unavailable [P2-S12-AC-255]');
select ok(pg_temp.g2_lits(pg_temp.g2_con('cms_governed_activation_schedules', 'cms_governed_activation_schedules_reason_state_check')) = array['blocked', 'cancelled']::text[]
  and pg_temp.g2_con('cms_governed_activation_schedules', 'cms_governed_activation_schedules_reason_state_check') like '%reason_code IS NOT NULL%',
  'reason_code is non-null exactly for blocked and cancelled [P2-S12-AC-255]');
select ok(pg_temp.g2_con('cms_governed_activation_schedules', 'cms_governed_activation_schedules_attempt_count_check') like '%attempt_count >= 0%'
  and pg_temp.g2_con('cms_governed_activation_schedules', 'cms_governed_activation_schedules_attempt_count_check') like '%attempt_count <= 3%',
  'attempt_count is 0 to 3 [P2-S12-AC-255]');
select ok(pg_temp.g2_trigger_ok('cms_governed_activation_schedules', 'cms_governed_activation_schedules_z_state_guard', 'cms_governed_schedule_guard', 28),
  'a BEFORE INSERT OR UPDATE OR DELETE state guard polices every schedule write [P2-S12-AC-255]');
select ok(pg_temp.g2_forced_rls('cms_governed_activation_schedules'), 'cms_governed_activation_schedules has forced row level security [P2-S12-AC-255]');
select is(pg_temp.g2_granted('cms_governed_activation_schedules'), array[]::text[],
  'direct UPDATE, DELETE and grants on cms_governed_activation_schedules are revoked from every API role [P2-S12-AC-255]');
select is(pg_temp.g2_writers('insert\s+into\s+platform_private\.cms_governed_activation_schedules\M'),
  array['platform_private.cms_activate_governed_subject']::text[],
  'schedule rows are inserted only by CMS-03C-09 (cms_activate_governed_subject) [P2-S12-AC-255]');
select is(pg_temp.g2_writers('(update|delete\s+from)\s+platform_private\.cms_governed_activation_schedules\M'),
  array['platform_private.cms_claim_due_governed_activations', 'platform_private.cms_execute_governed_activation',
    'platform_private.cms_governed_invalidate_approved_review', 'platform_private.cms_governed_schedule_block',
    'platform_private.cms_governed_schedule_record_failure']::text[],
  'schedule rows advance only in the claim and execute RPCs of CMS-03C-19 and their block, failure and cancel helpers, and none is deleted [P2-S12-AC-255]');

-- ------------------------------------------------------------------ oracle controls (mutations, rolled back) --
-- Each probe above must be able to fail: grant a privilege, add a writer, and watch the probes see them.
grant select on table platform_private.cms_governed_reviews to anon;
grant insert on table platform_private.cms_governed_review_decisions to public;
select is(pg_temp.g2_granted('cms_governed_reviews'), array['anon']::text[],
  'control: the grant probe reports an anon table privilege when one is added [P2-S12-AC-251]');
select is(pg_temp.g2_granted('cms_governed_review_decisions'), array['anon', 'authenticated', 'public', 'service_role']::text[],
  'control: the grant probe reports PUBLIC (and every role it reaches) when PUBLIC is granted [P2-S12-AC-252]');
create function platform_private.g2_probe_writer() returns void language sql as
  $$ insert into platform_private.cms_governed_review_dependencies(owner_id, review_id, kind, ref_id) select null, null, null, null $$;
select is(pg_temp.g2_writers('insert\s+into\s+platform_private\.cms_governed_review_dependencies\M'),
  array['platform_private.cms_submit_governed_review', 'platform_private.g2_probe_writer']::text[],
  'control: the writer scan reports a second inserting function when one is added [P2-S12-AC-254]');
select ok(not pg_temp.g2_trigger_ok('cms_governed_review_dependencies', 'cms_governed_review_dependencies_immutable_guard', 'cms_immutable_guard', 28),
  'control: the trigger probe rejects a wrong event mask [P2-S12-AC-254]');

select * from finish();
rollback;
