-- Slice 12: a locale snapshot must describe the locale of its referenced
-- immutable revisions. The preceding owner/entry foreign keys remain in
-- force; these additional keys bind only the exact locale labels.
begin;

set local lock_timeout = '5s';

alter table platform_private.cms_entry_revisions
  add constraint cms_entry_revisions_id_locale_key unique (id, locale);

alter table platform_private.cms_locale_variants
  add constraint cms_locale_variants_revision_locale_fkey
    foreign key (revision_id, locale)
    references platform_private.cms_entry_revisions(id, locale)
    not valid,
  add constraint cms_locale_variants_source_locale_fkey
    foreign key (source_revision_id, source_locale)
    references platform_private.cms_entry_revisions(id, locale)
    not valid;

alter table platform_private.cms_locale_variants
  validate constraint cms_locale_variants_revision_locale_fkey;
alter table platform_private.cms_locale_variants
  validate constraint cms_locale_variants_source_locale_fkey;

commit;
