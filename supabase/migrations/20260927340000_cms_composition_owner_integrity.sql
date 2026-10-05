-- Slice 12: a privileged composition write must not cross an owner boundary.
-- Keep the original identity/version foreign keys and add owner-bound keys as
-- a second, database-enforced line of defense for future named RPCs.
begin;

alter table platform_private.cms_entry_revisions
  add constraint cms_entry_revisions_id_owner_key unique (id, owner_id);
alter table platform_private.cms_pattern_versions
  add constraint cms_pattern_versions_id_version_owner_key
    unique (id, version, owner_id);
alter table platform_private.cms_composition_instances
  add constraint cms_composition_instances_id_owner_key unique (id, owner_id);

alter table platform_private.cms_composition_instances
  add constraint cms_composition_instances_revision_owner_fkey
    foreign key (revision_id, owner_id)
    references platform_private.cms_entry_revisions(id, owner_id),
  add constraint cms_composition_instances_pattern_owner_fkey
    foreign key (pattern_id, pattern_version, owner_id)
    references platform_private.cms_pattern_versions(id, version, owner_id),
  add constraint cms_composition_instances_parent_owner_fkey
    foreign key (parent_instance_id, owner_id)
    references platform_private.cms_composition_instances(id, owner_id);

commit;
