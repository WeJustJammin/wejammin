/**
 * Helper-level mutations for the claim-gate mutation suite. Each weakens one
 * shared gate in place by rewriting the live function definition, and names the
 * manifest entries that rely on that gate: exactly those must fail the
 * behaviour probes (claim-gate-mutation.apispec.ts restores the original).
 */
import {
  CLAIM_ACTOR_FAMILY,
  CLAIM_GATED_API_FUNCTIONS,
  type ActorFamily,
} from './claim-gate-manifest';

export type HelperMutant = Readonly<{
  name: string;
  /** Regprocedure of the function rewritten. */
  target: string;
  /** Families whose entries this mutation is aimed at (coverage check). */
  families: readonly ActorFamily[];
  mutate: (definition: string) => string;
  /** Manifest entries that must fail, and no others. */
  expected: () => readonly string[];
}>;

const entries = (
  families: readonly ActorFamily[],
  gates?: readonly string[],
): readonly string[] =>
  Object.keys(CLAIM_GATED_API_FUNCTIONS).filter((name) => {
    const family = CLAIM_ACTOR_FAMILY[name];
    const gate = CLAIM_GATED_API_FUNCTIONS[name];
    return (
      family !== undefined &&
      families.includes(family) &&
      gate !== 'ungranted' &&
      (gates === undefined || (gate !== undefined && gates.includes(gate)))
    );
  });

const replaceOnce = (
  definition: string,
  pattern: RegExp,
  replacement: string,
): string => definition.replace(pattern, replacement);

const LEGACY_ROLE = `nullif(pg_catalog.current_setting('request.jwt.claim.role', true), '')`;

export const HELPER_MUTANTS: readonly HelperMutant[] = [
  {
    name: 'cfg_actor trusts the actor the request names instead of the token subject',
    target: 'platform_private.cfg_actor(jsonb)',
    families: ['cfg-actor'],
    mutate: (definition) =>
      replaceOnce(
        replaceOnce(
          replaceOnce(
            definition,
            /context_auth_user_id <> jwt_subject/u,
            'false',
          ),
          /context_actor_person_id <> jwt_subject/u,
          'false',
        ),
        /value := jwt_subject;/u,
        'value := coalesce(context_auth_user_id, jwt_subject);',
      ),
    expected: () => entries(['cfg-actor'], ['subject-or-service']),
  },
  {
    name: 'cfg_actor no longer requires the actor to be a real auth user',
    target: 'platform_private.cfg_actor(jsonb)',
    families: ['cfg-actor'],
    mutate: (definition) =>
      replaceOnce(
        definition,
        /if not exists \(select 1 from auth\.users where id = value::uuid\) then\s+raise exception 'UNAUTHENTICATED' using errcode = 'P0001';\s+end if;/u,
        '',
      ),
    expected: () => entries(['cfg-actor']),
  },
  {
    name: 'identity_auth_user no longer requires the token subject to be a real auth user',
    target: 'platform_private.identity_auth_user()',
    families: ['identity-auth-user', 'profile-subject', 'public-read'],
    mutate: (definition) =>
      replaceOnce(
        definition,
        /if not exists \(select 1 from auth\.users u where u\.id = result\) then\s+raise exception 'UNAUTHENTICATED' using errcode = 'P0001';\s+end if;/u,
        '',
      ),
    expected: () =>
      entries(['identity-auth-user', 'profile-subject', 'public-read']),
  },
  {
    name: 'cms_require_release_worker lets any role through',
    target: 'platform_private.cms_require_release_worker()',
    families: ['release-worker'],
    mutate: (definition) =>
      replaceOnce(
        definition,
        /if platform_private\.request_jwt_claim\('role'\) is distinct from 'service_role' then\s+raise exception 'UNAUTHENTICATED' using errcode = 'P0001';\s+end if;/u,
        '',
      ),
    expected: () => entries(['release-worker']),
  },
  {
    name: 'cms_release_actor accepts a release key that is not registered',
    target: 'platform_private.cms_release_actor(jsonb)',
    families: ['release-principal'],
    mutate: (definition) =>
      replaceOnce(definition, /if actor_id is null then/u, 'if false then'),
    expected: () => entries(['release-principal']),
  },
  {
    name: 'cms_require_release_worker reads the legacy claim GUC PostgREST never sets (the SEC-1 defect)',
    target: 'platform_private.cms_require_release_worker()',
    families: ['release-worker', 'release-principal'],
    mutate: (definition) =>
      replaceOnce(
        definition,
        /platform_private\.request_jwt_claim\('role'\)/u,
        LEGACY_ROLE,
      ),
    expected: () => entries(['release-worker', 'release-principal']),
  },
  {
    name: 'profile_actor acts as a fixed person when the request names none, instead of the token subject',
    target: 'profile_private.profile_actor()',
    families: ['profile-claims', 'profile-subject'],
    mutate: (definition) =>
      replaceOnce(
        definition,
        /return platform_private\.identity_actor_person\(platform_private\.identity_auth_user\(\)\);/u,
        `return '00000000-0000-4000-8000-0000000000aa'::uuid;`,
      ),
    expected: () => entries(['profile-claims', 'profile-subject']),
  },
  {
    name: 'request_jwt_claim reads the legacy per-claim GUC PostgREST never sets (the SEC-1 root defect)',
    target: 'platform_private.request_jwt_claim(text)',
    families: [
      'cfg-actor',
      'identity-auth-user',
      'release-worker',
      'release-principal',
      'profile-subject',
      'public-read',
    ],
    mutate: (definition) =>
      replaceOnce(
        definition,
        /raw_claims text := nullif\(pg_catalog\.current_setting\('request\.jwt\.claims', true\), ''\);/u,
        `raw_claims text := (select pg_catalog.jsonb_build_object(p_name, nullif(pg_catalog.current_setting('request.jwt.claim.' || p_name, true), ''))::text);`,
      ),
    expected: () => [
      ...entries(['cfg-actor'], ['subject-or-service']),
      ...entries([
        'identity-auth-user',
        'release-worker',
        'release-principal',
        'profile-subject',
        'public-read',
      ]),
    ],
  },
];
