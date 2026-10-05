-- Slice 12: immutable locale and related-content snapshots may not link a
-- foreign owner or a revision belonging to a different entry. These database
-- constraints backstop future privileged RPCs; they do not implement locale
-- authoring or cross-owner target-eligibility policy.
begin;

set local lock_timeout = '5s';

alter table platform_private.cms_content_entries
  add constraint cms_content_entries_id_owner_key unique (id, owner_id);
alter table platform_private.cms_entry_revisions
  add constraint cms_entry_revisions_id_entry_owner_key
    unique (id, entry_id, owner_id);

alter table platform_private.cms_entry_revisions
  add constraint cms_entry_revisions_entry_owner_fkey
    foreign key (entry_id, owner_id)
    references platform_private.cms_content_entries(id, owner_id)
    not valid;

alter table platform_private.cms_locale_variants
  add constraint cms_locale_variants_entry_owner_fkey
    foreign key (entry_id, owner_id)
    references platform_private.cms_content_entries(id, owner_id)
    not valid,
  add constraint cms_locale_variants_revision_entry_owner_fkey
    foreign key (revision_id, entry_id, owner_id)
    references platform_private.cms_entry_revisions(id, entry_id, owner_id)
    not valid,
  add constraint cms_locale_variants_source_entry_owner_fkey
    foreign key (source_revision_id, entry_id, owner_id)
    references platform_private.cms_entry_revisions(id, entry_id, owner_id)
    not valid;

alter table platform_private.cms_related_content_rules
  add constraint cms_related_content_rules_source_owner_fkey
    foreign key (source_entry_id, owner_id)
    references platform_private.cms_content_entries(id, owner_id)
    not valid;

alter table platform_private.cms_entry_revisions
  validate constraint cms_entry_revisions_entry_owner_fkey;
alter table platform_private.cms_locale_variants
  validate constraint cms_locale_variants_entry_owner_fkey;
alter table platform_private.cms_locale_variants
  validate constraint cms_locale_variants_revision_entry_owner_fkey;
alter table platform_private.cms_locale_variants
  validate constraint cms_locale_variants_source_entry_owner_fkey;
alter table platform_private.cms_related_content_rules
  validate constraint cms_related_content_rules_source_owner_fkey;

commit;
