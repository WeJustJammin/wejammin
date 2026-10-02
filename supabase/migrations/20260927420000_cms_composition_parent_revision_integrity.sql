-- Slice 12: nested composition instances must remain inside one revision tree.
-- The earlier owner-bound parent key prevents cross-owner links but permits a
-- same-owner parent from another revision. Keep that key and strengthen it.
begin;
set local lock_timeout = '5s';

alter table platform_private.cms_composition_instances
  add constraint cms_composition_instances_id_revision_owner_key
    unique (id, revision_id, owner_id);

alter table platform_private.cms_composition_instances
  add constraint cms_composition_instances_parent_revision_owner_fkey
    foreign key (parent_instance_id, revision_id, owner_id)
    references platform_private.cms_composition_instances(id, revision_id, owner_id)
    not valid;

-- Fail deployment rather than grandfathering a malformed composition graph.
alter table platform_private.cms_composition_instances
  validate constraint cms_composition_instances_parent_revision_owner_fkey;

commit;
