-- Slice 10 CMS editorial revision history (BE03b CMS-03B-03).
--
-- Forward-only migration.  It owns no tables: it adds one protected READ RPC
-- over the revision tables created by 20260926090000 and reuses the authority
-- helpers, capability registry, and JCS/hash primitives already defined by
-- 20260902080000 and 20260927080000.  Nothing in 080000/120000/130000 or the
-- conflict lane is modified.
--
-- CMS-03B-03 is a safe read:
--   * authority is derived server-side from the resolved actor (auth user) and
--     the resolved acting party, plus a live registered capability grant and an
--     active entry assignment.  The request may never assert authority.
--   * a hidden/absent entry is concealed as NOT_FOUND; a visible entry whose
--     caller has no read scope is FORBIDDEN, so concealment and refusal stay
--     distinguishable exactly as the registry requires.
--   * no row is written and no audit or outbox event is emitted.
--   * the response carries only RevisionSummary/RevisionHistoryPage fields:
--     no content values, no field ids beyond a JSON Pointer, and never an
--     owner, acting-party, assignee, or author person id.
--
-- Reported gaps (fail-closed, never fabricated):
--   * The cursor is tamper-evident and context/expiry-bound but NOT
--     cryptographically signed, because no cursor-signing key source exists in
--     the runtime (no signing secret, no vault entry, and no hmac key material
--     is seeded anywhere in the migration lane).  It reuses the canonical 03a
--     keyset envelope and adds a hard expiry.  A future owner-approved
--     signing-key migration can replace the envelope without a contract change.

begin;

-- ---------------------------------------------------------------------------
-- 1. Read-only revision helpers.
-- ---------------------------------------------------------------------------

-- The read capabilities this route accepts.  Kept as one closed list so the
-- authority loop and the documented scope cannot drift apart.
create or replace function platform_private.cms_revision_reader_capabilities()
returns text[]
language sql
immutable
set search_path = ''
as $body$
  select array['cms.author', 'cms.editor', 'cms.reviewer']::text[]
$body$;

comment on function platform_private.cms_revision_reader_capabilities() is
  'Closed scope list for CMS-03B-03: author, editor and reviewer grants with an active entry assignment.';

