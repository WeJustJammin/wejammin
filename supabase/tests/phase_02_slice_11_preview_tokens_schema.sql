-- Slice 11 data model, lane S11-2: the PreviewToken record (BE03b "Preview token
-- and verification", Database Schema "PreviewToken"; tracker P2-S11-AC-117,
-- AC-118).  The token plaintext is derived and never stored: the row holds only
-- token_hash and the binding evidence.  RED before 20261005017090, GREEN after.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(40);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc

insert into s11_ids(key, value) values
  ('token1', 'a9110000-0000-4000-8000-000000000801'),
  ('token2', 'a9110000-0000-4000-8000-000000000802');

create or replace function pg_temp.s11_tok_bare(p_overrides jsonb)
returns text
language sql
as $body$
  select pg_temp.s11_bare_outcome('platform_private.cms_preview_tokens',
    pg_temp.s11_insert_sql('platform_private.cms_preview_tokens', pg_temp.s11_token_row(p_overrides)))
$body$;

create or replace function pg_temp.s11_tok_ins(p_overrides jsonb)
returns text
language sql
as $body$
  select pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_preview_tokens', pg_temp.s11_token_row(p_overrides)))
$body$;

create or replace function pg_temp.s11_tok_upd(p_id uuid, p_set text)
returns text
language sql
as $body$
  select format('update platform_private.cms_preview_tokens set %s where id = %L', p_set, p_id)
$body$;

-- ---------------------------------------------------------------------------
-- Shape.
-- ---------------------------------------------------------------------------
select ok(
  pg_temp.s10r_column_type('platform_private.cms_preview_tokens', 'person_id') = 'uuid'
    and pg_temp.s10r_col_notnull('platform_private.cms_preview_tokens', 'person_id')
    and pg_temp.s10r_fk_target('platform_private.cms_preview_tokens', 'person_id')
      = 'platform_private.person_party.party_id'
    and pg_temp.s10r_fk_target('platform_private.cms_preview_tokens', 'user_id') = 'auth.users.id',
  'token: the canonical person (the BE04c userId) is bound beside the auth user [P2-S11-AC-118]'
);

select ok(
  pg_temp.s11_constraint_has('platform_private.cms_preview_tokens', 'cms_preview_tokens_state_check',
    array['active', 'revoked'])
    and pg_temp.s11_condef('platform_private.cms_preview_tokens', 'cms_preview_tokens_state_check') !~ 'expired'
    and pg_temp.s11_constraint_has('platform_private.cms_preview_tokens', 'cms_preview_tokens_expiry_check',
      array['expires_at = (created_at + ''00:15:00''::interval)'])
    and pg_temp.s11_constraint_has('platform_private.cms_preview_tokens', 'cms_preview_tokens_revoked_state_check',
      array['state = ''revoked''', 'revoked_at IS NOT NULL']),
  'token: the physical state is active|revoked (expired is derived), expiry is exactly 15 minutes and revoked_at tracks the state [P2-S11-AC-117]'
);

select ok(
  pg_temp.s11_constraint_has('platform_private.cms_preview_tokens', 'cms_preview_tokens_entry_owner_fkey',
    array['FOREIGN KEY (entry_id, owner_id)', 'cms_content_entries(id, owner_id)'])
    and pg_temp.s11_constraint_has('platform_private.cms_preview_tokens', 'cms_preview_tokens_revision_entry_fkey',
      array['FOREIGN KEY (revision_id, entry_id)', 'cms_entry_revisions(id, entry_id)'])
    and pg_temp.s11_constraint_has('platform_private.cms_preview_tokens', 'cms_preview_tokens_token_hash_unique',
      array['UNIQUE (token_hash)'])
    and pg_temp.s11_index_has('platform_private.cms_preview_tokens', 'cms_preview_tokens_person_expires_idx',
      array['(person_id, expires_at)'])
    and pg_temp.s11_index_has('platform_private.cms_preview_tokens', 'cms_preview_tokens_entry_state_idx',
      array['(entry_id, state)'])
    and pg_temp.s11_index_has('platform_private.cms_preview_tokens', 'cms_preview_tokens_expires_live_idx',
      array['(expires_at)', 'revoked_at IS NULL']),
  'token: entry owner and revision-of-entry keys, the unique token hash and the person, entry-state and live-expiry indexes [P2-S11-AC-117]'
);

