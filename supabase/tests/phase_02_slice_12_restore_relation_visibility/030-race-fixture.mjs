import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  actorSettings,
  buildFixture,
  createRequest,
  FIELD,
  jsonb,
  relation,
  restoreRequest,
  revisionRequest,
  runScript,
  runValue,
  seedArticleTarget,
  sql,
} from '../../../infra/database-races/race-kit.mjs';
import { nonce, requireAltRelease, Session } from './040-race-session.mjs';
export { cleanup, requireAltRelease, Session } from './040-race-session.mjs';

let fixtureIds;

export function ids() {
  requireAltRelease();
  fixtureIds ??= buildFixture();
  return fixtureIds;
}

export function publicCall(functionName, request) {
  return JSON.parse(
    runScript(
      `begin; ${actorSettings(ids())}
    set local role service_role;
    select platform_api.${functionName}(${jsonb(request)}); commit;`,
      `${nonce}-public`,
    ),
  );
}

export function prepare(label) {
  const identity = ids();
  const targetId = seedArticleTarget(identity);
  const key = `${nonce}-${label}`;
  const created = publicCall(
    'cms_create_entry',
    createRequest(
      identity,
      {
        [FIELD.title]: `RRV source ${label}`,
        [FIELD.related]: relation(targetId),
      },
      `${key}-create`,
    ),
  );
  const entryId = created.entry?.id;
  const sourceId = created.revision?.id;
  assert.ok(
    entryId && sourceId,
    'real public create returned entry and source revision',
  );
  publicCall(
    'cms_create_revision',
    revisionRequest(
      identity,
      entryId,
      { [FIELD.title]: `RRV current ${label}` },
      '1',
      '1',
      `${key}-append`,
    ),
  );
  const request = restoreRequest(
    identity,
    entryId,
    sourceId,
    '2',
    `${key}-restore`,
  );
  const assignmentId =
    runValue(`select id from platform_private.cms_entry_assignments
    where entry_id = ${sql(targetId)}::uuid and assignee_person_id = ${sql(identity.creatorPerson)}::uuid
      and capability_key = 'cms.author' and state = 'active';`);
  assert.match(
    assignmentId,
    /^[0-9a-f-]{36}$/u,
    'one actual caller assignment observed',
  );
  return { label, targetId, assignmentId, entryId, sourceId, request };
}

export async function observer() {
  const session = await Session.open('observer');
  const source = readFileSync(
    new URL('./000-fixture.sqlinc', import.meta.url),
    'utf8',
  );
  const from = source.indexOf(
    'create or replace function pg_temp.s12rv_image(',
  );
  const to = source.indexOf(
    'create or replace function pg_temp.s12rv_prepare(',
  );
  assert.ok(from >= 0 && to > from, 'exact image-only SQL utility anchors');
  await session.query(source.slice(from, to));
  return session;
}

export const lastJson = (rows) =>
  JSON.parse(rows.filter((row) => row.startsWith('{')).at(-1));
export async function image(session, fixture) {
  return lastJson(
    await session.query(
      `select pg_temp.s12rv_image(${sql(fixture.targetId)}::uuid);`,
    ),
  );
}
export async function sourceImage(session, fixture) {
  return (
    await session.query(
      `select pg_temp.s12rv_source_image(${sql(fixture.sourceId)}::uuid);`,
    )
  ).at(-1);
}

