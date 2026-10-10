-- Slice 11 lane preflight-cursor, finding 3 (BE03b "Derived revision workflow state (E2)",
-- tracker P2-S11-AC-086; DEC-140 fault classes): the filtered CMS-03B-03 history cursor must not
-- disclose the identity of a concealed scan-tail candidate.
--
-- A request that names a `state` scans at most 1,000 keyset candidates, concealed ones included
-- (a cursor must not become a probe), and on reaching that bound answers a cursor positioned after
-- the last scanned candidate.  That candidate may be a revision the caller is not allowed to know
-- exists.  Until now the public cursor was base64(JCS({queryHash, lastRevisionNumber,
-- lastRevisionId, expiresAt, keyId, signature})): signed, but readable, so decoding the cursor of
-- the bound-ending page revealed the hidden revision UUID and revision number.
--
-- Entry 301 carries 1,231 revisions, all stored as the constant `draft`; rank 1 is the highest
-- revision number, so number = 1232 - rank.  Evidence:
--   approved  ranks 3, 450, 1001, 1100 (numbers 1229, 782, 231, 132)
--   published rank 1150 (number 82)
--   published rank 1000 (number 232) under ANOTHER acting party: CONCEALED, and it is the
--     last candidate of the 1,000-candidate scan, so every bound-ending cursor points at it.
--
-- Every call goes through platform_private.cms_list_revisions_signed, the wrapper that
-- platform_api.cms_list_revisions delegates to, so the suite sees exactly the bytes an API caller
-- receives.  The authenticated-encryption envelope itself is exercised through the public
-- behaviour (what a caller can decode, replay, bit-flip, re-time) and through the private
-- seal/open pair for forging well-formed cursors that the wrapper must still refuse.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(41);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_e2/000-derived-evidence.sqlinc

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);

-- This fixed key exists only inside the rolled-back pgTAP transaction; no migration provisions an
-- operational signing key (20261005010400 header).
select vault.create_secret(
  repeat('a1', 32),
  'cms_editorial_history_cursor_active',
  'pgTAP transaction-only CMS-03B-03 sealed-cursor test key'
);

create or replace function pg_temp.sh_rev(p_number integer) returns uuid language sql immutable as $$
  select case when p_number = 1 then 'a9100000-0000-4000-8000-000000000302'::uuid
              else ('a9150000-0000-4000-8000-' || lpad(p_number::text, 12, '0'))::uuid end $$;

select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_entry_revisions(
  id, owner_id, entry_id, revision_number, schema_version_id,
  template_version_id, taxonomy_version_ids, parent_revision_ids, locale,
  payload_hash, author_person_id, acting_party_id, state, version,
  validation_state, validation_report, created_at, updated_at
)
select pg_temp.sh_rev(series.n), base.owner_id, base.entry_id, series.n, base.schema_version_id,
       null, '[]'::jsonb, '[]'::jsonb, base.locale,
       platform_private.cms_jcs_sha256('{}'::jsonb)::char(64),
       base.author_person_id,
       case when series.n = 232 then (select value::uuid from s10_ids where key = 'strangerPerson')
            else base.acting_party_id end,
       'draft', 1, 'valid', '{}'::jsonb,
       base.created_at + series.n * interval '1 second', base.created_at + series.n * interval '1 second'
from generate_series(2, 1231) series(n),
     platform_private.cms_entry_revisions base
where base.id = 'a9100000-0000-4000-8000-000000000302';
analyze platform_private.cms_entry_revisions;

select pg_temp.e2_evidence(pg_temp.sh_rev(1232 - r), 'approved') from unnest(array[3, 450, 1001, 1100]) r;
select pg_temp.e2_evidence(pg_temp.sh_rev(1232 - 1150), 'published');
select pg_temp.e2_evidence(pg_temp.sh_rev(232), 'published');

