-- Slice 11 lane S11-3c: platform_api.cms_mint_preview (CMS-03B-08, E5; tracker P2-S11-AC-023 ..
-- AC-028, AC-117, AC-118).  A caller holding preview scope on a revision (entry assignee, active
-- reviewer assignee of a review of the revision, or owner-party publisher) mints a 15-minute token
-- bound to the person, user, acting context, revision, the full VersionSet, locale, audience, route,
-- expiry and a nonce.  The token is DERIVED (base64url HMAC-SHA-256 under the Vault history-signing
-- key over "cms.preview.token.v1" and the JCS { tokenId, nonce, entryId, revisionId }), never
-- stored: only its SHA-256 and the binding evidence are.  An exact replay re-derives the identical
-- token while it is unexpired and unrevoked; afterwards it is 409 preview_expired.  This file covers
-- the contract, the committed effects, the replay and the scopes; the refusals are in
-- phase_02_slice_11_rpc_preview_mint_refusals.sql.  RED before 20261005017860.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(37);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_11_rpc_review/000-world.sqlinc
\ir phase_02_slice_11_rpc_review/030-submit.sqlinc
\ir phase_02_slice_11_rpc_preview/000-world.sqlinc

create temp table r11_req(label text primary key, request jsonb not null) on commit drop;
create temp table r11_snap(label text primary key, effects text not null) on commit drop;

select pg_temp.r11p_key();
select pg_temp.r11_entry('mt-1');
select pg_temp.r11_entry('mt-2');
select pg_temp.r11_entry('mt-3');
select pg_temp.r11_entry('mt-4');
select pg_temp.r11_entry('mt-5');

select ok(pg_temp.r11_posture('platform_private', 'cms_mint_preview(jsonb)'),
  'cms_mint_preview is a private SECURITY DEFINER of the CMS definer (empty search_path) that no API role, service_role included, can execute [P2-S11-AC-028]');
select ok(pg_temp.r11_posture('platform_api', 'cms_mint_preview(jsonb)'),
  'the platform_api wrapper is a SECURITY DEFINER of the CMS definer, executable by service_role only, not by PUBLIC, anon or authenticated [P2-S11-AC-028]');

-- ---------------------------------------------------------------------------
-- The committed result.
-- ---------------------------------------------------------------------------
insert into r11_req(label, request) values ('m1', pg_temp.r11p_mreq('mt-1'));
insert into r11_snap(label, effects) values ('before-m1', pg_temp.r11p_effects());
select set_config('response.headers', '', true);
select pg_temp.r11p_mcall('m1', 'owner', (select request from r11_req where label = 'm1'));
select is(pg_temp.r11_out('m1'), '00000:', 'an entry assignee mints a preview token [P2-S11-AC-023]');
select is(pg_temp.r11_keys(pg_temp.r11_resp('m1')),
  'audience,entryId,expiresAt,locale,revisionId,revoked,route,token,versionSet',
  'the response is exactly PreviewTokenResource (9 members) [P2-S11-AC-023]');
select ok(
  pg_temp.r11_resp('m1')->>'token' ~ '^[A-Za-z0-9_-]{43}$'
    and pg_temp.r11_resp('m1')->>'entryId' = pg_temp.h11w_uuid('mt-1:entry')::text
    and pg_temp.r11_resp('m1')->>'revisionId' = pg_temp.h11w_uuid('mt-1:revision')::text
    and pg_temp.r11_resp('m1')->>'locale' = 'en-US' and pg_temp.r11_resp('m1')->>'audience' = 'public'
    and pg_temp.r11_resp('m1')->>'route' = '/preview/article'
    and pg_temp.r11_resp('m1')->'versionSet' = (select request->'versionSet' from r11_req where label = 'm1')
    and pg_temp.r11_resp('m1')->'revoked' = 'false'::jsonb,
  'the token is 43 unpadded base64url characters and the resource echoes the exact binding with revoked false [P2-S11-AC-117]');
