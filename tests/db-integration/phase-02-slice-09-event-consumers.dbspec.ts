/**
 * Slice 09 G1/AC-916 real-database integration: the PRODUCTION event-consumer
 * composition (`createProductionEventConsumers`) runs over the real
 * `platform_api` boundary of the disposable local Supabase database.
 *
 * Only the transport is substituted: a `fetch` that maps
 * `/rest/v1/rpc/<name>` to `docker exec psql` as `service_role` (the role the
 * Worker holds in production) and answers the Supabase Auth admin factor list.
 * Every row is produced by a named producer RPC; nothing is inserted by hand
 * except the `auth.users` row a provider owns. The suite COMMITS its fixtures.
 * Run it right after `pnpm db:reset` (`pnpm test:db-integration`) and run
 * `pnpm db:reset` again afterwards; see tests/db-integration/README.md.
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import type { ServerEnvironment } from '@wejammin/config/environment';
import { beforeAll, describe, expect, it } from 'vitest';

import { parseOutboxClaim } from '../../apps/worker/src/async-runtime-parsing';
import { createProductionEventConsumers } from '../../apps/worker/src/event-consumers/production';

const CONTAINER = process.env.S09_DB_CONTAINER ?? 'supabase_db_wejammin';
const ENVIRONMENT = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'local',
  SUPABASE_SECRET_KEY: 'sb_secret_0123456789abcdef',
  SUPABASE_URL: 'https://staging.example.supabase.co',
} as unknown as ServerEnvironment;

const psql = (sql: string): string =>
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      CONTAINER,
      'psql',
      '-X',
      '-q',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-At',
    ],
    { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim();

const literal = (value: unknown): string =>
  value === null || value === undefined
    ? 'NULL'
    : typeof value === 'object'
      ? `'${JSON.stringify(value).replaceAll("'", "''")}'`
      : `'${String(value).replaceAll("'", "''")}'`;

/** Calls `platform_api.<operation>` as service_role with named arguments. */
const callRpc = (operation: string, args: Record<string, unknown>): unknown => {
  const settable = psql(
    `select proretset::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'platform_api' and p.proname = ${literal(operation)}`,
  );
  if (settable === '') throw new Error(`unknown rpc ${operation}`);
  const call = `platform_api.${operation}(${Object.entries(args)
    .map(([name, value]) => `${name} => ${literal(value)}`)
    .join(', ')})`;
  const select =
    settable === 'true'
      ? `select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from ${call} t`
      : `select to_jsonb(r) from (select ${call} as r) s`;
  const out = psql(`begin; set local role service_role; ${select}; commit;`);
  return out === '' ? null : (JSON.parse(out) as unknown);
};

