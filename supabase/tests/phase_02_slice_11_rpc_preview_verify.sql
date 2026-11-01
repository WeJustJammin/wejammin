-- Slice 11 lane S11-3c: platform_api.cms_verify_preview_token (CMS-03B-19, the BE04c "Shard 03
-- preview-token verifier" seam; tracker P2-S11-AC-073 .. AC-078, AC-118).  The verifier is a
-- read-safe internal RPC (service_role only): given the lowercase SHA-256 of the presented token and
-- the binding the Shard 04 delivery adapter resolved (actor person, acting-context version, route,
-- locale, audience) it answers `valid: true` with the stored VersionSet only when the token row is
-- active, unexpired, bound to exactly that actor, context, route, locale and audience, its entry is
-- active and the minting person's preview scope still holds.  Every other input is ONE
-- byte-identical denial; `revoked` is true only for the bound actor's own revoked token, so the
-- verifier is not an existence oracle.  RED before 20261005017850.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(43);

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

select pg_temp.r11_entry('pv-1');
select pg_temp.r11_entry('pv-2');
select pg_temp.r11_entry('pv-3');
select pg_temp.r11_entry('pv-4');

-- ---------------------------------------------------------------------------
-- Posture: a private SECURITY DEFINER nobody can call, a STABLE service_role-only wrapper.
-- ---------------------------------------------------------------------------
select ok(pg_temp.r11_posture('platform_private', 'cms_verify_preview_token(jsonb)'),
  'cms_verify_preview_token is a private SECURITY DEFINER of the CMS definer (empty search_path) that no API role, service_role included, can execute [P2-S11-AC-075]');
select ok(pg_temp.r11_posture('platform_api', 'cms_verify_preview_token(jsonb)'),
  'the platform_api wrapper is a SECURITY DEFINER of the CMS definer, executable by service_role only, not by PUBLIC, anon or authenticated [P2-S11-AC-075]');
select is(
  (select string_agg(p.provolatile::text, ',' order by n.nspname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('platform_api', 'platform_private') and p.proname = 'cms_verify_preview_token'),
  's,s',
  'both functions are STABLE, so the database itself refuses any insert, update, delete, audit or outbox write [P2-S11-AC-076]');

-- ---------------------------------------------------------------------------
-- The valid result.
-- ---------------------------------------------------------------------------
select pg_temp.r11p_token('ok', 'pv-1');
select pg_temp.r11p_vcall('ok', pg_temp.r11p_vreq('ok'));
select is(pg_temp.r11_out('ok'), '00000:', 'a live token presented by its bound actor verifies [P2-S11-AC-074]');
select is(pg_temp.r11_keys(pg_temp.r11_resp('ok')),
  'entryId,exactVersionSet,expiresAt,revisionId,revoked,userId,valid',
  'the valid result is exactly PreviewVerificationResult (7 members) [P2-S11-AC-073]');
select ok(
  pg_temp.r11_resp('ok')->>'valid' = 'true'
    and pg_temp.r11_resp('ok')->>'userId' = pg_temp.s11_id('creator')::text
    and pg_temp.r11_resp('ok')->>'entryId' = pg_temp.h11w_uuid('pv-1:entry')::text
    and pg_temp.r11_resp('ok')->>'revisionId' = pg_temp.h11w_uuid('pv-1:revision')::text
    and pg_temp.r11_resp('ok')->'exactVersionSet' = jsonb_build_object('settingsVersion', '1', 'tag', 'pv-1')
    and pg_temp.r11_resp('ok')->>'expiresAt' = (select platform_private.auth_iso_time(token.expires_at)
          from platform_private.cms_preview_tokens token where token.token_hash = pg_temp.h11_sha256(pg_temp.r11p_plain('ok')))
    and pg_temp.r11_resp('ok')->'revoked' = 'false'::jsonb,
  'the valid result carries the canonical person as userId, the entry and revision ids, the STORED VersionSet and the exact expiry [P2-S11-AC-073]');
select ok(
  not pg_temp.r11_leaks(pg_temp.r11_resp('ok'), array[
    pg_temp.h11_sha256(pg_temp.r11p_plain('ok')), pg_temp.r11p_plain('ok'),
    (select auth_user_id::text from r11_actor where key = 'owner'), pg_temp.s11_id('org')::text,
    platform_private.cms_acting_context_version(pg_temp.s11_id('creator'), pg_temp.s11_id('org')), '/preview/article']),
  'the valid result echoes no token hash, plaintext, account id, acting party, context version or route [P2-S11-AC-075]');

-- Zero writes: a battery of valid and denied calls leaves every token row byte-identical and writes
-- no audit, outbox or idempotency row.
create temp table r11_before(token_digest text, audit bigint, outbox bigint, idem bigint) on commit drop;
insert into r11_before select pg_temp.r11p_tokens_digest(), pg_temp.s10_audit_total(), pg_temp.s10_outbox_total(),
  (select count(*) from platform_private.idempotency_records);
select pg_temp.r11p_vcall('w1', pg_temp.r11p_vreq('ok'));
select pg_temp.r11p_vcall('w2', pg_temp.r11p_vreq('ok', 'owner', '{"route":"/elsewhere"}'));
select pg_temp.r11p_vcall('w3', pg_temp.r11p_vreq('ok', 'editor'));
select pg_temp.r11p_vcall('w4', pg_temp.r11p_vreq('nope'));
select ok(
  (select pg_temp.r11p_tokens_digest() = token_digest and pg_temp.s10_audit_total() = audit
          and pg_temp.s10_outbox_total() = outbox
          and (select count(*) from platform_private.idempotency_records) = idem from r11_before),
  'the verifier writes nothing: token rows (with their xmin), audit, outbox and idempotency are unchanged by valid and denied calls [P2-S11-AC-076]');
select ok(
  (select pg_temp.r11_resp('w1') = pg_temp.r11_resp('ok')),
  'a repeated verification answers the same document (retry is harmless) [P2-S11-AC-076]');

-- It is a service call: no actor is needed and none is read.
select pg_temp.s10_rpc_clear_actor();
select pg_temp.r11p_vcall('no-actor', pg_temp.r11p_vreq('ok'));
select ok(pg_temp.r11_resp('no-actor') = pg_temp.r11_resp('ok'),
  'the verifier needs no session or acting context: it answers from the request alone [P2-S11-AC-073]');

-- ---------------------------------------------------------------------------
-- Every denial is the same bytes.
-- ---------------------------------------------------------------------------
select pg_temp.r11p_vcall('d-unknown', pg_temp.r11p_vreq('nope'));
select is(pg_temp.r11_resp('d-unknown')::text, pg_temp.r11p_denial(false),
  'an unknown token hash is the canonical denial (valid false, five null members, revoked false) [P2-S11-AC-075]');

select pg_temp.r11p_token('expired', 'pv-1', 'owner', interval '15 minutes 10 seconds');
select pg_temp.r11p_vcall('d-expired', pg_temp.r11p_vreq('expired'));
select is(pg_temp.r11_resp('d-expired')::text, pg_temp.r11p_denial(false),
  'an expired token (15 minutes 10 seconds old) is the canonical denial [P2-S11-AC-074]');

select pg_temp.r11p_token('edge', 'pv-1', 'owner', interval '14 minutes 50 seconds');
select pg_temp.r11p_vcall('d-edge', pg_temp.r11p_vreq('edge'));
select is(pg_temp.r11_resp('d-edge')->>'valid', 'true',
  'a token with ten seconds of life left still verifies (the expiry is exact, not rounded) [P2-S11-AC-074]');

select pg_temp.r11p_vcall('d-forward', pg_temp.r11p_vreq('ok', 'editor'));
select is(pg_temp.r11_resp('d-forward')::text, pg_temp.r11p_denial(false),
  'a forwarded token presented by another person is the canonical denial, revoked false [P2-S11-AC-075]');

select pg_temp.r11p_vcall('d-context', pg_temp.r11p_vreq('ok', 'owner', jsonb_build_object('actingContextVersion', repeat('c', 64))));
select is(pg_temp.r11_resp('d-context')::text, pg_temp.r11p_denial(false),
  'another acting-context version is the canonical denial [P2-S11-AC-074]');

select pg_temp.r11p_vcall('d-route', pg_temp.r11p_vreq('ok', 'owner', '{"route":"/preview/Article"}'));
select pg_temp.r11p_vcall('d-route-slash', pg_temp.r11p_vreq('ok', 'owner', '{"route":"/preview/article/"}'));
select pg_temp.r11p_vcall('d-route-prefix', pg_temp.r11p_vreq('ok', 'owner', '{"route":"/preview"}'));
select ok(
  pg_temp.r11_resp('d-route')::text = pg_temp.r11p_denial(false)
    and pg_temp.r11_resp('d-route-slash')::text = pg_temp.r11p_denial(false)
    and pg_temp.r11_resp('d-route-prefix')::text = pg_temp.r11p_denial(false),
  'another route (case, trailing slash, prefix) is the canonical denial: the route must equal the minted one exactly [P2-S11-AC-074]');

select pg_temp.r11p_vcall('d-locale', pg_temp.r11p_vreq('ok', 'owner', '{"locale":"en-us"}'));
select pg_temp.r11p_vcall('d-locale2', pg_temp.r11p_vreq('ok', 'owner', '{"locale":"de-DE"}'));
select ok(
  pg_temp.r11_resp('d-locale')::text = pg_temp.r11p_denial(false) and pg_temp.r11_resp('d-locale2')::text = pg_temp.r11p_denial(false),
  'another locale (case variant or other language) is the canonical denial [P2-S11-AC-074]');

select pg_temp.r11p_vcall('d-audience', pg_temp.r11p_vreq('ok', 'owner', '{"audience":"members"}'));
select is(pg_temp.r11_resp('d-audience')::text, pg_temp.r11p_denial(false),
  'another audience is the canonical denial [P2-S11-AC-074]');

-- Lost minting scope (the lazy path: no eager trigger fires).
select pg_temp.r11p_token('scope-lost', 'pv-2', 'editor');
select pg_temp.r11p_vcall('d-scope-before', pg_temp.r11p_vreq('scope-lost', 'editor'));
select pg_temp.h11_raw_exec('platform_private.cms_entry_assignments',
  format($$update platform_private.cms_entry_assignments set state = 'revoked', version = version + 1
            where entry_id = %L and assignee_person_id = %L$$, pg_temp.h11w_uuid('pv-2:entry'), pg_temp.s11_id('editor')));
select pg_temp.r11p_vcall('d-scope-after', pg_temp.r11p_vreq('scope-lost', 'editor'));
select ok(
  pg_temp.r11_resp('d-scope-before')->>'valid' = 'true'
    and pg_temp.r11_resp('d-scope-after')::text = pg_temp.r11p_denial(false)
    and (select state from platform_private.cms_preview_tokens where token_hash = pg_temp.h11_sha256(pg_temp.r11p_plain('scope-lost'))) = 'active',
  'a token whose minting person lost the entry assignment stops verifying although its row is still active: canonical denial, revoked false [P2-S11-AC-074]');

-- Lost standing grant (calendar-style lapse without an UPDATE event).
select pg_temp.r11p_token('grant-lost', 'pv-2', 'owner');
select pg_temp.r11p_vcall('d-grant-before', pg_temp.r11p_vreq('grant-lost'));
select pg_temp.h11_raw_exec('identity_private.organization_actor_grant',
  format($$update identity_private.organization_actor_grant set valid_from = current_date - 5, valid_through = current_date - 1
            where organization_id = %L and person_id = %L and capability_code = 'cms.author'$$,
         pg_temp.s11_id('org'), pg_temp.s11_id('creator')));
select pg_temp.r11p_vcall('d-grant-after', pg_temp.r11p_vreq('grant-lost'));
-- Restore the grant so the creator's later tokens are judged on their own merits.
select pg_temp.h11_raw_exec('identity_private.organization_actor_grant',
  format($$update identity_private.organization_actor_grant set valid_from = current_date, valid_through = null
            where organization_id = %L and person_id = %L and capability_code = 'cms.author'$$,
         pg_temp.s11_id('org'), pg_temp.s11_id('creator')));
select ok(
  pg_temp.r11_resp('d-grant-before')->>'valid' = 'true'
    and pg_temp.r11_resp('d-grant-after')::text = pg_temp.r11p_denial(false),
  'a lapsed standing cms.author grant ends the minting scope: canonical denial (the acting-context version moved as well) [P2-S11-AC-074]');

-- Entry no longer active.
select pg_temp.r11p_token('entry-gone', 'pv-3', 'owner');
select pg_temp.r11p_vcall('d-entry-before', pg_temp.r11p_vreq('entry-gone'));
select pg_temp.h11_raw_exec('platform_private.cms_content_entries',
  format($$update platform_private.cms_content_entries set lifecycle = 'archived' where id = %L$$, pg_temp.h11w_uuid('pv-3:entry')));
select pg_temp.r11p_vcall('d-entry-after', pg_temp.r11p_vreq('entry-gone'));
select ok(
  pg_temp.r11_resp('d-entry-before')->>'valid' = 'true' and pg_temp.r11_resp('d-entry-after')::text = pg_temp.r11p_denial(false),
  'a token of an entry that left `active` is the canonical denial even before its row is revoked [P2-S11-AC-074]');

-- ---------------------------------------------------------------------------
-- Minting scopes: assignee, active reviewer assignee, owner-party publisher.
-- ---------------------------------------------------------------------------
select pg_temp.h11r_review('pv-review', jsonb_build_object(
  'revision_id', pg_temp.h11w_uuid('pv-4:revision'), 'entry_id', pg_temp.h11w_uuid('pv-4:entry')));
select pg_temp.h11r_assign('pv-review-asg', 'pv-review', 'rvA');
select pg_temp.r11p_token('by-reviewer', 'pv-4', 'rvA');
select pg_temp.r11p_token('by-publisher', 'pv-4', 'pub');
select pg_temp.r11p_token('by-outsider', 'pv-4', 'outsider');
select pg_temp.r11p_vcall('s-reviewer', pg_temp.r11p_vreq('by-reviewer', 'rvA'));
select pg_temp.r11p_vcall('s-publisher', pg_temp.r11p_vreq('by-publisher', 'pub'));
select pg_temp.r11p_vcall('s-outsider', pg_temp.r11p_vreq('by-outsider', 'outsider'));
select ok(
  pg_temp.r11_resp('s-reviewer')->>'valid' = 'true' and pg_temp.r11_resp('s-publisher')->>'valid' = 'true',
  'an active reviewer assignee of a review of the revision and an owner-party publisher keep a valid preview [P2-S11-AC-074]');
select is(pg_temp.r11_resp('s-outsider')::text, pg_temp.r11p_denial(false),
  'a member with no preview scope on the entry cannot verify a row bound to them (scope is rechecked on every open) [P2-S11-AC-074]');
select pg_temp.h11_raw_exec('platform_private.cms_editorial_review_assignments',
  format($$update platform_private.cms_editorial_review_assignments set state = 'revoked', version = version + 1
            where id = %L$$, pg_temp.s11_id('pv-review-asg')));
select pg_temp.r11p_vcall('s-reviewer-revoked', pg_temp.r11p_vreq('by-reviewer', 'rvA'));
select is(pg_temp.r11_resp('s-reviewer-revoked')::text, pg_temp.r11p_denial(false),
  'revoking the reviewer assignment ends that reviewer''s preview scope [P2-S11-AC-074]');

-- ---------------------------------------------------------------------------
-- Revoked tokens: `revoked` is true only for the bound actor.
-- ---------------------------------------------------------------------------
select pg_temp.r11p_token('rev', 'pv-1', 'owner');
select pg_temp.r11p_revoke('rev');
select pg_temp.r11p_vcall('r-owner', pg_temp.r11p_vreq('rev'));
select is(pg_temp.r11_resp('r-owner')::text, pg_temp.r11p_denial(true),
  'the bound actor presenting a revoked token gets valid false and revoked true, every other member null [P2-S11-AC-075]');
select pg_temp.r11p_vcall('r-other', pg_temp.r11p_vreq('rev', 'editor'));
select is(pg_temp.r11_resp('r-other')::text, pg_temp.r11p_denial(false),
  'another person presenting the same revoked token gets the unknown-token bytes (revoked false): no existence oracle [P2-S11-AC-075]');
select pg_temp.r11p_vcall('r-owner-route', pg_temp.r11p_vreq('rev', 'owner', '{"route":"/other"}'));
select pg_temp.r11p_vcall('r-owner-context', pg_temp.r11p_vreq('rev', 'owner', jsonb_build_object('actingContextVersion', repeat('d', 64))));
select ok(
  pg_temp.r11_resp('r-owner-route')::text = pg_temp.r11p_denial(true) and pg_temp.r11_resp('r-owner-context')::text = pg_temp.r11p_denial(true),
  'revoked is true whenever the row exists, is bound to the supplied person and is revoked, whatever else of the binding differs [P2-S11-AC-075]');
select pg_temp.r11p_token('rev-expired', 'pv-1', 'owner', interval '20 minutes');
select pg_temp.r11p_revoke('rev-expired');
select pg_temp.r11p_vcall('r-expired', pg_temp.r11p_vreq('rev-expired'));
select is(pg_temp.r11_resp('r-expired')::text, pg_temp.r11p_denial(true),
  'a revoked token that has also expired still reports revoked for its bound actor [P2-S11-AC-075]');
select ok(
  pg_temp.r11_resp('d-unknown')::text = pg_temp.r11_resp('r-other')::text
    and pg_temp.r11_resp('d-unknown')::text = pg_temp.r11_resp('d-forward')::text
    and pg_temp.r11_resp('d-unknown')::text = pg_temp.r11_resp('d-expired')::text,
  'unknown, forwarded, other-actor-revoked and expired denials are the same bytes [P2-S11-AC-075]');

-- ---------------------------------------------------------------------------
-- Malformed requests are denials too (the function is total; the Worker never retries into a circuit).
-- ---------------------------------------------------------------------------
select pg_temp.r11p_vcall('m-missing-hash', pg_temp.r11p_vreq('ok', 'owner', '{}', array['tokenHash']));
select pg_temp.r11p_vcall('m-missing-route', pg_temp.r11p_vreq('ok', 'owner', '{}', array['route']));
select pg_temp.r11p_vcall('m-extra', pg_temp.r11p_vreq('ok', 'owner', '{"extra":"x"}'));
select pg_temp.r11p_vcall('m-upper-hash', pg_temp.r11p_vreq('ok', 'owner', jsonb_build_object('tokenHash', upper(pg_temp.h11_sha256(pg_temp.r11p_plain('ok'))))));
select pg_temp.r11p_vcall('m-short-hash', pg_temp.r11p_vreq('ok', 'owner', jsonb_build_object('tokenHash', 'abc')));
select pg_temp.r11p_vcall('m-actor', pg_temp.r11p_vreq('ok', 'owner', '{"actorPersonId":"not-a-uuid"}'));
select pg_temp.r11p_vcall('m-actor-null', pg_temp.r11p_vreq('ok', 'owner', '{"actorPersonId":null}'));
select pg_temp.r11p_vcall('m-context', pg_temp.r11p_vreq('ok', 'owner', '{"actingContextVersion":"xyz"}'));
select pg_temp.r11p_vcall('m-route-long', pg_temp.r11p_vreq('ok', 'owner', jsonb_build_object('route', '/' || repeat('a', 4096))));
select pg_temp.r11p_vcall('m-route-type', pg_temp.r11p_vreq('ok', 'owner', '{"route":7}'));
select pg_temp.r11p_vcall('m-locale', pg_temp.r11p_vreq('ok', 'owner', '{"locale":"!!"}'));
select pg_temp.r11p_vcall('m-audience', pg_temp.r11p_vreq('ok', 'owner', jsonb_build_object('audience', repeat('a', 49))));
select pg_temp.r11p_vcall('m-null', null);
select pg_temp.r11_try('m-array', $$select platform_api.cms_verify_preview_token('[]'::jsonb)$$, true);
select pg_temp.r11_try('m-string', $$select platform_api.cms_verify_preview_token('"x"'::jsonb)$$, true);
select is(
  (select coalesce(string_agg(label, ',' order by label), '') from r11_probe
    where label like 'm-%' and (state <> '00000' or response::text is distinct from pg_temp.r11p_denial(false))),
  '',
  'every malformed request (missing or extra member, upper-case or short hash, bad uuid, over-long or non-string route, bad locale or audience, null, array, string) is the canonical denial and never an error [P2-S11-AC-077]');

-- ---------------------------------------------------------------------------
-- The exact-binding tokens survive long routes and unusual but legal routes.
-- ---------------------------------------------------------------------------
select pg_temp.r11p_token('long-route', 'pv-1', 'owner', interval '1 minute',
  jsonb_build_object('route', '/' || repeat('a', 2047)));
select pg_temp.r11p_vcall('long-route', pg_temp.r11p_vreq('long-route', 'owner', jsonb_build_object('route', '/' || repeat('a', 2047))));
select is(pg_temp.r11_resp('long-route')->>'valid', 'true',
  'a 2,048-character route verifies when presented exactly [P2-S11-AC-074]');
select pg_temp.r11p_token('unicode-route', 'pv-1', 'owner', interval '1 minute',
  jsonb_build_object('route', '/preview/caf' || chr(233)));
select pg_temp.r11p_vcall('unicode-route', pg_temp.r11p_vreq('unicode-route', 'owner', jsonb_build_object('route', '/preview/caf' || chr(233))));
select pg_temp.r11p_vcall('unicode-route-nfd', pg_temp.r11p_vreq('unicode-route', 'owner', jsonb_build_object('route', '/preview/cafe' || chr(769))));
select ok(
  pg_temp.r11_resp('unicode-route')->>'valid' = 'true' and pg_temp.r11_resp('unicode-route-nfd')::text = pg_temp.r11p_denial(false),
  'route equality is on the exact code points: the NFC route verifies, its NFD spelling is the canonical denial [P2-S11-AC-074]');

-- The acting-context version follows the person's capabilities (the BE04c actingContextVersion).
select pg_temp.h11r_member('outsider', array['cms.reviewer']);
select pg_temp.r11p_token('ctx-outsider', 'pv-4', 'outsider');
select pg_temp.r11p_vcall('ctx-before', pg_temp.r11p_vreq('ctx-outsider', 'outsider'));
select ok(
  (select token.capability_snapshot_hash = platform_private.cms_acting_context_version(pg_temp.s11_id('outsider'), pg_temp.s11_id('org'))
     from platform_private.cms_preview_tokens token where token.token_hash = pg_temp.h11_sha256(pg_temp.r11p_plain('ctx-outsider')))
    and pg_temp.r11_resp('ctx-before')::text = pg_temp.r11p_denial(false),
  'the stored capability snapshot equals cms_acting_context_version of the minting person (BE04c actingContextVersion), and a minting person with no scope is denied [P2-S11-AC-118]');

select pg_temp.h11r_member('outsider', array['cms.publisher']);
select pg_temp.r11p_vcall('ctx-after', pg_temp.r11p_vreq('ctx-outsider', 'outsider'));
select pg_temp.r11p_vcall('ctx-after-old', pg_temp.r11p_vreq('ctx-outsider', 'outsider',
  jsonb_build_object('actingContextVersion', (select token.capability_snapshot_hash
     from platform_private.cms_preview_tokens token where token.token_hash = pg_temp.h11_sha256(pg_temp.r11p_plain('ctx-outsider'))))));
select ok(
  pg_temp.r11_resp('ctx-after')::text = pg_temp.r11p_denial(false) and pg_temp.r11_resp('ctx-after-old')->>'valid' = 'true',
  'a granted capability changes the context version: the token verifies only against the version it was minted under (and scope now holds as a publisher) [P2-S11-AC-118]');

select * from finish();
rollback;