select ok(
  (select tk.expires_at = tk.created_at + interval '900 seconds'
          and tk.created_at between clock_timestamp() - interval '2 minutes' and clock_timestamp()
          and pg_temp.r11_resp('m1')->>'expiresAt' = platform_private.auth_iso_time(tk.expires_at)
     from (select (pg_temp.r11p_row(pg_temp.r11_resp('m1')->>'token')).*) tk),
  'the token expires exactly 900 seconds after it was created and the resource reports that instant [P2-S11-AC-117]');
select ok(
  (select pg_temp.r11_resp('m1')->>'token' = pg_temp.r11p_derive(tk.id, tk.nonce, tk.entry_id, tk.revision_id)
     from (select (pg_temp.r11p_row(pg_temp.r11_resp('m1')->>'token')).*) tk),
  'the token is the HMAC-SHA-256 of "cms.preview.token.v1" and the JCS { tokenId, nonce, entryId, revisionId } under the Vault key, recomputed by an independent oracle [P2-S11-AC-117]');
select ok(
  (select tk.token_hash = pg_temp.h11_sha256(pg_temp.r11_resp('m1')->>'token')
          and tk.person_id = pg_temp.s11_id('creator')
          and tk.user_id = (select auth_user_id from r11_actor where key = 'owner')
          and tk.acting_party_id = pg_temp.s11_id('org') and tk.owner_id = pg_temp.s11_id('org')
          and tk.entry_id = pg_temp.h11w_uuid('mt-1:entry') and tk.revision_id = pg_temp.h11w_uuid('mt-1:revision')
          and tk.capability_snapshot_hash = platform_private.cms_acting_context_version(pg_temp.s11_id('creator'), pg_temp.s11_id('org'))
          and tk.version_set = (select request->'versionSet' from r11_req where label = 'm1')
          and tk.locale = 'en-US' and tk.audience = 'public' and tk.route = '/preview/article'
          and tk.state = 'active' and tk.version = 1 and tk.revoked_at is null and tk.nonce is not null
          and tk.updated_at = tk.created_at
     from (select (pg_temp.r11p_row(pg_temp.r11_resp('m1')->>'token')).*) tk),
  'the row holds the server-derived person, user and acting context, the capability snapshot (BE04c actingContextVersion), the exact binding, state active at version 1 and only the token SHA-256 [P2-S11-AC-118]');
select ok(
  not exists (select 1 from platform_private.cms_preview_tokens token_row where token_row.id is not null and to_jsonb(token_row)::text like '%' || (pg_temp.r11_resp('m1')->>'token') || '%')
    and not exists (select 1 from platform_private.idempotency_records record where record.response_ref::text like '%' || (pg_temp.r11_resp('m1')->>'token') || '%')
    and not exists (select 1 from audit_private.audit_events audit where to_jsonb(audit)::text like '%' || (pg_temp.r11_resp('m1')->>'token') || '%')
    and not exists (select 1 from platform_private.outbox_events event where to_jsonb(event)::text like '%' || (pg_temp.r11_resp('m1')->>'token') || '%'),
  'the plaintext token is persisted nowhere: not in the token table, the idempotency record, the audit trail or the outbox [P2-S11-AC-117]');
select ok(
  not pg_temp.r11_leaks(pg_temp.r11_resp('m1'), array[
    pg_temp.s11_id('creator')::text, pg_temp.s11_id('org')::text, (select auth_user_id::text from r11_actor where key = 'owner'),
    (select token_hash from platform_private.cms_preview_tokens where entry_id = pg_temp.h11w_uuid('mt-1:entry') limit 1),
    platform_private.cms_acting_context_version(pg_temp.s11_id('creator'), pg_temp.s11_id('org'))]),
  'the resource carries no person, account, acting-party, token-hash or capability-snapshot identifier [P2-S11-AC-025]');
