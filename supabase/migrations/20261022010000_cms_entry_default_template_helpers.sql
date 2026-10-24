-- Slice 12 lane dec202, DEC-202 / BE03b "Initial revision default template (CMS-03B-10, DEC-202)"
-- (tracker P2-S12-AC-286..AC-296): two private helpers for the entry-create producer.
--
--   cms_lock_default_template_shared(template, owner)   position 3 of the write-path lock order:
--       FOR SHARE on the exact SAME-OWNER stored default TemplateVersion row only.  A missing,
--       foreign or concealed definition matches no row and is never locked (no lock lever).  No
--       slot or block allow-list row is locked.  A deadlock is converted to the typed CONFLICT
--       by the platform_api.cms_create_entry wrapper (20261005013100).
--   cms_entry_default_template_gate(actor, party, template, version)
--       applies the EXISTING compatibility resolver (cms_resolve_template_compatibility,
--       BE03c DEC-108) to that exact stored default against the exact content-type version and
--       maps only its three expected refusals, exactly like the successor gate (20261002216000):
--         NOT_FOUND (missing or concealed)  -> 404 NOT_FOUND, no detail;
--         INCOMPATIBLE                      -> 422 VALIDATION_FAILED, DETAIL ["/contentTypeVersionId"];
--         WITHDRAWN (retired or blocked)    -> 409 CONFLICT, no detail.
--       A superseded default is eligible (the resolver rejects only retired and blocked).  Every other
--       exception is re-raised unchanged: an unexpected resolver fault is never relabelled as a
--       template refusal.  The gate returns the exact template version id to pin.
-- Forward-only; both private, definer-owned, no API-role execute.
begin;

create or replace function platform_private.cms_lock_default_template_shared(
  p_template_version_id uuid,
  p_owner_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
begin
  if p_template_version_id is null or p_owner_id is null then
    return;
  end if;
  -- The owner predicate is part of the locking statement itself: a row of another owner is
  -- filtered out before it is locked, so a foreign definition can never be waited on.
  perform 1
  from platform_private.cms_template_versions template
  where template.id = p_template_version_id
    and template.owner_id = p_owner_id
  for share;
end;
$body$;

create or replace function platform_private.cms_entry_default_template_gate(
  p_actor_id uuid,
  p_acting_party_id uuid,
  p_template_version_id uuid,
  p_content_type_version_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $body$
declare
  resolved jsonb;
  content_type_id uuid;
begin
  select version.content_type_id into content_type_id
  from platform_private.cms_content_type_versions version
  where version.id = p_content_type_version_id;
  begin
    resolved := platform_private.cms_resolve_template_compatibility(
      pg_catalog.jsonb_build_object(
        'templateVersionId', p_template_version_id,
        'contentTypeId', content_type_id,
        'contentTypeVersionId', p_content_type_version_id,
        'context', pg_catalog.jsonb_build_object(
          'authUserId', p_actor_id, 'actingPartyId', p_acting_party_id)));
  exception when others then
    if sqlerrm = 'NOT_FOUND' then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    elsif sqlerrm = 'INCOMPATIBLE' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001',
        detail = '["/contentTypeVersionId"]';
    elsif sqlerrm = 'WITHDRAWN' then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    raise;
  end;
  return (resolved->>'templateVersionId')::uuid;
end;
$body$;

comment on function platform_private.cms_lock_default_template_shared(uuid, uuid) is
  'DEC-202 position 3: FOR SHARE on the exact same-owner stored default TemplateVersion row of a content-type version, held to commit. A missing, foreign or concealed row matches nothing and is never locked. Private.';
comment on function platform_private.cms_entry_default_template_gate(uuid, uuid, uuid, uuid) is
  'DEC-202: applies cms_resolve_template_compatibility to the exact stored default of a content-type version and maps NOT_FOUND -> 404, INCOMPATIBLE -> 422 VALIDATION_FAILED ["/contentTypeVersionId"], WITHDRAWN (retired or blocked) -> 409 CONFLICT; superseded stays eligible; every other fault propagates unchanged. Returns the exact template version id to pin. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_lock_default_template_shared(uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_entry_default_template_gate(uuid, uuid, uuid, uuid) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_lock_default_template_shared(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_entry_default_template_gate(uuid, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

commit;
