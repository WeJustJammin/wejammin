import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nonce, requireAltRelease, Session, sql } from './040-race-session.mjs';
export { bounded, cleanup, Session, sql } from './040-race-session.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const includes = new Set(
  [
    'support/jwt-claims.sqlinc',
    'phase_02_slice_09_dec108/00-helpers.sqlinc',
    'phase_02_slice_09_dec108/01-actors.sqlinc',
    'phase_02_slice_09_dec108/02-chain.sqlinc',
    'phase_02_slice_09_dec108/03-support.sqlinc',
    'phase_02_slice_12_governed_submit/000-fixtures.sqlinc',
    'phase_02_slice_12_governed_assignment/000-world.sqlinc',
    'phase_02_slice_12_governed_activation/000-world.sqlinc',
  ].map((path) => resolve(directory, '..', path)),
);
export const jsonb = (value) => `${sql(JSON.stringify(value))}::jsonb`;
export const lastJson = (rows) =>
  JSON.parse(rows.filter((row) => row.startsWith('{')).at(-1));

function world() {
  const source = readFileSync(resolve(directory, '000-world.sqlinc'), 'utf8');
  return source
    .split('\n')
    .map((line) => {
      if (!line.startsWith('\\ir ')) return line;
      const path = resolve(directory, line.slice(4).trim());
      assert.ok(includes.has(path), 'only reviewed helper includes');
      const fragment = readFileSync(path, 'utf8');
      assert.ok(!/^\\i(?:r)?\s/m.test(fragment), 'unexpected nested include');
      return fragment;
    })
    .join('\n');
}

export async function prepare(diagnostic) {
  requireAltRelease();
  const bootstrap = await Session.open('setup');
  const fixture = lastJson(await bootstrap.query(world(), 300_000));
  diagnostic({ nonce, fixture, committed: false });
  const expected = [
    'author grant',
    'designer grant',
    'reviewer grant',
    'thirty schema steps',
    'all captured schema calls',
    'no helper read errors',
    'six service-role producers',
    'source exact active compiled default',
    'literal active T1',
    'empty real source population and bindings',
    'actual bound relation',
    'public target and caller assignment',
    'resolved caller visibility',
    'actual recent owner binding',
  ];
  assert.deepEqual(Object.keys(fixture.premises).sort(), expected.sort());
  for (const [key, passed] of Object.entries(fixture.premises)) {
    assert.equal(passed, true, `SETUP: ${key}`);
  }
  for (const call of fixture.schemaCalls) {
    assert.equal(call.state, '00000', `SETUP: ${call.label}`);
    assert.equal(call.hasResponse, true, `SETUP: ${call.label} response`);
  }
  assert.equal(fixture.governedCalls.length, 6);
  for (const call of fixture.governedCalls) {
    assert.deepEqual(
      [call.state, call.role, call.restored],
      ['00000', 'service_role', true],
    );
  }
  for (const id of [
    fixture.schema,
    fixture.type,
    fixture.template,
    fixture.target,
    fixture.titleField,
    fixture.relationField,
    fixture.relationDefinition,
    fixture.relationFieldDefinition,
    ...Object.values(fixture.actor),
  ]) {
    assert.match(id, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u);
  }
  assert.equal(fixture.request.contentTypeVersionId, fixture.schema);
  assert.equal(fixture.request.contentTypeId, fixture.type);
  assert.ok(
    fixture.request.activationEvidence && fixture.request.workflowPolicy,
  );
  console.log(
    `# EDTL precommit fixture ${JSON.stringify({
      nonce,
      actor: fixture.actor,
      schema: fixture.schema,
      template: fixture.template,
      target: fixture.target,
      type: fixture.type,
      relationDefinition: fixture.relationDefinition,
    })}`,
  );
  await bootstrap.query('commit;');
  diagnostic({ nonce, committed: true });
  return fixture;
}

const imageFunction = `create function pg_temp.s12edtl_image() returns jsonb
language plpgsql as $image$
declare store record; rows_image jsonb; result jsonb := '{}'::jsonb;
begin
  for store in select n.nspname, c.relname from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p') and (
      (n.nspname = 'platform_private' and (c.relname like 'cms\\_%' escape '\\'
        or c.relname in ('idempotency_records', 'outbox_events')))
      or (n.nspname = 'audit_private' and c.relname = 'audit_events'))
    order by n.nspname, c.relname
  loop
    execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text), ''[]''::jsonb)
      from %I.%I r', store.nspname, store.relname) into rows_image;
    result := result || jsonb_build_object(store.nspname || '.' || store.relname,
      jsonb_build_object('count', jsonb_array_length(rows_image),
        'hash', platform_private.cms_jcs_sha256(rows_image)));
  end loop;
  return result;
end;
$image$;`;