select ok(
  (select count(*) = 1 from audit_private.audit_events audit
    where audit.action = 'cms.preview.mint' and audit.target_type = 'cms_preview_token'
      and audit.target_id = (select id from (select (pg_temp.r11p_row(pg_temp.r11_resp('m1')->>'token')).*) tk)
      and audit.actor_id = (select auth_user_id from r11_actor where key = 'owner')
      and audit.acting_party_id = pg_temp.s11_id('org') and audit.reason_code = 'CMS_PREVIEW_MINTED')
    and (select count(*) from platform_private.outbox_events) = (select split_part(effects, '/', 5)::bigint from r11_snap where label = 'before-m1'),
  'exactly one audit record commits and NO outbox event is emitted (BE03b: audit, no outbox) [P2-S11-AC-028]');
select is(pg_temp.s10_reservation_status((select request->>'idempotencyKey' from r11_req where label = 'm1')), 'completed',
  'the idempotency reservation is completed with the command [P2-S11-AC-026]');
select ok(
  (select count(*) = 1 from platform_private.idempotency_records record
    where record.operation = 'CMS-03B-08' and record.state = 'completed'
      and not (record.response_ref::text like '%' || (pg_temp.r11_resp('m1')->>'token') || '%')),
  'the stored idempotent response is the resource WITHOUT the token (the token is re-derived on replay) [P2-S11-AC-117]');
select ok(
  platform_private.cms_revision_effective_state(pg_temp.h11w_uuid('mt-1:revision')) = 'draft'
    and (select version = 1 and updated_at = created_at from platform_private.cms_content_entries where id = pg_temp.h11w_uuid('mt-1:entry'))
    and not exists (select 1 from platform_private.cms_editorial_reviews where entry_id = pg_temp.h11w_uuid('mt-1:entry')),
  'minting changes nothing else: the entry, the revision''s derived state and the reviews are untouched [P2-S11-AC-023]');

-- A minted token verifies end to end (CMS-03B-19) for its minting person and context.
select ok(
  (select platform_api.cms_verify_preview_token(jsonb_build_object(
      'tokenHash', pg_temp.h11_sha256(pg_temp.r11_resp('m1')->>'token'), 'actorPersonId', pg_temp.s11_id('creator'),
      'actingContextVersion', platform_private.cms_acting_context_version(pg_temp.s11_id('creator'), pg_temp.s11_id('org')),
      'route', '/preview/article', 'locale', 'en-US', 'audience', 'public'))->>'valid') = 'true',
  'the minted token verifies through cms_verify_preview_token for its person, acting-context version, route, locale and audience [P2-S11-AC-074]');

-- ---------------------------------------------------------------------------
-- Replay.
-- ---------------------------------------------------------------------------
insert into r11_snap(label, effects) values ('after-m1', pg_temp.r11p_effects());
select set_config('response.headers', '', true);
select pg_temp.r11p_mcall('m1-replay', 'owner', (select request from r11_req where label = 'm1'));
select ok(pg_temp.r11_out('m1-replay') = '00000:' and pg_temp.r11_resp('m1-replay') = pg_temp.r11_resp('m1')
    and pg_temp.r11p_effects() = (select effects from r11_snap where label = 'after-m1'),
  'an exact replay re-derives the identical token (same resource) and adds no second token row, audit record, reservation or event [P2-S11-AC-117]');
select ok(coalesce(current_setting('response.headers', true), '') like '%x-cms-idempotent-replay%',
  'the replay is marked with the x-cms-idempotent-replay response header [P2-S11-AC-026]');
select pg_temp.r11p_mcall('m1-mismatch', 'owner', jsonb_set((select request from r11_req where label = 'm1'), '{route}', '"/preview/other"'));
select is(pg_temp.r11_out('m1-mismatch'), 'P0001:IDEMPOTENCY_MISMATCH', 'the same key with a changed request is IDEMPOTENCY_MISMATCH [P2-S11-AC-026]');

