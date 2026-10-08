-- Slice 10 gap resolution (P2-S10-AC-083/AC-084, audit WP-A4): rich_text.v1 link,
-- text-unit and merge-key parity between PostgreSQL and TypeScript.
--
-- BE03b "rich_text.v1 value grammar": the grammar is code-owned and mirrored by
-- platform_private.cms_rich_text_v1_valid(jsonb) in SQL and RichTextV1Schema in
-- packages/contracts/src/content-schema-registry/structured-values.ts.  This
-- file is the SINGLE corpus both implementations are held to: every row of the
-- VALUES list below is parsed by
-- packages/contracts/src/content-schema-registry/rich-text-link-parity.test.ts,
-- which runs the TypeScript validator over the same JSON and asserts the same
-- verdict, so neither side can drift from the other without a failing test.
--
-- Row shape: (label, kind, json, expected).
--   kind 'link'  : json is a link object wrapped in one paragraph/one span
--   kind 'doc'   : json is a complete rich_text.v1 document
-- Rules decided here (and mirrored in TS):
--   * Every link kind refuses a C0, DEL or C1 character in its target.
--   * An internal route is an absolute normalised path: one leading slash, no
--     protocol-relative prefix, no query/fragment, no backslash anywhere, no
--     dot segment ("." or ".."), no C0/DEL/C1 character, at most 2048 Unicode
--     characters.
--   * https/mailto targets refuse Unicode whitespace as JavaScript's \s defines
--     it (spelled out explicitly here so no database locale changes the class).
--   * Every length bound counts Unicode characters (code points), BE03a "Unicode
--     characters" and PostgreSQL length(), never UTF-16 code units.
--   * Two adjacent spans with equal marks and an equal link are non-canonical
--     whatever the key order of the link object.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

create or replace function pg_temp.s10_rtp_wrap_link(p_link jsonb)
returns jsonb
language sql
immutable
as $body$
  select jsonb_build_object(
    'format', 'rich_text.v1',
    'blocks', jsonb_build_array(jsonb_build_object(
      'type', 'paragraph',
      'spans', jsonb_build_array(jsonb_build_object(
        'text', 'x', 'marks', '[]'::jsonb, 'link', p_link))))
  )
$body$;

create or replace function pg_temp.s10_rtp_wrap_text(p_text text)
returns jsonb
language sql
immutable
as $body$
  select jsonb_build_object(
    'format', 'rich_text.v1',
    'blocks', jsonb_build_array(jsonb_build_object(
      'type', 'paragraph',
      'spans', jsonb_build_array(jsonb_build_object(
        'text', p_text, 'marks', '[]'::jsonb))))
  )
$body$;

