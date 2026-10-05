-- Slice 12: a taxonomy assignment must not refer to another owner's field.
-- Forward-only: reverting this boundary requires a reviewed later migration;
-- dropping it in place would reopen cross-owner editorial metadata linkage.
begin;

set local lock_timeout = '5s';

do $body$
begin
  if exists (
    select 1
      from platform_private.cms_term_assignments assignment
      join platform_private.cms_field_definition_versions field
        on field.id = assignment.field_definition_id
     where assignment.owner_id <> field.owner_id
  ) then
    raise exception 'cms_term_assignments contains a cross-owner field reference'
      using errcode = 'P0001';
  end if;
end;
$body$;

alter table platform_private.cms_field_definition_versions
  add constraint cms_field_definition_versions_id_owner_key
    unique (id, owner_id);

alter table platform_private.cms_term_assignments
  add constraint cms_term_assignments_field_owner_fkey
    foreign key (field_definition_id, owner_id)
    references platform_private.cms_field_definition_versions(id, owner_id)
    not valid;

alter table platform_private.cms_term_assignments
  validate constraint cms_term_assignments_field_owner_fkey;

commit;
