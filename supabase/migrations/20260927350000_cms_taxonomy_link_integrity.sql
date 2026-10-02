-- Slice 12: vocabulary hierarchy, redirects, and assignments may not cross
-- taxonomy or owner boundaries even if a future privileged RPC errs.
-- Forward-only: removing these constraints would reopen a disclosure path.
begin;

set local lock_timeout = '5s';

alter table platform_private.cms_terms
  add constraint cms_terms_id_taxonomy_owner_key
    unique (id, taxonomy_version_id, owner_id);

alter table platform_private.cms_terms
  add constraint cms_terms_parent_taxonomy_owner_fkey
    foreign key (parent_term_id, taxonomy_version_id, owner_id)
    references platform_private.cms_terms(id, taxonomy_version_id, owner_id)
    not valid,
  add constraint cms_terms_successor_taxonomy_owner_fkey
    foreign key (successor_id, taxonomy_version_id, owner_id)
    references platform_private.cms_terms(id, taxonomy_version_id, owner_id)
    not valid;

alter table platform_private.cms_term_assignments
  add constraint cms_term_assignments_term_taxonomy_owner_fkey
    foreign key (term_id, taxonomy_version_id, owner_id)
    references platform_private.cms_terms(id, taxonomy_version_id, owner_id)
    not valid,
  add constraint cms_term_assignments_revision_owner_fkey
    foreign key (revision_id, owner_id)
    references platform_private.cms_entry_revisions(id, owner_id)
    not valid;

alter table platform_private.cms_terms
  validate constraint cms_terms_parent_taxonomy_owner_fkey;
alter table platform_private.cms_terms
  validate constraint cms_terms_successor_taxonomy_owner_fkey;
alter table platform_private.cms_term_assignments
  validate constraint cms_term_assignments_term_taxonomy_owner_fkey;
alter table platform_private.cms_term_assignments
  validate constraint cms_term_assignments_revision_owner_fkey;

commit;
