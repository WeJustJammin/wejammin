-- Slice 10 evidence lane EB (AC-038..AC-048, AC-045), amended for Slice 11 (DEC-149, BE03b CMS-03B-05..09, CMS-03B-15..20).
-- Slice 10 shipped the editorial-workflow storage with no command that writes it; the CMS-03B-05..09 request rules were
-- contract-only.  Slice 11 adds the review, decision, schedule, preview and publication commands.  This file keeps the
-- database half of that boundary statement as an EXPLICIT ALLOW-LIST: each assertion below names, one by one, every
-- review, decision, schedule, preview, publication, manifest and version-set function or table the database may carry.
-- A function or table that is not on a list, or a named one that disappears, makes its assertion fail, so a new command
-- cannot enter the editorial-workflow surface without being reviewed and named here together with the contract and
-- runtime evidence that goes with it.  Every listed Slice 11 function is SECURITY DEFINER; the platform_api commands are
-- service_role-only and the platform_private implementations carry no API-role grant (phase_02_slice_09_r8_api_surface.sql
-- and the Slice 11 rpc suites assert the grants).

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(6);

-- 1: worker-facing mint / open / schedule / claim / execute / publish commands (platform_api only; public_api and public carry none).
select is(
  (select string_agg(n.nspname || '.' || p.proname, ', ' order by n.nspname, p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('platform_api', 'public_api', 'public')
      and p.proname ~ '(preview|schedul|publication|publish)'),
  'platform_api.cms_claim_due_publication_schedules, platform_api.cms_execute_publication_schedule, platform_api.cms_mint_preview, platform_api.cms_publish_revision, platform_api.cms_schedule_publication, platform_api.cms_verify_preview_token',
  'EB scope: the only worker-facing functions that mint, open, schedule, claim, execute or publish are the six named Slice 11 commands (no other preview, schedule or publication RPC exists)'
);

-- 2: worker-facing review and decision functions (the name pattern "review" also covers "preview").
select is(
  (select string_agg(p.proname, ', ' order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_api'
      and p.proname ~ '(review|decision)'),
  'cms_assign_editorial_reviewer, cms_assign_schema_review, cms_decide_schema_review, cms_get_editorial_review, cms_get_schema_review, cms_list_editorial_reviews, cms_mint_preview, cms_record_review_decision, cms_submit_review, cms_submit_schema_review, cms_sweep_expired_review_authority, cms_verify_preview_token',
  'EB scope: the only worker-facing review and decision functions are the 03A schema-review family and the named Slice 11 entry-review commands and reads'
);

-- 3: private commands and helpers for entry reviews, editorial decisions, publications, preview tokens and scheduled publication.
select is(
  (select string_agg(p.proname, ', ' order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_private'
      and p.proname ~ '(entry_review|editorial_review|editorial_decision|publication|preview_token|schedule_publication)'),
  'cms_append_publication_lineage, cms_assign_editorial_reviewer, cms_claim_due_publication_schedules, cms_editorial_review_distinct_approvals, cms_editorial_review_qualifying_decisions, cms_editorial_review_resource, cms_editorial_review_scopes, cms_execute_publication_schedule, cms_get_editorial_review, cms_invalidate_editorial_review, cms_list_editorial_reviews, cms_list_editorial_reviews_signed, cms_preview_token_derive, cms_publication_lineage_lock, cms_publication_lock_authority, cms_publication_lock_review, cms_publication_preflight_verdict, cms_publication_review_operand, cms_publication_row_state, cms_publication_settings_effective_values, cms_publication_settings_keys, cms_publication_settings_registry_version, cms_publication_stale_refusal, cms_publication_target, cms_revoke_active_preview_tokens, cms_revoke_preview_tokens, cms_schedule_publication, cms_verify_preview_token',
  'EB scope: the private entry-review, editorial-decision, publication and preview-token functions are exactly the named Slice 11 commands and helpers'
);

select is(
  (select count(*)::integer
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_api'
      and p.proname ~ '^cms_(create_entry|get_entry_draft|create_revision|resolve_conflict|restore_revision|list_revisions|get_conflict_detail|list_entries|get_entry_authoring_context)$'),
  9,
  'EB scope: the nine Slice 10 editorial operations are the nine worker-facing editorial RPCs'
);

-- 5: storage for reviews, decisions, review assignments and dependencies, schedules, publications, settings snapshots and preview tokens.
select is(
  (select string_agg(c.relname, ', ' order by c.relname)
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'platform_private'
      and c.relkind in ('r', 'p')
      and c.relname ~ '(editorial_review|editorial_decision|publication|preview_token)'),
  'cms_editorial_decisions, cms_editorial_review_assignments, cms_editorial_review_dependencies, cms_editorial_reviews, cms_preview_tokens, cms_publication_schedules, cms_publication_settings_snapshots, cms_publication_versions',
  'EB scope: the review, decision, schedule, publication and preview-token storage is exactly the five Slice 10 tables plus the named Slice 11 review-assignment, review-dependency and publication-settings-snapshot tables'
);

-- 6: manifest / version-set / hash functions, any schema the API or the Worker can reach plus the private helpers.
select is(
  (select string_agg(n.nspname || '.' || p.proname, ', ' order by n.nspname, p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('platform_api', 'platform_private', 'public_api', 'public')
      and p.proname ~ '(dependency_manifest|version_set|frozen_hash|normalized_revision_hash)'),
  'platform_private.cms_build_dependency_manifest, platform_private.cms_dependency_manifest_valid, platform_private.cms_dependency_manifest_within_bounds, platform_private.cms_revision_version_set, platform_private.cms_version_set_matches_manifest, platform_private.cms_version_set_of',
  'EB scope: the only functions that build a dependency manifest, derive a version set or compare them are the six named private Slice 11 derivation helpers (no API or public function exposes them)'
);

select * from finish();
rollback;