create temp table sh_calls(label text primary key, response jsonb, message text) on commit drop;
create or replace function pg_temp.sh_request(p_request jsonb) returns jsonb language sql stable as $$
  select jsonb_build_object('entryId', 'a9100000-0000-4000-8000-000000000301') || p_request
    || jsonb_build_object('context', jsonb_build_object(
         'actingPartyId', (select value from s10_ids where key = 'organization'),
         'actingContextId', 'a9100000-0000-4000-8000-000000000094',
         'correlationId', 'a9100000-0000-4000-8000-000000000095')) $$;
create or replace function pg_temp.sh_hist(p_label text, p_request jsonb)
returns void
language plpgsql
as $body$
declare
  result jsonb;
begin
  begin
    select platform_private.cms_list_revisions_signed(pg_temp.sh_request(p_request)) into result;
    insert into sh_calls values (p_label, result, null)
    on conflict (label) do update set response = excluded.response, message = null;
  exception when others then
    insert into sh_calls values (p_label, null, sqlerrm)
    on conflict (label) do update set response = null, message = excluded.message;
  end;
end;
$body$;
create or replace function pg_temp.sh_numbers(p_label text)
returns text language sql stable as $body$
  select coalesce(string_agg((item->>'revisionNumber') || ':' || (item->>'state'), ',' order by ord), '')
  from sh_calls call,
       jsonb_array_elements(coalesce(call.response->'items', '[]'::jsonb)) with ordinality as t(item, ord)
  where call.label = p_label
$body$;
create or replace function pg_temp.sh_cursor(p_label text)
returns text language sql stable as $$ select response->>'nextCursor' from sh_calls where label = p_label $$;
create or replace function pg_temp.sh_outcome(p_label text)
returns text language sql stable as $$
  select case when message is not null then message else 'accepted' end from sh_calls where label = p_label $$;
-- The cursor bytes an API caller can read: base64-decoded and rendered losslessly in bytea escape
-- form (printable ASCII stays literal, every other byte is an octal escape), so a NUL-bearing
-- ciphertext is still a searchable text.
create or replace function pg_temp.sh_plain(p_cursor text)
returns text language sql immutable as $$
  select encode(decode(p_cursor, 'base64'), 'escape') $$;
-- The cursor as a JSON document, or null when its decoded bytes are not one.
create or replace function pg_temp.sh_json(p_cursor text)
returns jsonb language plpgsql immutable as $body$
begin
  return convert_from(decode(p_cursor, 'base64'), 'utf8')::jsonb;
exception when others then
  return null;
