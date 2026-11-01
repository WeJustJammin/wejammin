-- Slice 11 lane S11-3d, BE03b "Derived revision workflow state (E2)" (tracker
-- P2-S11-AC-085): the CMS-03B-03 concealment classifier reads the DERIVED state.
--
-- cms_revision_page_disposition decides whether the caller may be told that a
-- revision exists: a scheduled or published revision is tenant data, visible only
-- to the acting party it was recorded under or to a confirmed member of that
-- party, and every other revision is visible once the caller cleared entry read
-- authority.  Until now it asked the physical column.  The physical state is the
-- constant `draft` (migration 20261005018090 closes the column to it), so a
-- scheduled or published revision would have been shown to every reader of the
-- entry.  The classifier now takes the derived state of the revision from
-- platform_private.cms_revision_effective_state:
--
--   * the three-argument form (unchanged signature) derives the state itself, for
--     the single-revision callers (a comparison target, the newest readable side);
--   * a NEW four-argument form classifies by a derived state the caller already
--     holds, so the history walk, which derives the states of a whole batch with the
--     set form of the helper, pays no second lookup per row.
--
-- A revision whose state cannot be derived (it does not exist) is `absent`: the
-- classifier fails closed.  Signature, SECURITY DEFINER attributes, search_path and
-- grants of the existing form are unchanged (CREATE OR REPLACE).  Both forms are
-- owned by the CMS definer role: the three-argument form (left with the platform
-- owner by the SEC-2 sweep, because it names no forced table) now calls the helper and
-- the four-argument form, which are definer-owned and executable by nothing else,
-- exactly like the readers that call the classifier.  Forward-only.
begin;

create or replace function platform_private.cms_revision_page_disposition(
  p_actor_id uuid,
  p_acting_party_id uuid,
  p_revision platform_private.cms_entry_revisions,
  p_effective_state text
)
returns text
language plpgsql
security definer
set search_path = ''
as $body$
begin
  if p_revision.id is null or p_effective_state is null then
    return 'absent';
  end if;
  if p_effective_state not in ('scheduled', 'published') then
    return 'visible';
  end if;
  if p_revision.acting_party_id is null then
    return 'absent';
  end if;
  if p_acting_party_id = p_revision.acting_party_id then
    return 'visible';
  end if;
  if platform_private.cms_entry_tenant_visible(
       p_actor_id, p_revision.acting_party_id
     ) then
    return 'visible';
  end if;
  return 'absent';
end;
$body$;

create or replace function platform_private.cms_revision_page_disposition(
  p_actor_id uuid,
  p_acting_party_id uuid,
  p_revision platform_private.cms_entry_revisions
)
returns text
language plpgsql
security definer
set search_path = ''
as $body$
begin
  if p_revision.id is null then
    return 'absent';
  end if;
  return platform_private.cms_revision_page_disposition(
    p_actor_id,
    p_acting_party_id,
    p_revision,
    platform_private.cms_revision_effective_state(p_revision.id)
  );
end;
$body$;

comment on function platform_private.cms_revision_page_disposition(uuid, uuid, platform_private.cms_entry_revisions) is
  'CMS-03B-03 concealment classifier: a revision whose DERIVED state (cms_revision_effective_state, BE03b E2) is scheduled or published is visible only to its acting party or a confirmed member of it; every other revision is visible once the caller cleared entry read authority; a revision whose state cannot be derived is absent.';
comment on function platform_private.cms_revision_page_disposition(uuid, uuid, platform_private.cms_entry_revisions, text) is
  'CMS-03B-03 concealment classifier for a caller that already holds the derived state of the revision (batch reads); same rule as the three-argument form.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_revision_page_disposition(uuid, uuid, platform_private.cms_entry_revisions)
  owner to wejammin_cms_definer;
alter function platform_private.cms_revision_page_disposition(uuid, uuid, platform_private.cms_entry_revisions, text)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_revision_page_disposition(uuid, uuid, platform_private.cms_entry_revisions)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_revision_page_disposition(uuid, uuid, platform_private.cms_entry_revisions, text)
  from public, anon, authenticated, service_role;

commit;
