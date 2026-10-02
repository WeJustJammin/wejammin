-- BE03b EntryFieldValue and EntryRelation snapshots inherit their revision
-- owner. Bind both parent references to owner_id at the database boundary.
-- Forward-only: dropping these keys would reopen cross-owner CMS linkage.
begin;

set local lock_timeout = '5s';

do $body$
begin
  if exists (
    select 1
      from platform_private.cms_entry_field_values value_row
      join platform_private.cms_entry_revisions revision
        on revision.id = value_row.revision_id
     where value_row.owner_id <> revision.owner_id
  ) or exists (
    select 1
      from platform_private.cms_entry_field_values value_row
      join platform_private.cms_field_definition_versions field
        on field.id = value_row.field_definition_id
     where value_row.owner_id <> field.owner_id
  ) or exists (
    select 1
      from platform_private.cms_entry_relations relation_row
      join platform_private.cms_entry_revisions revision
        on revision.id = relation_row.revision_id
     where relation_row.owner_id <> revision.owner_id
  ) or exists (
    select 1
      from platform_private.cms_entry_relations relation_row
      join platform_private.cms_field_definition_versions field
        on field.id = relation_row.field_definition_id
     where relation_row.owner_id <> field.owner_id
  ) then
    raise exception 'CMS entry snapshots contain cross-owner parent references'
      using errcode = 'P0001';
  end if;
end;
$body$;

alter table platform_private.cms_entry_field_values
  add constraint cms_entry_field_values_revision_owner_fkey
    foreign key (revision_id, owner_id)
    references platform_private.cms_entry_revisions(id, owner_id)
    not valid,
  add constraint cms_entry_field_values_definition_owner_fkey
    foreign key (field_definition_id, owner_id)
    references platform_private.cms_field_definition_versions(id, owner_id)
    not valid;

alter table platform_private.cms_entry_relations
  add constraint cms_entry_relations_revision_owner_fkey
    foreign key (revision_id, owner_id)
    references platform_private.cms_entry_revisions(id, owner_id)
    not valid,
  add constraint cms_entry_relations_definition_owner_fkey
    foreign key (field_definition_id, owner_id)
    references platform_private.cms_field_definition_versions(id, owner_id)
    not valid;

alter table platform_private.cms_entry_field_values
  validate constraint cms_entry_field_values_revision_owner_fkey;
alter table platform_private.cms_entry_field_values
  validate constraint cms_entry_field_values_definition_owner_fkey;
alter table platform_private.cms_entry_relations
  validate constraint cms_entry_relations_revision_owner_fkey;
alter table platform_private.cms_entry_relations
  validate constraint cms_entry_relations_definition_owner_fkey;

commit;
