-- Slice 10 Round 2 item 3 (Codex SQL review 3, finding 3): CMS-03B-13 keyset pagination
-- under concurrent updates.
--
-- The list is ordered by the spec's mutable (updatedAt DESC, entryId DESC).  Before
-- the fix an entry that was UPDATED between two pages could move ahead of the cursor
-- and be listed on no later page of that walk (fetch page one, update an unseen older
-- entry so its updated_at is newer than the cursor, fetch page two: the exclusive
-- `< cursor` predicate omits it).  The cursor now carries the collection epoch
-- (`aheadDigest`, the digest of the entries at or before the last row); a resumed read
-- recomputes it in the same statement as the page and answers 409 CONFLICT when the
-- set changed (DEC-140: restart from the first page).  Every "concurrent" change here
-- is a committed write between two reader calls, which is exactly what a second
-- session's commit between two HTTP requests is.
--
--   A  an unseen older entry updated ahead of the cursor    -> CONFLICT, restart lists it first
--   B  a SEEN entry updated                                  -> no conflict, no repeat, no gap
--   C  an unseen entry updated but still behind the cursor  -> no conflict, listed in its new place
--   D  a new entry created ahead of the cursor               -> CONFLICT
--   E  a seen entry leaves the collection (assignment revoked) -> CONFLICT
--   F  an unseen entry behind the cursor leaves              -> no conflict, simply absent
--   G  the caller loses every assignment mid-walk            -> CONFLICT (restart lists nothing)
--   H  cursor payload shape: aheadDigest required, 32 lowercase hex; a wrong digest is a
--      CONFLICT, a malformed or missing one is INVALID_REQUEST; the signed envelope still
--      fits the 512-character contract.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);

\ir phase_02_slice_10_entry_list_keyset/000-helpers.sqlinc

-- K1..K4, K7 and the 001 entry (301) are the creator's authorized entries; K5 (revoked
-- assignment) and K6 (archived) are never listed.
select pg_temp.s10k_seed('a9100000-0000-4000-8000-0000000e0001', 'a9100000-0000-4000-8000-0000000e1001', timestamptz '2026-10-01T12:00:07Z', 'cms.author', 'active', 'active', 'draft');
select pg_temp.s10k_seed('a9100000-0000-4000-8000-0000000e0002', 'a9100000-0000-4000-8000-0000000e1002', timestamptz '2026-10-01T12:00:06Z', 'cms.author', 'active', 'active', 'draft');
select pg_temp.s10k_seed('a9100000-0000-4000-8000-0000000e0003', 'a9100000-0000-4000-8000-0000000e1003', timestamptz '2026-10-01T12:00:05Z', 'cms.author', 'active', 'active', 'draft');
select pg_temp.s10k_seed('a9100000-0000-4000-8000-0000000e0004', 'a9100000-0000-4000-8000-0000000e1004', timestamptz '2026-10-01T12:00:04Z', 'cms.editor', 'active', 'active', 'draft');
select pg_temp.s10k_seed('a9100000-0000-4000-8000-0000000e0005', 'a9100000-0000-4000-8000-0000000e1005', timestamptz '2026-10-01T12:00:03Z', 'cms.author', 'revoked', 'active', 'draft');
select pg_temp.s10k_seed('a9100000-0000-4000-8000-0000000e0006', 'a9100000-0000-4000-8000-0000000e1006', timestamptz '2026-10-01T12:00:02Z', 'cms.author', 'active', 'archived', 'draft');
select pg_temp.s10k_seed('a9100000-0000-4000-8000-0000000e0007', 'a9100000-0000-4000-8000-0000000e1007', timestamptz '2026-10-01T12:00:01Z', 'cms.author', 'active', 'active', 'approved');
select set_config('app.cms_rpc', 'true', true);
update platform_private.cms_content_entries set updated_at = timestamptz '2026-09-26T12:00:00Z'
 where id = 'a9100000-0000-4000-8000-000000000301';