end;
$body$;
-- Flips the bits of one byte of the decoded cursor and re-encodes it.
create or replace function pg_temp.sh_flip(p_cursor text, p_offset integer)
returns text language sql immutable as $$
  select replace(encode(
    set_byte(decode(p_cursor, 'base64'), p_offset, get_byte(decode(p_cursor, 'base64'), p_offset) # 255),
    'base64'), E'\n', '') $$;
create or replace function pg_temp.sh_resize(p_cursor text, p_length integer)
returns text language sql immutable as $$
  select replace(encode(
    case when p_length <= octet_length(decode(p_cursor, 'base64'))
         then substring(decode(p_cursor, 'base64') from 1 for p_length)
         else decode(p_cursor, 'base64') || decode(repeat('00', p_length - octet_length(decode(p_cursor, 'base64'))), 'hex')
    end, 'base64'), E'\n', '') $$;
-- Opens a cursor's payload, patches it and seals it again under p_domain: a well-formed, correctly
-- authenticated forgery.  Late bound and exception-safe, so a run before the sealed-cursor helpers
-- exist reports failed assertions instead of aborting the suite (a null forgery is a request with no
-- cursor, which every refusal assertion below distinguishes from the expected refusal).
create or replace function pg_temp.sh_forge(p_cursor text, p_patch jsonb, p_domain text default 'cms-03b-03')
returns text
language plpgsql
as $body$
begin
  return platform_private.cms_sealed_cursor_seal(
    p_domain,
    convert_from(decode(
      platform_private.cms_sealed_cursor_open('cms-03b-03', to_jsonb(p_cursor)), 'base64'), 'utf8')::jsonb
    || p_patch);
exception when others then
  return null;
end;
$body$;

select is((select count(*)::integer from platform_private.cms_entry_revisions
            where entry_id = 'a9100000-0000-4000-8000-000000000301' and state = 'draft'), 1231,
  'entry 301 holds 1,231 revisions, every one stored as the constant draft [P2-S11-AC-085]');

create temp table sh_writes_before on commit drop as
  select coalesce(sum(n_tup_ins + n_tup_upd + n_tup_del), 0)::bigint as writes
    from pg_stat_xact_all_tables
   where schemaname not like 'pg\_%' and schemaname <> 'information_schema';

-- ---------------------------------------------------------------- the privacy finding ----
select pg_temp.sh_hist('a-1', '{"limit":25,"state":"approved"}'::jsonb);
select is(pg_temp.sh_numbers('a-1'), '1229:approved,782:approved',
  'the first filtered page lists the matches among the first 1,000 candidates [P2-S11-AC-086]');
select ok(pg_temp.sh_cursor('a-1') is not null,
  'the bound-reached page carries a next cursor positioned after the last scanned candidate (rank 1000) [P2-S11-AC-086]');

select is(position(pg_temp.sh_rev(232)::text in pg_temp.sh_plain(pg_temp.sh_cursor('a-1'))), 0,
  'decoding the bound-ending cursor does not reveal the UUID of the concealed rank-1000 revision (0 = the UUID text is absent) [P2-S11-AC-086]');
select ok(position(decode(replace(pg_temp.sh_rev(232)::text, '-', ''), 'hex') in decode(pg_temp.sh_cursor('a-1'), 'base64')) = 0,
  'the concealed revision UUID is not present in the cursor as raw bytes either [P2-S11-AC-086]');
select is(substring(pg_temp.sh_plain(pg_temp.sh_cursor('a-1')) from '"lastRevisionNumber":"([0-9]+)"'), null::text,
  'decoding the bound-ending cursor does not reveal the revision number of the concealed rank-1000 revision [P2-S11-AC-086]');
select is(pg_temp.sh_json(pg_temp.sh_cursor('a-1')), null::jsonb,
  'the bound-ending cursor is not a decodable JSON document: its payload is encrypted [P2-S11-AC-086]');

select pg_temp.sh_hist('p-1', '{"limit":25,"state":"published"}'::jsonb);
select is(pg_temp.sh_numbers('p-1') || '|' || (pg_temp.sh_cursor('p-1') is not null)::text, '|true',
  'an empty filtered page whose whole scan was concealed or non-matching still answers a non-null cursor [P2-S11-AC-086]');
select ok(position(pg_temp.sh_rev(232)::text in pg_temp.sh_plain(pg_temp.sh_cursor('p-1'))) = 0
          and pg_temp.sh_json(pg_temp.sh_cursor('p-1')) is null,
  'the empty-page cursor discloses nothing about the concealed published revision it passed [P2-S11-AC-086]');

-- --------------------------------------------- bounded scan and keyset position preserved ----
select pg_temp.sh_hist('a-2', jsonb_build_object('limit', 25, 'state', 'approved', 'cursor', pg_temp.sh_cursor('a-1')));
select is(pg_temp.sh_numbers('a-2') || '|' || coalesce(pg_temp.sh_cursor('a-2'), 'no-cursor'),
  '231:approved,132:approved|no-cursor',
  'the sealed cursor resumes exactly after the last scanned candidate: the remaining matches, then the end of the walk [P2-S11-AC-086]');
select pg_temp.sh_hist('p-2', jsonb_build_object('limit', 25, 'state', 'published', 'cursor', pg_temp.sh_cursor('p-1')));
select is(pg_temp.sh_numbers('p-2') || '|' || coalesce(pg_temp.sh_cursor('p-2'), 'no-cursor'), '82:published|no-cursor',
  'the empty page resumes past the concealed rank-1000 revision and finds the visible published revision at rank 1150 [P2-S11-AC-086]');
select pg_temp.sh_hist('l-1', '{"limit":1,"state":"approved"}'::jsonb);
select is(pg_temp.sh_numbers('l-1'), '1229:approved', 'limit 1 returns the first match [P2-S11-AC-086]');
select pg_temp.sh_hist('l-2', jsonb_build_object('limit', 1, 'state', 'approved', 'cursor', pg_temp.sh_cursor('l-1')));
select is(pg_temp.sh_numbers('l-2'), '782:approved',
  'a cursor positioned after the last RETURNED row (the probe case) is sealed too and resumes at the probe match [P2-S11-AC-086]');

-- ----------------------------------------------------------- shape of the sealed cursor ----
select ok(char_length(pg_temp.sh_cursor('a-1')) <= 512 and char_length(pg_temp.sh_cursor('l-1')) <= 512,
  'a sealed cursor stays inside the 512-character contract [P2-S11-AC-086]');
select is(char_length(pg_temp.sh_cursor('a-1')) || '/' || char_length(pg_temp.sh_cursor('l-1')), '364/364',
  'every sealed cursor has one fixed length (273 raw bytes, 364 characters) whatever the position it encodes: no length side channel [P2-S11-AC-086]');
select pg_temp.sh_hist('l-1b', '{"limit":1,"state":"approved"}'::jsonb);
select isnt(pg_temp.sh_cursor('l-1b'), pg_temp.sh_cursor('l-1'),
  'the same position sealed by two back-to-back reads yields different cursors (fresh nonce: positions are not linkable) [P2-S11-AC-086]');
select pg_temp.sh_hist('l-2b', jsonb_build_object('limit', 1, 'state', 'approved', 'cursor', pg_temp.sh_cursor('l-1b')));
select is(pg_temp.sh_numbers('l-2b'), pg_temp.sh_numbers('l-2'),
  'both independently sealed cursors resume to the same page [P2-S11-AC-086]');

-- The unfiltered cursor never points at a concealed row (it stays after the last RETURNED row), so
-- its Slice 10 six-key signed envelope is unchanged.
select pg_temp.sh_hist('u-1', '{"limit":3}'::jsonb);
select ok(platform_private.cms_exact_keys(
            pg_temp.sh_json(pg_temp.sh_cursor('u-1')),
            array['queryHash', 'lastRevisionNumber', 'lastRevisionId', 'expiresAt', 'keyId', 'signature']::text[],
            array['queryHash', 'lastRevisionNumber', 'lastRevisionId', 'expiresAt', 'keyId', 'signature']::text[]),
  'an unfiltered history cursor keeps the Slice 10 six-key signed envelope [P2-S11-AC-086]');

-- ------------------------------------------------------------------- context binding ----
select pg_temp.sh_hist('b-state', jsonb_build_object('limit', 25, 'state', 'published', 'cursor', pg_temp.sh_cursor('a-1')));
select is(pg_temp.sh_outcome('b-state'), 'CONFLICT',
  'a sealed cursor replayed with another state filter is a cursor/context mismatch (409) [P2-S11-AC-086]');
select pg_temp.sh_hist('b-limit', jsonb_build_object('limit', 10, 'state', 'approved', 'cursor', pg_temp.sh_cursor('a-1')));
select is(pg_temp.sh_outcome('b-limit'), 'CONFLICT',
  'a sealed cursor replayed with another limit is a cursor/context mismatch (409) [P2-S11-AC-086]');
select pg_temp.sh_hist('b-locale', jsonb_build_object('limit', 25, 'state', 'approved', 'locale', 'en-US', 'cursor', pg_temp.sh_cursor('a-1')));
select is(pg_temp.sh_outcome('b-locale'), 'CONFLICT',
  'a sealed cursor replayed with another locale filter is a cursor/context mismatch (409) [P2-S11-AC-086]');
select pg_temp.sh_hist('b-nofilter', jsonb_build_object('limit', 25, 'cursor', pg_temp.sh_cursor('a-1')));
select is(pg_temp.sh_outcome('b-nofilter'), 'CONFLICT',
  'a sealed cursor replayed without the state filter is a cursor/context mismatch (409) [P2-S11-AC-086]');

-- ------------------------------------------------------------------- authenticity (AEAD) ----
-- Layout of the 273-byte sealed envelope: version 0, key id 1..16, nonce 17..32, ciphertext 33..240, tag 241..272.
select pg_temp.sh_hist('t-ct', jsonb_build_object('limit', 25, 'state', 'approved', 'cursor', pg_temp.sh_flip(pg_temp.sh_cursor('a-1'), 100)));
select is(pg_temp.sh_outcome('t-ct'), 'CONFLICT', 'a flipped ciphertext byte is refused (409): the payload is authenticated [P2-S11-AC-086]');
select pg_temp.sh_hist('t-tag', jsonb_build_object('limit', 25, 'state', 'approved', 'cursor', pg_temp.sh_flip(pg_temp.sh_cursor('a-1'), 250)));
select is(pg_temp.sh_outcome('t-tag'), 'CONFLICT', 'a flipped tag byte is refused (409) [P2-S11-AC-086]');
select pg_temp.sh_hist('t-iv', jsonb_build_object('limit', 25, 'state', 'approved', 'cursor', pg_temp.sh_flip(pg_temp.sh_cursor('a-1'), 20)));
select is(pg_temp.sh_outcome('t-iv'), 'CONFLICT', 'a flipped nonce byte is refused (409): the nonce is authenticated [P2-S11-AC-086]');
select pg_temp.sh_hist('t-key', jsonb_build_object('limit', 25, 'state', 'approved', 'cursor', pg_temp.sh_flip(pg_temp.sh_cursor('a-1'), 5)));
select is(pg_temp.sh_outcome('t-key'), 'CONFLICT', 'a key id that names no Vault secret is refused (409) [P2-S11-AC-086]');
select pg_temp.sh_hist('t-short', jsonb_build_object('limit', 25, 'state', 'approved', 'cursor', pg_temp.sh_resize(pg_temp.sh_cursor('a-1'), 257)));
select is(pg_temp.sh_outcome('t-short'), 'INVALID_REQUEST', 'a truncated sealed envelope is structurally malformed (400) [P2-S11-AC-086]');
select pg_temp.sh_hist('t-long', jsonb_build_object('limit', 25, 'state', 'approved', 'cursor', pg_temp.sh_resize(pg_temp.sh_cursor('a-1'), 274)));
select is(pg_temp.sh_outcome('t-long'), 'INVALID_REQUEST', 'an over-long sealed envelope is structurally malformed (400) [P2-S11-AC-086]');

-- Well-formed, correctly authenticated cursors that the wrapper must still refuse.
select ok(pg_temp.sh_forge(pg_temp.sh_cursor('a-1'), '{}'::jsonb) is not null,
  'control: the private seal/open pair re-seals an opened payload into a well-formed cursor, so each refusal below is about the forged content [P2-S11-AC-086]');
select pg_temp.sh_hist('e-old', jsonb_build_object('limit', 25, 'state', 'approved',
  'cursor', pg_temp.sh_forge(pg_temp.sh_cursor('a-1'), '{"expiresAt":"1"}'::jsonb)));
select is(pg_temp.sh_outcome('e-old'), 'CONFLICT', 'a correctly sealed but expired cursor is refused (409) [P2-S11-AC-086]');
select pg_temp.sh_hist('e-long', jsonb_build_object('limit', 25, 'state', 'approved',
  'cursor', pg_temp.sh_forge(pg_temp.sh_cursor('a-1'),
    jsonb_build_object('expiresAt', (floor(extract(epoch from clock_timestamp())) + 90000)::bigint::text))));
select is(pg_temp.sh_outcome('e-long'), 'CONFLICT', 'a correctly sealed cursor living beyond the 24-hour ceiling is refused (409) [P2-S11-AC-086]');
select pg_temp.sh_hist('e-shape', jsonb_build_object('limit', 25, 'state', 'approved',
  'cursor', pg_temp.sh_forge(pg_temp.sh_cursor('a-1'), '{"extra":"x"}'::jsonb)));
select is(pg_temp.sh_outcome('e-shape'), 'INVALID_REQUEST', 'a correctly sealed payload with a foreign member is a malformed cursor (400) [P2-S11-AC-086]');
select pg_temp.sh_hist('e-pos', jsonb_build_object('limit', 25, 'state', 'approved',
  'cursor', pg_temp.sh_forge(pg_temp.sh_cursor('a-1'), '{"lastRevisionId":"not-a-uuid"}'::jsonb)));
select is(pg_temp.sh_outcome('e-pos'), 'CONFLICT', 'a correctly sealed payload with a non-UUID position is refused by the reader (409) [P2-S11-AC-086]');
-- A signing-domain mismatch: the same payload sealed under another cursor domain never opens as history.
select pg_temp.sh_hist('e-domain', jsonb_build_object('limit', 25, 'state', 'approved',
  'cursor', pg_temp.sh_forge(pg_temp.sh_cursor('a-1'), '{}'::jsonb, 'cms-03b-13')));
select is(pg_temp.sh_outcome('e-domain'), 'CONFLICT', 'a cursor sealed under another domain (cms-03b-13) is refused as history (409) [P2-S11-AC-086]');

-- ------------------------------------------------------------------- safe read: no writes ----
select is(
  (select coalesce(sum(n_tup_ins + n_tup_upd + n_tup_del), 0)::bigint
     from pg_stat_xact_all_tables
    where schemaname not like 'pg\_%' and schemaname <> 'information_schema')
  - (select writes from sh_writes_before),
  0::bigint,
  'every read above, sealing and opening included, wrote no row to any table (safe read) [P2-S11-AC-086]');

-- ------------------------------------------------------------------- key rotation window ----
-- Rotation runs in a subtransaction that is rolled back, so the rotated Vault state never outlives its probe.
create or replace function pg_temp.sh_rotated(p_old_key_name text, p_request jsonb)
returns text
language plpgsql
as $body$
declare
  outcome text;
begin
  begin
    perform vault.update_secret(
      (select id from vault.secrets where name = 'cms_editorial_history_cursor_active'),
      new_name => p_old_key_name);
    perform vault.create_secret(repeat('b2', 32), 'cms_editorial_history_cursor_active',
      'pgTAP transaction-only rotated CMS-03B-03 test key');
    perform pg_temp.sh_hist('rot', p_request);
    outcome := coalesce((select message from sh_calls where label = 'rot'),
                        'accepted:' || (select response->'items'->0->>'revisionNumber' from sh_calls where label = 'rot'));
    raise exception 'sh_rollback';
  exception when others then
    if sqlerrm <> 'sh_rollback' then raise; end if;
  end;
  return outcome;
end;
$body$;
select is(
  pg_temp.sh_rotated('cms_editorial_history_cursor_retired_1',
    jsonb_build_object('limit', 25, 'state', 'approved', 'cursor', pg_temp.sh_cursor('a-1'))),
  'accepted:231',
  'a sealed cursor still opens under a freshly retired key for the rest of its lifetime [P2-S11-AC-086]');
select is(
  pg_temp.sh_rotated('unrelated_secret',
    jsonb_build_object('limit', 25, 'state', 'approved', 'cursor', pg_temp.sh_cursor('a-1'))),
  'CONFLICT',
  'a sealed cursor never opens under a Vault secret that is neither the active nor a retired history key [P2-S11-AC-086]');

select * from finish();
rollback;