-- ---------------------------------------------------------------------------
-- Constraints in isolation.
-- ---------------------------------------------------------------------------
select is(pg_temp.s11_tok_bare('{}'::jsonb), '00000',
  'token: control - the canonical active token image with a 15-minute expiry is accepted [P2-S11-AC-117]');
select is(pg_temp.s11_tok_bare('{"state":"expired"}'::jsonb), '23514',
  'token: expired is derived from expires_at and never stored [P2-S11-AC-117]');
select is(pg_temp.s11_tok_bare('{"expires_at":"2026-10-01T16:14:59Z"}'::jsonb), '23514',
  'token: the expiry is not earlier than exactly 900 seconds after creation [P2-S11-AC-117]');
select is(pg_temp.s11_tok_bare('{"expires_at":"2026-10-01T16:15:01Z"}'::jsonb), '23514',
  'token: the expiry is not later than exactly 900 seconds after creation [P2-S11-AC-117]');
select is(pg_temp.s11_tok_bare('{"state":"revoked"}'::jsonb), '23514',
  'token: a revoked token records when it was revoked [P2-S11-AC-118]');
select is(pg_temp.s11_tok_bare('{"revoked_at":"2026-10-01T16:05:00Z"}'::jsonb), '23514',
  'token: an active token records no revocation [P2-S11-AC-118]');
select is(pg_temp.s11_tok_bare('{"state":"revoked","revoked_at":"2026-10-01T16:05:00Z","version":2}'::jsonb), '00000',
  'token: control - a revoked token with its revocation instant is accepted [P2-S11-AC-118]');
select is(pg_temp.s11_tok_bare('{"audience":"Public"}'::jsonb), '23514',
  'token: the audience follows ^[a-z0-9_-]{1,48}$ (E4) [P2-S11-AC-117]');
select is(pg_temp.s11_tok_bare(jsonb_build_object('audience', repeat('a', 49))), '23514',
  'token: the audience is at most 48 characters [P2-S11-AC-117]');
select is(pg_temp.s11_tok_bare('{"token_hash":"ABCDEF"}'::jsonb), '23514',
  'token: only the lowercase SHA-256 of the token is stored, never the plaintext [P2-S11-AC-117]');
select is(pg_temp.s11_tok_bare('{"route":"preview/article"}'::jsonb), '23514',
  'token: the bound route is an internal path starting with a slash [P2-S11-AC-117]');
select is(pg_temp.s11_tok_bare(jsonb_build_object('route', '/' || repeat('a', 2047))), '00000',
  'token: control - a 2048-character route is accepted [P2-S11-AC-117]');
select is(pg_temp.s11_tok_bare(jsonb_build_object('route', '/' || repeat('a', 2048))), '23514',
  'token: a route of more than 2048 characters is refused [P2-S11-AC-117]');
select is(pg_temp.s11_tok_bare(jsonb_build_object('revision_id', pg_temp.s11_id('revB1'))), '23503',
  'token: a revision of another entry cannot be previewed under this entry [P2-S11-AC-117]');
select is(pg_temp.s11_tok_bare(jsonb_build_object('owner_id', pg_temp.s11_id('stranger'))), '23503',
  'token: the owner is the entry owner, never another party [P2-S11-AC-117]');
select is(pg_temp.s11_tok_bare(jsonb_build_object('person_id', gen_random_uuid())), '23503',
  'token: the bound person is a canonical person [P2-S11-AC-118]');

-- ---------------------------------------------------------------------------
-- Insert guard and CAS revocation (triggers enabled).
-- ---------------------------------------------------------------------------
select is(pg_temp.s11_tok_ins('{"state":"revoked","revoked_at":"2026-10-01T16:05:00Z"}'::jsonb),
  'P0001:VALIDATION_FAILED', 'token: a token is minted active [P2-S11-AC-117]');
select is(pg_temp.s11_tok_ins('{"version":2}'::jsonb),
  'P0001:VALIDATION_FAILED', 'token: a token is minted at version 1 [P2-S11-AC-117]');
select pg_temp.s11_archive_entry(pg_temp.s11_id('entryB'));
select is(pg_temp.s11_tok_ins(jsonb_build_object('entry_id', pg_temp.s11_id('entryB'), 'revision_id', pg_temp.s11_id('revB1'))),
  'P0001:entry_unavailable', 'token: no preview is minted for an entry that is no longer active [P2-S11-AC-118]');
