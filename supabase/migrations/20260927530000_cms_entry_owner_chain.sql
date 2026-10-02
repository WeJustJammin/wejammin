-- BE03a/BE03b owner lineage: content type -> version -> entry -> revision
-- and entry -> assignment. The original identity FKs do not bind owner_id.
-- Forward-only: removing this chain would reopen cross-owner CMS writes.
begin;

set local lock_timeout = '5s';

do $body$
begin
  if exists (
    select 1
      from platform_private.cms_content_type_versions version_row
      join platform_private.cms_content_types type_row
        on type_row.id = version_row.content_type_id
     where version_row.owner_id <> type_row.owner_id
  ) or exists (
    select 1
      from platform_private.cms_content_entries entry_row
      join platform_private.cms_content_types type_row
        on type_row.id = entry_row.content_type_id
     where entry_row.owner_id <> type_row.owner_id
  ) or exists (
    select 1
      from platform_private.cms_entry_revisions revision_row
      join platform_private.cms_content_type_versions version_row
        on version_row.id = revision_row.schema_version_id
     where revision_row.owner_id <> version_row.owner_id
  ) or exists (
    select 1
      from platform_private.cms_entry_assignments assignment_row
      join platform_private.cms_content_entries entry_row
        on entry_row.id = assignment_row.entry_id
     where assignment_row.owner_id <> entry_row.owner_id
  ) then
    raise exception 'CMS entry owner lineage contains cross-owner references'
      using errcode = 'P0001';
  end if;
end;
$body$;

alter table platform_private.cms_content_types
  add constraint cms_content_types_id_owner_key unique (id, owner_id);
alter table platform_private.cms_content_type_versions
  add constraint cms_content_type_versions_id_owner_key unique (id, owner_id);

alter table platform_private.cms_content_type_versions
  add constraint cms_content_type_versions_type_owner_fkey
    foreign key (content_type_id, owner_id)
    references platform_private.cms_content_types(id, owner_id)
    not valid;
alter table platform_private.cms_content_entries
  add constraint cms_content_entries_type_owner_fkey
    foreign key (content_type_id, owner_id)
    references platform_private.cms_content_types(id, owner_id)
    not valid;
alter table platform_private.cms_entry_revisions
  add constraint cms_entry_revisions_schema_owner_fkey
    foreign key (schema_version_id, owner_id)
    references platform_private.cms_content_type_versions(id, owner_id)
    not valid;
alter table platform_private.cms_entry_assignments
  add constraint cms_entry_assignments_entry_owner_fkey
    foreign key (entry_id, owner_id)
    references platform_private.cms_content_entries(id, owner_id)
    not valid;

alter table platform_private.cms_content_type_versions
  validate constraint cms_content_type_versions_type_owner_fkey;
alter table platform_private.cms_content_entries
  validate constraint cms_content_entries_type_owner_fkey;
alter table platform_private.cms_entry_revisions
  validate constraint cms_entry_revisions_schema_owner_fkey;
alter table platform_private.cms_entry_assignments
  validate constraint cms_entry_assignments_entry_owner_fkey;

commit;
