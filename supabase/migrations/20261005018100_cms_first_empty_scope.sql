-- DEC-162 / BE03a: null source denotes a genuine first, empty candidate.
-- A null comparison cannot prove emptiness. Read every persisted root of the
-- candidate's type, including archived entries and retained draft revisions.
-- Registry declarations/artifacts/bindings are not instantiated content.
-- This STABLE helper observes the caller's snapshot; it does not replace the
-- protected scan/seal, lock, CAS, lease or fingerprint fences.
begin;

create or replace function platform_private.cms_schema_source_row_count(
  p_from_version_id uuid,
  p_to_version_id uuid
)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  initial_type_id uuid;
  initial_nonempty boolean;
begin
  -- Preserve the existing successor census, including affected locale rows.
  if p_from_version_id is not null then
    return (
      select pg_catalog.count(*)
        from platform_private.cms_migration_live_rows(p_from_version_id, p_to_version_id)
    );
  end if;

  select candidate.content_type_id into initial_type_id
    from platform_private.cms_content_type_versions candidate
    join platform_private.cms_content_types content_type
      on content_type.id = candidate.content_type_id
     and content_type.owner_id = candidate.owner_id
   where candidate.id = p_to_version_id
     and candidate.version_no = 1
     and candidate.supersedes_id is null
     and not exists (
       select 1 from platform_private.cms_content_type_versions history
        where history.content_type_id = candidate.content_type_id
          and (
            history.id <> candidate.id
            or history.state in ('active', 'superseded', 'retired')
          )
     );
  if not found then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- Ownership is validated above. Do not filter these roots by owner or state:
  -- inconsistent ownership/type links must not conceal instantiated content.
  with type_versions as (
    select version_row.id
      from platform_private.cms_content_type_versions version_row
     where version_row.content_type_id = initial_type_id
  ), entries as (
    select entry.id
      from platform_private.cms_content_entries entry
     where entry.content_type_id = initial_type_id
  ), revisions as (
    select revision.id
      from platform_private.cms_entry_revisions revision
     where revision.entry_id in (select entry.id from entries entry)
        or revision.schema_version_id in (select version_row.id from type_versions version_row)
  )
  select exists (select 1 from entries)
      or exists (select 1 from revisions)
      or exists (
        select 1 from platform_private.cms_publication_versions publication
         where publication.entry_id in (select entry.id from entries entry)
            or publication.revision_id in (select revision.id from revisions revision)
            or publication.schema_version_id in (select version_row.id from type_versions version_row)
      )
      or exists (
        select 1 from platform_private.cms_locale_variants variant
         where variant.entry_id in (select entry.id from entries entry)
            or variant.revision_id in (select revision.id from revisions revision)
            or variant.source_revision_id in (select revision.id from revisions revision)
      )
    into initial_nonempty;

  if initial_nonempty then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  return 0::bigint;
end;
$body$;

-- The former SQL wrapper delegated all table reads. Direct forced-table reads
-- now require the existing SEC-2 NOLOGIN/NOSUPERUSER/NOBYPASSRLS definer owner.
-- Its existing SELECT privileges cover all six relations above. CREATE is held
-- only for this ownership transfer; API roles gain no execute/table privileges.
revoke all on function platform_private.cms_schema_source_row_count(uuid, uuid)
  from public, anon, authenticated, service_role;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_schema_source_row_count(uuid, uuid)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;

commit;