-- A committed change by "another session": touches an entry's updated_at (a write
-- by its editor) or its assignment.
create or replace function pg_temp.s10e_touch(p_entry text, p_updated timestamptz)
returns void language plpgsql as $body$
begin
  perform set_config('app.cms_rpc', 'true', true);
  update platform_private.cms_content_entries
     set updated_at = p_updated, version = version + 1
   where id = p_entry::uuid;
end;
$body$;
create or replace function pg_temp.s10e_revoke(p_entry text)
returns void language plpgsql as $body$
begin
  perform set_config('app.cms_rpc', 'true', true);
  update platform_private.cms_entry_assignments
     set state = 'revoked', version = version + 1
   where entry_id = p_entry::uuid;
end;
$body$;
create or replace function pg_temp.s10e_cursor(p_label text)
returns text language sql stable as $body$
  select response->>'nextCursor' from s10k_calls where label = p_label
$body$;
create or replace function pg_temp.s10e_page(p_label text, p_limit integer, p_cursor_label text default null)
returns void language plpgsql as $body$
begin
  perform pg_temp.s10k_list(p_label,
    case when p_cursor_label is null then jsonb_build_object('limit', p_limit)
         else jsonb_build_object('limit', p_limit, 'cursor', pg_temp.s10e_cursor(p_cursor_label)) end);
end;
$body$;
create or replace function pg_temp.s10e_msg(p_label text)
returns text language sql stable as $body$
  select message from s10k_calls where label = p_label
$body$;

-- ---- baseline: an unchanged walk pages the six authorized entries, no gap, no repeat ----
select pg_temp.s10e_page('base-1', 2);
select pg_temp.s10e_page('base-2', 2, 'base-1');
select pg_temp.s10e_page('base-3', 2, 'base-2');
select is(
  pg_temp.s10k_ids('base-1') || '|' || pg_temp.s10k_ids('base-2') || '|' || pg_temp.s10k_ids('base-3'),
  'a9100000-0000-4000-8000-0000000e0001,a9100000-0000-4000-8000-0000000e0002|a9100000-0000-4000-8000-0000000e0003,a9100000-0000-4000-8000-0000000e0004|a9100000-0000-4000-8000-0000000e0007,a9100000-0000-4000-8000-000000000301',
  'an unchanged walk lists the six authorized entries newest first without a gap or a repeat');
select is(
  (select count(*)::integer from s10k_calls where label like 'base-%' and message is not null), 0,
  'an unchanged walk raises nothing');

-- ---- H: the cursor payload and its size ----
select ok(
  convert_from(decode(pg_temp.s10e_cursor('base-1'), 'base64'), 'utf8')::jsonb ?& array['queryHash','lastUpdatedAt','lastEntryId','aheadDigest','expiresAt']
  and (select count(*) from jsonb_object_keys(convert_from(decode(pg_temp.s10e_cursor('base-1'), 'base64'), 'utf8')::jsonb)) = 5
  and convert_from(decode(pg_temp.s10e_cursor('base-1'), 'base64'), 'utf8')::jsonb->>'aheadDigest' ~ '^[0-9a-f]{32}$',
  'H: the unsigned keyset payload is exactly {queryHash, lastUpdatedAt, lastEntryId, aheadDigest, expiresAt} with a 32-character hex digest');
select cmp_ok(
  octet_length(replace(encode(convert_to(platform_private.cms_jcs(
    convert_from(decode(pg_temp.s10e_cursor('base-1'), 'base64'), 'utf8')::jsonb
    || jsonb_build_object('keyId', 'a9100000-0000-4000-8000-0000000000aa', 'signature', repeat('a', 64))
  ), 'utf8'), 'base64'), E'\n', '')), '<=', 512,
  'H: the signed envelope (payload + keyId + signature) of an entry-list cursor fits the 512-character contract');
select isnt(
  convert_from(decode(pg_temp.s10e_cursor('base-1'), 'base64'), 'utf8')::jsonb->>'aheadDigest',
  convert_from(decode(pg_temp.s10e_cursor('base-2'), 'base64'), 'utf8')::jsonb->>'aheadDigest',
  'H: the digest moves with the cursor position (two different leading sets)');