export async function facts(session, fixture) {
  const identity = ids();
  return lastJson(
    await session.query(`begin; ${actorSettings(identity)}
    select set_config('app.cms_rpc', 'true', true);
    select platform_private.cms_acting_party(${jsonb(fixture.request)},
      platform_private.cms_actor(${jsonb(fixture.request)}));
    select jsonb_build_object(
    'sourceAuthority', platform_private.cms_authority_origin(${sql(identity.creatorAuth)}::uuid,
      ${sql(identity.organization)}::uuid, 'cms.author', ${sql(fixture.entryId)}::uuid) is not null,
    'visible', platform_private.cms_relation_target_visible(${sql(identity.creatorAuth)}::uuid,
      ${sql(identity.organization)}::uuid, ${sql(fixture.targetId)}::uuid, 'article'),
    'lifecycle', (select lifecycle from platform_private.cms_content_entries where id = ${sql(fixture.targetId)}::uuid),
    'targetVersion', (select version::text from platform_private.cms_content_entries where id = ${sql(fixture.targetId)}::uuid),
    'assignment', (select state from platform_private.cms_entry_assignments where id = ${sql(fixture.assignmentId)}::uuid),
    'pins', (select jsonb_agg(expected_target_version) from platform_private.cms_entry_relations
      where revision_id = ${sql(fixture.sourceId)}::uuid)); rollback;`),
  );
}

export function mutation(fixture, kind) {
  if (kind === 'unassign')
    return `update platform_private.cms_entry_assignments
    set state = 'revoked', version = version + 1, updated_at = clock_timestamp()
    where id = ${sql(fixture.assignmentId)}::uuid;`;
  assert.equal(kind, 'archive');
  return `update platform_private.cms_content_entries set lifecycle = 'archived', updated_at = clock_timestamp()
    where id = ${sql(fixture.targetId)}::uuid;`;
}

export function startRestore(session, fixture) {
  const promise = session
    .query(
      `begin; ${actorSettings(ids())} set local role service_role;
    do $rrv$ declare response jsonb; result jsonb; transport text := current_user; begin
      begin
        response := platform_api.cms_restore_revision(${jsonb(fixture.request)});
        result := jsonb_build_object('role', transport, 'state', '00000', 'response', response);
      exception when others then
        result := jsonb_build_object('role', transport, 'state', sqlstate, 'message', sqlerrm);
      end;
      perform set_config('s12rrv.result', result::text, true);
    end $rrv$;
    reset role; select current_setting('s12rrv.result');`,
    )
    .then(lastJson);
  promise.catch(() => {});
  return promise;
}

export const targetRow = (fixture) =>
  `select id from platform_private.cms_content_entries where id = ${sql(fixture.targetId)}::uuid`;
export const assignmentRow = (fixture) =>
  `select id from platform_private.cms_entry_assignments where id = ${sql(fixture.assignmentId)}::uuid`;
export const schemaRow = () =>
  `select id from platform_private.cms_content_type_versions where id = ${sql(ids().versionId)}::uuid`;

export async function nowait(session, rowSelect) {
  const rows = await session.query(`begin;
    do $rrv$ begin begin
      perform locked.id from (${rowSelect} for update nowait) locked;
      perform set_config('s12rrv.probe', 'free', true);
    exception when lock_not_available then
      perform set_config('s12rrv.probe', '55P03', true);
    end; end $rrv$;
    select current_setting('s12rrv.probe'); rollback;`);
  return rows.at(-1);
}

export async function blockedBy(observerSession, waiter, holder, rowSelect) {
  const deadline = Date.now() + 8_000;
  // Synchronize on an exact observed server lock edge, never elapsed time,
  // pg_stat_activity.wait_event alone, or an inferred/passed timeout.
  while (Date.now() < deadline) {
    const rows = await observerSession.query(`select exists (
      select 1 from pg_stat_activity w, pg_stat_activity h
      where w.pid = ${waiter.pid} and w.application_name = ${sql(waiter.name)}
        and h.pid = ${holder.pid} and h.application_name = ${sql(holder.name)}
        and h.pid = any(pg_blocking_pids(w.pid)))::text;`);
    if (rows.at(-1) === 'true') {
      assert.equal(
        await nowait(observerSession, rowSelect),
        '55P03',
        'exact tuple remains locked',
      );
      return;
    }
    assert.ok(
      waiter.pending,
      'writer completed before the required exact blocker was observed',
    );
  }
  throw new Error(
    'exact owned backend/tuple blocker not observed before bounded deadline',
  );
}

export async function bounded(promise, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), 10_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
