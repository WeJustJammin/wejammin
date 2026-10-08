-- Slice 10 write-path serialization helpers (lane H, wave 2).  Private, owned by
-- the NOLOGIN CMS definer role (SEC-2), no API role may execute them.  The commands
-- that call them are redefined in 20261005012300 (create, append, resolve) and
-- 20261005012400 (restore).  Forward-only.
--
--   cms_lock_schema_version_shared(version)      BE03b "Entry and revision writes
--       serialize with schema activation" (Codex adversarial review H2): FOR SHARE on
--       the target content-type version row BEFORE the command reads schema evidence
--       and writes, and a recheck that the version is still active.  The 03a
--       activation switch takes the conflicting FOR UPDATE on the same row, so no
--       revision commits against a version the switch has already scanned and
--       superseded.  The Slice 09 insert-time guard (cms_entry_version_lock_guard)
--       stays as the backstop for every other producer path.
--
--   cms_lock_entry_authority(actor, party, entry)  IA03 "Authority revoked ..." edge
--       case (Codex adversarial review H1): FOR SHARE locks on the authority-bearing
--       rows -- the person, the confirmed membership tenure, the actor grants for
--       cms.author / cms.editor and (for an existing entry) the entry assignments --
--       in the order the revocation code path takes them (tenure or grant first,
--       then the assignments and presence rows of cms_revoke_edit_presence_without_
--       authority, 20261005011300).  A revoking UPDATE or DELETE of one of those
--       rows conflicts with the share lock, so a revocation and a write serialize:
--       a committed revocation is seen by the capability check that follows the
--       lock, and a revocation that arrives later waits for the write to commit.
--   cms_require_entry_capability_locked(actor, party, capabilities, entry)  the lock
--       followed by the unchanged cms_require_entry_capability (FORBIDDEN unless a
--       capability is proven AFTER the locks are held).
--
--   cms_require_draft_value_valid / cms_require_value_source_available / the relation
--       resolver (item 6e)  semantic validation refusals carry a bounded, safe
--       violation DETAIL: a JSON array of RFC 6901 pointers (`/fields/{stableFieldId}`,
--       the normative changedPaths grammar) that the Worker maps to
--       details.violations.  Only validated UUIDs are interpolated; no caller value is
--       ever echoed.  The reason token stays the whole P0001 message
--       (VALIDATION_FAILED, rich_text_not_canonical, object_kind_unspecified,
--       object_property_invalid, relation_target_unavailable, taxonomy_source_unavailable,
--       media_source_unavailable).
--
--   cms_acquire_revision_write_slot(actor)  BE03b "Rate buckets ...": concurrent
--       revision writes cap at three per actor, enforced in the database
--       transaction so the cap holds across Worker isolates.  Each in-flight
--       cms_create_revision holds one of three per-actor transaction advisory
--       locks until its transaction ends; a fourth is refused with the registered
--       whole-message token RATE_LIMITED (429) before any insert.  The slots are
--       taken after the idempotency replay short-circuit (a replay of a completed
--       command is answered, never counted) and are try-locks, so a refused write
--       never waits.  Advisory locks are re-entrant per session, so one
--       transaction that appends several times never exhausts its own cap.
--
--   cms_lock_entry_rows_shared(entry ids) / cms_lock_relation_target(actor, party,
--       target) / cms_resolve_relation_targets  Codex adversarial review H3: a
--       relation target's visibility and expected version were read without a lock
--       and written later (check-then-use), so a target that advanced, was archived
--       or lost the caller's assignment in between produced a revision whose pinned
--       relation was already stale.  Every external content target of a relation
--       value is now locked FOR SHARE (entry row, then its assignments) in
--       deterministic ascending UUID order BEFORE its visibility and pin are
--       decided, and the lock is held to commit; the entry's own row is already
--       held FOR UPDATE by the command.  A target that is not visible on the
--       unlocked state is refused (uniform VALIDATION_FAILED) before any lock is
--       taken, so an unreadable target is never a lock lever.  Carried relations
--       (append, resolve, restore) lock their external targets the same way.  Two
--       writers that mutually reference each other's entries can wait for each
--       other's FOR UPDATE row; PostgreSQL's deadlock detector aborts one of them
--       and the helpers convert that into a typed CONFLICT (restartable, nothing
--       committed) instead of leaking SQLSTATE 40P01.
begin;