const providerStatus = new Map<string, 'verified' | 'unverified'>();
const dbFetch = (async (
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> => {
  const url = String(input instanceof Request ? input.url : input);
  const rpc = /\/rest\/v1\/rpc\/([a-z0-9_]+)$/u.exec(url);
  if (rpc?.[1] !== undefined) {
    const body =
      typeof init?.body === 'string' && init.body !== '' ? init.body : '{}';
    return rpcResponse(rpc[1], JSON.parse(body) as Record<string, unknown>);
  }
  const factors = /\/auth\/v1\/admin\/users\/([0-9a-f-]{36})\/factors$/u.exec(
    url,
  );
  if (factors?.[1] !== undefined) {
    const rows = psql(
      `select coalesce(jsonb_agg(provider_factor_id), '[]'::jsonb) from identity.mfa_factor_registry where auth_user_id = '${factors[1]}'`,
    );
    const ids = JSON.parse(rows) as string[];
    return Response.json(
      ids.map((id) => ({ id, status: providerStatus.get(id) ?? 'verified' })),
    );
  }
  throw new Error(`unexpected url ${url}`);
}) as unknown as typeof fetch;

const rpcResponse = (
  operation: string,
  args: Record<string, unknown>,
): Response => {
  try {
    return Response.json(callRpc(operation, args));
  } catch (error) {
    return new Response(
      JSON.stringify({
        message: String((error as Error).message).slice(0, 200),
      }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }
};

const logs: Array<Record<string, unknown>> = [];
const logger = {
  debug: () => 'written' as const,
  error: (details: object) => (logs.push(details as never), 'written' as const),
  fatal: () => 'written' as const,
  info: (details: object) => (logs.push(details as never), 'written' as const),
  warn: (details: object) => (logs.push(details as never), 'written' as const),
};
const consumers = createProductionEventConsumers(ENVIRONMENT, dbFetch, {
  logger: logger as never,
});

const fixtureRpc = (operation: string, args: Record<string, unknown>) =>
  callRpc(operation, {
    ...args,
    p_request_id: randomUUID(),
    p_correlation_id: randomUUID(),
  }) as Record<string, unknown>;

const user = randomUUID();
const session = randomUUID();
const other = randomUUID();
const otherSession = randomUUID();

const createUser = (id: string, sessionId: string): void => {
  psql(
    `insert into auth.users(id, email, email_confirmed_at) values ('${id}', 's09-db-${id}@example.test', now());
     select platform_api.auth_bootstrap('${id}', decode(repeat('a1', 32), 'hex'), decode(repeat('b2', 32), 'hex'), gen_random_uuid(), gen_random_uuid());
     select platform_api.auth_session_register('${id}', '${sessionId}', now(), gen_random_uuid(), gen_random_uuid());`,
  );
};

const enroll = (id: string, sessionId: string, name: string): string => {
  const mfaVersion = psql(
    `select mfa_version::text from identity.auth_user_bindings where auth_user_id = '${id}'`,
  );
  const begun = fixtureRpc('auth_mfa_enrollment_begin', {
    p_auth_user_id: id,
    p_friendly_name: name,
    p_expected_version: mfaVersion,
  });
  const finished = fixtureRpc('auth_mfa_enrollment_finish', {
    p_auth_user_id: id,
    p_provider_factor_id: randomUUID(),
    p_friendly_name: name,
    p_expected_version: String(begun.version),
    p_session_id: sessionId,
  });
  const factorId = String(finished.factorId);
  const version = String(finished.version);
  fixtureRpc('auth_mfa_enrollment_verify_prepare', {
    p_auth_user_id: id,
    p_factor_id: factorId,
    p_expected_version: version,
  });
  fixtureRpc('auth_mfa_enrollment_verify_settle', {
    p_auth_user_id: id,
    p_factor_id: factorId,
    p_expected_version: version,
    p_session_id: sessionId,
    p_new_session_id: sessionId,
    p_issued_at: new Date().toISOString(),
  });
  return factorId;
};

const factorState = (factorId: string): string =>
  psql(
    `select state::text from identity.mfa_factor_registry where id = '${factorId}'`,
  );

/** The relay step: claim real outbox rows and parse them as the Worker does. */
const claimEnvelopes = () => {
  const rows = callRpc('claim_outbox_batch', {
    p_lease_token: randomUUID(),
    p_lease_seconds: 60,
    p_batch_size: 100,
  }) as unknown[];
  return rows.map((row) => {
    const claim = parseOutboxClaim(row);
    if (claim === null) throw new Error('relay refused a real outbox row');
    return claim;
  });
};

let factorA = '';
let factorB = '';

describe('Slice 09 event consumers over the real database boundary', () => {
  beforeAll(() => {
    expect(
      psql(
        `select (to_regprocedure('platform_api.in_app_notification_record(jsonb)') is not null
           and to_regprocedure('platform_api.auth_mfa_reconciling_age()') is not null)::text`,
      ),
    ).toBe('true');
    createUser(user, session);
    createUser(other, otherSession);
    factorA = enroll(user, session, 'Phone');
    factorB = enroll(other, otherSession, 'Laptop');
  });

  it('[P2-S09-AC-913] [P2-S09-AC-916] [P2-S09-AC-689] the relay claims real consumer events and the registry acknowledges every one', async () => {
    const claims = claimEnvelopes();
    const types = new Set(claims.map((claim) => claim.envelope.eventType));
    expect(types).toContain('identity.mfa-factor.changed.v1');
    expect(types).toContain('identity.security-notification.requested.v1');
    for (const claim of claims)
      await expect(
        consumers.registry.process({ body: claim.envelope, attempts: 1 }),
      ).resolves.toEqual({ outcome: 'ack' });
    // A verified (not reconciling) factor is acknowledged without a settlement.
    expect(factorState(factorA)).toBe('verified');
  });

  it('[P2-S09-AC-916] the in-app notifier recorded one intent per holder, identifiers only, and a replay writes nothing', async () => {
    const intents = psql(
      `select count(*)::text || '|' || count(distinct recipient_auth_user_id)::text || '|' || bool_and(safe_template_code = 'mfa_factor_added')::text
         from identity.in_app_notification_intents`,
    );
    expect(intents).toBe('2|2|true');
    const holders = psql(
      `select string_agg(recipient_auth_user_id::text, ',' order by recipient_auth_user_id) from identity.in_app_notification_intents`,
    );
    expect(holders).toBe([user, other].sort().join(','));
    const notification = psql(
      `select o.aggregate_id::text || '|' || o.aggregate_version::text || '|' || o.correlation_id::text
         from platform_private.outbox_events o
         join identity.in_app_notification_intents i on i.notification_id = o.aggregate_id
        where i.recipient_auth_user_id = '${user}'
          and o.event_type = 'identity.security-notification.requested.v1'`,
    ).split('|');
    const replay = {
      eventId: randomUUID(),
      eventType: 'identity.security-notification.requested.v1',
      schemaVersion: 1,
      aggregateType: 'security_event',
      aggregateId: notification[0],
      aggregateVersion: notification[1],
      correlationId: notification[2],
      causationId: null,
    };
    await expect(
      consumers.registry.process({ body: replay, attempts: 2 }),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(
      psql(
        `select count(*)::text from identity.in_app_notification_intents where recipient_auth_user_id = '${user}'`,
      ),
    ).toBe('1');
  });

  it('[P2-S09-AC-916] a notification request for an unknown security event is dead-lettered once and acknowledged', async () => {
    const unknown = randomUUID();
    const body = {
      eventId: randomUUID(),
      eventType: 'identity.security-notification.requested.v1',
      schemaVersion: 1,
      aggregateType: 'security_event',
      aggregateId: unknown,
      aggregateVersion: '1',
      correlationId: randomUUID(),
      causationId: null,
    };
    await expect(
      consumers.registry.process({ body, attempts: 1 }),
    ).resolves.toEqual({ outcome: 'ack' });
    await expect(
      consumers.registry.process({ body, attempts: 1 }),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(
      psql(
        `select count(*)::text || '|' || min(reason_code) from platform_private.consumer_dead_letters where consumer = 'identity.security-notifier' and event_id = '${body.eventId}'`,
      ),
    ).toBe('1|SOURCE_RECORD_NOT_FOUND');
  });

  it('[P2-S09-AC-689] a grant event for an unknown grant is dead-lettered and acknowledged', async () => {
    const body = {
      eventId: randomUUID(),
      eventType: 'cms.capability.grant.changed.v1',
      schemaVersion: 1,
      aggregateType: 'cms_capability_grant',
      aggregateId: randomUUID(),
      aggregateVersion: '1',
      correlationId: randomUUID(),
      causationId: null,
    };
    await expect(
      consumers.registry.process({ body, attempts: 1 }),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(
      psql(
        `select reason_code from platform_private.consumer_dead_letters where consumer = 'cms.capability-grant-consumer' and event_id = '${body.eventId}'`,
      ),
    ).toBe('SOURCE_RECORD_NOT_FOUND');
  });

  it('[P2-S09-AC-913] [P2-S09-AC-908] the reconciler settles a reconciling factor from the provider status and the gauge tracks it', async () => {
    fixtureRpc('auth_mfa_factor_mark_reconciling', {
      p_auth_user_id: user,
      p_factor_id: factorA,
    });
    expect(factorState(factorA)).toBe('reconciling');
    logs.length = 0;
    await consumers.reconcilingAge.observe();
    const sample = logs.find(
      (entry) => entry.eventName === 'identity.mfa.reconciling_age',
    );
    expect(sample?.outcome).toBe('success');
    expect(sample?.metrics).toMatchObject({
      'identity.mfa.reconciling.count': 1,
    });
    expect(
      (sample?.metrics as Record<string, number>)[
        'identity.mfa.reconciling.age.seconds'
      ],
    ).toBeGreaterThanOrEqual(0);

    const changed = claimEnvelopes().filter(
      (claim) =>
        claim.envelope.eventType === 'identity.mfa-factor.changed.v1' &&
        claim.envelope.aggregateId === factorA,
    );
    expect(changed.length).toBeGreaterThan(0);
    const newest = changed[changed.length - 1];
    if (newest === undefined) throw new Error('no reconciling event relayed');
    await expect(
      consumers.registry.process({ body: newest.envelope, attempts: 1 }),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(factorState(factorA)).toBe('verified');

    logs.length = 0;
    await consumers.reconcilingAge.observe();
    expect(
      logs.find((entry) => entry.eventName === 'identity.mfa.reconciling_age')
        ?.metrics,
    ).toMatchObject({
      'identity.mfa.reconciling.count': 0,
      'identity.mfa.reconciling.age.seconds': 0,
    });
  });

  it('[P2-S09-AC-913] a provider that reports the factor unverified never leaves it verified: the registry expires it because its enrollment window is gone', async () => {
    fixtureRpc('auth_mfa_factor_mark_reconciling', {
      p_auth_user_id: other,
      p_factor_id: factorB,
    });
    const providerId = psql(
      `select provider_factor_id::text from identity.mfa_factor_registry where id = '${factorB}'`,
    );
    providerStatus.set(providerId, 'unverified');
    const event = claimEnvelopes().filter(
      (claim) =>
        claim.envelope.eventType === 'identity.mfa-factor.changed.v1' &&
        claim.envelope.aggregateId === factorB,
    );
    const newest = event[event.length - 1];
    if (newest === undefined) throw new Error('no reconciling event relayed');
    await expect(
      consumers.registry.process({ body: newest.envelope, attempts: 1 }),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(factorState(factorB)).toBe('expired');
  });

  it('[P2-S09-AC-913] a factor the registry no longer holds is acknowledged without a write', async () => {
    const body = {
      eventId: randomUUID(),
      eventType: 'identity.mfa-factor.changed.v1',
      schemaVersion: 1,
      aggregateType: 'mfa_factor',
      aggregateId: randomUUID(),
      aggregateVersion: '3',
      correlationId: randomUUID(),
      causationId: null,
    };
    await expect(
      consumers.registry.process({ body, attempts: 1 }),
    ).resolves.toEqual({ outcome: 'ack' });
  });
});