export async function observer(label) {
  const session = await Session.open(label);
  await session.query(imageFunction);
  return session;
}

export async function image(session) {
  return lastJson(await session.query('select pg_temp.s12edtl_image();'));
}

export function row(fixture, kind) {
  const rows = {
    target: ['cms_content_entries', fixture.target],
    template: ['cms_template_versions', fixture.template],
    schema: ['cms_content_type_versions', fixture.schema],
  };
  assert.ok(Object.hasOwn(rows, kind));
  const [table, id] = rows[kind];
  return `select id, tableoid::oid as table_oid, ctid::text as tuple_id
    from platform_private.${table} where id = ${sql(id)}::uuid`;
}

export async function hold(session, fixture, kind) {
  return lastJson(
    await session.query(`begin;
    select row_to_json(locked) from (${row(fixture, kind)} for update) locked;`),
  );
}

export async function nowait(session, fixture, kind) {
  const rows = await session.query(`begin;
    do $probe$ begin begin
      perform locked.id from (${row(fixture, kind)} for update nowait) locked;
      perform set_config('s12edtl.probe', 'free', true);
    exception when lock_not_available then
      perform set_config('s12edtl.probe', '55P03', true);
    end; end $probe$;
    select current_setting('s12edtl.probe'); rollback;`);
  return rows.at(-1);
}

export async function edge(session, caller, holder) {
  return lastJson(
    await session.query(`select jsonb_build_object(
    'caller', ${caller.pid}, 'holder', ${holder.pid},
    'callerBackendStart', ${sql(caller.backendStart)},
    'holderBackendStart', ${sql(holder.backendStart)}, 'blocked', exists (
      select 1 from pg_stat_activity c, pg_stat_activity h
      where c.pid = ${caller.pid} and c.application_name = ${sql(caller.name)}
        and c.backend_start = ${sql(caller.backendStart)}::timestamptz
        and h.pid = ${holder.pid} and h.application_name = ${sql(holder.name)}
        and h.backend_start = ${sql(holder.backendStart)}::timestamptz
        and c.datname = ${sql(caller.database)} and h.datname = ${sql(holder.database)}
        and c.datname = current_database() and h.datname = c.datname
        and h.pid = any(pg_blocking_pids(c.pid))));`),
  );
}

function request(fixture, label) {
  const actor = fixture.actor;
  const title = `EDTL ${label}`;
  const values = {
    [fixture.titleField]: title,
    [fixture.relationField]: { targets: [{ targetId: fixture.target }] },
  };
  return {
    ...fixture.request,
    values,
    changedPaths: Object.keys(values).map((field) => `/fields/${field}`),
    idempotencyKey: `${nonce}-${label}`,
    context: {
      authUserId: actor.auth,
      actorPersonId: actor.person,
      actingPartyId: actor.party,
      actingContextId: actor.binding,
      sessionId: randomUUID(),
      requestId: randomUUID(),
      correlationId: randomUUID(),
      stepUpVerified: true,
      stepUpAt: new Date(Date.now() - 60_000).toISOString(),
    },
  };
}

export function startCreate(session, fixture, label) {
  const body = request(fixture, label);
  const actor = fixture.actor;
  const settings = {
    'request.jwt.claims': JSON.stringify({
      role: 'service_role',
      sub: actor.auth,
    }),
    'app.auth_user_id': actor.auth,
    'app.actor_auth_user_id': actor.auth,
    'app.actor_person_id': actor.person,
    'app.acting_party_id': actor.party,
    'app.acting_context_id': actor.binding,
    'app.cms_session_actor': '',
    'app.cms_session_party': '',
    'app.mfa_session_subject': '',
    'app.cms_rpc': '',
  };
  const select = Object.entries(settings)
    .map(([key, value]) => `set_config(${sql(key)}, ${sql(value)}, true)`)
    .join(', ');
  const work = session
    .query(
      `begin; select ${select}; set local role service_role;
    do $call$ declare response jsonb; result jsonb; transport text := current_user;
      code text; message text; detail text;
    begin
      begin
        response := platform_api.cms_create_entry(${jsonb(body)});
        result := jsonb_build_object('role', transport, 'state', '00000', 'response', response);
      exception when others then
        get stacked diagnostics code = returned_sqlstate, message = message_text, detail = pg_exception_detail;
        result := jsonb_build_object('role', transport, 'state', code, 'message', message, 'detail', detail);
      end;
      perform set_config('s12edtl.result', result::text, true);
    end $call$; reset role; select current_setting('s12edtl.result');`,
    )
    .then(lastJson);
  work.catch(() => {});
  return { body, work };
}