-- ---- A: an unseen older entry is updated ahead of the cursor ----
select pg_temp.s10e_page('a-1', 2);
select pg_temp.s10e_touch('a9100000-0000-4000-8000-0000000e0004', timestamptz '2026-10-01T12:00:09Z');
select pg_temp.s10e_page('a-2', 2, 'a-1');
select is(pg_temp.s10e_msg('a-2'), 'CONFLICT',
  'A: an unseen entry updated ahead of the cursor between two pages is a 409 CONFLICT, never a silent skip');
select is(pg_temp.s10k_ids('a-2'), '', 'A: the conflicted page lists nothing');
select pg_temp.s10e_page('a-restart', 2);
select is(pg_temp.s10k_ids('a-restart'),
  'a9100000-0000-4000-8000-0000000e0004,a9100000-0000-4000-8000-0000000e0001',
  'A: restarting from the first page lists the updated entry first');

-- ---- B: a seen entry is updated ----
-- the restarted first page is [E4(09), E1(07)]; its epoch is {E4, E1}
select pg_temp.s10e_touch('a9100000-0000-4000-8000-0000000e0001', timestamptz '2026-10-01T12:00:10Z');
select pg_temp.s10e_page('b-2', 2, 'a-restart');
select is(pg_temp.s10e_msg('b-2'), null, 'B: updating an entry the walk already passed is not a conflict');
select is(pg_temp.s10k_ids('b-2'),
  'a9100000-0000-4000-8000-0000000e0002,a9100000-0000-4000-8000-0000000e0003',
  'B: the walk continues with the next unseen entries: no repeat of the updated entry, no gap');

-- ---- C: an unseen entry is updated but stays behind the cursor ----
-- b-2 ended at E3(05); E7 is touched to 12:00:02 (still older than E3)
select pg_temp.s10e_touch('a9100000-0000-4000-8000-0000000e0007', timestamptz '2026-10-01T12:00:02Z');
select pg_temp.s10e_page('c-3', 2, 'b-2');
select is(pg_temp.s10e_msg('c-3'), null, 'C: an unseen entry updated but still behind the cursor is not a conflict');
select is(pg_temp.s10k_ids('c-3'),
  'a9100000-0000-4000-8000-0000000e0007,a9100000-0000-4000-8000-000000000301',
  'C: the tail is listed in its current order (the touched entry still behind the cursor, then the 001 entry)');
select is((select response->>'nextCursor' from s10k_calls where label = 'c-3'), null,
  'C: the walk ends');

-- ---- D: a new entry appears ahead of the cursor ----
select pg_temp.s10e_page('d-1', 2);
select pg_temp.s10k_seed('a9100000-0000-4000-8000-0000000e0008', 'a9100000-0000-4000-8000-0000000e1008', timestamptz '2026-10-01T12:00:11Z', 'cms.author', 'active', 'active', 'draft');
select pg_temp.s10e_page('d-2', 2, 'd-1');
select is(pg_temp.s10e_msg('d-2'), 'CONFLICT', 'D: an entry created ahead of the cursor between two pages is a 409 CONFLICT');
select pg_temp.s10e_page('d-restart', 2);
select is(pg_temp.s10k_ids('d-restart'),
  'a9100000-0000-4000-8000-0000000e0008,a9100000-0000-4000-8000-0000000e0001',
  'D: restarting lists the new entry first');

-- ---- E: a seen entry leaves the collection ----
select pg_temp.s10e_revoke('a9100000-0000-4000-8000-0000000e0008');
select pg_temp.s10e_page('e-2', 2, 'd-restart');
select is(pg_temp.s10e_msg('e-2'), 'CONFLICT', 'E: an entry ahead of the cursor leaving the collection is a 409 CONFLICT');
select pg_temp.s10e_page('e-restart', 2);
select is(pg_temp.s10k_ids('e-restart'),
  'a9100000-0000-4000-8000-0000000e0001,a9100000-0000-4000-8000-0000000e0004',
  'E: restarting lists the remaining entries');

