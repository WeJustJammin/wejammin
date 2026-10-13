/**
 * Shared kit of the Slice 11 preview race runners (supabase/tests/phase_02_slice_11_races/020-*.mjs; lane
 * S11-3c: cms_mint_preview, cms_verify_preview_token, the preview-token revocation seams).  Like review-kit.mjs
 * every call is a fresh `psql` process inside the disposable local Supabase database container, so a lock or
 * ordering guarantee is proven across real committed PostgreSQL sessions, which a single-transaction pgTAP file
 * cannot.  Run only right after `pnpm db:reset`.
 *
 * The fixture is the SAME pgTAP fragments the pgTAP suites include (the Slice 10 organization fixture, the Slice
 * 11 data-model fixture, the h11doc world with the real editorial policy, the receipt-derived owner and the
 * reviewer accounts, the CMS-03B-05 entry builder and the preview builders) executed once in a script that
 * COMMITS, plus supabase/tests/phase_02_slice_11_rpc_preview/090-race-fixture.sqlinc (the entries and the
 * committed Vault key).  Commands are driven only through the named RPCs (`platform_api.cms_*`) exactly as the
 * Worker calls them.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as review from './review-kit.mjs';
import * as kit from './race-kit.mjs';

export const { check, sql, jsonb, sleep, call, callAsync, context, nextKey } =
  review;
export const {
  closeGate,
  openGate,
  openAllGates,
  waitParked,
  waitFor,
  blockedOrCompleted,
  isLockWaiting,
  value,
  capture,
  spawnSession,
} = review;
const { runScript, runValue } = kit;

const fragment = (relative) =>
  readFileSync(join(kit.testsDir, relative), 'utf8');

const FRAGMENTS = [
  'phase_02_slice_10_rpc/000-helpers.sqlinc',
  'phase_02_slice_10_remaining_schema/000-helpers.sqlinc',
  'phase_02_slice_10_rpc/001-fixtures.sqlinc',
  'phase_02_slice_11_schema/000-helpers.sqlinc',
  'phase_02_slice_11_schema/001-fixture.sqlinc',
  'phase_02_slice_11_schema/002-row-builders.sqlinc',
  'phase_02_slice_11_helpers/000-helpers.sqlinc',
  'phase_02_slice_11_helpers/001-world.sqlinc',
  'phase_02_slice_11_helpers/002-reviews.sqlinc',
  'phase_02_slice_11_rpc_review/000-world.sqlinc',
  'phase_02_slice_11_rpc_review/030-submit.sqlinc',
  'phase_02_slice_11_rpc_preview/000-world.sqlinc',
  'phase_02_slice_11_rpc_preview/090-race-fixture.sqlinc',
];

/** Builds the committed fixture; returns the ids document of 090-race-fixture.sqlinc. */
export const buildPreviewFixture = () => {
  runScript(
    "create extension if not exists pgtap with schema extensions;\nselect '{}';",
    's11race-setup-ext',
  );
  const script = [
    '\\set ON_ERROR_STOP on',
    fragment('support/jwt-claims.sqlinc'),
    'begin;',
    'select no_plan();',
    ...FRAGMENTS.map(fragment),
    'commit;',
  ].join('\n');
  return JSON.parse(runScript(script, 's11race-preview-setup'));
};

/**
 * A mint request for the committed entry of `tag`: the entry's current version as If-Match and the version set the
 * server recomputes for its revision.
 */
