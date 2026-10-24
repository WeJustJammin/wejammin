-- Slice 12 lane pattern-updates (BE03c Pattern versions and linked updates 1367, Canonical records 1426; DEC-185, DEC-193; tracker
-- P2-S12-AC-118 .. AC-121, AC-258): the row CMS-03C-15 appends for an instance.
--
--   platform_private.cms_pattern_update_next_row(head, action, plan, choices, digest, actor, now) returns cms_composition_instances
--
-- DEC-193 row assembly only; the caller owns the ordered registry locks and validation. The row is a copy of the head row of the path at
-- the next version (UNIQUE(revision_id, path, version), append-only), same position, slot, lineage, bindings and parent (a position is
-- immutable per path, DEC-185). One pure B/L/T resolution decides it: accept adopts the target pin with the resolved overrides (an
-- exact semantic choices refusal otherwise; a removed target root retires the row with its prior pin), detach keeps the prior pin and
-- stores the complete detached_tree with empty props. R1-006: the row has no cross-revision carry source, so carried_from_id is null.
-- Private; VOLATILE SECURITY DEFINER with an empty search_path, owned by the CMS definer.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function platform_private.cms_pattern_update_next_row(
  p_head platform_private.cms_composition_instances, p_action text, p_plan jsonb,
  p_choices jsonb, p_digest text, p_actor uuid, p_now timestamptz)
returns platform_private.cms_composition_instances
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_row platform_private.cms_composition_instances;
  pinned platform_private.cms_pattern_versions%rowtype;
  base_tree jsonb;
  resolution jsonb;
  disposition text;
  message text;
begin
  if p_action = 'detach' then
    select * into pinned from platform_private.cms_pattern_versions candidate
     where candidate.owner_id = p_head.owner_id and candidate.pattern_id = p_head.pattern_id
       and candidate.version = p_head.pattern_version;
    if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
    base_tree := platform_private.cms_pattern_root_snapshot(p_head, pinned, false);
  elsif p_action = 'accept' then
    base_tree := p_plan->'baseTree';
  else
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  begin
    -- B=B and no choices materializes current L for ordinary detach. Accept
    -- invokes exactly the same pure resolver over its complete canonical B/T.
    resolution := platform_private.cms_pattern_update_resolve(base_tree,
      case when p_action = 'detach' then base_tree else p_plan->'targetTree' end,
      p_head.props, case when p_action = 'detach' then '[]'::jsonb else coalesce(p_choices, '[]'::jsonb) end);
  exception when sqlstate 'P0001' then
    get stacked diagnostics message = message_text;
    if p_action = 'accept' and message = 'VALIDATION_FAILED' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/instances/0/choices"]';
    end if;
    raise;
  end;
  disposition := case when p_action = 'detach' then 'detached' else resolution->>'disposition' end;
  if disposition is null or disposition not in ('linked', 'detached', 'retired') then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  v_row := p_head;
  -- R1-006: an accept or detach row has no cross-revision carry source.
  v_row.carried_from_id := null;
  v_row.id := extensions.gen_random_uuid();
  v_row.version := p_head.version + 1;
  v_row.created_at := p_now;
  v_row.updated_at := p_now;
  v_row.created_by := p_actor;
  v_row.pending_pattern_version := null;
  v_row.state := 'active';
  v_row.detached_tree := null;
  v_row.block_registry_digest := p_digest;
  if disposition = 'retired' then
    -- A tombstone retains the actual prior pin/root. Never pin a linked row to
    -- the newer forest that lacks it; its retained content can still be detached.
    v_row.state := 'retired';
  else
    v_row.block_key := resolution#>>'{tree,nodes,0,blockKey}';
    v_row.block_version := (resolution#>>'{tree,nodes,0,blockVersion}')::integer;
    if disposition = 'detached' then
      v_row.link_mode := 'detached';
      v_row.props := '{}'::jsonb;
      v_row.detached_tree := resolution->'tree';
    else
      v_row.link_mode := 'linked';
      v_row.pattern_version := (p_plan->>'target')::bigint;
      v_row.props := resolution->'overrides';
    end if;
  end if;
  return v_row;
end;
$body$;

comment on function platform_private.cms_pattern_update_next_row(
  platform_private.cms_composition_instances, text, jsonb, jsonb, text, uuid, timestamptz) is
  'DEC-193 private append-row assembly: one pure B/L/T resolution, exact semantic choices refusal, target-pin linked overrides or complete detached_tree with empty props and prior provenance; removed-root theirs retires with prior pin. Ordinary detach materializes unchanged L. No registry lock or persistent write here.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_pattern_update_next_row(platform_private.cms_composition_instances, text, jsonb, jsonb, text, uuid, timestamptz)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_pattern_update_next_row(platform_private.cms_composition_instances, text, jsonb, jsonb, text, uuid, timestamptz)
  from public, anon, authenticated, service_role;

commit;
