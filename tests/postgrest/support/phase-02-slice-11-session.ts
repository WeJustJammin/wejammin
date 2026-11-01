/** Local composition only: real binding/session RPCs and production token/cookie
 * parsing. The provider-user adapter accepts only a token already authenticated
 * by PostgREST's identity_context_bind. This is not hosted MFA/provider evidence. */
import { createHash, randomUUID } from 'node:crypto';

import type { ServerEnvironment } from '@wejammin/config/environment';
import { expect } from 'vitest';

import { normalizeAuthProductionOptions } from '../../../apps/worker/src/authentication/production-configuration';
import { sessionCookies } from '../../../apps/worker/src/authentication/production-cookie';
import { createSessionDependencies } from '../../../apps/worker/src/authentication/production-session';
import { verifyTokenResponse } from '../../../apps/worker/src/authentication/production-token';
import type { CapabilityResolver } from '../../../apps/worker/src/content-schema-registry/production-types';
import { createCmsApp, ownerSession } from './cms-app';
import {
  API_URL,
  callRpc,
  mintJwt,
  psql,
  tokenFor,
  workerServiceCredential,
} from './stack';

export type S11SessionActor = Readonly<{
  authUserId: string;
  personId: string;
  actingPartyId: string;
}>;
export type S11TokenProof = 'fresh' | 'stale' | 'future' | 'none' | 'aal1';

export const s11Environment = (): ServerEnvironment => ({
  SUPABASE_URL: API_URL,
  SUPABASE_SECRET_KEY: workerServiceCredential(),
  APP_ENVIRONMENT: 'development',
  APP_RELEASE: 'slice-11-lifecycle',
});

/** Safe internal scalar extraction: never print a response carrying token data. */
export const s11String = (value: unknown, key: string): string => {
  if (typeof value !== 'object' || value === null)
    throw new Error('Lifecycle resource is not an object');
  const field = (value as Record<string, unknown>)[key];
  if (typeof field !== 'string' || field === '')
    throw new Error(`Lifecycle resource lacks ${key}`);
  return field;
};

/** Existing identity creation foundation; no member, capability or review rows. */
export const createS11SchemaReviewer = async (): Promise<S11SessionActor> => {
  const authUserId = randomUUID();
  psql(`insert into auth.users(id, email, email_confirmed_at)
    values ('${authUserId}', 's11-${authUserId}@example.test', now())`);
  const hash = createHash('sha256').update(randomUUID()).digest('hex');
  const boot = await callRpc('auth_bootstrap', tokenFor('service_role'), {
    p_auth_user_id: authUserId,
    p_key_hash: `\\x${hash}`,
    p_request_hash: `\\x${hash}`,
    p_request_id: randomUUID(),
    p_correlation_id: randomUUID(),
  });
  expect(boot.status, 'reviewer auth_bootstrap').toBe(200);
  const personId = s11String(boot.body, 'personId');
  return { authUserId, personId, actingPartyId: personId };
};

/** Opt-in discovery adapter: real current grants, receipt and target assignment.
 * SQL rechecks authority. Default production capability discovery remains unproven. */
export const s11StoredCapabilities: CapabilityResolver = (session, request) => {
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
  if (
    !uuid.test(session.authUserId) ||
    !uuid.test(session.personId ?? '') ||
    !uuid.test(session.actingPartyId ?? '')
  )
    return [];
  const reviewId = /\/schema-reviews\/([0-9a-f-]{36})(?:\/|$)/iu.exec(
    new URL(request.url).pathname,
  )?.[1];
  const review =
    reviewId !== undefined && uuid.test(reviewId)
      ? `'${reviewId}'::uuid`
      : 'null::uuid';
  const raw =
    psql(`select coalesce(jsonb_agg(distinct capability), '[]'::jsonb)::text from (
    select g.capability_code as capability
      from identity_private.organization_actor_grant g
     where g.organization_id = '${session.actingPartyId}' and g.person_id = '${session.personId}'
       and platform_private.cms_person_holds_capability(g.organization_id, g.person_id, g.capability_code)
    union all
    select 'cms.schema_review.assign' from platform_private.cms_owner_initialization r
     where r.auth_user_id = '${session.authUserId}' and r.person_id = '${session.personId}'
       and r.organization_id = '${session.actingPartyId}'
       and platform_private.cms_person_holds_capability(r.organization_id, r.person_id, 'cms.schema_designer')
    union all
    select a.capability_key from platform_private.cms_schema_review_assignments a
      join platform_private.cms_schema_reviews r on r.id = a.review_id and r.owner_id = a.owner_id
     where a.review_id = ${review} and a.reviewer_person_ref = '${session.personId}'
       and '${session.actingPartyId}' = '${session.personId}'
       and a.state = 'active' and a.starts_at <= clock_timestamp() and a.ends_at > clock_timestamp()
       and a.actions @> array['read','decide']::text[]
  ) capabilities`);
  const parsed: unknown = JSON.parse(raw);
  if (
    !Array.isArray(parsed) ||
    !parsed.every((item): item is string => typeof item === 'string')
  )
    throw new Error('Stored capability projection is invalid');
  return parsed;
};