-- Builds the safe {stable field id -> value hash} payload for one revision at
-- one locale.  Every stored value must still be declared by that revision's own
-- pinned schema version, because a revision legitimately pins an older schema
-- after a migration chain (CMS-03B-04 owns restore).  An undeclared or
-- unbounded value would let an untyped row reach the comparison, so it fails
-- closed rather than being projected.  Only the stable field id and a 64-hex
-- hash are returned: never the value itself.
create or replace function platform_private.cms_revision_field_payload(
  p_revision_id uuid,
  p_locale text,
  p_schema_version_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  field_count integer;
  payload jsonb;
begin
  if p_revision_id is null or p_locale is null or p_schema_version_id is null then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  select count(*)::integer into field_count
  from platform_private.cms_entry_field_values field_value
  where field_value.revision_id = p_revision_id
    and field_value.locale = p_locale;
  if field_count > 128 then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  if exists (
       select 1
       from platform_private.cms_entry_field_values field_value
       where field_value.revision_id = p_revision_id
         and field_value.locale = p_locale
         and (
           not exists (
             select 1
             from platform_private.cms_field_definition_versions field
             where field.id = field_value.field_definition_id
               and field.stable_field_id = field_value.field_id
               and field.content_type_version_id = p_schema_version_id
           )
           or not platform_private.cms_json_bounded(
                field_value.value, 262144, 8, 128, 128
              )
           or not platform_private.cms_draft_field_value_valid(
                p_schema_version_id,
                field_value.field_id,
                field_value.value,
                field_value.provenance
              )
           or pg_catalog.btrim(coalesce(field_value.value_hash::text, ''))
                is distinct from platform_private.cms_jcs_sha256(field_value.value)
         )
     ) then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  select coalesce(pg_catalog.jsonb_object_agg(
    field_value.field_id::text,
    pg_catalog.btrim(field_value.value_hash::text)
  ), '{}'::jsonb) into payload
  from platform_private.cms_entry_field_values field_value
  where field_value.revision_id = p_revision_id
    and field_value.locale = p_locale;

  return payload;
end;
$body$;

comment on function platform_private.cms_revision_field_payload(uuid, text, uuid) is
  'Safe per-revision field projection for CMS-03B-03 compare: stable field id to 64-hex value hash, validated against the revision''s own pinned schema version. Never returns a content value.';

-- Extracts a validated frozen field-value hash from the safe projection.
create or replace function platform_private.cms_revision_field_hash(p_value jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $body$
begin
  if pg_catalog.jsonb_typeof(p_value) is distinct from 'string'
     or coalesce(p_value #>> '{}', '') !~ '^[a-f0-9]{64}$' then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  return p_value #>> '{}';
end;
$body$;

comment on function platform_private.cms_revision_field_hash(jsonb) is
  'Extracts an integrity-checked 64-hex field-value hash for CMS-03B-03 comparison.';

-- Returns the summary contentHash for one revision.
--
-- RevisionSummary.contentHash is the frozen revision content hash.  Verify it
-- against the exact stable-field-id/value projection used by CMS-03B-10 and
-- CMS-03B-11; a drifted or malformed revision is not safe to serve.
create or replace function platform_private.cms_revision_content_hash(
  p_revision_id uuid,
  p_payload_hash text,
  p_locale text,
  p_schema_version_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $body$
declare
  payload jsonb;
  contained text;
  recomputed text;
begin
  payload := platform_private.cms_revision_field_payload(
    p_revision_id, p_locale, p_schema_version_id
  );
  if not platform_private.cms_json_bounded(payload, 262144, 8, 128, 128) then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  contained := pg_catalog.btrim(coalesce(p_payload_hash, ''));
  if contained !~ '^[a-f0-9]{64}$' then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  recomputed := platform_private.cms_draft_content_hash(p_revision_id, p_locale);
  if recomputed is distinct from contained then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  return contained;
end;
$body$;

comment on function platform_private.cms_revision_content_hash(uuid, text, text, uuid) is
  'CMS-03B-03 RevisionSummary.contentHash. Returns the frozen 64-hex payload_hash only when it matches the exact stored value projection and the pinned schema validates; otherwise fails closed.';

-- Derives the safe RevisionSummary.authorClass label for one revision author.
--
-- There is no author-class column and BE03b forbids exposing the author person
-- id, so the class is derived from the author's standing on this revision's
-- entry: the capability they are actively assigned, or 'human' when no active
-- editorial assignment exists.  The label is a role class, never an identity.
-- The assignment lookup runs as definer and is scoped to p_author_person_id, so
-- a caller cannot probe another party's assignment rows.
create or replace function platform_private.cms_revision_author_class(
  p_entry_id uuid,
  p_author_person_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $body$
begin
  if p_author_person_id is null then
    return 'human';
  end if;
  if exists (
       select 1
       from platform_private.cms_entry_assignments assignment
       where assignment.entry_id = p_entry_id
         and assignment.assignee_person_id = p_author_person_id
         and assignment.capability_key = 'cms.author'
         and assignment.state = 'active'
     ) then
    return 'author';
  end if;
  if exists (
       select 1
       from platform_private.cms_entry_assignments assignment
       where assignment.entry_id = p_entry_id
         and assignment.assignee_person_id = p_author_person_id
         and assignment.capability_key = 'cms.editor'
         and assignment.state = 'active'
     ) then
    return 'editor';
  end if;

  return 'human';
end;
$body$;

comment on function platform_private.cms_revision_author_class(uuid, uuid) is
  'CMS-03B-03 authorClass: server-derived role class for the revision author (assigned cms.author -> author, cms.editor -> editor, otherwise human). Never returns an identity.';

-- Classifies one revision for the requesting principal: 'visible' when the
-- caller may be told the revision exists, 'absent' when it must be concealed as
-- though it did not exist.
--
-- An entry whose latest revision was published from a party is tenant data: a
-- confirmed member of that party may see the history, anyone else gets the same
-- answer as a missing revision.  Revision rows carry the acting party of the
-- publication, so a scheduled/published revision inherits that party's tenancy;
-- editor-only drafts stay scoped to the entry's own authority check.
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
  if p_revision.state not in ('scheduled', 'published') then
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

comment on function platform_private.cms_revision_page_disposition(uuid, uuid, platform_private.cms_entry_revisions) is
  'CMS-03B-03 concealment classifier: a published/scheduled revision is visible only to its acting party or a confirmed member of it; every other revision is visible once the caller cleared entry read authority.';

-- ---------------------------------------------------------------------------
-- 2. CMS-03B-03 cms_list_revisions: authorized revision history + safe compare.
--    Writes nothing and emits no audit or outbox row.
-- ---------------------------------------------------------------------------
create or replace function platform_private.cms_list_revisions(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  resolved_acting_party_id uuid;
  entry_row platform_private.cms_content_entries%rowtype;
  target_entry_id uuid;
  requested_state text;
  requested_locale text;
  compare_revision_id uuid;
  limit_value integer := 25;
  limit_input text;
  cursor_text text;
  cursor_value jsonb;
  cursor_expires bigint;
  cursor_last_number bigint;
  cursor_last_id uuid;
  query_hash text;
  capability_candidate text;
  authorized_capability text;
  revision_row platform_private.cms_entry_revisions;
  compared_revision_row platform_private.cms_entry_revisions%rowtype;
  newest_revision_row platform_private.cms_entry_revisions%rowtype;
  rows_seen integer := 0;
  has_more boolean := false;
  cursor_revision_number bigint;
  cursor_revision_id uuid;
  next_cursor text;
  page_items jsonb := '[]'::jsonb;
  left_payload jsonb;
  right_payload jsonb;
  compare_changes jsonb := '[]'::jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  resolved_acting_party_id := platform_private.cms_acting_party(p_request, actor_id);

  -- Request shape: entryId is required; cursor/limit/state/compareRevisionId/
  -- locale are the only accepted filters.  context and correlationId are
  -- control fields, never authority.
  if not platform_private.cms_exact_keys(
    p_request,
    array['entryId']::text[],
    array[
      'entryId', 'cursor', 'limit', 'state', 'compareRevisionId', 'locale',
      'context', 'correlationId'
    ]::text[]
  ) then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;

  if not platform_private.cms_valid_uuid(p_request->>'entryId') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  target_entry_id := (p_request->>'entryId')::uuid;

  if p_request ? 'state'
     and p_request->'state' <> 'null'::jsonb
     and coalesce(p_request->>'state', '') not in (
       'draft', 'submitted', 'approved', 'rejected', 'scheduled', 'published'
     ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  requested_state := case
    when p_request->'state' = 'null'::jsonb then null
    else p_request->>'state'
  end;

  if p_request ? 'locale'
     and p_request->'locale' <> 'null'::jsonb
     and coalesce(p_request->>'locale', '') !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  requested_locale := case
    when p_request->'locale' = 'null'::jsonb then null
    else p_request->>'locale'
  end;

  if p_request ? 'compareRevisionId'
     and p_request->'compareRevisionId' <> 'null'::jsonb then
    if not platform_private.cms_valid_uuid(p_request->>'compareRevisionId') then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    compare_revision_id := (p_request->>'compareRevisionId')::uuid;
  end if;

  -- limit is a query bound, not a malformed selector: an out-of-range window is
  -- a 422 VALIDATION_FAILED, matching the registry's query-bounds column rather
  -- than the malformed-query 400.
  if p_request ? 'limit' and p_request->'limit' <> 'null'::jsonb then
    limit_input := p_request->>'limit';
    if limit_input is null
       or limit_input !~ '^[0-9]{1,2}$'
       or (limit_input::integer) not between 1 and 50 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    limit_value := limit_input::integer;
  end if;

  if p_request ? 'cursor' then
    cursor_text := nullif(p_request->>'cursor', '');
  end if;
  if cursor_text is not null
     and pg_catalog.octet_length(cursor_text) not between 1 and 512 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;

  select * into entry_row
  from platform_private.cms_content_entries candidate
  where candidate.id = target_entry_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Authority: a registered grant keyed to the acting party AND an active
  -- assignment on this entry.  A caller that presents a capability key without
  -- the grant/assignment is refused exactly like a caller that presents none.
  authorized_capability := null;
  foreach capability_candidate in array
    platform_private.cms_revision_reader_capabilities()
  loop
    if platform_private.cms_authority_origin(
         actor_id, resolved_acting_party_id, capability_candidate, target_entry_id
       ) is not null then
      authorized_capability := capability_candidate;
      exit;
    end if;
  end loop;
  if authorized_capability is null then
    if platform_private.cms_entry_tenant_visible(actor_id, entry_row.owner_id) then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Cursor envelope: {queryHash, lastRevisionNumber, lastRevisionId, expiresAt}.
  -- queryHash binds the cursor to the exact actor, acting party, entry, filters,
  -- and window, so a cursor cannot be replayed against another context.
  query_hash := platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
    'actorId', actor_id::text,
    'actingPartyId', resolved_acting_party_id::text,
    'entryId', target_entry_id::text,
    'state', requested_state,
    'locale', requested_locale,
    'limit', limit_value::text
  ));

  if cursor_text is not null then
    begin
      cursor_value := pg_catalog.convert_from(
        pg_catalog.decode(cursor_text, 'base64'), 'utf8'
      )::jsonb;
    exception
      when others then
        raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end;

    if not platform_private.cms_exact_keys(
      cursor_value,
      array['queryHash', 'lastRevisionNumber', 'lastRevisionId', 'expiresAt']::text[],
      array['queryHash', 'lastRevisionNumber', 'lastRevisionId', 'expiresAt']::text[]
    ) then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;

    -- A cursor whose shape is wrong is malformed (400).  A cursor that is
    -- well-formed but bound to another actor, party, entry, filter set, or
    -- window, or that has expired, is a cursor/context mismatch (409), exactly
    -- as the registry error matrix separates the two.
    if coalesce(cursor_value->>'queryHash', '') is distinct from query_hash
       or not platform_private.cms_valid_version(cursor_value->>'lastRevisionNumber')
       or not platform_private.cms_valid_uuid(cursor_value->>'lastRevisionId')
       or coalesce(cursor_value->>'expiresAt', '') !~ '^[0-9]{1,12}$' then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;

    cursor_expires := (cursor_value->>'expiresAt')::bigint;
    cursor_last_number := (cursor_value->>'lastRevisionNumber')::bigint;
    cursor_last_id := (cursor_value->>'lastRevisionId')::uuid;

    if cursor_expires <= pg_catalog.floor(
         pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
       )::bigint then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
  end if;

  -- The comparison target is resolved before pagination so an unreadable or
  -- off-entry target is a 404 regardless of which window was requested.
  if compare_revision_id is not null then
    select * into compared_revision_row
    from platform_private.cms_entry_revisions candidate
    where candidate.id = compare_revision_id;
    if not found then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    if compared_revision_row.entry_id <> target_entry_id then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    if platform_private.cms_revision_page_disposition(
         actor_id, resolved_acting_party_id, compared_revision_row
       ) = 'absent' then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
  end if;

  -- Keyset walk: descending (revision_number, id).  Concealed rows still
  -- advance the scan (a cursor must not become a probe), so has_more is decided
  -- only by the first row the caller is allowed to see beyond the window.
  for revision_row in
    select candidate.*
    from platform_private.cms_entry_revisions candidate
    where candidate.entry_id = target_entry_id
      and (requested_state is null or candidate.state = requested_state)
      and (requested_locale is null or candidate.locale = requested_locale)
      and (
        cursor_text is null
        or candidate.revision_number < cursor_last_number
        or (
          candidate.revision_number = cursor_last_number
          and candidate.id < cursor_last_id
        )
      )
    order by candidate.revision_number desc, candidate.id desc
  loop
    if platform_private.cms_revision_page_disposition(
         actor_id, resolved_acting_party_id, revision_row
       ) = 'absent' then
      continue;
    end if;

    if rows_seen >= limit_value then
      has_more := true;
      exit;
    end if;
    rows_seen := rows_seen + 1;
    cursor_revision_number := revision_row.revision_number;
    cursor_revision_id := revision_row.id;

    page_items := page_items || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'id', revision_row.id,
        'revisionNumber', revision_row.revision_number::text,
        'locale', revision_row.locale,
        'state', revision_row.state,
        'contentHash', platform_private.cms_revision_content_hash(
          revision_row.id,
          revision_row.payload_hash::text,
          revision_row.locale,
          revision_row.schema_version_id
        ),
        'createdAt', platform_private.auth_iso_time(revision_row.created_at),
        'authorClass', platform_private.cms_revision_author_class(
          revision_row.entry_id, revision_row.author_person_id
        )
      )
    );
  end loop;

  if has_more then
    next_cursor := pg_catalog.replace(
      pg_catalog.encode(
        pg_catalog.convert_to(
          platform_private.cms_jcs(pg_catalog.jsonb_build_object(
            'queryHash', query_hash,
          'lastRevisionNumber', cursor_revision_number::text,
          'lastRevisionId', cursor_revision_id::text,
            'expiresAt', (
              pg_catalog.floor(
                pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
              ) + 86400
            )::bigint::text
          )),
          'utf8'
        ),
        'base64'
      ),
      E'\n', ''
    );
    -- A cursor that cannot fit the 512-character contract is withheld rather
    -- than truncated; the client re-reads the first window instead.
    if pg_catalog.octet_length(next_cursor) > 512 then
      next_cursor := null;
      has_more := false;
    end if;
  end if;

  if compare_revision_id is null then
    return pg_catalog.jsonb_build_object(
      'items', page_items,
      'nextCursor', next_cursor,
      'pageVersion', entry_row.version::text,
      'compare', null
    );
  end if;

  -- The right side of the comparison is the newest readable revision on the
  -- entry that matches the requested locale.  The state filter is deliberately
  -- not applied: state is a window filter for the history list, and narrowing
  -- the comparison side to it would silently change what "latest" means.
  select * into newest_revision_row
  from platform_private.cms_entry_revisions candidate
  where candidate.entry_id = target_entry_id
    and (requested_locale is null or candidate.locale = requested_locale)
    and platform_private.cms_revision_page_disposition(
          actor_id, resolved_acting_party_id, candidate
        ) = 'visible'
  order by candidate.revision_number desc, candidate.id desc
  limit 1;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  left_payload := platform_private.cms_revision_field_payload(
    compared_revision_row.id,
    compared_revision_row.locale,
    compared_revision_row.schema_version_id
  );
  right_payload := platform_private.cms_revision_field_payload(
    newest_revision_row.id,
    newest_revision_row.locale,
    newest_revision_row.schema_version_id
  );

  -- A semantic linear change list keyed by stable field id.  Only the pointer
  -- and the two safe hashes are exposed: no value, no field definition id, and
  -- no relation-level diff (relationship comparison has no locked JSON Pointer
  -- convention).  Paths use the same /fields/<stableFieldId> form the create
  -- and restore changedPaths contract already fixes.  left is the explicitly
  -- requested compareRevisionId and right is the newest readable revision, so
  -- kind=added means the field exists only on the newer side.
  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'path', '/fields/' || distinct_keys.key_value,
      'kind', case
        when left_payload ? distinct_keys.key_value
         and right_payload ? distinct_keys.key_value
         and left_payload->distinct_keys.key_value
             is distinct from right_payload->distinct_keys.key_value then 'changed'
        when left_payload ? distinct_keys.key_value
         and right_payload ? distinct_keys.key_value then 'unchanged'
        when right_payload ? distinct_keys.key_value then 'added'
        else 'removed'
      end,
      'leftHash', case
        when left_payload ? distinct_keys.key_value
          then platform_private.cms_revision_field_hash(
            left_payload->distinct_keys.key_value
          )
        else null
      end,
      'rightHash', case
        when right_payload ? distinct_keys.key_value
          then platform_private.cms_revision_field_hash(
            right_payload->distinct_keys.key_value
          )
        else null
      end
    ) order by distinct_keys.key_value
  ), '[]'::jsonb) into compare_changes
  from (
    select distinct keys.key_name as key_value
    from (
      select k.key_name
      from pg_catalog.jsonb_object_keys(left_payload) as k(key_name)
      union all
      select k.key_name
      from pg_catalog.jsonb_object_keys(right_payload) as k(key_name)
    ) keys
  ) distinct_keys;

  if pg_catalog.jsonb_array_length(compare_changes) > 512 then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  return pg_catalog.jsonb_build_object(
    'items', page_items,
    'nextCursor', next_cursor,
    'pageVersion', entry_row.version::text,
    'compare', pg_catalog.jsonb_build_object(
      'leftRevisionId', compared_revision_row.id,
      'rightRevisionId', newest_revision_row.id,
      'changes', compare_changes
    )
  );