-- The entry moving on does not break an exact replay (the CAS ran once, at the original mint).
select pg_temp.h11_raw_exec('platform_private.cms_content_entries',
  format($$update platform_private.cms_content_entries set version = version + 1, updated_at = clock_timestamp() where id = %L$$,
         pg_temp.h11w_uuid('mt-1:entry')));
select pg_temp.r11p_mcall('m1-replay-moved', 'owner', (select request from r11_req where label = 'm1'));
select ok(pg_temp.r11_out('m1-replay-moved') = '00000:' and pg_temp.r11_resp('m1-replay-moved') = pg_temp.r11_resp('m1'),
  'an exact replay after the entry version moved still returns the same token: replay is answered before the If-Match check [P2-S11-AC-026]');

-- A new key mints a new, independent token.
insert into r11_req(label, request) values ('m1b', pg_temp.r11p_mreq('mt-1'));
select pg_temp.r11p_mcall('m1b', 'owner', (select request from r11_req where label = 'm1b'));
select ok(pg_temp.r11_out('m1b') = '00000:' and pg_temp.r11_resp('m1b')->>'token' <> pg_temp.r11_resp('m1')->>'token'
    and (select count(*) from platform_private.cms_preview_tokens where entry_id = pg_temp.h11w_uuid('mt-1:entry')) = 2,
  'a new Idempotency-Key mints a new token with a fresh nonce; both tokens stay valid until their own expiry [P2-S11-AC-117]');

-- Replay after expiry or revocation is 409 preview_expired (the old token is never re-issued).
insert into r11_req(label, request) values ('m2', pg_temp.r11p_mreq('mt-2'));
select pg_temp.r11p_mcall('m2', 'owner', (select request from r11_req where label = 'm2'));
select pg_temp.h11_raw_exec('platform_private.cms_preview_tokens',
  format($$update platform_private.cms_preview_tokens
              set created_at = created_at - interval '16 minutes', updated_at = updated_at - interval '16 minutes',
                  expires_at = expires_at - interval '16 minutes'
            where token_hash = %L$$, pg_temp.h11_sha256(pg_temp.r11_resp('m2')->>'token')));
select pg_temp.r11p_mcall('m2-expired', 'owner', (select request from r11_req where label = 'm2'));
select is(pg_temp.r11_out('m2-expired'), 'P0001:preview_expired',
  'a replay after the token expired is the typed preview_expired (a new key mints a new token) [P2-S11-AC-117]');
insert into r11_req(label, request) values ('m3', pg_temp.r11p_mreq('mt-3'));
select pg_temp.r11p_mcall('m3', 'owner', (select request from r11_req where label = 'm3'));
select pg_temp.r11p_revoke_hash(pg_temp.h11_sha256(pg_temp.r11_resp('m3')->>'token'));
select pg_temp.r11p_mcall('m3-revoked', 'owner', (select request from r11_req where label = 'm3'));
select is(pg_temp.r11_out('m3-revoked'), 'P0001:preview_expired',
  'a replay after the token was revoked is the typed preview_expired [P2-S11-AC-117]');

-- Key rotation: a token minted under the old key re-derives under the freshly retired key.
insert into r11_req(label, request) values ('m4', pg_temp.r11p_mreq('mt-4'));
select pg_temp.r11p_mcall('m4', 'owner', (select request from r11_req where label = 'm4'));
select vault.update_secret((select id from vault.secrets where name = 'cms_editorial_history_cursor_active'),
  new_name => 'cms_editorial_history_cursor_retired_pgtap');
select vault.create_secret(repeat('b2', 32), 'cms_editorial_history_cursor_active', 'pgTAP rotated preview key');
select pg_temp.r11p_mcall('m4-rotated', 'owner', (select request from r11_req where label = 'm4'));
select ok(pg_temp.r11_out('m4-rotated') = '00000:' and pg_temp.r11_resp('m4-rotated') = pg_temp.r11_resp('m4'),
  'after a key rotation an exact replay still re-derives the same token under the freshly retired key [P2-S11-AC-117]');