export const createS11Session = async (
  actor: S11SessionActor,
  proof: S11TokenProof = 'fresh',
) => {
  const sessionId = randomUUID();
  const clientBindingId = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const offset = proof === 'stale' ? -3600 : proof === 'future' ? 3600 : -5;
  const token = mintJwt({
    role: 'authenticated',
    sub: actor.authUserId,
    session_id: sessionId,
    iss: `${API_URL}/auth/v1`,
    aud: 'authenticated',
    iat: now,
    aal: proof === 'aal1' ? 'aal1' : 'aal2',
    amr: proof === 'none' ? [] : [{ method: 'totp', timestamp: now + offset }],
  });
  const bound = await fetch(`${API_URL}/rest/v1/rpc/identity_context_bind`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'accept-profile': 'platform_api',
      'content-profile': 'platform_api',
      'content-type': 'application/json',
      'x-client-binding-id': clientBindingId,
      'idempotency-key': randomUUID(),
    },
    body: JSON.stringify({
      p_context_id: actor.actingPartyId,
      p_deliberate_confirmation: true,
      p_client_binding_id: clientBindingId,
    }),
  });
  expect(bound.status, 'authenticated identity_context_bind').toBe(200);
  const bindingId = s11String(await bound.json(), 'bindingId');
  // PostgREST has verified this exact signed token. Only the external /user
  // lookup is supplied locally; every session and CMS RPC uses real transport.
  const providerFetch: typeof fetch = async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === `${API_URL}/auth/v1/user`) {
      const headers = new Headers(init?.headers);
      return headers.get('authorization') === `Bearer ${token}`
        ? Response.json({ id: actor.authUserId })
        : Response.json({ message: 'Invalid local token' }, { status: 401 });
    }
    return fetch(input, init);
  };
  const environment = s11Environment();
  const config = normalizeAuthProductionOptions({
    environment,
    fetchImpl: providerFetch,
  });
  const verified = await verifyTokenResponse(
    { access_token: token, refresh_token: randomUUID() },
    config,
    new AbortController().signal,
  );
  if (!verified.ok) throw new Error('Local token verification failed');
  const registered = await callRpc(
    'auth_session_register',
    tokenFor('service_role'),
    {
      p_auth_user_id: actor.authUserId,
      p_session_id: sessionId,
      p_issued_at: new Date(now * 1000).toISOString(),
      p_request_id: randomUUID(),
      p_correlation_id: randomUUID(),
    },
  );
  expect(registered.status, 'auth_session_register').toBe(200);
  const cookies = await sessionCookies(verified.value, config);
  const cookie = cookies.map((value) => value.split(';')[0]).join('; ');
  const csrf = cookies
    .find((value) => value.startsWith('wj_csrf='))
    ?.split(';')[0]
    ?.slice(8);
  if (csrf === undefined) throw new Error('Session CSRF cookie missing');
  const headers = {
    cookie,
    'x-csrf-token': csrf,
    'x-client-binding-id': clientBindingId,
  };
  const auth = createSessionDependencies(config);
  const resolved = await auth.resolveSession(
    new Request('https://cms-console.example.test/api/v1/auth/session', {
      headers,
    }),
    environment,
    new AbortController().signal,
  );
  if (!resolved.ok) throw new Error('Registered session could not be read');
  expect(resolved.value).toMatchObject({
    authUserId: actor.authUserId,
    sessionId,
    personId: actor.personId,
    actingPartyId: actor.actingPartyId,
    actingContextId: bindingId,
  });
  const app = createCmsApp(
    ownerSession(actor.authUserId, actor.actingPartyId, []),
    {
      authentication: { auth, resolveCapabilities: s11StoredCapabilities },
      requestHeaders: headers,
    },
  );
  return {
    actor,
    sessionId,
    clientBindingId,
    bindingId,
    app,
    proofAt: resolved.value.stepUpAt,
    auth,
    headers,
  };
};

export type S11BoundSession = Awaited<ReturnType<typeof createS11Session>>;
