-- Slice 11 data model: the (id, entry_id) key of cms_entry_revisions.
--
-- The Slice 11 review, schedule, publication and preview-token rows bind a
-- revision to ITS entry declaratively with a composite foreign key
-- (revision_id, entry_id) -> cms_entry_revisions (id, entry_id), exactly as the
-- (id, owner_id) keys bind owner lineage (20260927340000, 20260927360000).  This
-- migration adds the key those foreign keys reference.
--
-- BE03b E2 (the physical revision state is the constant `draft`, every
-- browser-visible EntryRevisionState derived by one helper) is NOT applied here:
-- the Slice 10 reads (cms_list_entries, cms_list_revisions, cms_get_entry_draft,
-- the revision write responses) still read the physical state column, and the
-- Slice 10 list, composition and cursor suites seed revisions in the other five
-- workflow states to exercise the `state` filter.  Narrowing the CHECK before
-- those reads adopt the derived helper would break them with no behaviour gain,
-- so the narrowing ships with the helper in the Slice 11 command/read migrations
-- (lane S11-3), in the same migration that rewires the reads.  Forward-only.
begin;

set local lock_timeout = '5s';

alter table platform_private.cms_entry_revisions
  add constraint cms_entry_revisions_id_entry_key unique (id, entry_id);

commit;
