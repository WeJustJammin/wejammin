-- Slice 10 repair (stream 1): a JSON null in any mandatory rich_text.v1 member
-- is a grammar violation, never skipped.
--
-- DEC-112 / BE03b: the rich_text.v1 grammar is closed (the TypeScript twin is a
-- strict discriminated union), so format, blocks, every block member, every
-- span member and every link member must be present and well typed.  SQL
-- three-valued logic makes `NULL not in (...)` NULL and an IF on NULL is
-- skipped, so a member that is present as JSON null could walk past a
-- membership check (a list_item whose `list` is null was admitted).  Each case
-- below sets exactly one mandatory member to JSON null in an otherwise valid
-- document and requires the document to be refused; the unmodified document is
-- the accepted control so no refusal can pass vacuously.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

create or replace function pg_temp.s10n_valid(p_doc jsonb)
returns boolean
language plpgsql
stable
as $body$
begin
  return platform_private.cms_rich_text_v1_valid(p_doc);
exception
  when others then
    return null;
end;
$body$;

create temp table s10n_base on commit drop as
select '{
  "format": "rich_text.v1",
  "blocks": [
    {"type": "heading", "level": 2, "spans": [{"text": "Title", "marks": []}]},
    {"type": "list_item", "list": "bulleted", "depth": 1,
     "spans": [{"text": "item", "marks": ["bold"],
                "link": {"kind": "https", "href": "https://example.com/x"}}]},
    {"type": "list_item", "list": "numbered", "depth": 1,
     "spans": [{"text": "mail", "marks": [],
                "link": {"kind": "mailto", "address": "a@example.com"}}]},
    {"type": "quote", "spans": [{"text": "q", "marks": [],
                "link": {"kind": "internal", "route": "/about"}}]}
  ]
}'::jsonb as doc;

select is(pg_temp.s10n_valid((select doc from s10n_base)), true,
  'control: the unmodified document with every block, mark and link kind is accepted [P2-S10-AC-082]');

select is(
  pg_temp.s10n_valid(jsonb_set((select doc from s10n_base), c.path::text[], 'null'::jsonb)),
  false,
  'a JSON null at ' || c.label || ' is refused [P2-S10-AC-082]'
)
from (values
  ('{format}', 'format'),
  ('{blocks}', 'blocks'),
  ('{blocks,0,type}', 'a block type'),
  ('{blocks,0,level}', 'a heading level'),
  ('{blocks,0,spans}', 'a heading spans member'),
  ('{blocks,1,type}', 'a list_item type'),
  ('{blocks,1,list}', 'a list_item list kind'),
  ('{blocks,1,depth}', 'a list_item depth'),
  ('{blocks,1,spans}', 'a list_item spans member'),
  ('{blocks,3,spans}', 'a quote spans member'),
  ('{blocks,0,spans,0,text}', 'a span text'),
  ('{blocks,0,spans,0,marks}', 'a span marks member'),
  ('{blocks,1,spans,0,marks,0}', 'a mark entry'),
  ('{blocks,1,spans,0,link}', 'a span link (absent rather than null)'),
  ('{blocks,1,spans,0,link,kind}', 'an https link kind'),
  ('{blocks,1,spans,0,link,href}', 'an https link href'),
  ('{blocks,2,spans,0,link,kind}', 'a mailto link kind'),
  ('{blocks,2,spans,0,link,address}', 'a mailto link address'),
  ('{blocks,3,spans,0,link,kind}', 'an internal link kind'),
  ('{blocks,3,spans,0,link,route}', 'an internal link route')
) c(path, label);

select * from finish();
rollback;