create or replace function platform_private.cms_lock_schema_version_shared(
  p_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
declare
  version_state text;
begin
  -- Waits behind an in-flight activation switch (FOR UPDATE).  After the wait the
  -- row is re-read under the lock, so a switch that committed is seen here.
  select candidate.state::text into version_state
  from platform_private.cms_content_type_versions candidate
  where candidate.id = p_version_id
  for share;
  if version_state is distinct from 'active' then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
end;
$body$;

comment on function platform_private.cms_lock_schema_version_shared(uuid) is
  'FOR SHARE lock on a content-type version row plus a recheck that it is still active (CONFLICT otherwise). Taken by every command that creates a revision before it reads schema evidence, so the 03a activation switch (FOR UPDATE on the same row) and the write serialize. Private.';

create or replace function platform_private.cms_lock_entry_authority(
  p_actor_id uuid,
  p_acting_party_id uuid,
  p_entry_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
declare
  resolved_person_id uuid;
begin
  if p_actor_id is null or p_acting_party_id is null then
    return;
  end if;
  begin
    resolved_person_id := platform_private.identity_actor_person(p_actor_id);
  exception
    when others then
      resolved_person_id := null;
  end;
  if resolved_person_id is null then
    -- No resolvable person has no authority; the capability check that follows
    -- refuses.
    return;
  end if;
  -- The revocation seams update exactly these rows (a grant, a tenure, an
  -- assignment) and then lock assignments and presence rows, so the share locks
  -- are taken in that order: person, tenure, grants, assignments.  No predicate
  -- narrows them: a row that is being revoked right now must be locked even though
  -- its committed state still proves authority.
  perform 1
  from platform_private.person_party person
  where person.party_id = resolved_person_id
  for share;
  perform 1
  from identity_private.membership_tenure tenure
  where tenure.organization_id = p_acting_party_id
    and tenure.person_id = resolved_person_id
  order by tenure.id
  for share;
  perform 1
  from identity_private.organization_actor_grant actor_grant
  where actor_grant.organization_id = p_acting_party_id
    and actor_grant.person_id = resolved_person_id
    and actor_grant.capability_code in ('cms.author', 'cms.editor')
  order by actor_grant.capability_code
  for share;
  if p_entry_id is not null then
    perform 1
    from platform_private.cms_entry_assignments assignment
    where assignment.entry_id = p_entry_id
      and assignment.owner_id = p_acting_party_id
      and assignment.assignee_person_id = resolved_person_id
      and assignment.capability_key in ('cms.author', 'cms.editor')
    order by assignment.id
    for share;
  end if;
end;
$body$;

comment on function platform_private.cms_lock_entry_authority(uuid, uuid, uuid) is
  'FOR SHARE locks on the authority-bearing rows of the server-resolved actor (person, confirmed tenure, cms.author/cms.editor actor grants, and the entry assignments when an entry is given), in the order the revocation path takes them, so a revoking UPDATE/DELETE and a write serialize. Takes no decision; the capability check that follows decides. Private.';

create or replace function platform_private.cms_require_entry_capability_locked(
  p_actor_id uuid,
  p_acting_party_id uuid,
  p_capabilities text[],
  p_entry_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $body$
begin
  perform platform_private.cms_lock_entry_authority(p_actor_id, p_acting_party_id, p_entry_id);
  -- The capability is proven only after the locks are held: a revocation that
  -- committed before the locks were granted is seen here, and one that follows
  -- waits for this transaction to finish.
  return platform_private.cms_require_entry_capability(
    p_actor_id, p_acting_party_id, p_capabilities, p_entry_id
  );
end;
$body$;

comment on function platform_private.cms_require_entry_capability_locked(uuid, uuid, text[], uuid) is
  'cms_lock_entry_authority followed by cms_require_entry_capability: FORBIDDEN unless a capability is proven after the authority rows are locked. Returns the matched capability key. Private.';


-- Item 6e: the typed value refusals name the refused field.
create or replace function platform_private.cms_require_draft_value_valid(
  p_schema_version_id uuid,
  p_field_id uuid,
  p_value jsonb,
  p_provenance text
)
returns void
language plpgsql
stable
set search_path = ''
as $body$
declare
  refusal text;
begin
  refusal := platform_private.cms_draft_value_refusal(
    p_schema_version_id, p_field_id, p_value, p_provenance
  );
  if refusal is not null then
    -- Item 6e: the refused field is named by its normative pointer (a validated
    -- UUID), never by the value.
    raise exception '%', refusal using errcode = 'P0001',
      detail = pg_catalog.jsonb_build_array('/fields/' || p_field_id::text)::text;
  end if;
end;
$body$;

create or replace function platform_private.cms_require_value_source_available(
  p_schema_version_id uuid,
  p_field_id uuid,
  p_value jsonb
)
returns void
language plpgsql
stable
set search_path = ''
as $body$
declare
  field_kind text;
  refusal text;
begin
  select field.kind into field_kind
  from platform_private.cms_field_definition_versions field
  where field.stable_field_id = p_field_id
    and field.content_type_version_id = p_schema_version_id;
  refusal := platform_private.cms_value_source_refusal(field_kind, p_value);
  if refusal is not null then
    -- Item 6e: the refused field is named by its normative pointer.
    raise exception '%', refusal using errcode = 'P0001',
      detail = pg_catalog.jsonb_build_array('/fields/' || p_field_id::text)::text;
  end if;
end;
$body$;

create or replace function platform_private.cms_acquire_revision_write_slot(
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
declare
  slot integer;
begin
  if p_actor_id is null then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  for slot in 1 .. 3 loop
    if pg_catalog.pg_try_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'cms-revision-write:' || p_actor_id::text || ':' || slot::text, 0
      )
    ) then
      return;
    end if;
  end loop;
  raise exception 'RATE_LIMITED' using errcode = 'P0001';
end;
$body$;

comment on function platform_private.cms_acquire_revision_write_slot(uuid) is
  'Takes one of three per-actor transaction advisory slots (try-lock, held to transaction end): the database-side cap of three concurrent revision writes per actor. RATE_LIMITED when all three are held by other transactions. Private.';


create or replace function platform_private.cms_lock_entry_rows_shared(
  p_entry_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
declare
  lock_id uuid;
begin
  -- Ascending id order: the one global order every relation writer uses for the
  -- rows it only reads.  A row another writer holds FOR UPDATE is waited for; a
  -- deadlock with a writer that holds one of them FOR UPDATE and waits for a row
  -- this transaction holds is converted into a typed CONFLICT.
  begin
    for lock_id in
      select distinct candidate.id
      from pg_catalog.unnest(p_entry_ids) as candidate(id)
      where candidate.id is not null
      order by candidate.id
    loop
      perform 1
      from platform_private.cms_content_entries entry_row
      where entry_row.id = lock_id
      for share;
    end loop;
  exception
    when deadlock_detected then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
end;
$body$;

comment on function platform_private.cms_lock_entry_rows_shared(uuid[]) is
  'FOR SHARE on the given content-entry rows in ascending id order, held to commit, so a carried relation target cannot change between its check and the write. A deadlock with a mutually referencing writer is a typed CONFLICT. Private.';

create or replace function platform_private.cms_lock_relation_target(
  p_actor_id uuid,
  p_acting_party_id uuid,
  p_target_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
begin
  -- The target entry row (version, lifecycle) and then the authority rows over the
  -- target (the caller's assignments on it), both FOR SHARE and held to commit.
  begin
    perform 1
    from platform_private.cms_content_entries target
    where target.id = p_target_id
    for share;
    perform platform_private.cms_lock_entry_authority(
      p_actor_id, p_acting_party_id, p_target_id
    );
  exception
    when deadlock_detected then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
end;
$body$;

comment on function platform_private.cms_lock_relation_target(uuid, uuid, uuid) is
  'FOR SHARE on one relation target entry row and on the caller''s authority rows over it, held to commit, so the target''s version, lifecycle and the caller''s read authority cannot change between the relation check and the write. A deadlock with a mutually referencing writer is a typed CONFLICT. Private.';


-- cms_resolve_relation_targets (20261005011600) with the target lock pass; signature,
-- attributes, owner and grants are unchanged (CREATE OR REPLACE).
create or replace function platform_private.cms_resolve_relation_targets(
  p_actor_id uuid,
  p_acting_party_id uuid,
  p_entry_id uuid,
  p_entry_version bigint,
  p_field_definition_id uuid,
  p_value jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $body$
declare
  definition platform_private.cms_relation_definitions%rowtype;
  targets jsonb;
  target_count integer;
  target_index integer;
  target jsonb;
  target_uuid uuid;
  pin_text text;
  pin bigint;
  target_version bigint;
  specs jsonb := '[]'::jsonb;
  relation_pointer text;
begin
  select * into definition
  from platform_private.cms_relation_definitions candidate
  where candidate.field_definition_id = p_field_definition_id;
  if not found then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  -- Item 6e: every refusal below names the offending field by its normative
  -- pointer (RFC 6901 `/fields/{stableFieldId}`, a validated UUID), never a value.
  select pg_catalog.jsonb_build_array('/fields/' || field.stable_field_id::text)::text
    into relation_pointer
  from platform_private.cms_field_definition_versions field
  where field.id = p_field_definition_id;
  targets := p_value->'targets';
  if pg_catalog.jsonb_typeof(targets) is distinct from 'array' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = relation_pointer;
  end if;
  target_count := pg_catalog.jsonb_array_length(targets);
  if target_count > 512
     or target_count < definition.min_count
     or target_count > definition.max_count then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = relation_pointer;
  end if;
  if (
    select count(distinct (candidate.value->>'targetId')::uuid) <> count(*)
    from pg_catalog.jsonb_array_elements(targets) candidate(value)
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = relation_pointer;
  end if;
  if target_count = 0 then
    return specs;
  end if;
  -- BE03b:1049: a domain-kind target resolves only through a registered domain
  -- projection provider; none is registered, so a non-empty value fails closed.
  if definition.target_kind <> 'content' then
    raise exception 'relation_target_unavailable' using errcode = 'P0001', detail = relation_pointer;
  end if;
  -- Codex review H3: lock every external content target, in ascending id order,
  -- BEFORE its visibility and pin are decided; the locks are held to commit.  A
  -- target that is not visible on the unlocked state is refused first, with the
  -- uniform error, so an unreadable target is never a lock lever.  The entry's
  -- own row is already held FOR UPDATE by the command.
  for target_uuid in
    select distinct (candidate.value->>'targetId')::uuid
    from pg_catalog.jsonb_array_elements(targets) candidate(value)
    order by 1
  loop
    if p_entry_id is not null and target_uuid = p_entry_id then
      continue;
    end if;
    if not platform_private.cms_relation_target_visible(
      p_actor_id, p_acting_party_id, target_uuid, definition.target_type
    ) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = relation_pointer;
    end if;
    perform platform_private.cms_lock_relation_target(
      p_actor_id, p_acting_party_id, target_uuid
    );
  end loop;
  for target_index in 0 .. target_count - 1 loop
    target := targets->target_index;
    target_uuid := (target->>'targetId')::uuid;
    if not platform_private.cms_relation_target_visible(
      p_actor_id, p_acting_party_id, target_uuid, definition.target_type
    ) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = relation_pointer;
    end if;
    pin := null;
    if pg_catalog.jsonb_typeof(target->'expectedTargetVersion') = 'string' then
      pin_text := target->>'expectedTargetVersion';
      if pg_catalog.length(pin_text) > 19
         or (pg_catalog.length(pin_text) = 19 and pin_text > '9223372036854775807') then
        raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = relation_pointer;
      end if;
      pin := pin_text::bigint;
    end if;
    if pin is not null then
      if p_entry_id is not null and target_uuid = p_entry_id then
        -- The entry's own version advances with this very commit.
        pin := p_entry_version + 1;
      else
        select candidate.version into target_version
        from platform_private.cms_content_entries candidate
        where candidate.id = target_uuid;
        if target_version is distinct from pin then
          raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = relation_pointer;
        end if;
      end if;
    end if;
    specs := specs || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'targetId', target_uuid,
      'targetKind', definition.target_kind,
      'expectedTargetVersion', pin,
      'position', target_index,
      'onUnavailable', definition.on_unavailable
    ));
  end loop;
  return specs;
end;
$body$;

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_lock_schema_version_shared(uuid)
  owner to wejammin_cms_definer;
alter function platform_private.cms_lock_entry_authority(uuid, uuid, uuid)
  owner to wejammin_cms_definer;
alter function platform_private.cms_require_entry_capability_locked(uuid, uuid, text[], uuid)
  owner to wejammin_cms_definer;
alter function platform_private.cms_lock_entry_rows_shared(uuid[])
  owner to wejammin_cms_definer;
alter function platform_private.cms_acquire_revision_write_slot(uuid)
  owner to wejammin_cms_definer;
alter function platform_private.cms_lock_relation_target(uuid, uuid, uuid)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_lock_schema_version_shared(uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_lock_entry_authority(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_require_entry_capability_locked(uuid, uuid, text[], uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_lock_entry_rows_shared(uuid[])
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_acquire_revision_write_slot(uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_lock_relation_target(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

commit;