select is(pg_temp.s11_tok_ins(jsonb_build_object('id', pg_temp.s11_id('token1'),
    'token_hash', pg_temp.s11_hex('token one'))), '00000',
  'token: an active token is minted with its binding evidence and only the token hash [P2-S11-AC-117]');
select is(pg_temp.s11_tok_ins(jsonb_build_object('id', pg_temp.s11_id('token2'),
    'token_hash', pg_temp.s11_hex('token one'))), '23505',
  'token: a token hash identifies exactly one token [P2-S11-AC-117]');

select is(pg_temp.s11_outcome(pg_temp.s11_tok_upd(pg_temp.s11_id('token1'), 'route = ''/preview/other'', state = ''revoked'', revoked_at = clock_timestamp(), version = 2, updated_at = clock_timestamp()')),
  'P0001:IMMUTABLE_RECORD', 'token: the bound route is immutable binding evidence [P2-S11-AC-117]');
select is(pg_temp.s11_outcome(pg_temp.s11_tok_upd(pg_temp.s11_id('token1'), 'expires_at = expires_at + interval ''1 minute'', created_at = created_at + interval ''1 minute'', state = ''revoked'', revoked_at = clock_timestamp(), version = 2, updated_at = clock_timestamp()')),
  'P0001:IMMUTABLE_RECORD', 'token: expiry and creation never move [P2-S11-AC-117]');
select is(pg_temp.s11_outcome(pg_temp.s11_tok_upd(pg_temp.s11_id('token1'), format('token_hash = %L, state = ''revoked'', revoked_at = clock_timestamp(), version = 2, updated_at = clock_timestamp()', pg_temp.s11_hex('another token')))),
  'P0001:IMMUTABLE_RECORD', 'token: the token hash never changes [P2-S11-AC-117]');
select is(pg_temp.s11_outcome(pg_temp.s11_tok_upd(pg_temp.s11_id('token1'), format('person_id = %L, state = ''revoked'', revoked_at = clock_timestamp(), version = 2, updated_at = clock_timestamp()', pg_temp.s11_id('editor')))),
  'P0001:IMMUTABLE_RECORD', 'token: the bound person never changes [P2-S11-AC-118]');
select is(pg_temp.s11_outcome(pg_temp.s11_tok_upd(pg_temp.s11_id('token1'), 'version_set = ''{}''::jsonb, state = ''revoked'', revoked_at = clock_timestamp(), version = 2, updated_at = clock_timestamp()')),
  'P0001:IMMUTABLE_RECORD', 'token: the bound version set never changes [P2-S11-AC-117]');
select is(pg_temp.s11_outcome(pg_temp.s11_tok_upd(pg_temp.s11_id('token1'), 'state = ''revoked'', revoked_at = clock_timestamp(), version = 3, updated_at = clock_timestamp()')),
  'P0001:CONFLICT', 'token: a revocation advances the CAS version by exactly one [P2-S11-AC-118]');
select is(pg_temp.s11_outcome(pg_temp.s11_tok_upd(pg_temp.s11_id('token1'), 'version = 2, updated_at = clock_timestamp()')),
  'P0001:CONFLICT', 'token: the only transition is active to revoked [P2-S11-AC-118]');
select is(pg_temp.s11_outcome(pg_temp.s11_tok_upd(pg_temp.s11_id('token1'), 'state = ''revoked'', revoked_at = clock_timestamp(), version = 2, updated_at = clock_timestamp()')),
  '00000', 'token: authority loss revokes by CAS (state revoked, revoked_at, version + 1) [P2-S11-AC-118]');
select is(pg_temp.s11_outcome(pg_temp.s11_tok_upd(pg_temp.s11_id('token1'), 'state = ''active'', revoked_at = null, version = 3, updated_at = clock_timestamp()')),
  'P0001:CONFLICT', 'token: a revoked token is never reactivated [P2-S11-AC-118]');
select is(pg_temp.s11_outcome(pg_temp.s11_tok_upd(pg_temp.s11_id('token1'), 'state = ''revoked'', revoked_at = clock_timestamp(), version = 3, updated_at = clock_timestamp()')),
  'P0001:CONFLICT', 'token: a second revocation of the same token is a CAS miss [P2-S11-AC-118]');
select is(pg_temp.s11_outcome(format('delete from platform_private.cms_preview_tokens where id = %L', pg_temp.s11_id('token1'))),
  'P0001:IMMUTABLE_RECORD', 'token: a token row is evidence and is never deleted [P2-S11-AC-117]');

select * from finish();
rollback;
