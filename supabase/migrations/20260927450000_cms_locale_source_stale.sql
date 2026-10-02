-- CMS-03C-04: a source revision with changed content appends a stale version
-- for each dependent locale. Existing immutable variants are never updated.
-- Forward-only: correction requires a reviewed successor migration.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '2min';

create index cms_locale_variants_source_locale_latest_idx
  on platform_private.cms_locale_variants
  (entry_id, pg_catalog.lower(source_locale), pg_catalog.lower(locale),
   version desc, created_at desc);

create function platform_private.cms_stale_locale_dependents(
  p_source_revision_id uuid,
  p_backfill boolean
)
returns integer
language plpgsql
security definer
set search_path = ''
as $body$
declare
  source_row platform_private.cms_entry_revisions%rowtype;
  entry_row platform_private.cms_content_entries%rowtype;
  previous_row platform_private.cms_locale_variants%rowtype;
  source_actor_id uuid;
  stale_id uuid;
  event_version bigint;
  event_correlation_id uuid;
  appended_count integer := 0;
  snapshot_time timestamptz := pg_catalog.clock_timestamp();
begin
  if pg_catalog.current_setting('app.cms_rpc', true) is distinct from 'true' then
    raise exception 'DIRECT_CMS_TABLE_WRITE' using errcode = 'P0001';
  end if;
  select * into source_row from platform_private.cms_entry_revisions revision
  where revision.id = p_source_revision_id;
  if not found then return 0; end if;

  -- All source and locale commands serialize on their entry aggregate. A
  -- historical insertion cannot invalidate a variant derived from a newer
  -- source revision.
  select * into entry_row from platform_private.cms_content_entries entry
  where entry.id = source_row.entry_id for update;
  if not found then raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001'; end if;
  if exists (
    select 1 from platform_private.cms_entry_revisions newer
    where newer.entry_id = source_row.entry_id
      and pg_catalog.lower(newer.locale) = pg_catalog.lower(source_row.locale)
      and newer.revision_number > source_row.revision_number
  ) then return 0; end if;

  event_version := entry_row.version + case when p_backfill then 0 else 1 end;
  event_correlation_id := platform_private.cms_correlation('{}'::jsonb);
  for previous_row in
    select distinct on (pg_catalog.lower(variant.locale)) variant.*
    from platform_private.cms_locale_variants variant
    where variant.entry_id = source_row.entry_id
      and pg_catalog.lower(variant.source_locale) = pg_catalog.lower(source_row.locale)
    order by pg_catalog.lower(variant.locale), variant.version desc,
             variant.created_at desc, variant.id desc
  loop
    if previous_row.state = 'stale'
       or previous_row.source_hash::text = source_row.payload_hash::text then
      continue;
    end if;
    if source_actor_id is null then
      select person.auth_user_id into source_actor_id
      from platform_private.person_party person
      where person.party_id = source_row.author_person_id
        and person.account_state in ('claimed', 'active');
      if source_actor_id is null then
        raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
      end if;
    end if;

    stale_id := extensions.gen_random_uuid();
    insert into platform_private.cms_locale_variants(
      id, owner_id, state, version, created_at, updated_at,
      entry_id, revision_id, source_revision_id, locale, source_locale,
      source_hash, fallback_chain, no_fallback_field_ids,
      approval_evidence, created_by
    ) values (
      stale_id, previous_row.owner_id, 'stale', previous_row.version + 1,
      snapshot_time, snapshot_time,
      previous_row.entry_id, previous_row.revision_id,
      previous_row.source_revision_id, previous_row.locale,
      previous_row.source_locale, previous_row.source_hash,
      previous_row.fallback_chain, previous_row.no_fallback_field_ids,
      null, source_actor_id
    );
    perform platform_private.cms_emit_event(
      'cms.locale.variant.stale', source_actor_id, source_row.acting_party_id,
      'cms_locale_variant', stale_id, 'CMS_LOCALE_SOURCE_STALE',
      'cms.localization.changed.v1', 'cms_content_entry', source_row.entry_id,
      event_version,
      pg_catalog.jsonb_build_object(
        'entryId', source_row.entry_id, 'locale', previous_row.locale,
        'revisionId', previous_row.revision_id
      ), event_correlation_id
    );
    appended_count := appended_count + 1;
  end loop;
  return appended_count;
end;
$body$;

comment on function platform_private.cms_stale_locale_dependents(uuid, boolean) is
  'Appends one stale locale variant per latest source-dependent locale when an immutable source revision hash changes. The original remains untouched; audit and identifier-only outbox commit atomically.';

create function platform_private.cms_entry_revision_locale_stale_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $body$
begin
  perform platform_private.cms_stale_locale_dependents(new.id, false);
  return new;
end;
$body$;

create trigger cms_entry_revisions_locale_stale
after insert on platform_private.cms_entry_revisions
for each row execute function platform_private.cms_entry_revision_locale_stale_trigger();

revoke all on function platform_private.cms_stale_locale_dependents(uuid, boolean)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_entry_revision_locale_stale_trigger()
  from public, anon, authenticated, service_role;

-- Reconcile any source/variant rows written before this trigger existed. This
-- is append-only and idempotent; no prior approval or provenance is erased.
do $body$
declare
  source_id uuid;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  for source_id in
    select distinct on (revision.entry_id, pg_catalog.lower(revision.locale))
      revision.id
    from platform_private.cms_entry_revisions revision
    where exists (
      select 1 from platform_private.cms_locale_variants variant
      where variant.entry_id = revision.entry_id
        and pg_catalog.lower(variant.source_locale) = pg_catalog.lower(revision.locale)
    )
    order by revision.entry_id, pg_catalog.lower(revision.locale),
             revision.revision_number desc, revision.id desc
  loop
    perform platform_private.cms_stale_locale_dependents(source_id, true);
  end loop;
end;
$body$;

commit;
