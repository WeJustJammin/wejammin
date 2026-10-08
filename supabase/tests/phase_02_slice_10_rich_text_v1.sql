-- Slice 10 QA-RED (WP-S10-2a): DEC-112 rich_text.v1 AST grammar.
-- BE03b "rich_text.v1 value grammar"; BE03a protected validator registry.
--
-- The grammar validator is code-owned and mirrored by
-- platform_private.cms_rich_text_v1_valid(jsonb).  The WP-S10-3
-- cms_rich_text_v1_validator.sql migration does not exist yet, so every probe
-- resolves the function through to_regprocedure and calls it dynamically: an
-- absent validator yields a false/null verdict for every assertion instead of
-- a 42883 parse abort that would hide the rest of the RED evidence.
--
-- Cases: flat container depth <=7, 128-block / 128-span / 10000-char bounds,
-- unsafe javascript/data/plain-http/protocol-relative link schemes, the
-- internal-route grammar, NFC and control-character exclusion, canonical mark
-- uniqueness/order, adjacent-span merging, and list depth transitions.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
-- 58 assertions in this file plus the 4 asserted by the shared
-- 001-fixtures include (matching the Slice 10 convention).
select plan(62);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

-- Resolves platform_private.cms_rich_text_v1_valid(jsonb) by OID and calls it
-- dynamically.  null means "validator absent or raised", which fails the true
-- and false assertions alike so a missing implementation stays evidence-backed
-- RED rather than aborting the suite.
create or replace function pg_temp.s10_rt_valid(p_value jsonb)
returns boolean
language plpgsql
stable
as $body$
declare
  result boolean;
begin
  if pg_catalog.to_regprocedure(
       'platform_private.cms_rich_text_v1_valid(jsonb)'
     ) is null then
    return null;
  end if;
  execute 'select platform_private.cms_rich_text_v1_valid($1)'
    into result using p_value;
  return result;
exception
  when others then
    return null;
end;
$body$;

-- Guarded container-depth probe.  Guards the shared cms_json_depth helper so an
-- absent catalog function yields null instead of a parse abort.
create or replace function pg_temp.s10_rt_depth(p_value jsonb)
returns integer
language plpgsql
stable
as $body$
declare
  result integer;
begin
  if pg_catalog.to_regprocedure(
       'platform_private.cms_json_depth(jsonb)'
     ) is null then
    return null;
  end if;
  execute 'select platform_private.cms_json_depth($1)'
    into result using p_value;
  return result;
exception
  when others then
    return null;
end;
$body$;

-- Document / span / block builders keep the probes readable.  s10_rt_span drops
-- an absent link so a span never carries a null link unless a probe asks for it
-- explicitly (the canonical "link absent rather than null" rule).
create or replace function pg_temp.s10_rt_doc(p_blocks jsonb)
returns jsonb
language sql
immutable
as $body$
  select jsonb_build_object('format', 'rich_text.v1', 'blocks', p_blocks)
$body$;

create or replace function pg_temp.s10_rt_span(
  p_text text,
  p_marks jsonb default '[]'::jsonb,
  p_link jsonb default null
)
returns jsonb
language sql
immutable
as $body$
  select jsonb_strip_nulls(jsonb_build_object(
    'text', p_text, 'marks', p_marks, 'link', p_link
  ))
$body$;

create or replace function pg_temp.s10_rt_paragraph(p_spans jsonb)
returns jsonb
language sql
immutable
as $body$
  select jsonb_build_object('type', 'paragraph', 'spans', p_spans)
$body$;

-- The validator is a named, code-owned protected function.
select ok(
  pg_temp.s10_fn_exists(
    'platform_private', 'cms_rich_text_v1_valid', 'jsonb'
  ),
  '[P2-S10-AC-082] the rich_text.v1 grammar has a named protected validator'
);

-- Structural baseline.
select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(pg_temp.s10_rt_span('hello')))
  ))),
  true,
  '[P2-S10-AC-082] a minimal one-paragraph document is canonical'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc('[]'::jsonb)),
  false,
  '[P2-S10-AC-082] an empty block list is refused'
);

select is(
  pg_temp.s10_rt_valid('{"blocks":[]}'::jsonb),
  false,
  '[P2-S10-AC-082] a document without the format literal is refused'
);

select is(
  pg_temp.s10_rt_valid('{"format":"rich_text.v2","blocks":[{"type":"paragraph","spans":[]}]}'::jsonb),
  false,
  '[P2-S10-AC-082] an unknown document format literal is refused'
);

