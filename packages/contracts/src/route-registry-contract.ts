import { z } from 'zod';

import {
  OwnerSchema,
  RegistryKeySchema,
  RunbookSchema,
} from './registry-primitives.ts';

const RouteSloSchema = z
  .object({
    tier: z.literal(2),
    commandP95Ms: z.number().int().positive().max(30_000),
    protectedRpcP95Ms: z.number().int().positive().max(30_000),
    acceptanceP99Ms: z.number().int().positive().max(30_000),
  })
  .strict()
  .readonly();

export const RouteRegistryEntrySchema = z
  .object({
    method: z.enum(['DELETE', 'GET', 'PATCH', 'POST', 'PUT']),
    path: z
      .string()
      .regex(/^(?:\/api\/v1(?:\/[A-Za-z0-9{}_.:-]+)*|\/auth\/callback)$/),
    authClass: RegistryKeySchema,
    cacheClass: RegistryKeySchema,
    cacheControl: z.string().min(1).max(128).optional(),
    timeoutMs: z.number().int().positive().max(30_000),
    rateClass: RegistryKeySchema,
    rateLimit: z.number().int().positive().max(100_000).optional(),
    partyRateLimit: z.number().int().positive().max(100_000).optional(),
    rateWindowSeconds: z.number().int().positive().max(86_400).optional(),
    rateScope: z.enum(['user', 'release']).optional(),
    sloTier: RegistryKeySchema,
    criticality: z.enum(['critical', 'high', 'standard']),
    owner: OwnerSchema,
    operationId: z
      .string()
      .regex(
        /^(?:[a-z][A-Za-z0-9]{2,79}|[A-Z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+)$/,
      ),
    requestSchema: z.string().min(1).max(128),
    successSchema: z.string().min(1).max(128),
    openApiSuccessSchema: z.string().min(1).max(128).optional(),
    errorSchemas: z.array(z.string().min(1).max(128)).min(1).max(16).readonly(),
    bolaTest: z.string().min(1).max(128),
    runbook: RunbookSchema,
    deprecated: z.boolean(),
    capability: RegistryKeySchema.optional(),
    capabilities: z
      .array(RegistryKeySchema)
      .min(1)
      .max(8)
      .readonly()
      .optional(),
    capabilityMode: z.enum(['all_of', 'any_of']).optional(),
    corsClass: z.enum(['cms-console', 'release-worker']).optional(),
    audience: z.enum(['browser', 'release-worker']).optional(),
    csrf: z.enum(['required', 'forbidden', 'none']).optional(),
    /**
     * `required` when missing or stale MFA is 401 `STEP_UP_REQUIRED`;
     * `conditional` when only some states of the target need it (AUTH-API-17
     * and AUTH-API-19).
     */
    stepUp: z.enum(['required', 'conditional', 'none']).optional(),
    rawBodySignature: z.enum(['required', 'none']).optional(),
    idempotency: z.enum(['required', 'none']).optional(),
    ifMatch: z.enum(['required', 'conditional', 'none']).optional(),
    slo: RouteSloSchema.optional(),
  })
  .strict()
  .readonly();

export type RouteRegistryEntry = z.infer<typeof RouteRegistryEntrySchema>;