select vault.update_secret((select id from vault.secrets where name = 'cms_editorial_history_cursor_retired_pgtap'),
  new_name => 'cms_unrelated_pgtap_secret');
select pg_temp.r11p_mcall('m4-lost', 'owner', (select request from r11_req where label = 'm4'));
select is(pg_temp.r11_out('m4-lost'), 'P0001:preview_expired',
  'when no current key reproduces the stored hash the replay is preview_expired, never a different token [P2-S11-AC-117]');
select pg_temp.r11p_mcall('m4-new-key', 'owner', pg_temp.r11p_mreq('mt-4'));
select ok(pg_temp.r11_out('m4-new-key') = '00000:'
    and pg_temp.r11_resp('m4-new-key')->>'token' = (select pg_temp.r11p_derive(tk.id, tk.nonce, tk.entry_id, tk.revision_id, repeat('b2', 32))
       from (select (pg_temp.r11p_row(pg_temp.r11_resp('m4-new-key')->>'token')).*) tk),
  'a fresh mint after the rotation derives under the NEW active key [P2-S11-AC-117]');

-- ---------------------------------------------------------------------------
-- Preview scopes.
-- ---------------------------------------------------------------------------
select pg_temp.h11r_review('mt-review', jsonb_build_object(
  'revision_id', pg_temp.h11w_uuid('mt-5:revision'), 'entry_id', pg_temp.h11w_uuid('mt-5:entry')));
select pg_temp.h11r_assign('mt-review-asg', 'mt-review', 'rvA');
select pg_temp.r11p_mcall('s-assignee-editor', 'editor', pg_temp.r11p_mreq('mt-5'));
select pg_temp.r11p_mcall('s-reviewer', 'rvA', pg_temp.r11p_mreq('mt-5'));
select pg_temp.r11p_mcall('s-publisher', 'pub', pg_temp.r11p_mreq('mt-5'));
select ok(
  pg_temp.r11_out('s-assignee-editor') = '00000:' and pg_temp.r11_out('s-reviewer') = '00000:' and pg_temp.r11_out('s-publisher') = '00000:',
  'an entry editor assignee, an active reviewer assignee of a review of the revision and an owner-party publisher each mint [P2-S11-AC-025]');
select ok(
  (select count(*) = 3 and count(distinct person_id) = 3 and bool_and(owner_id = pg_temp.s11_id('org'))
     from platform_private.cms_preview_tokens where entry_id = pg_temp.h11w_uuid('mt-5:entry'))
    and (select person_id from platform_private.cms_preview_tokens where token_hash = pg_temp.h11_sha256(pg_temp.r11_resp('s-publisher')->>'token')) = pg_temp.s11_id('pub')
    and (select capability_snapshot_hash from platform_private.cms_preview_tokens where token_hash = pg_temp.h11_sha256(pg_temp.r11_resp('s-reviewer')->>'token'))
        = platform_private.cms_acting_context_version(pg_temp.s11_id('rvA'), pg_temp.s11_id('org')),
  'each token is bound to its own minting person and that person''s capability snapshot [P2-S11-AC-118]');
select ok(
  (select count(*) = 5 from platform_private.cms_preview_tokens token_row
     where token_row.entry_id in (pg_temp.h11w_uuid('mt-1:entry'), pg_temp.h11w_uuid('mt-5:entry'))
       and token_row.state = 'active' and token_row.expires_at > clock_timestamp()
       and platform_private.cms_preview_scope_holds(token_row.person_id, token_row.acting_party_id, token_row.entry_id, token_row.revision_id)),
  'every minted token of the suite is live and its minting scope holds (control for the revocation cases of the refusal suite)');

select * from finish();
rollback;
