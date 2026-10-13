-- Slice 11 data model (BE03b "Preview token and verification", Database Schema
-- "PreviewToken"; tracker P2-S11-AC-117, AC-118): reconcile the Slice 10
-- foundation cms_preview_tokens (20260927090000) to the locked shape.
--
-- The token plaintext is DERIVED, never stored: base64url(HMAC-SHA-256(key,
-- "cms.preview.token.v1" || JCS{ tokenId, nonce, entryId, revisionId })) under the
-- Vault-held history-signing key, so an exact replay re-derives the identical
-- token while the row holds only token_hash (the lowercase SHA-256 of the token
-- string, UNIQUE) and the binding evidence.
--
--   * person_id: the canonical person (the BE04c userId) beside the auth user.
--   * the physical state is active | revoked; `expired` is derived from
--     expires_at.  expires_at is exactly created_at + 15 minutes (900 seconds, the
--     IA default and maximum) and revoked_at is stored exactly when the token is
--     revoked.  The audience follows the BE04c grammar ^[a-z0-9_-]{1,48}$ (E4).
--   * the route CHECK of the foundation (`^/[^[:cntrl:]]{0,2047}$`) could never be
--     evaluated: PostgreSQL caps a regex repetition count at 255, so EVERY insert
--     failed with 2201B (invalid_regular_expression) - invisible while no named
--     RPC wrote the table.  It is replaced by the same grammar stated with a
--     length bound: a path of 1..2048 characters that starts with `/` and holds no
--     control character.
--   * the entry owner and the revision-belongs-to-entry rule are composite keys;
--     the person and entry-state indexes of the locked schema.
--   * a state guard (defence in depth under cms_mint_preview and the authority-loss
--     cascades): a token is minted active at version 1 for an active entry; its
--     binding evidence (hash, entry, revision, person, user, acting party, capability
--     snapshot, version set, locale, audience, route, expiry, nonce, creation) never
--     changes; the only update is the CAS revocation active -> revoked with
--     version + 1 and revoked_at; a revoked token never reopens, and a token row is
--     never deleted.  A version-set movement revokes nothing (the preview is of that
--     exact set).  SECURITY INVOKER; it reads the entry.
-- The foundation holds no rows: nothing is back-filled.  Forward-only.
begin;

set local lock_timeout = '5s';

do $body$
begin
  if exists (select 1 from platform_private.cms_preview_tokens token_row) then
    raise exception 'CMS preview tokens pre-date the canonical person binding'
      using errcode = 'P0001';
  end if;
end;
$body$;

alter table platform_private.cms_preview_tokens
  add column person_id uuid not null;

alter table platform_private.cms_preview_tokens
  drop constraint cms_preview_tokens_state_check,
  drop constraint cms_preview_tokens_audience_check,
  drop constraint cms_preview_tokens_route_check;

alter table platform_private.cms_preview_tokens
  add constraint cms_preview_tokens_state_check
    check (state in ('active', 'revoked')),
  add constraint cms_preview_tokens_audience_check
    check (audience ~ '^[a-z0-9_-]{1,48}$'),
  add constraint cms_preview_tokens_route_check check (
    pg_catalog.char_length(route) between 1 and 2048
    and route ~ '^/[^[:cntrl:]]*$'
  ),
  add constraint cms_preview_tokens_expiry_check
    check (expires_at = created_at + interval '15 minutes'),
  add constraint cms_preview_tokens_revoked_state_check
    check ((state = 'revoked') = (revoked_at is not null)),
  add constraint cms_preview_tokens_person_id_fkey
    foreign key (person_id) references platform_private.person_party(party_id),
  add constraint cms_preview_tokens_entry_owner_fkey
    foreign key (entry_id, owner_id)
    references platform_private.cms_content_entries(id, owner_id),
  add constraint cms_preview_tokens_revision_entry_fkey
    foreign key (revision_id, entry_id)
    references platform_private.cms_entry_revisions(id, entry_id);

create index cms_preview_tokens_person_expires_idx
  on platform_private.cms_preview_tokens (person_id, expires_at);
create index cms_preview_tokens_entry_state_idx
  on platform_private.cms_preview_tokens (entry_id, state);

create or replace function platform_private.cms_preview_state_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
declare
  entry_lifecycle text;
begin
  if tg_op = 'DELETE' then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' then
    if (pg_catalog.to_jsonb(new) - 'state' - 'version' - 'revoked_at' - 'updated_at')
       is distinct from
       (pg_catalog.to_jsonb(old) - 'state' - 'version' - 'revoked_at' - 'updated_at') then
      raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
    end if;
    if old.state <> 'active'
       or new.state <> 'revoked'
       or new.version <> old.version + 1
       or new.updated_at < old.updated_at then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if new.state <> 'active' or new.version <> 1 or new.revoked_at is not null then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  select entry_item.lifecycle into entry_lifecycle
    from platform_private.cms_content_entries entry_item
   where entry_item.id = new.entry_id;
  if found and entry_lifecycle <> 'active' then
    raise exception 'entry_unavailable' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

-- Fires after cms_preview_tokens_write_guard (alphabetical order).
create trigger cms_preview_tokens_z_state_guard
before insert or update or delete on platform_private.cms_preview_tokens
for each row execute function platform_private.cms_preview_state_guard();

revoke all on function platform_private.cms_preview_state_guard()
  from public, anon, authenticated, service_role;

-- SEC-2: a function whose body names a forced-RLS CMS table is owned by the
-- NOLOGIN, non-BYPASSRLS definer role (the catalog guard in
-- supabase/tests/phase_02_slice_09_sec2_definer_rls.sql derives the set from the
-- live bodies), exactly as the Slice 09 schema-review guards are.  ALTER FUNCTION
-- ... OWNER TO needs CREATE on the function's schema for the new owner, held for
-- this transaction only.  The guard stays SECURITY INVOKER: it runs with the
-- privileges of the calling role, so the definer functions that write the table
-- (Slice 11 command migrations) are the ones that hold the table verbs.
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_preview_state_guard() owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;

commit;