end;
$body$;

comment on function platform_private.cms_list_revisions(jsonb) is
  'CMS-03B-03 authorized revision history read. Server-derives actor/acting party, requires a registered cms.author/cms.editor grant plus an active entry assignment, conceals hidden entries as NOT_FOUND, paginates a signed-keyset (tamper-evident, context- and expiry-bound, not cryptographically signed) cursor over (revisionNumber DESC, revisionId DESC), and returns only safe summary hashes. The compare block uses left=compareRevisionId and right=newest readable revision at the requested locale over stable field-id hashes. Writes nothing and emits no audit/outbox row.';

create or replace function platform_api.cms_list_revisions(p_request jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $body$
  select platform_private.cms_list_revisions(p_request)
$body$;

-- ---------------------------------------------------------------------------
-- 3. Privileges.  The worker boundary is service_role only; the browser roles
--    and the private schema functions stay unreachable.
-- ---------------------------------------------------------------------------
revoke all on function platform_api.cms_list_revisions(jsonb) from public, anon, authenticated, service_role;
grant usage on schema platform_api to service_role;
grant execute on function platform_api.cms_list_revisions(jsonb) to service_role;

revoke all on function platform_private.cms_list_revisions(jsonb) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_revision_reader_capabilities() from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_revision_field_payload(uuid, text, uuid) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_revision_field_hash(jsonb) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_revision_content_hash(uuid, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_revision_author_class(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_revision_page_disposition(uuid, uuid, platform_private.cms_entry_revisions) from public, anon, authenticated, service_role;

commit;