-- ---------------------------------------------------------------------------
-- The shared corpus.  Mirrored row for row by the TypeScript parity test.
-- ---------------------------------------------------------------------------
create temp table s10_rtp_corpus on commit drop as
select row_number() over () as n, label, kind, json::jsonb as json, expected
from (values
  -- internal routes -------------------------------------------------------
  ('internal root', 'link', $j${"kind":"internal","route":"/"}$j$, true),
  ('internal nested path', 'link', $j${"kind":"internal","route":"/blog/post"}$j$, true),
  ('internal space is allowed', 'link', $j${"kind":"internal","route":"/a b"}$j$, true),
  ('internal dots inside a segment', 'link', $j${"kind":"internal","route":"/a..b/c.d"}$j$, true),
  ('internal dot-prefixed segment', 'link', $j${"kind":"internal","route":"/.well-known/x"}$j$, true),
  ('internal three dots are a name', 'link', $j${"kind":"internal","route":"/a/.../b"}$j$, true),
  ('internal astral character', 'link', $j${"kind":"internal","route":"/😀"}$j$, true),
  ('internal NBSP is not a C1 control', 'link', $j${"kind":"internal","route":"/a b"}$j$, true),
  ('internal no leading slash', 'link', $j${"kind":"internal","route":"a"}$j$, false),
  ('internal empty route', 'link', $j${"kind":"internal","route":""}$j$, false),
  ('internal protocol-relative', 'link', $j${"kind":"internal","route":"//example.com"}$j$, false),
  ('internal backslash host', 'link', $j${"kind":"internal","route":"/\\example.com"}$j$, false),
  ('internal backslash inside a path', 'link', $j${"kind":"internal","route":"/a\\b"}$j$, false),
  ('internal trailing backslash', 'link', $j${"kind":"internal","route":"/a\\"}$j$, false),
  ('internal query', 'link', $j${"kind":"internal","route":"/a?b"}$j$, false),
  ('internal fragment', 'link', $j${"kind":"internal","route":"/a#b"}$j$, false),
  ('internal dot segment inside', 'link', $j${"kind":"internal","route":"/a/../b"}$j$, false),
  ('internal single dot segment leading', 'link', $j${"kind":"internal","route":"/./a"}$j$, false),
  ('internal dot segment trailing', 'link', $j${"kind":"internal","route":"/a/.."}$j$, false),
  ('internal single dot segment trailing', 'link', $j${"kind":"internal","route":"/a/."}$j$, false),
  ('internal bare dot-dot', 'link', $j${"kind":"internal","route":"/.."}$j$, false),
  ('internal C0 control', 'link', $j${"kind":"internal","route":"/a\u001fb"}$j$, false),
  ('internal tab', 'link', $j${"kind":"internal","route":"/a\tb"}$j$, false),
  ('internal DEL', 'link', $j${"kind":"internal","route":"/a\u007fb"}$j$, false),
  ('internal C1 NEL', 'link', $j${"kind":"internal","route":"/a\u0085b"}$j$, false),
  ('internal C1 upper bound', 'link', $j${"kind":"internal","route":"/a\u009fb"}$j$, false),
  ('internal route is a string', 'link', $j${"kind":"internal","route":7}$j$, false),
  -- https links -----------------------------------------------------------
  ('https host only', 'link', $j${"kind":"https","href":"https://example.com"}$j$, true),
  ('https path query fragment', 'link', $j${"kind":"https","href":"https://example.com/a/b?c=d#e"}$j$, true),
  ('https zero-width space is not whitespace', 'link', $j${"kind":"https","href":"https://example.com/a​b"}$j$, true),
  ('https plain http scheme', 'link', $j${"kind":"https","href":"http://example.com"}$j$, false),
  ('https javascript scheme', 'link', $j${"kind":"https","href":"javascript:alert(1)"}$j$, false),
  ('https no host', 'link', $j${"kind":"https","href":"https://"}$j$, false),
  ('https userinfo', 'link', $j${"kind":"https","href":"https://a@example.com"}$j$, false),
  ('https space in host', 'link', $j${"kind":"https","href":"https://exa mple.com"}$j$, false),
  ('https space in path', 'link', $j${"kind":"https","href":"https://example.com/a b"}$j$, false),
  ('https C0 control in path', 'link', $j${"kind":"https","href":"https://example.com/a\u0001"}$j$, false),
  ('https DEL in path', 'link', $j${"kind":"https","href":"https://example.com/a\u007f"}$j$, false),
  ('https C1 in path', 'link', $j${"kind":"https","href":"https://example.com/a\u0085"}$j$, false),
  ('https NBSP', 'link', $j${"kind":"https","href":"https://example.com/a b"}$j$, false),
  ('https line separator', 'link', $j${"kind":"https","href":"https://example.com/a b"}$j$, false),
  ('https byte order mark', 'link', $j${"kind":"https","href":"https://example.com/a﻿b"}$j$, false),
  ('https ideographic space', 'link', $j${"kind":"https","href":"https://example.com/a　b"}$j$, false),
  -- mailto links ----------------------------------------------------------
  ('mailto plain', 'link', $j${"kind":"mailto","address":"a@b.co"}$j$, true),
  ('mailto shortest address', 'link', $j${"kind":"mailto","address":"a@b"}$j$, true),
  ('mailto no local part', 'link', $j${"kind":"mailto","address":"@b"}$j$, false),
  ('mailto space', 'link', $j${"kind":"mailto","address":"a b@c"}$j$, false),
  ('mailto two at signs', 'link', $j${"kind":"mailto","address":"a@b@c"}$j$, false),
  ('mailto no at sign', 'link', $j${"kind":"mailto","address":"no-at-sign"}$j$, false),
  ('mailto C0 control', 'link', $j${"kind":"mailto","address":"a\u0001@b.co"}$j$, false),
  ('mailto DEL', 'link', $j${"kind":"mailto","address":"a\u007f@b.co"}$j$, false),
  ('mailto C1', 'link', $j${"kind":"mailto","address":"a\u0085@b.co"}$j$, false),
  ('mailto NBSP', 'link', $j${"kind":"mailto","address":"a @b.co"}$j$, false),
  -- canonical merge parity ------------------------------------------------
  ('merge equal link in another key order is non-canonical', 'doc', $j${"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"a","marks":[],"link":{"kind":"https","href":"https://a.example"}},{"text":"b","marks":[],"link":{"href":"https://a.example","kind":"https"}}]}]}$j$, false),
  ('merge equal link in the same key order is non-canonical', 'doc', $j${"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"a","marks":[],"link":{"kind":"https","href":"https://a.example"}},{"text":"b","marks":[],"link":{"kind":"https","href":"https://a.example"}}]}]}$j$, false),
  ('merge equal marks and no link is non-canonical', 'doc', $j${"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"a","marks":["bold"]},{"text":"b","marks":["bold"]}]}]}$j$, false),
  ('merge different link keeps the spans apart', 'doc', $j${"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"a","marks":[],"link":{"kind":"https","href":"https://a.example"}},{"text":"b","marks":[],"link":{"kind":"https","href":"https://b.example"}}]}]}$j$, true),
  ('merge different marks keeps the spans apart', 'doc', $j${"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"a","marks":["bold"]},{"text":"b","marks":[]}]}]}$j$, true)
) as corpus(label, kind, json, expected);

select ok((select count(*) >= 58 from s10_rtp_corpus),
  'the parity corpus carries every link, https, mailto and merge row');

-- One assertion per row: the verdict of cms_rich_text_v1_valid equals expected.
select is(
  platform_private.cms_rich_text_v1_valid(
    case corpus.kind
      when 'link' then pg_temp.s10_rtp_wrap_link(corpus.json)
      else corpus.json end
  ),
  corpus.expected,
  'PG parity corpus: ' || corpus.label
)
from s10_rtp_corpus corpus
order by corpus.n;

-- ---------------------------------------------------------------------------
-- Bound units: every bound counts Unicode characters (code points).  A 4-byte
-- character is one character in PostgreSQL length() and, after this change, one
-- in the TypeScript validator, so a value at the bound is accepted by both and a
-- value one character over is refused by both.
-- ---------------------------------------------------------------------------
select is(
  platform_private.cms_rich_text_v1_valid(
    pg_temp.s10_rtp_wrap_text(repeat(U&'\+01F600', 10000))),
  true,
  'PG units: a span of exactly 10000 astral characters is accepted'
);
select is(
  platform_private.cms_rich_text_v1_valid(
    pg_temp.s10_rtp_wrap_text(repeat(U&'\+01F600', 10001))),
  false,
  'PG units: a span of 10001 astral characters is refused'
);
select is(
  platform_private.cms_rich_text_v1_valid(pg_temp.s10_rtp_wrap_link(
    jsonb_build_object('kind', 'https',
      'href', 'https://a.example/' || repeat(U&'\+01F600', 2030)))),
  true,
  'PG units: an https href of exactly 2048 characters (astral) is accepted'
);
select is(
  platform_private.cms_rich_text_v1_valid(pg_temp.s10_rtp_wrap_link(
    jsonb_build_object('kind', 'https',
      'href', 'https://a.example/' || repeat(U&'\+01F600', 2031)))),
  false,
  'PG units: an https href of 2049 characters (astral) is refused'
);
select is(
  platform_private.cms_rich_text_v1_valid(pg_temp.s10_rtp_wrap_link(
    jsonb_build_object('kind', 'mailto',
      'address', 'a@' || repeat(U&'\+01F600', 252)))),
  true,
  'PG units: a mailto address of exactly 254 characters (astral) is accepted'
);
select is(
  platform_private.cms_rich_text_v1_valid(pg_temp.s10_rtp_wrap_link(
    jsonb_build_object('kind', 'mailto',
      'address', 'a@' || repeat(U&'\+01F600', 253)))),
  false,
  'PG units: a mailto address of 255 characters (astral) is refused'
);
select is(
  platform_private.cms_rich_text_v1_valid(pg_temp.s10_rtp_wrap_link(
    jsonb_build_object('kind', 'internal',
      'route', '/' || repeat(U&'\+01F600', 2047)))),
  true,
  'PG units: an internal route of exactly 2048 characters (astral) is accepted'
);
select is(
  platform_private.cms_rich_text_v1_valid(pg_temp.s10_rtp_wrap_link(
    jsonb_build_object('kind', 'internal',
      'route', '/' || repeat(U&'\+01F600', 2048)))),
  false,
  'PG units: an internal route of 2049 characters (astral) is refused'
);

select * from finish();
rollback;