export const mintRequest = (ids, tag, extra = {}) => {
  const entryId = ids.entries[tag];
  const revisionId = ids.revisions[tag];
  const built = JSON.parse(
    runScript(
      `begin;
       select set_config('app.cms_rpc', 'true', true);
       select jsonb_build_object(
         'version', (select version::text from platform_private.cms_content_entries where id = ${sql(entryId)}),
         'versionSet', platform_private.cms_revision_version_set(${sql(revisionId)}::uuid,
            platform_private.cms_build_dependency_manifest(${sql(revisionId)}::uuid)))::text;
       commit;`,
      's11race-mint-build',
    ),
  );
  return {
    entryId,
    revisionId,
    locale: 'en-US',
    audience: 'public',
    route: '/preview/article',
    versionSet: built.versionSet,
    expectedVersion: built.version,
    ifMatch: built.version,
    idempotencyKey: nextKey('mint'),
    context: { actingPartyId: ids.org, correlationId: randomUUID() },
    ...extra,
  };
};

/**
 * Installs the preview gate: a session whose application name is `s11race-pvgated-<key>-<label>` parks right
 * before its preview-token insert (after every lock and check of the mint), on the shared advisory lock `<key>`
 * that closeGate() holds.
 */
export const installPreviewGate = () =>
  runScript(
    `
create or replace function public.s11race_preview_gate() returns trigger
language plpgsql security definer set search_path = ''
as $f$
declare
  app text := pg_catalog.current_setting('application_name', true);
begin
  if app like 's11race-pvgated-%' then
    perform pg_catalog.pg_advisory_xact_lock_shared(
      pg_catalog.split_part(app, '-', 3)::bigint);
  end if;
  return new;
end;
$f$;
revoke all on function public.s11race_preview_gate() from public;
grant execute on function public.s11race_preview_gate() to public;
drop trigger if exists cms_preview_tokens_0_s11race_gate on platform_private.cms_preview_tokens;
create trigger cms_preview_tokens_0_s11race_gate
  before insert on platform_private.cms_preview_tokens
  for each row execute function public.s11race_preview_gate();
select '{}';
`,
    's11race-preview-gate-install',
  );

// ---------------------------------------------------------------- database reads ----
export const count = (statement) => Number(runValue(statement));
export const tokenRows = (entryId) =>
  count(
    `select count(*) from platform_private.cms_preview_tokens where entry_id = ${sql(entryId)};`,
  );
export const mintAudits = (entryId) =>
  count(
    `select count(*) from audit_private.audit_events audit
       join platform_private.cms_preview_tokens token on token.id = audit.target_id
      where audit.action = 'cms.preview.mint' and token.entry_id = ${sql(entryId)};`,
  );
/** `state/version` of the token whose plaintext is given. */
export const tokenState = (token) =>
  runValue(
    `select state || '/' || version from platform_private.cms_preview_tokens
      where token_hash = encode(extensions.digest(convert_to(${sql(token)}, 'utf8'), 'sha256'), 'hex');`,
  );

/** The CMS-03B-19 answer for a token and its minting actor (route, locale, audience as minted). */
export const verify = (ids, token, who = 'owner') =>
  JSON.parse(
    runValue(
      `select platform_api.cms_verify_preview_token(jsonb_build_object(
         'tokenHash', encode(extensions.digest(convert_to(${sql(token)}, 'utf8'), 'sha256'), 'hex'),
         'actorPersonId', ${sql(ids.actors[who].person)}::uuid,
         'actingContextVersion', platform_private.cms_acting_context_version(${sql(ids.actors[who].person)}::uuid, ${sql(ids.org)}::uuid),
         'route', '/preview/article', 'locale', 'en-US', 'audience', 'public'))::text;`,
    ),
  );

export const { REVOKERS, revokerScript, restoreAuthority } = kit;

/**
 * Losing an actor grant also revokes the person's entry assignments for the capabilities no longer held (DEC-143), and
 * re-granting never restores them: put the creator's assignments back so the next scenario starts from the fixture.
 */
export const restoreAssignments = (ids) =>
  runValue(
    `begin; select set_config('app.cms_rpc', 'true', true);
     update platform_private.cms_entry_assignments set state = 'active', updated_at = clock_timestamp()
      where assignee_person_id = ${sql(ids.creatorPerson)}::uuid and state = 'revoked';
     commit; select 'restored';`,
  );
