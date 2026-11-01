/** ALT-only, opt-in local fixture/probe owner. No imports from the default stack. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ALT_API,
  command,
  DB,
  readDec194AltEnvironment,
  RELEASE,
  root,
} from './phase-02-slice-12-dec194-alt-environment';

export {
  ALT_API,
  ALT_PROJECT,
} from './phase-02-slice-12-dec194-alt-environment';
export const sql = (value: string): string =>
  `'${value.replaceAll("'", "''")}'`;

export type IsolationWorld = Readonly<{
  authUserId: string;
  personId: string;
  partyId: string;
  bindingId: string;
  taxonomyId: string;
  sourceId: string;
  survivorId: string;
  sourceKey: string;
  expectedVersion: string;
  upstreamJobId: string;
}>;

const fragments = [
  'support/jwt-claims.sqlinc',
  'phase_02_slice_09_dec108/00-helpers.sqlinc',
  'phase_02_slice_09_dec108/01-actors.sqlinc',
  'phase_02_slice_09_dec108/02-chain.sqlinc',
  'phase_02_slice_09_dec119/00-support.sqlinc',
  'phase_02_slice_12_governed_submit/000-fixtures.sqlinc',
  'phase_02_slice_12_governed_submit/005-real-type-chains.sqlinc',
  'phase_02_slice_12_governed_assignment/000-world.sqlinc',
  'phase_02_slice_12_governed_activation/000-world.sqlinc',
  'phase_02_slice_12_taxonomy_terms/000-world.sqlinc',
  'phase_02_slice_12_taxonomy_terms/010-setup.sqlinc',
  'phase_02_slice_12_dec194_sweep/000-helpers.sqlinc',
];

export const openDec194AltStack = () => {
  const secret = readDec194AltEnvironment();
  const nonce = randomUUID();
  const schema = `s12_dec194_iso_${nonce.replaceAll('-', '').slice(0, 16)}`;
  const trigger = `${schema}_jobs`;
  const nonRcExpected = process.env.S12_DEC194_RPC_NON_RC_EXPECTED;
  assert.ok(
    nonRcExpected === undefined ||
      nonRcExpected === 'repeatable read' ||
      nonRcExpected === 'serializable',
    'optional sensitivity requires an explicit non-RC enum',
  );
  const psql = (body: string): string =>
    command(
      'docker',
      [
        'exec',
        '-i',
        '-e',
        'PGCONNECT_TIMEOUT=5',
        '-e',
        'PGOPTIONS=-c statement_timeout=120000 -c lock_timeout=15000',
        DB,
        'psql',
        '-X',
        '-q',
        '-At',
        '-v',
        'ON_ERROR_STOP=1',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-f',
        '-',
      ],
      body,
    ).trim();
  const json = <T>(body: string): T =>
    JSON.parse(psql(body).split('\n').at(-1) ?? '') as T;
  let owned = false;
  let acquired: { oid: number; functionOid: number } | undefined;
  const ownershipSql = (phase: 'ACTIVATE' | 'CLEANUP'): string => {
    const source = readFileSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        'phase-02-slice-12-dec194-probe-ownership.sqlinc',
      ),
      'utf8',
    );
    const section = source
      .split(`-- DEC194_${phase}\n`)[1]
      ?.split('-- DEC194_')[0];
    assert.ok(section, 'exact ownership SQL section required');
    return section
      .replaceAll('__SCHEMA__', schema)
      .replaceAll('__TRIGGER__', trigger)
      .replaceAll('__TRIGGER_OID__', String(acquired?.oid ?? 0))
      .replaceAll('__FUNCTION_OID__', String(acquired?.functionOid ?? 0));
  };

  const prepareFixture = (): IsolationWorld => {
    assert.equal(
      process.env.S12_DEC194_RPC_FIXTURE_RELEASE,
      RELEASE,
      'root fixture release required',
    );
    const read = (path: string) =>
      readFileSync(resolve(root, 'supabase/tests', path), 'utf8');
    const world = fragments.map((path) => read(path));
    // Match the existing guarded race bootstrap. Claims here are FIXTURE ONLY,
    // before a probe trigger exists or any tagged HTTP request can be made.
    world.splice(
      5,
      0,
      "select pg_temp.s09d_session('owner', 'authenticated');",
    );
    const probe = readFileSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        'phase-02-slice-12-dec194-isolation-probe.sqlinc',
      ),
      'utf8',
    )
      .replaceAll('__SCHEMA__', schema)
      .replaceAll('__NONCE__', nonce);
    const output = psql(`begin;
      do $fresh$ begin
        if exists (select 1 from platform_private.cms_terms)
          or exists (select 1 from auth.users where id = 'a9d10000-0000-4000-8000-000000000001')
        then raise exception 'fresh root-staged ALT fixture required'; end if;
      end $fresh$;
      create extension if not exists pgtap with schema extensions;
      select no_plan();
      ${world.join('\n')}
      create schema ${schema};
      revoke all on schema ${schema} from public, anon, authenticated, service_role;
      ${probe}
      select ${schema}.bootstrap();
      commit;
      select 'DEC194-FIXTURE-COMMITTED';`);
    owned = true;
    assert.ok(
      !/^not ok\b/mu.test(output),
      'all inherited fixture pgTAP prerequisites',
    );
    assert.equal(output.split('\n').at(-1), 'DEC194-FIXTURE-COMMITTED');
    return json<IsolationWorld>(`select ids from ${schema}.world;`);
  };

  const activateProbe = (): void => {
    assert.ok(owned, 'probe cannot precede fixture bootstrap');
    assert.equal(acquired, undefined, 'this run already acquired its trigger');
    const binding = json<{
      oid: number;
      functionOid: number;
      functionSchema: string;
      functionName: string;
    }>(ownershipSql('ACTIVATE'));
    assert.ok(Number.isSafeInteger(binding.oid) && binding.oid > 0);
    assert.ok(
      Number.isSafeInteger(binding.functionOid) && binding.functionOid > 0,
    );
    assert.equal(binding.functionSchema, schema);
    assert.equal(binding.functionName, 'observe_job');
    acquired = { oid: binding.oid, functionOid: binding.functionOid };
  };
  const cleanupProbe = (): void => {
    assert.equal(
      process.env.S12_DEC194_RPC_CLEANUP_RELEASE,
      RELEASE,
      'root cleanup release required',
    );
    if (!owned) return;
    // One locked transaction rechecks acquired OIDs/binding and uses RESTRICT
    // for every explicit owned object. A foreign dependency rolls it all back.
    psql(ownershipSql('CLEANUP'));
    owned = false;
    acquired = undefined;
  };
  return {
    api: ALT_API,
    secret,
    nonce,
    schema,
    nonRcExpected,
    psql,
    json,
    prepareFixture,
    activateProbe,
    cleanupProbe,
  };
};

export type Dec194AltStack = ReturnType<typeof openDec194AltStack>;
