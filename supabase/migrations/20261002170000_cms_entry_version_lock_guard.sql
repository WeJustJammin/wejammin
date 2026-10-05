-- BE03a "Source drift" race fix.  The activation switch proves the scanned
-- source unchanged and then flips the source version to superseded.  An entry
-- or publication write that targets that version in between would commit a row
-- the scan never saw.  Every revision or publication-version insert therefore
-- takes a FOR SHARE row lock on the target content-type version row: the switch
-- takes the conflicting FOR UPDATE lock on the source version BEFORE its final
-- unchanged check (human path: current active; worker path: expected active), so
-- the two serialize.  A write that was waiting behind the switch re-reads the
-- version after the switch commits and is refused with CONFLICT when the version
-- is superseded, so no entry can land on a switched-away version.
-- The guard is a trigger so that every present and future producer path
-- (cms_create_entry, revision writes, locale variants, calendar and enum
-- writes, publication) is covered without editing the Slice 10-owned functions.
-- Forward-only.
begin;

create or replace function platform_private.cms_entry_version_lock_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $body$
declare
  version_state platform_private.cms_definition_state;
begin
  select version_row.state into version_state
    from platform_private.cms_content_type_versions version_row
   where version_row.id = new.schema_version_id
     for share;
  if version_state = 'superseded'::platform_private.cms_definition_state then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

-- Named with the "a" infix so the lock is taken before any other BEFORE INSERT
-- guard of the table does its own reads.
create trigger cms_entry_revisions_a_version_lock_guard
before insert on platform_private.cms_entry_revisions
for each row execute function platform_private.cms_entry_version_lock_guard();

create trigger cms_publication_versions_a_version_lock_guard
before insert on platform_private.cms_publication_versions
for each row execute function platform_private.cms_entry_version_lock_guard();

revoke all on function platform_private.cms_entry_version_lock_guard()
  from public, anon, authenticated, service_role;

commit;
