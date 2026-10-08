-- Slice 10 gap resolution (P2-S10-AC-083/AC-084, audit WP-A4): rich_text.v1 link,
-- text-unit and merge-key parity with the TypeScript validator.
--
-- 20261005010000 accepted an internal route a browser reads as protocol-relative
-- (`/\host`: a backslash is a slash in a URL path) and let an internal route or
-- a mailto address carry DEL and C1 control characters; its https/mailto
-- whitespace class was PostgreSQL's locale-dependent `\s`, which is not the
-- JavaScript `\s` the TypeScript validator uses (U+FEFF is whitespace in one and
-- not the other).  The grammar below is the 20261005010000 definition with only
-- the link rules changed:
--
--   * internal: refuses a backslash anywhere and every C0, DEL and C1 character,
--     beside the existing protocol-relative, query, fragment and dot-segment
--     refusals;
--   * mailto: refuses C0, DEL and C1 characters (https already did);
--   * https/mailto: the whitespace class is spelled out explicitly and equals
--     JavaScript's `\s`, so no database locale can change a verdict.
--
-- Every length bound already counted Unicode characters through length() (BE03a
-- "Unicode characters": code points); the TypeScript side is aligned in the same
-- change.  The shared corpus both implementations are held to lives in
-- supabase/tests/phase_02_slice_10_rich_text_link_parity.sql and is parsed by
-- packages/contracts/src/content-schema-registry/rich-text-link-parity.test.ts.
-- Signature, volatility, search_path and grants are unchanged (CREATE OR
-- REPLACE).  Forward-only.
begin;

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
  -- Unicode whitespace exactly as JavaScript's \s defines it, spelled out so no
  -- database locale changes the class (parity with RichTextV1Schema).
  link_whitespace constant text :=
    '\t\n\u000b\u000c\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff';
  https_pattern constant text :=
    '^https://[^' || link_whitespace || '@/]+(/[^' || link_whitespace || ']*)?$';
  mailto_pattern constant text :=
    '^[^' || link_whitespace || '@]+@[^' || link_whitespace || '@]+$';
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
             or link_value !~ https_pattern
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
             or link_value !~ mailto_pattern
             or link_value ~ '[\u0000-\u001f\u007f-\u009f]' then
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
          -- protocol-relative prefix, no query, fragment, backslash (a browser
          -- reads `/\host` as `//host`), C0/DEL/C1 control character or dot
          -- segment, at most 2048 Unicode characters.
          if pg_catalog.length(link_value) > 2048
             -- PostgreSQL ARE caps quantifier repetition at 255, so the
             -- <=2048 length cap above bounds the tail; the lookahead-free
             -- form keeps the protocol-relative refusal as an explicit test.
             or link_value !~ '^/[^\u0000-\u001f\u007f-\u009f?#\\]*$'
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

commit;
