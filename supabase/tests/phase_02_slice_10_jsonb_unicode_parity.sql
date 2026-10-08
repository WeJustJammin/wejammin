-- Slice 10 Round 2 item 6 (lane N request): the PostgreSQL jsonb Unicode-escape
-- rules the TypeScript well-formed-Unicode predicate mirrors.
--
-- Lane N's `isWellFormedUnicode` / editorial-string predicate refuses strings
-- PostgreSQL cannot store.  These assertions pin the database side of that parity
-- so a PostgreSQL change (or a TS drift) is caught here rather than at a write:
--
--   * a JSON `\uD800`..`\uDBFF` high surrogate must be followed by a `\uDC00`..`\uDFFF`
--     low surrogate; any lone or mispaired surrogate escape is SQLSTATE 22P02;
--   * a JSON `\u0000` escape is SQLSTATE 22P05 (jsonb text cannot hold NUL);
--   * a well-formed surrogate pair is accepted and is one supplementary code point.
--
-- The literals are written as JSON escape text (standard_conforming_strings is on,
-- so the backslashes reach the jsonb parser verbatim).

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(12);

select throws_ok($$select '"\ud800"'::jsonb$$, '22P02', null,
  'a lone high surrogate escape is rejected with 22P02');
select throws_ok($$select '"\udc00"'::jsonb$$, '22P02', null,
  'a lone low surrogate escape is rejected with 22P02');
select throws_ok($$select '"\ud800\ud800"'::jsonb$$, '22P02', null,
  'two consecutive high surrogate escapes are rejected with 22P02');
select throws_ok($$select '"\udc00\ud800"'::jsonb$$, '22P02', null,
  'a low surrogate escape followed by a high one is rejected with 22P02');
select throws_ok($$select '"a\ud800b"'::jsonb$$, '22P02', null,
  'a high surrogate escape followed by a non-surrogate is rejected with 22P02');
select throws_ok($$select '"\u0000"'::jsonb$$, '22P05', null,
  'a NUL escape is rejected with 22P05');
select throws_ok($$select '"a\u0000b"'::jsonb$$, '22P05', null,
  'a NUL escape inside a longer string is rejected with 22P05');
select throws_ok($$select '{"k":"\u0000"}'::jsonb$$, '22P05', null,
  'a NUL escape in an object value is rejected with 22P05');
select throws_ok($$select '{"\u0000":"v"}'::jsonb$$, '22P05', null,
  'a NUL escape in an object key is rejected with 22P05');

select is(
  ('"😀"'::jsonb #>> '{}'), E'\U0001F600',
  'a well-formed surrogate pair is accepted as one supplementary code point'
);
select is(
  pg_catalog.char_length('"😀"'::jsonb #>> '{}'), 1,
  'a surrogate pair is one character, not two'
);
select is(
  ('"é퟿"'::jsonb #>> '{}'), E'é퟿',
  'the code points adjacent to the surrogate block are accepted'
);

select finish();
rollback;