select is(
  pg_temp.s10_rt_valid('{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[]}],"extra":1}'::jsonb),
  false,
  '[P2-S10-AC-082] an unknown top-level key is refused'
);

select is(
  pg_temp.s10_rt_valid('{"format":"rich_text.v1","blocks":{}}'::jsonb),
  false,
  '[P2-S10-AC-082] a non-array blocks value is refused'
);

-- Block grammar and heading/quote span floors.
select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    jsonb_build_object('type', 'heading', 'level', 2,
      'spans', jsonb_build_array(pg_temp.s10_rt_span('Title')))
  ))),
  true,
  '[P2-S10-AC-082] a level-2 heading is admitted'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    jsonb_build_object('type', 'heading', 'level', 1,
      'spans', jsonb_build_array(pg_temp.s10_rt_span('Title')))
  ))),
  false,
  '[P2-S10-AC-082] a level-1 heading is refused'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    jsonb_build_object('type', 'heading', 'level', 5,
      'spans', jsonb_build_array(pg_temp.s10_rt_span('Title')))
  ))),
  false,
  '[P2-S10-AC-082] a level-5 heading is refused'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    jsonb_build_object('type', 'heading', 'level', 3, 'spans', '[]'::jsonb)
  ))),
  false,
  '[P2-S10-AC-082] a heading without spans is refused'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    jsonb_build_object('type', 'heading', 'spans',
      jsonb_build_array(pg_temp.s10_rt_span('Title')))
  ))),
  false,
  '[P2-S10-AC-082] a heading without a level is refused'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    jsonb_build_object('type', 'embed', 'spans', '[]'::jsonb)
  ))),
  false,
  '[P2-S10-AC-082] an unknown block type is refused'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph('[]'::jsonb)
  ))),
  true,
  '[P2-S10-AC-082] a paragraph may carry no spans'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    jsonb_build_object('type', 'quote', 'spans', '[]'::jsonb)
  ))),
  false,
  '[P2-S10-AC-082] a quote without spans is refused'
);

-- Array and text bounds.
select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc((
    select jsonb_agg(pg_temp.s10_rt_paragraph('[]'::jsonb))
    from generate_series(1, 128) g
  ))),
  true,
  '[P2-S10-AC-082] 128 blocks is the inclusive bound'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc((
    select jsonb_agg(pg_temp.s10_rt_paragraph('[]'::jsonb))
    from generate_series(1, 129) g
  ))),
  false,
  '[P2-S10-AC-082] 129 blocks is refused'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph((
      select jsonb_agg(pg_temp.s10_rt_span(
        's' || g::text,
        case when g % 2 = 1 then '["bold"]'::jsonb else '["italic"]'::jsonb end
      ))
      from generate_series(1, 128) g
    ))
  ))),
  true,
  '[P2-S10-AC-082] 128 spans per block is the inclusive bound'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph((
      select jsonb_agg(pg_temp.s10_rt_span(
        's' || g::text,
        case when g % 2 = 1 then '["bold"]'::jsonb else '["italic"]'::jsonb end
      ))
      from generate_series(1, 129) g
    ))
  ))),
  false,
  '[P2-S10-AC-082] 129 spans per block is refused'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(
      pg_temp.s10_rt_span(repeat('a', 10000))
    ))
  ))),
  true,
  '[P2-S10-AC-082] a 10000-character span is the inclusive text bound'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(
      pg_temp.s10_rt_span(repeat('a', 10001))
    ))
  ))),
  false,
  '[P2-S10-AC-082] a 10001-character span is refused'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(pg_temp.s10_rt_span('')))
  ))),
  false,
  '[P2-S10-AC-082] an empty span text is refused'
);

-- Canonical marks: unique and in bold, italic, code order.
select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(
      pg_temp.s10_rt_span('a', '["bold","italic","code"]'::jsonb)
    ))
  ))),
  true,
  '[P2-S10-AC-083] canonical bold/italic/code marks are admitted'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(
      pg_temp.s10_rt_span('a', '["bold","bold"]'::jsonb)
    ))
  ))),
  false,
  '[P2-S10-AC-083] duplicate marks are refused'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(
      pg_temp.s10_rt_span('a', '["italic","bold"]'::jsonb)
    ))
  ))),
  false,
  '[P2-S10-AC-083] marks out of canonical order are refused'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(
      pg_temp.s10_rt_span('a', '["underline"]'::jsonb)
    ))
  ))),
  false,
  '[P2-S10-AC-083] an unknown mark is refused'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(
      pg_temp.s10_rt_span('a', '"bold"'::jsonb)
    ))
  ))),
  false,
  '[P2-S10-AC-083] a non-array marks value is refused'
);

