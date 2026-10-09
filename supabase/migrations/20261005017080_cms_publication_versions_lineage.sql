-- Slice 11 data model (BE03b E3 "Publication lineage", Database Schema
-- "PublicationVersion", Separation of duties E11; tracker P2-S11-AC-114,
-- AC-115, AC-116): reconcile the Slice 10 foundation cms_publication_versions
-- (20260927090000) to the locked append-only LINEAGE model.
--
-- A lineage is the sequence of rows for one (entry_id, locale, audience); it
-- carries a stable publication_id (the id of its first row), a version (1, then
-- +1 per successor) and an action.  `publish` rows are `active` and carry the
-- full evidence; `unpublish`, `expire` and `archive` rows are `revoked`
-- tombstones that copy the ended row's revision and evidence.  The head is the
-- row with the greatest version; a row's browser state (`superseded` for a
-- non-head publish row) is DERIVED, so the physical state narrows to active |
-- revoked and the former one-active-row partial unique index is dropped (a prior
-- head stays `active` physically).  At most one head per lineage is guaranteed by
-- UNIQUE (entry_id, locale, audience, version) plus the lineage advisory lock the
-- publish RPCs take; the loser of a race is 409 publication_conflict.
--
-- The append guard (defence in depth under cms_publish_revision and the CMS-03B-20
-- executor) verifies, per inserted row: the lineage locale is the revision locale
-- and a schedule belongs to the same entry; publication_hash is recomputed (the
-- lowercase SHA-256 of the JCS { action, audience, dependencyHash, entryId, locale,
-- publicationId, revisionId, supersedesId, version, versionSet }); a first row is
-- a `publish` whose publication_id is its own id; a successor shares the
-- predecessor's publication_id, entry, locale and audience, takes the previous
-- version + 1, supersedes the current head (otherwise publication_conflict), and a
-- tombstone requires an `active` head (publication_not_active) and copies its
-- revision and evidence; a `publish` row is never appended by the revision author
-- (separation_of_duties), only for an active entry (entry_unavailable) and only
-- for a revision whose review is approved at the same dependency hash.  UPDATE and
-- DELETE stay rejected by the existing immutable guard.  SECURITY INVOKER; it
-- reads the revision, schedule, entry, review and predecessor rows.
-- The foundation holds no rows: nothing is back-filled.  Forward-only.
begin;

set local lock_timeout = '5s';

do $body$
begin
  if exists (select 1 from platform_private.cms_publication_versions version_row) then
    raise exception 'CMS publication versions pre-date the lineage model'
      using errcode = 'P0001';
  end if;
end;
$body$;

alter table platform_private.cms_publication_versions
  add column publication_id uuid not null,
  add column supersedes_id uuid null,
  add column action text not null,
  add column schedule_id uuid null,
  add column publisher_person_id uuid not null;

alter table platform_private.cms_publication_versions
  drop constraint cms_publication_versions_state_check,
  drop constraint cms_publication_versions_audience_check;
drop index platform_private.cms_publication_versions_active_identity_unique;
drop index platform_private.cms_publication_versions_entry_locale_audience_state_idx;

alter table platform_private.cms_publication_versions
  add constraint cms_publication_versions_state_check
    check (state in ('active', 'revoked')),
  add constraint cms_publication_versions_audience_check
    check (audience ~ '^[a-z0-9_-]{1,48}$'),
  add constraint cms_publication_versions_action_check
    check (action in ('publish', 'unpublish', 'expire', 'archive')),
  add constraint cms_publication_versions_action_state_check
    check ((action = 'publish') = (state = 'active')),
  add constraint cms_publication_versions_activation_check check (
    (state = 'active') = (activated_at is not null)
    and (state = 'revoked') = (revoked_at is not null)
  ),
  add constraint cms_publication_versions_chain_check
    check ((version = 1) = (supersedes_id is null)),
  add constraint cms_publication_versions_supersedes_self_check
    check (supersedes_id is null or supersedes_id <> id),
  add constraint cms_publication_versions_supersedes_id_fkey
    foreign key (supersedes_id) references platform_private.cms_publication_versions(id),
  add constraint cms_publication_versions_schedule_id_fkey
    foreign key (schedule_id) references platform_private.cms_publication_schedules(id),
  add constraint cms_publication_versions_publisher_person_id_fkey
    foreign key (publisher_person_id) references platform_private.person_party(party_id),
  add constraint cms_publication_versions_entry_owner_fkey
    foreign key (entry_id, owner_id)
    references platform_private.cms_content_entries(id, owner_id),
  add constraint cms_publication_versions_revision_entry_fkey
    foreign key (revision_id, entry_id)
    references platform_private.cms_entry_revisions(id, entry_id),
  add constraint cms_publication_versions_lineage_version_key
    unique (entry_id, locale, audience, version),
  add constraint cms_publication_versions_publication_version_key
    unique (publication_id, version);

