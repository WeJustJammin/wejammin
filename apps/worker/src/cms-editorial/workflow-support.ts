import {
  cmsEditorialRoutePolicies,
  type CmsEditorialOperationId,
  type PreflightEvidence,
} from '@wejammin/contracts';

import { parseRequestPathId } from './admission-body';
import { invalid, type Result, type UnknownSchema } from './admission-common';
import type { WorkflowPrepareContext } from './workflow-command';
import type { CmsEditorialQualityGateInput, CmsEditorialResult } from './types';

/** One row of the editorial route registry. */
export type RegistryRoute = (typeof cmsEditorialRoutePolicies)[number];

/** The registry row of an operation: the single source of its transport policy. */
export const policyFor = (
  operationId: CmsEditorialOperationId,
): RegistryRoute =>
  cmsEditorialRoutePolicies.find(
    (item) => item.operationId === operationId,
  ) as RegistryRoute;

/** Bind one UUID path parameter; anything else is a structural 400. */
export const uuidParam =
  <Name extends string>(name: Name) =>
  (
    param: (name: string) => string | undefined,
  ): Result<Readonly<Record<Name, string>>> => {
    const value = parseRequestPathId(param(name));
    return value.ok
      ? { ok: true, value: { [name]: value.value } as Record<Name, string> }
      : value;
  };

export type AccessibilityTarget = Readonly<{
  phase: CmsEditorialQualityGateInput['phase'];
  entryId: string | null;
  revisionId: string | null;
}>;

/**
 * The pre-RPC accessibility proof (BE05c quality gate): the in-process checker
 * runs fresh, within its own 2,000 ms budget, immediately before the command
 * RPC. The gate never reports an error: an absent gate, a throw or an unreadable
 * revision all yield null, and the database answers the category
 * unavailable/checker_failed (DEC-150). Only the route deadline can refuse.
 */
export const accessibilityEvidence = async <Path, Body>(
  context: WorkflowPrepareContext<Path, Body>,
  target: AccessibilityTarget,
): Promise<CmsEditorialResult<PreflightEvidence | null>> => {
  const gate = context.dependencies.qualityGate;
  if (gate === undefined) return { ok: true, value: null };
  return context.withinDeadline(async (signal) => {
    try {
      return {
        ok: true as const,
        value: await gate(
          {
            ...target,
            requestId: context.requestId,
            request: context.request,
            session: context.session,
          },
          signal,
        ),
      };
    } catch {
      return { ok: true as const, value: null };
    }
  });
};

/** The pre-RPC stage of a command that has none. */
export const noPreparation = async (): Promise<CmsEditorialResult<null>> => ({
  ok: true,
  value: null,
});

const queryViolation = (key: string, code: string) => ({
  violations: [
    {
      path: `/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`,
      code,
      message: 'The value is invalid.',
    },
  ],
});

/**
 * The raw members of a closed query: only `allowed` keys, each at most once.
 * Anything else is a structural 400 with a stable pointer, before the session's
 * quota or any dependency is touched.
 */
export const closedQuery = (
  request: Request,
  allowed: ReadonlySet<string>,
): Result<Record<string, string>> => {
  const members: Record<string, string> = {};
  for (const [key, value] of new URL(request.url).searchParams) {
    if (!allowed.has(key))
      return invalid(
        'The query is invalid.',
        queryViolation(key, 'unknown_field'),
      );
    if (Object.hasOwn(members, key))
      return invalid(
        'The query is invalid.',
        queryViolation(key, 'duplicate_field'),
      );
    members[key] = value;
  }
  return { ok: true, value: members };
};

const hexOf = (bytes: ArrayBuffer): string =>
  [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

/**
 * SHA-256 of the exact response bytes scoped to the caller. A response that
 * depends on the caller's scope (permitted actions, owner-only members) must not
 * share a strong validator across callers.
 */
export const representationDigest = async (
  session: Readonly<{ userId: string; actingPartyId: string | null }>,
  body: string,
): Promise<string> =>
  hexOf(
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(
        JSON.stringify({
          actorId: session.userId,
          actingPartyId: session.actingPartyId,
          body,
        }),
      ),
    ),
  );

/** The dependency answered a success payload that breaks the contract. */
export const BAD_GATEWAY = {
  ok: false,
  status: 502,
  code: 'BAD_GATEWAY',
  message: 'The CMS editorial dependency returned invalid data.',
} as const;

/** The strict parse of a resource, or null when it breaks the contract. */
export const parsedResource = <Resource>(
  schema: UnknownSchema,
  value: unknown,
): Resource | null => {
  const parsed = schema.safeParse(value) as {
    success: boolean;
    data?: Resource;
  };
  return parsed.success ? (parsed.data as Resource) : null;
};