-- Link kinds and unsafe schemes.
select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(pg_temp.s10_rt_span(
      'a', '[]'::jsonb, '{"kind":"https","href":"https://example.com/a"}'::jsonb
    )))
  ))),
  true,
  '[P2-S10-AC-083] an absolute https link is admitted'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(pg_temp.s10_rt_span(
      'a', '[]'::jsonb, '{"kind":"https","href":"http://example.com/a"}'::jsonb
    )))
  ))),
  false,
  '[P2-S10-AC-083] a plain-http link is refused'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(pg_temp.s10_rt_span(
      'a', '[]'::jsonb, '{"kind":"https","href":"javascript:alert(1)"}'::jsonb
    )))
  ))),
  false,
  '[P2-S10-AC-083] a javascript: link is refused'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(pg_temp.s10_rt_span(
      'a', '[]'::jsonb, '{"kind":"https","href":"data:text/html,<b>x</b>"}'::jsonb
    )))
  ))),
  false,
  '[P2-S10-AC-083] a data: link is refused'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(pg_temp.s10_rt_span(
      'a', '[]'::jsonb, '{"kind":"javascript","href":"https://example.com/"}'::jsonb
    )))
  ))),
  false,
  '[P2-S10-AC-083] an unknown link kind is refused'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(pg_temp.s10_rt_span(
      'a', '[]'::jsonb, '{"kind":"internal","route":"/articles/hello"}'::jsonb
    )))
  ))),
  true,
  '[P2-S10-AC-083] an internal absolute route is admitted'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(pg_temp.s10_rt_span(
      'a', '[]'::jsonb, '{"kind":"internal","route":"//evil.example/x"}'::jsonb
    )))
  ))),
  false,
  '[P2-S10-AC-083] a protocol-relative internal route is refused'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(pg_temp.s10_rt_span(
      'a', '[]'::jsonb, '{"kind":"internal","route":"articles/hello"}'::jsonb
    )))
  ))),
  false,
  '[P2-S10-AC-083] a relative internal route without a leading slash is refused'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(pg_temp.s10_rt_span(
      'a', '[]'::jsonb, '{"kind":"internal","route":"/articles?x=1"}'::jsonb
    )))
  ))),
  false,
  '[P2-S10-AC-083] an internal route carrying a query string is refused'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(pg_temp.s10_rt_span(
      'a', '[]'::jsonb, '{"kind":"internal","route":"/articles#top"}'::jsonb
    )))
  ))),
  false,
  '[P2-S10-AC-083] an internal route carrying a fragment is refused'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(pg_temp.s10_rt_span(
      'a', '[]'::jsonb, '{"kind":"internal","route":"/a/../b"}'::jsonb
    )))
  ))),
  false,
  '[P2-S10-AC-083] an internal route escaping with dot-dot is refused'
);

-- Canonical form: the link is absent rather than null.
select is(
  pg_temp.s10_rt_valid(
    '{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"a","marks":[],"link":null}]}]}'::jsonb
  ),
  false,
  '[P2-S10-AC-083] a null link is refused in favour of an absent link'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(pg_temp.s10_rt_span(
      'a', '[]'::jsonb, '{"kind":"mailto","address":"a@example.com"}'::jsonb
    )))
  ))),
  true,
  '[P2-S10-AC-083] a mailto link is admitted'
);

-- NFC normalisation and control-character exclusion.
select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(pg_temp.s10_rt_span(U&'caf\00e9')))
  ))),
  true,
  '[P2-S10-AC-083] NFC text is admitted'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(
      pg_temp.s10_rt_span(U&'caf\0065\0301')
    ))
  ))),
  false,
  '[P2-S10-AC-083] decomposed text is refused'
);

select is(
  pg_temp.s10_rt_valid(
    '{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"line\nbreak","marks":[]}]}]}'::jsonb
  ),
  true,
  '[P2-S10-AC-083] the single permitted newline U+000A is admitted'
);

select is(
  pg_temp.s10_rt_valid(
    '{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"a\u0009b","marks":[]}]}]}'::jsonb
  ),
  false,
  '[P2-S10-AC-083] a tab control character is refused'
);

select is(
  pg_temp.s10_rt_valid(
    '{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"a\u0001b","marks":[]}]}]}'::jsonb
  ),
  false,
  '[P2-S10-AC-083] a C0 control character is refused'
);

select is(
  pg_temp.s10_rt_valid(
    '{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"a\u007fb","marks":[]}]}]}'::jsonb
  ),
  false,
  '[P2-S10-AC-083] DEL is refused'
);

