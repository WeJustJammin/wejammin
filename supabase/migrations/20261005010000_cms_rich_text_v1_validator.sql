-- Slice 10 WP-S10-3 (DEC-112): the `rich_text.v1` value grammar validator.
--
-- BE03b "Rich text value grammar"; BE03a protected validator registry. The
-- grammar is code-owned and mirrored by platform_private.cms_rich_text_v1_valid
-- (jsonb): a flat, canonical, bounded AST that fits the shared container-depth
-- cap (<= 7) without reopening the frozen 03a validator registry.
--
-- This forward migration installs the grammar, the registry membership and the
-- total-text length bound.  It does NOT redefine the pinned-schema draft value
-- gate cms_draft_field_value_valid: that gate has exactly one definition after
-- the 20260927540000 fail-closed refusal, in 20261005010100_cms_field_kind_
-- encodings.sql, which admits exactly the canonical rich_text.v1 AST through the
-- shared kind-encoding gate next to every other field kind.  Non-canonical input
-- is refused, never canonicalised, so a client and the server agree on
-- valueHash.  The preflight that no legacy non-AST row exists is kept and
-- strengthened: every stored non-null rich-text value must already satisfy this
-- validator before the next migration widens admission, so the refusal in
-- 20260927540000 stays in force (fail closed) until that preflight has passed.
-- Forward-only.
begin;

-- ---------------------------------------------------------------------------
-- BE03a protected validator registry membership (DEC-112).
--
-- rich_text.v1 version 1 is the only member: the grammar artifact reference and
-- its code-owned SHA-256 hash are constants frozen into this migration, so a
-- field-level validatorKey/validatorVersion pair names the exact grammar bytes
-- and a member pair on any other field kind is refused.  Immutable,
-- forward-only, and reached only from SECURITY DEFINER command bodies.
-- ---------------------------------------------------------------------------
create or replace function platform_private.cms_protected_validator_ref(
  p_key text,
  p_version bigint
)
returns boolean
language sql
immutable
set search_path = ''
as $body$
  select coalesce((p_key, p_version) in (values ('rich_text.v1', 1::bigint)), false)
$body$;

comment on function platform_private.cms_protected_validator_ref(text, bigint) is
  'BE03a protected validator registry: rich_text.v1 version 1 is the only member, bound to the code-owned cms_rich_text_v1_valid(jsonb) grammar artifact. A member pair is valid only on a rich_text field; the artifact reference and hash are code constants, never caller values.';

