/**
 * Real Supabase API path for the PostgREST gate suites.
 *
 * Requests go through the same Kong -> PostgREST v16 path the Worker uses
 * (`${SUPABASE_URL}/rest/v1/rpc/<name>`), so the role and claims GUCs that
 * PostgREST derives from a bearer token are the ones the database sees.
 * Nothing here sets a GUC by hand. The JWT signing secret is read at runtime
 * from the local stack and never lives in source.
 */
import { execFileSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';

const DB_CONTAINER = process.env.S09_DB_CONTAINER ?? 'supabase_db_wejammin';
const REST_CONTAINER =
  process.env.POSTGREST_API_REST_CONTAINER ?? 'supabase_rest_wejammin';
const DEFAULT_API_URL = 'http://127.0.0.1:54321';

export type ApiRole = 'anon' | 'authenticated' | 'service_role';

export type RpcOutcome = Readonly<{
  status: number;
  /** PostgREST error `message` (a P0001 application code such as UNAUTHENTICATED) or ''. */
  message: string;
  /** PostgREST error `code` (SQLSTATE) or ''. */
  code: string;
  /** Parsed JSON body (null when empty). */
  body: unknown;
}>;

const statusEnv = (): Readonly<Record<string, string>> => {
  try {
    const output = execFileSync(
      'pnpm',
      ['exec', 'supabase', 'status', '-o', 'env'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    );
    const entries = output
      .split('\n')
      .map((line) => /^([A-Z_]+)="(.*)"$/u.exec(line))
      .filter((match): match is RegExpExecArray => match !== null)
      .map((match): [string, string] => [match[1] ?? '', match[2] ?? '']);
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
};

const restContainerSecret = (): string => {
  const raw = execFileSync(
    'docker',
    [
      'inspect',
      REST_CONTAINER,
      '--format',
      '{{range .Config.Env}}{{println .}}{{end}}',
    ],
    { encoding: 'utf8' },
  )
    .split('\n')
    .find((line) => line.startsWith('PGRST_JWT_SECRET='));
  if (raw === undefined)
    throw new Error(
      `${REST_CONTAINER} has no PGRST_JWT_SECRET; is the API running?`,
    );
  const value = raw.slice('PGRST_JWT_SECRET='.length);
  if (!value.startsWith('{')) return value;
  const jwks = JSON.parse(value) as {
    keys: ReadonlyArray<{ kty: string; k?: string }>;
  };
  const symmetric = jwks.keys.find(
    (key) => key.kty === 'oct' && key.k !== undefined,
  );
  if (symmetric?.k === undefined)
    throw new Error('the local PostgREST JWKS has no symmetric (HS256) key');
  return Buffer.from(symmetric.k, 'base64url').toString('utf8');
};

const environment = statusEnv();
export const API_URL = environment.API_URL ?? DEFAULT_API_URL;
const JWT_SECRET = environment.JWT_SECRET ?? restContainerSecret();

const encode = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

/** Mints an HS256 JWT the local PostgREST accepts. */
export const mintJwt = (claims: Readonly<Record<string, unknown>>): string => {
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    ...claims,
    exp: Math.floor(Date.now() / 1000) + 600,
  });
  const signature = createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
};

export const tokenFor = (
  role: ApiRole,
  extra: Readonly<Record<string, unknown>> = {},
): string => mintJwt({ role, ...extra });

export const userToken = (
  userId: string,
  aal: 'aal1' | 'aal2' = 'aal1',
): string => mintJwt({ role: 'authenticated', sub: userId, aal });

/** Calls `<schema>.<name>` through Kong -> PostgREST. */
export const callRpc = async (
  name: string,
  token: string | null,
  body: Readonly<Record<string, unknown>>,
  schema = 'platform_api',
): Promise<RpcOutcome> => {
  const response = await fetch(`${API_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      ...(token === null ? {} : { authorization: `Bearer ${token}` }),
      'accept-profile': schema,
      'content-profile': schema,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = ((): unknown => {
    try {
      return text === '' ? null : (JSON.parse(text) as unknown);
    } catch {
      return text;
    }
  })();
  const record =
    typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  return {
    status: response.status,
    message: typeof record.message === 'string' ? record.message : '',
    code: typeof record.code === 'string' ? record.code : '',
    body: parsed,
  };
};

/** Runs SQL as the database owner (fixtures and catalog queries only). */
export const psql = (sql: string): string =>
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      DB_CONTAINER,
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
      '-F',
      '|',
    ],
    { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim();

/** Inserts an `auth.users` row (the only hand-made fixture) and returns its id. */
export const createAuthUser = (id: string = randomUUID()): string => {
  psql(
    `insert into auth.users(id) values ('${id}') on conflict (id) do nothing`,
  );
  return id;
};

export type FunctionArgument = Readonly<{ name: string; type: string }>;
export type ApiFunction = Readonly<{
  name: string;
  args: readonly FunctionArgument[];
  anon: boolean;
  authenticated: boolean;
  serviceRole: boolean;
}>;

/** Every function in an exposed API schema with its caller-role execute grants. */
export const listApiFunctions = (
  schema = 'platform_api',
): readonly ApiFunction[] => {
  const rows = psql(`
    select p.proname,
           coalesce((select string_agg(coalesce(p.proargnames[t.ord], '') || ':' || format_type(t.typ, null), ',' order by t.ord)
                       from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality as t(typ, ord)
                      where coalesce(p.proargmodes[t.ord], 'i') in ('i', 'b', 'v')), ''),
           has_function_privilege('anon', p.oid, 'execute'),
           has_function_privilege('authenticated', p.oid, 'execute'),
           has_function_privilege('service_role', p.oid, 'execute')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = '${schema}' and p.prokind = 'f'
     order by 1`);
  return rows
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => {
      const [name = '', args = '', anon, authenticated, serviceRole] =
        line.split('|');
      return {
        name,
        args:
          args === ''
            ? []
            : args.split(',').map((entry) => {
                const [argName = '', type = ''] = entry.split(':');
                return { name: argName, type };
              }),
        anon: anon === 't',
        authenticated: authenticated === 't',
        serviceRole: serviceRole === 't',
      };
    });
};

/** A JSON body naming every argument of `fn`, using `{ context }` for `p_request`. */
export const bodyFor = (
  fn: ApiFunction,
  context: Readonly<Record<string, unknown>>,
  request: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    fn.args.map((argument) => [
      argument.name,
      argument.name === 'p_request' ? { ...request, context } : null,
    ]),
  );

const JWT_ROLE_ROOTS = String.raw`request\.jwt\.claim|request_jwt_claim`;

/**
 * Names of the `platform_api` functions whose body, directly or through any
 * function it calls (matched by name across the internal schemas), reads the
 * caller's JWT claims. Computed from the live catalog so a new function that
 * reaches a claims gate is covered the moment it exists.
 */
export const claimReadingApiFunctions = (): ReadonlySet<string> => {
  const rows = psql(`
    with recursive internal as (
      select p.oid, p.proname::text as name, n.nspname::text as schema, p.prosrc
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('platform_api','platform_private','profile_api','profile_private',
                           'identity_private','identity_api','public_api')
         and p.prokind = 'f'
    ), reach(oid) as (
      select oid from internal where prosrc ~ '${JWT_ROLE_ROOTS}'
      union
      select i.oid from internal i join reach r on true
        join internal callee on callee.oid = r.oid
       where i.prosrc ~ ('\\m' || callee.name || '\\M')
    )
    select distinct i.name from internal i join reach r on r.oid = i.oid
     where i.schema = 'platform_api' order by 1`);
  return new Set(rows.split('\n').filter((line) => line !== ''));
};

/**
 * The credential the Worker holds in production form. Locally Kong maps the
 * stack's opaque `sb_secret_` key to the service_role JWT, so using it
 * exercises the Worker's apikey-only header path end to end. Read from the
 * running gateway; falls back to a minted service_role JWT.
 */
export const workerServiceCredential = (): string => {
  try {
    const key = execFileSync(
      'docker',
      [
        'exec',
        process.env.POSTGREST_API_KONG_CONTAINER ?? 'supabase_kong_wejammin',
        'sh',
        '-c',
        "grep -o 'sb_secret_[A-Za-z0-9_-]*' /home/kong/kong.yml | head -1",
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    if (key.startsWith('sb_secret_')) return key;
  } catch {
    // fall through to the minted credential
  }
  return tokenFor('service_role');
};

/** Creates the person for an auth user through the production `identity_create`. */
export const createPerson = (authUserId: string): string => {
  const output = psql(`
    begin;
    select set_config('app.auth_user_id', '${authUserId}', true),
           set_config('app.idempotency_key_hash', 'api-gate-person-${authUserId}', true),
           set_config('app.request_hash', 'api-gate-person-${authUserId}', true),
           set_config('app.request_id', gen_random_uuid()::text, true),
           set_config('app.correlation_id', gen_random_uuid()::text, true);
    select (platform_api.identity_create() ->> 'personId') as person_id \\gset
    commit;
    select :'person_id';`);
  return output.split('\n').at(-1) ?? '';
};

export type CmsOwner = Readonly<{
  authUserId: string;
  personId: string;
  organizationId: string;
}>;

/**
 * The CMS owner the operator bootstrap produces. Every row comes from the
 * production functions: `identity_create` makes the person and
 * `initialize_cms_owner` (the operator-only bootstrap, which establishes its
 * actor context through request.jwt.claims) makes the owner organization and
 * capability grants. Idempotent: an already initialized database returns the
 * recorded owner.
 */
export const ensureCmsOwner = (): CmsOwner => {
  const existing = psql(
    `select auth_user_id || '|' || person_id || '|' || organization_id from platform_private.cms_owner_initialization limit 1`,
  );
  if (existing !== '') {
    const [authUserId = '', personId = '', organizationId = ''] =
      existing.split('|');
    return { authUserId, personId, organizationId };
  }
  const authUserId = randomUUID();
  const email = `owner-${authUserId.slice(0, 8)}@example.test`;
  psql(
    `insert into auth.users(id, email, email_confirmed_at) values ('${authUserId}', '${email}', now())`,
  );
  const personId = createPerson(authUserId);
  const organizationId = psql(`
    select platform_private.initialize_cms_owner('${authUserId}', '${personId}', '${email}',
      now() + interval '3 days', gen_random_uuid(), false) ->> 'organizationId'`);
  return { authUserId, personId, organizationId };
};