select is(
  pg_temp.s10_rt_valid(
    '{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"a\u0085b","marks":[]}]}]}'::jsonb
  ),
  false,
  '[P2-S10-AC-083] a C1 control character is refused'
);

-- Adjacent spans with equal marks and link must already be merged.
select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(
      pg_temp.s10_rt_span('a', '["bold"]'::jsonb),
      pg_temp.s10_rt_span('b', '["bold"]'::jsonb)
    ))
  ))),
  false,
  '[P2-S10-AC-083] adjacent spans with equal marks are refused as non-canonical'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(
      pg_temp.s10_rt_span('a', '["bold"]'::jsonb),
      pg_temp.s10_rt_span('b', '["italic"]'::jsonb)
    ))
  ))),
  true,
  '[P2-S10-AC-083] adjacent spans with distinct marks are admitted'
);

-- List depth transitions: a run starts at depth 1 and rises by at most one.
select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    jsonb_build_object('type', 'list_item', 'list', 'bulleted', 'depth', 1,
      'spans', jsonb_build_array(pg_temp.s10_rt_span('a'))),
    jsonb_build_object('type', 'list_item', 'list', 'bulleted', 'depth', 2,
      'spans', jsonb_build_array(pg_temp.s10_rt_span('b'))),
    jsonb_build_object('type', 'list_item', 'list', 'bulleted', 'depth', 3,
      'spans', jsonb_build_array(pg_temp.s10_rt_span('c')))
  ))),
  true,
  '[P2-S10-AC-082] a list run rising one level per item is admitted'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    jsonb_build_object('type', 'list_item', 'list', 'bulleted', 'depth', 2,
      'spans', jsonb_build_array(pg_temp.s10_rt_span('a')))
  ))),
  false,
  '[P2-S10-AC-082] a list run whose first item is not depth 1 is refused'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    jsonb_build_object('type', 'list_item', 'list', 'bulleted', 'depth', 1,
      'spans', jsonb_build_array(pg_temp.s10_rt_span('a'))),
    jsonb_build_object('type', 'list_item', 'list', 'bulleted', 'depth', 3,
      'spans', jsonb_build_array(pg_temp.s10_rt_span('b')))
  ))),
  false,
  '[P2-S10-AC-082] a list depth jump of more than one is refused'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    jsonb_build_object('type', 'list_item', 'list', 'bulleted', 'depth', 1,
      'spans', jsonb_build_array(pg_temp.s10_rt_span('a'))),
    jsonb_build_object('type', 'list_item', 'list', 'numbered', 'depth', 1,
      'spans', jsonb_build_array(pg_temp.s10_rt_span('b')))
  ))),
  true,
  '[P2-S10-AC-082] switching the list type starts a fresh depth-1 run'
);

select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(pg_temp.s10_rt_span('intro'))),
    jsonb_build_object('type', 'list_item', 'list', 'bulleted', 'depth', 1,
      'spans', jsonb_build_array(pg_temp.s10_rt_span('a')))
  ))),
  true,
  '[P2-S10-AC-082] a list starting after a non-list block resets to depth 1'
);

-- Flat container depth stays within the shared depth-7 bound.
select is(
  pg_temp.s10_rt_valid(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(pg_temp.s10_rt_span(
      'a', '[]'::jsonb, '{"kind":"internal","route":"/x"}'::jsonb
    )))
  ))),
  true,
  '[P2-S10-AC-082] the deepest legal flat document is admitted'
);

select is(
  pg_temp.s10_rt_valid(
    '{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"a","marks":[],"link":{"kind":"internal","route":"/x","deep":{"a":{"b":{"c":{"d":1}}}}}}]}]}'::jsonb
  ),
  false,
  '[P2-S10-AC-082] a value nested past the depth-7 bound is refused'
);

select is(
  pg_temp.s10_rt_depth(pg_temp.s10_rt_doc(jsonb_build_array(
    pg_temp.s10_rt_paragraph(jsonb_build_array(pg_temp.s10_rt_span(
      'a', '[]'::jsonb, '{"kind":"internal","route":"/x"}'::jsonb
    )))
  ))) <= 7,
  true,
  '[P2-S10-AC-082] the deepest legal document stays within the depth-7 container bound'
);

select is(
  pg_temp.s10_rt_depth(
    '{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"a","marks":[],"link":{"kind":"internal","route":"/x","deep":{"a":{"b":{"c":{"d":1}}}}}}]}]}'::jsonb
  ) > 7,
  true,
  '[P2-S10-AC-082] the over-deep probe exceeds the depth-7 container bound'
);

select finish();
rollback;
