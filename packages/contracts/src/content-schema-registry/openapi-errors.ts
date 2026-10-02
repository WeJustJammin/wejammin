import { z } from 'zod';

import type { ContentSchemaRegistryRoutePolicy } from './route-policy.ts';
import { schemaReference } from './openapi-contracts.ts';

/**
 * A 401 group that carries `STEP_UP_REQUIRED` publishes the exact
 * unauthenticated/step-up union, so a client can tell an expired session
 * (`reauthenticate`) from recoverable MFA (`step_up` plus `allowedMethods`).
 */
const errorSchemaForStatus = (
  codes: readonly string[],
  errorRef: Readonly<{ $ref: string }>,
  contracts: Readonly<Record<string, z.ZodTypeAny>>,
): unknown => {
  if (!codes.includes('STEP_UP_REQUIRED')) return errorRef;
  const stepUp = schemaReference('CmsStepUpRequiredErrorSchema', contracts);
  return codes.includes('UNAUTHENTICATED')
    ? {
        oneOf: [
          schemaReference('CmsUnauthenticatedErrorSchema', contracts),
          stepUp,
        ],
      }
    : stepUp;
};

export const apiErrorResponses = (
  route: ContentSchemaRegistryRoutePolicy,
  contracts: Readonly<Record<string, z.ZodTypeAny>>,
): Record<string, unknown> => {
  const grouped = new Map<number, string[]>();
  for (const [code, status] of Object.entries(route.errors)) {
    const codes = grouped.get(status) ?? [];
    codes.push(code);
    grouped.set(status, codes);
  }
  const errorRef = schemaReference('ApiErrorSchema', contracts);
  return Object.fromEntries(
    [...grouped.entries()]
      .sort(([left], [right]) => left - right)
      .map(([status, codes]) => [
        String(status),
        {
          description: codes.sort().join(', '),
          content: {
            'application/json': {
              schema: errorSchemaForStatus(codes, errorRef, contracts),
            },
          },
        },
      ]),
  );
};