-- The 03a minLength/maxLength bind the total NFC text across every span of
-- every block.  Exposed as its own predicate so the definition default gate and
-- the draft value gate share one bound implementation.
create or replace function platform_private.cms_rich_text_length_in_bounds(
  p_value jsonb,
  p_constraints jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $body$
declare
  blocks jsonb;
  block jsonb;
  spans jsonb;
  block_index integer;
  span_index integer;
  total_text integer := 0;
begin
  if p_value is null or pg_catalog.jsonb_typeof(p_value) <> 'object' then
    return false;
  end if;
  blocks := p_value->'blocks';
  if pg_catalog.jsonb_typeof(blocks) <> 'array' then
    return false;
  end if;
  for block_index in 0 .. pg_catalog.jsonb_array_length(blocks) - 1 loop
    block := blocks->block_index;
    spans := block->'spans';
    if pg_catalog.jsonb_typeof(spans) <> 'array' then
      return false;
    end if;
    for span_index in 0 .. pg_catalog.jsonb_array_length(spans) - 1 loop
      total_text := total_text
        + pg_catalog.length(spans->span_index->>'text');
    end loop;
  end loop;
  if p_constraints ? 'minLength'
     and total_text < (p_constraints->>'minLength')::integer then
    return false;
  end if;
  if p_constraints ? 'maxLength'
     and total_text > (p_constraints->>'maxLength')::integer then
    return false;
  end if;
  return true;
end;
$body$;

comment on function platform_private.cms_rich_text_length_in_bounds(jsonb, jsonb) is
  'BE03b: 03a minLength/maxLength bind the total NFC text across every span of every block, so no document can hide length outside a single span.';

-- ---------------------------------------------------------------------------
-- platform_private.cms_rich_text_v1_valid(jsonb): the code-owned grammar.
--
-- A flat container per the depth-8 value cap: the deepest legal document nests
-- document -> blocks -> block -> spans -> span -> link, a container depth of 6.
-- Only canonical form is admitted (NFC text, no empty spans, unique marks in
-- bold/italic/code order, absent-rather-than-null links, merged adjacent
-- spans).  Links are https, mailto, or a normalised internal route; unsafe
-- schemes and protocol-relative or dot-escaping routes are refused.  This is a
-- pure predicate: it reads no table, writes nothing and emits no evidence.
-- ---------------------------------------------------------------------------
create or replace function platform_private.cms_rich_text_v1_valid(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $body$
declare
  blocks jsonb;
  block jsonb;
  block_type text;
  block_index integer;
  block_count integer;
  spans jsonb;
  span jsonb;
  span_index integer;
  span_count integer;
  span_text text;
  marks jsonb;
  mark_index integer;
  mark_count integer;
  mark_text text;
  mark_order integer;
  previous_mark_order integer;
  link jsonb;
  link_kind text;
  link_value text;
  previous_marks jsonb;
  previous_link jsonb;
  list_kind text;
  list_depth integer;
  previous_list_kind text;
  previous_list_depth integer;
begin
  if p_value is null or pg_catalog.jsonb_typeof(p_value) <> 'object' then
    return false;
  end if;

  -- Closed grammar: only the format literal and the block list are admitted.
  if not platform_private.cms_exact_keys(
       p_value,
       array['format', 'blocks']::text[],
       array['format', 'blocks']::text[]
     )
     or p_value->>'format' is distinct from 'rich_text.v1' then
    return false;
  end if;

  -- The flat representation is required so a stored value fits the shared
  -- container-depth cap; nothing may nest past the deepest legal document.
  if platform_private.cms_json_depth(p_value) > 7 then
    return false;
  end if;

  blocks := p_value->'blocks';
  if pg_catalog.jsonb_typeof(blocks) <> 'array' then
    return false;
  end if;
  block_count := pg_catalog.jsonb_array_length(blocks);
  if block_count < 1 or block_count > 128 then
    return false;
  end if;

  previous_list_kind := null;
  previous_list_depth := null;

  for block_index in 0 .. block_count - 1 loop
    block := blocks->block_index;
    if pg_catalog.jsonb_typeof(block) <> 'object' then
      return false;
    end if;
    block_type := block->>'type';

    if block_type = 'paragraph' then
      if not platform_private.cms_exact_keys(
           block,
           array['type', 'spans']::text[],
           array['type', 'spans']::text[]
         ) then
        return false;
      end if;
      spans := block->'spans';
    elsif block_type = 'heading' then
      if not platform_private.cms_exact_keys(
           block,
           array['type', 'level', 'spans']::text[],
           array['type', 'level', 'spans']::text[]
         )
         or pg_catalog.jsonb_typeof(block->'level') <> 'number'
         or (block->>'level') !~ '^[2-4]$' then
        return false;
      end if;
      spans := block->'spans';
    elsif block_type = 'list_item' then
      if not platform_private.cms_exact_keys(
           block,
           array['type', 'list', 'depth', 'spans']::text[],
           array['type', 'list', 'depth', 'spans']::text[]
         )
         -- A JSON-null list kind makes `->>` NULL and `NULL not in (...)` is
         -- NULL, which an IF skips: guard the type first so it is refused.
         or pg_catalog.jsonb_typeof(block->'list') is distinct from 'string'
         or block->>'list' not in ('bulleted', 'numbered')
         or pg_catalog.jsonb_typeof(block->'depth') <> 'number'
         or (block->>'depth') !~ '^[1-3]$' then
        return false;
      end if;
      spans := block->'spans';
    elsif block_type = 'quote' then
      if not platform_private.cms_exact_keys(
           block,
           array['type', 'spans']::text[],
           array['type', 'spans']::text[]
         ) then
        return false;
      end if;
      spans := block->'spans';
    else
      return false;
    end if;

    if pg_catalog.jsonb_typeof(spans) <> 'array' then
      return false;
    end if;
    span_count := pg_catalog.jsonb_array_length(spans);
    if span_count > 128 then
      return false;
    end if;
    -- Heading and quote blocks are non-empty; a paragraph may be empty.
    if block_type in ('heading', 'quote') and span_count < 1 then
      return false;
    end if;

    -- List run: a run starts at depth 1 and rises by at most one level; any
    -- non-list block or a change of list kind starts a fresh run.
    if block_type = 'list_item' then
      list_kind := block->>'list';
      list_depth := (block->>'depth')::integer;
      if previous_list_kind is not distinct from list_kind then
        if list_depth > previous_list_depth + 1 then
          return false;
        end if;
      elsif list_depth <> 1 then
        return false;
      end if;
      previous_list_kind := list_kind;
      previous_list_depth := list_depth;
    else
      previous_list_kind := null;
      previous_list_depth := null;
    end if;

    previous_marks := null;
    previous_link := null;

    for span_index in 0 .. span_count - 1 loop
      span := spans->span_index;
      if pg_catalog.jsonb_typeof(span) <> 'object' then
        return false;
      end if;
      -- Strict span keys; the link is optional and absent rather than null.
      if not platform_private.cms_exact_keys(
           span,
           array['text', 'marks']::text[],
           array['text', 'marks', 'link']::text[]
         ) then
        return false;
      end if;

      if span->'text' is null
         or pg_catalog.jsonb_typeof(span->'text') <> 'string' then
        return false;
      end if;
      span_text := span->>'text';
      if pg_catalog.length(span_text) < 1
         or pg_catalog.length(span_text) > 10000 then
        return false;
      end if;
      if pg_catalog.normalize(span_text, 'NFC') <> span_text then
        return false;
      end if;
      -- U+000A is the single permitted control character; every other C0,
      -- DEL and C1 code point is refused.
      if pg_catalog.replace(span_text, E'\n', '')
           ~ '[\u0000-\u0009\u000B-\u001F\u007F-\u009F]' then
        return false;
      end if;

      marks := span->'marks';
      if pg_catalog.jsonb_typeof(marks) <> 'array' then
        return false;
      end if;
      mark_count := pg_catalog.jsonb_array_length(marks);
      if mark_count > 3 then
        return false;
      end if;
      previous_mark_order := 0;
      for mark_index in 0 .. mark_count - 1 loop
        if pg_catalog.jsonb_typeof(marks->mark_index) <> 'string' then
          return false;
        end if;
        mark_text := marks->>mark_index;
        mark_order := case mark_text
                        when 'bold' then 1
                        when 'italic' then 2
                        when 'code' then 3
                      end;
        -- A null order is an unknown mark; an order not greater than the
        -- previous one is a duplicate or an out-of-canonical-order mark.
        if mark_order is null or mark_order <= previous_mark_order then
          return false;
        end if;
        previous_mark_order := mark_order;
      end loop;

      if span ? 'link' then
        link := span->'link';
        if link is null
           or link = 'null'::jsonb
           or pg_catalog.jsonb_typeof(link) <> 'object' then
          return false;
        end if;
        link_kind := link->>'kind';
        if link_kind = 'https' then
          if not platform_private.cms_exact_keys(
               link,
               array['kind', 'href']::text[],
               array['kind', 'href']::text[]
             )
             or pg_catalog.jsonb_typeof(link->'href') <> 'string' then
            return false;
          end if;
          link_value := link->>'href';
          if pg_catalog.length(link_value) > 2048
             or link_value !~ '^https://[^\s@/]+(/[^\s]*)?$'
             or link_value ~ '[\u0000-\u001f\u007f-\u009f]' then
            return false;
          end if;
        elsif link_kind = 'mailto' then
          if not platform_private.cms_exact_keys(
               link,
               array['kind', 'address']::text[],
               array['kind', 'address']::text[]
             )
             or pg_catalog.jsonb_typeof(link->'address') <> 'string' then
            return false;
          end if;
          link_value := link->>'address';
          if pg_catalog.length(link_value) not between 3 and 254
             or link_value !~ '^[^\s@]+@[^\s@]+$' then
            return false;
          end if;
        elsif link_kind = 'internal' then
          if not platform_private.cms_exact_keys(
               link,
               array['kind', 'route']::text[],
               array['kind', 'route']::text[]
             )
             or pg_catalog.jsonb_typeof(link->'route') <> 'string' then
            return false;
          end if;
          link_value := link->>'route';
          -- An absolute, normalised path: a lone leading slash, no
          -- protocol-relative prefix, no query, fragment, control character
          -- or dot segment, at most 2048 characters.
          if pg_catalog.length(link_value) > 2048
             -- PostgreSQL ARE caps quantifier repetition at 255, so the
             -- <=2048 length cap above bounds the tail; the lookahead-free
             -- form keeps the protocol-relative refusal as an explicit test.
             or link_value !~ '^/[^\u0000-\u001f?#]*$'
             or link_value ~ '^//'
             or link_value ~ '(^|/)\.\.?(/|$)' then
            return false;
          end if;
        else
          return false;
        end if;
      else
        link := null;
      end if;

      -- Canonical form: adjacent spans with equal marks and an equal link are
      -- already merged, so two consecutive identical spans are refused.
      if span_index > 0
         and marks is not distinct from previous_marks
         and link is not distinct from previous_link then
        return false;
      end if;
      previous_marks := marks;
      previous_link := link;
    end loop;
  end loop;

  return true;
end;
$body$;

comment on function platform_private.cms_rich_text_v1_valid(jsonb) is
  'DEC-112 rich_text.v1 canonical grammar. Admits only the flat, NFC, bounded AST (paragraph, heading 2-4, bulleted/numbered list_item, quote; bold/italic/code marks in order; https/mailto/normalised internal links) and refuses non-canonical or unsafe input. Pure predicate: no reads, no writes, no evidence.';

-- The stored values must already be canonical before admission is widened, so
-- the read boundary cannot be handed a legacy row it would only refuse later.
do $preflight$
begin
  if exists (
    select 1
    from platform_private.cms_entry_field_values value_row
    join platform_private.cms_field_definition_versions field_row
      on field_row.id = value_row.field_definition_id
    where field_row.kind = 'rich_text'
      and value_row.value is not null
      and pg_catalog.jsonb_typeof(value_row.value) <> 'null'
      and not platform_private.cms_rich_text_v1_valid(value_row.value)
  ) then
    raise exception 'CMS rich-text values must satisfy rich_text.v1 before admission is widened'
      using errcode = 'P0001';
  end if;
end;
$preflight$;

-- Least privilege: the DEC-112 grammar predicate is reached only from other
-- SECURITY DEFINER command bodies, so no API role may call it directly and the
-- CREATE-time EXECUTE-to-PUBLIC default is revoked.  The definer role that owns
-- the draft value gate (defined in 20261005010100) keeps EXECUTE so the gate can
-- still reach the grammar.
revoke all on function platform_private.cms_rich_text_v1_valid(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_private.cms_rich_text_v1_valid(jsonb)
  to wejammin_cms_definer;
-- SEC-2: the validators are invoker-rights and run as wejammin_cms_definer inside
-- the SECURITY DEFINER commands, which hold EXECUTE only on the helpers their
-- bodies call.  The grammar's container-depth pre-check calls cms_json_depth, so
-- the definer role needs EXECUTE on it too: without it a valid rich-text value
-- fails inside every command with "permission denied for function
-- cms_json_depth" instead of being validated.  The function is a pure recursive
-- depth measure; no API role gains access.
grant execute on function platform_private.cms_json_depth(jsonb)
  to wejammin_cms_definer;
revoke all on function platform_private.cms_protected_validator_ref(text, bigint)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_rich_text_length_in_bounds(jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_private.cms_protected_validator_ref(text, bigint)
  to wejammin_cms_definer;
grant execute on function platform_private.cms_rich_text_length_in_bounds(jsonb, jsonb)
  to wejammin_cms_definer;

commit;
