/** Audited S09 SQL producer fragments, executed only through the owned async facade. */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { queryScript } from './governed-authority-execution.mjs';

const testsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fragment = (path) => readFileSync(resolve(testsDir, path), 'utf8');
const DEC108 = 'phase_02_slice_09_dec108';

/**
 * Selective SQL equivalent of the audited chain-kit buildWorld/buildSources/bindOwner path.
 * One committed fixture transaction; no scratch-table persistence or shared JS executors.
 * The actor fragment's unrelated negative controls remain explicitly upstream-labeled.
 */
export const buildSourceFixture = async () =>
  queryScript(
    [
      fragment('support/jwt-claims.sqlinc'),
      'begin;',
      ...[
        '00-helpers.sqlinc',
        '01-actors.sqlinc',
        '02-chain.sqlinc',
        '03-support.sqlinc',
        '04-worker.sqlinc',
      ].map((name) => fragment(`${DEC108}/${name}`)),
      fragment('phase_02_slice_09_dec119/00-support.sqlinc'),
      `select pg_temp.s09g_grant('s12gov:author', 'owner', 'owner', 'cms.author', pg_temp.s09g_day(1));
   select pg_temp.s09g_grant('s12gov:editor', 'owner', 'owner', 'cms.editor', pg_temp.s09g_day(1));
   select pg_temp.s09d_create_type('govrace', 'racegovrace');
   select pg_temp.s09d_to_active('govrace');
   do $verify$
   declare label text;
   begin
     foreach label in array array['s12gov:author', 's12gov:editor', 'govrace:activate'] loop
       if pg_temp.s09d_outcome(label) <> 'OK' then
         raise exception 'producer step % failed: %', label, pg_temp.s09d_outcome(label);
       end if;
     end loop;
   end $verify$;`,
      // The same real binding seam used by chain-kit, with a fresh request identity.
      `do $bind$
   declare actor s09d_actor%rowtype; bound jsonb; nonce text := extensions.gen_random_uuid()::text;
   begin
     select * into actor from s09d_actor where key = 'owner';
     perform pg_temp.s09d_session('owner', 'authenticated');
     perform set_config('app.correlation_id', extensions.gen_random_uuid()::text, true);
     perform set_config('app.idempotency_key_hash', 's12gov-bind-' || nonce, true);
     perform set_config('app.request_hash', 's12gov-bind-' || nonce || '-request', true);
     bound := platform_api.identity_context_bind(actor.party_id, true, 's12gov-' || nonce);
     update s09d_actor set binding_id = (bound->>'bindingId')::uuid where key = 'owner';
   end $bind$;
   select jsonb_build_object(
     'org', pg_temp.s09d_id('ownerOrg'),
     'typeId', pg_temp.s09d_id('govrace:type'),
     'typeVersion', pg_temp.s09d_id('govrace:version'),
     'auth', auth_user_id, 'person', person_id, 'binding', binding_id)::text
   from s09d_actor where key = 'owner';`,
      'commit;',
    ].join('\n'),
    'fixture-source',
  );
