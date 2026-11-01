-- Slice 12 lane locale, the source-change fan-out writer, Slice 12 deltas (BE03c Locale field resolution
-- (DEC-121, DEC-138) and fan-out (D12) 1393-1395, CMS-03C-04 transaction 1508, Event schemas 1555;
-- tracker P2-S12-AC-235, AC-237):
--
--   * the stale row it appends records the translated fields whose current source value hash differs
--     (stale_field_ids) and keeps the variant's recorded field_source_hashes, the baseline of every later
--     per-field comparison;
--   * the event it emits is cms.localization.changed.v1 under aggregate type cms_locale_variant, the locale
--     aggregate id (cms_locale_aggregate_id) and the stale row's own variant version, so the fan-out writer
--     and the author command never share a dedupe key.
--
-- The writers insert the field values of a revision after the revision row, so this function must run after
-- the values exist (20261014050310 attaches it to the draft head move, which every writer performs last, and
-- cms_author_locale_variant calls it after its own values): the snapshot of stale_field_ids is then exact, the
-- same truth cms_locale_stale_fields computes live.  Everything else is unchanged from 20260927450000: the same
-- row-level rule (latest source revision of the locale, one stale row per latest non-stale dependent whose source
-- hash differs), actor, audit and locking.
--
-- p_backfill is retained but has no effect: the event version is previous_row.version + 1 in both modes (D12),
-- so the installed callers' argument (20261005010900 cms_backfill_locale_stale passes true, the retired
-- revision trigger passed false, the head-move trigger and the lane suites pass false) changes nothing.  The
-- two-argument signature is pinned by the installed ownership migration (20261003120500) and those callers,
-- which this forward migration may not edit; dropping the parameter is a later retirement that must redefine
-- the backfill caller in the same migration.  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_stale_locale_dependents(
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
  stale_ids jsonb;
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

    select coalesce(pg_catalog.jsonb_agg(recorded.key order by recorded.key), '[]'::jsonb)
      into stale_ids
      from pg_catalog.jsonb_each_text(previous_row.field_source_hashes) recorded
     where recorded.value is distinct from
           platform_private.cms_locale_source_field_hash(source_row.id, recorded.key::uuid);

    stale_id := extensions.gen_random_uuid();
    insert into platform_private.cms_locale_variants(
      id, owner_id, state, version, created_at, updated_at,
      entry_id, revision_id, source_revision_id, locale, source_locale,
      source_hash, fallback_chain, no_fallback_field_ids,
      approval_evidence, created_by, field_source_hashes, stale_field_ids
    ) values (
      stale_id, previous_row.owner_id, 'stale', previous_row.version + 1,
      snapshot_time, snapshot_time,
      previous_row.entry_id, previous_row.revision_id,
      previous_row.source_revision_id, previous_row.locale,
      previous_row.source_locale, previous_row.source_hash,
      previous_row.fallback_chain, previous_row.no_fallback_field_ids,
      null, source_actor_id, previous_row.field_source_hashes, stale_ids
    );
    perform platform_private.cms_emit_event(
      'cms.locale.variant.stale', source_actor_id, source_row.acting_party_id,
      'cms_locale_variant', stale_id, 'CMS_LOCALE_SOURCE_STALE',
      'cms.localization.changed.v1', 'cms_locale_variant',
      platform_private.cms_locale_aggregate_id(previous_row.entry_id, previous_row.locale),
      previous_row.version + 1,
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
  'Appends one stale locale variant per latest source-dependent locale (p_backfill is retained for the installed callers and ignored) when an immutable source revision hash changes, recording exactly the translated fields whose source value hash differs from the recorded one (the same truth as cms_locale_stale_fields, taken after the revision values exist). The original remains untouched; audit and the identifier-only outbox event (aggregate cms_locale_variant, the locale aggregate, the stale row version) commit atomically.';

commit;
