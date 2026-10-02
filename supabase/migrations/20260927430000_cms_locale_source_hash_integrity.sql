-- Slice 12: a locale snapshot's source hash must identify its source revision.
-- Revisions are immutable, so this composite reference remains stable while a
-- later source revision can legitimately make the locale snapshot stale.
-- Rollback before commit is transactional; deployed corrections are forward-only.
begin;
set local lock_timeout = '5s';

alter table platform_private.cms_entry_revisions
  add constraint cms_entry_revisions_id_payload_hash_key
    unique (id, payload_hash);

alter table platform_private.cms_locale_variants
  add constraint cms_locale_variants_source_revision_hash_fkey
    foreign key (source_revision_id, source_hash)
    references platform_private.cms_entry_revisions(id, payload_hash)
    not valid;

-- Fail deployment rather than grandfathering a falsely attributed source.
alter table platform_private.cms_locale_variants
  validate constraint cms_locale_variants_source_revision_hash_fkey;

commit;