create index cms_publication_versions_lineage_head_idx
  on platform_private.cms_publication_versions (entry_id, locale, audience, version desc);
create index cms_publication_versions_schedule_idx
  on platform_private.cms_publication_versions (schedule_id)
  where schedule_id is not null;

create or replace function platform_private.cms_lineage_append_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
declare
  revision_locale text;
  revision_author uuid;
  schedule_entry uuid;
  entry_lifecycle text;
  previous_row platform_private.cms_publication_versions%rowtype;
begin
  select revision_item.locale, revision_item.author_person_id
    into revision_locale, revision_author
    from platform_private.cms_entry_revisions revision_item
   where revision_item.id = new.revision_id;
  if found and revision_locale <> new.locale then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if new.schedule_id is not null then
    select schedule_item.entry_id into schedule_entry
      from platform_private.cms_publication_schedules schedule_item
     where schedule_item.id = new.schedule_id;
    if found and schedule_entry <> new.entry_id then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
  end if;
  if new.publication_hash is distinct from platform_private.cms_jcs_sha256(
       pg_catalog.jsonb_build_object(
         'action', new.action,
         'audience', new.audience,
         'dependencyHash', new.dependency_hash,
         'entryId', new.entry_id,
         'locale', new.locale,
         'publicationId', new.publication_id,
         'revisionId', new.revision_id,
         'supersedesId', new.supersedes_id,
         'version', new.version,
         'versionSet', new.version_set
       )) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if new.supersedes_id is null then
    -- The first row of a lineage is a publish and names itself as the lineage.
    if new.publication_id <> new.id or new.action <> 'publish' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
  else
    select version_item.* into previous_row
      from platform_private.cms_publication_versions version_item
     where version_item.id = new.supersedes_id;
    if not found then
      -- The foreign key reports the absent predecessor.
      return new;
    end if;
    if previous_row.publication_id <> new.publication_id
       or previous_row.entry_id <> new.entry_id
       or previous_row.locale <> new.locale
       or previous_row.audience <> new.audience
       or new.version <> previous_row.version + 1 then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    if exists (
         select 1
           from platform_private.cms_publication_versions head_item
          where head_item.entry_id = new.entry_id
            and head_item.locale = new.locale
            and head_item.audience = new.audience
            and head_item.version > previous_row.version
       ) then
      raise exception 'publication_conflict' using errcode = 'P0001';
    end if;
    if new.action <> 'publish' then
      if previous_row.state <> 'active' then
        raise exception 'publication_not_active' using errcode = 'P0001';
      end if;
      if new.revision_id <> previous_row.revision_id
         or new.dependency_hash <> previous_row.dependency_hash
         or new.activation_evidence_hash <> previous_row.activation_evidence_hash
         or new.schema_artifact_id <> previous_row.schema_artifact_id
         or new.schema_artifact_hash <> previous_row.schema_artifact_hash
         or new.version_set <> previous_row.version_set
         or new.schema_version_id <> previous_row.schema_version_id
         or new.template_version_id is distinct from previous_row.template_version_id
         or new.taxonomy_version_ids <> previous_row.taxonomy_version_ids
         or new.settings_version <> previous_row.settings_version then
        raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
      end if;
    end if;
  end if;
  if new.action = 'publish' then
    if new.publisher_person_id = revision_author then
      raise exception 'separation_of_duties' using errcode = 'P0001';
    end if;
    select entry_item.lifecycle into entry_lifecycle
      from platform_private.cms_content_entries entry_item
     where entry_item.id = new.entry_id;
    if found and entry_lifecycle <> 'active' then
      raise exception 'entry_unavailable' using errcode = 'P0001';
    end if;
    if not exists (
         select 1
           from platform_private.cms_editorial_reviews review_item
          where review_item.revision_id = new.revision_id
            and review_item.state = 'approved'
            and review_item.dependency_hash = new.dependency_hash
       ) then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$body$;

-- Fires after cms_publication_versions_write_guard (alphabetical order); the
-- Slice 09 a_version_lock_guard still takes its share lock first.
create trigger cms_publication_versions_z_lineage_guard
before insert on platform_private.cms_publication_versions
for each row execute function platform_private.cms_lineage_append_guard();

revoke all on function platform_private.cms_lineage_append_guard()
  from public, anon, authenticated, service_role;

-- SEC-2: a function whose body names a forced-RLS CMS table is owned by the
-- NOLOGIN, non-BYPASSRLS definer role (the catalog guard in
-- supabase/tests/phase_02_slice_09_sec2_definer_rls.sql derives the set from the
-- live bodies), exactly as the Slice 09 schema-review guards are.  ALTER FUNCTION
-- ... OWNER TO needs CREATE on the function's schema for the new owner, held for
-- this transaction only.  The guard stays SECURITY INVOKER: it runs with the
-- privileges of the calling role, so the definer functions that write the table
-- (Slice 11 command migrations) are the ones that hold the table verbs.
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_lineage_append_guard() owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;

commit;