-- ---- F: an unseen entry behind the cursor leaves ----
select pg_temp.s10e_revoke('a9100000-0000-4000-8000-0000000e0003');
select pg_temp.s10e_page('f-2', 2, 'e-restart');
select is(pg_temp.s10e_msg('f-2'), null, 'F: an entry behind the cursor leaving the collection is not a conflict');
select is(pg_temp.s10k_ids('f-2'),
  'a9100000-0000-4000-8000-0000000e0002,a9100000-0000-4000-8000-0000000e0007',
  'F: the departed entry is simply absent, the rest continue in order');

-- ---- H (cont.): wrong, malformed and missing digests ----
create or replace function pg_temp.s10e_forge(p_label text, p_patch jsonb, p_drop text default null)
returns text language sql stable as $body$
  select replace(encode(convert_to(platform_private.cms_jcs(
    (convert_from(decode(pg_temp.s10e_cursor(p_label), 'base64'), 'utf8')::jsonb || p_patch)
      - coalesce(p_drop, '')), 'utf8'), 'base64'), E'\n', '')
$body$;
select pg_temp.s10e_page('h-seed', 2);
select pg_temp.s10k_list('h-wrong', jsonb_build_object('limit', 2,
  'cursor', pg_temp.s10e_forge('h-seed', jsonb_build_object('aheadDigest', repeat('0', 32)))));
select is(pg_temp.s10e_msg('h-wrong'), 'CONFLICT', 'H: a well-formed digest that does not match the collection is CONFLICT');
select pg_temp.s10k_list('h-malformed', jsonb_build_object('limit', 2,
  'cursor', pg_temp.s10e_forge('h-seed', jsonb_build_object('aheadDigest', 'not-a-digest'))));
select is(pg_temp.s10e_msg('h-malformed'), 'INVALID_REQUEST', 'H: a malformed digest is a structural fault: INVALID_REQUEST');
select pg_temp.s10k_list('h-upper', jsonb_build_object('limit', 2,
  'cursor', pg_temp.s10e_forge('h-seed', jsonb_build_object('aheadDigest', repeat('A', 32)))));
select is(pg_temp.s10e_msg('h-upper'), 'INVALID_REQUEST', 'H: an uppercase digest is a structural fault: INVALID_REQUEST');
select pg_temp.s10k_list('h-missing', jsonb_build_object('limit', 2,
  'cursor', pg_temp.s10e_forge('h-seed', '{}'::jsonb, 'aheadDigest')));
select is(pg_temp.s10e_msg('h-missing'), 'INVALID_REQUEST', 'H: a cursor without a digest (the previous payload shape) is INVALID_REQUEST');
select pg_temp.s10k_list('h-ok', jsonb_build_object('limit', 2,
  'cursor', pg_temp.s10e_forge('h-seed', '{}'::jsonb)));
select is(pg_temp.s10e_msg('h-ok'), null, 'H: a re-encoded but unchanged cursor is accepted (the digest is stable)');

-- ---- G: the caller loses every assignment mid-walk ----
select pg_temp.s10e_page('g-1', 2);
select pg_temp.s10e_revoke('a9100000-0000-4000-8000-0000000e0001');
select pg_temp.s10e_revoke('a9100000-0000-4000-8000-0000000e0002');
select pg_temp.s10e_revoke('a9100000-0000-4000-8000-0000000e0004');
select pg_temp.s10e_revoke('a9100000-0000-4000-8000-0000000e0007');
select pg_temp.s10e_revoke('a9100000-0000-4000-8000-000000000301');
select pg_temp.s10e_page('g-2', 2, 'g-1');
select is(pg_temp.s10e_msg('g-2'), 'CONFLICT', 'G: a caller whose collection emptied mid-walk gets CONFLICT, never a stale continuation');
select pg_temp.s10e_page('g-restart', 2);
select is(pg_temp.s10k_ids('g-restart'), '', 'G: the restart lists nothing');
select is((select response->>'nextCursor' from s10k_calls where label = 'g-restart'), null, 'G: and carries no cursor');

select is(
  (select string_agg(label || ': ' || message, ', ' order by label) from s10k_calls
    where message is not null and label !~ '^(a-2|d-2|e-2|g-2|h-wrong|h-malformed|h-upper|h-missing)$'),
  null, 'no reader call outside the intended refusals raised an error');

select * from finish();
rollback;
