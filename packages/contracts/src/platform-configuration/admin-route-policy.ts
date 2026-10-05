import { z } from 'zod';

export const AdminWorkspaceOperationIdSchema = z.enum([
  'CFG-05B-01',
  'CFG-05B-02',
  'CFG-05B-03',
  'CFG-05B-04',
  'CFG-05B-05',
  'CFG-05B-06',
  'CFG-05B-07',
]);

export const AdminWorkspaceRouteErrorCodeSchema = z.enum([
  'INVALID_REQUEST',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'RATE_LIMITED',
  'TASK_SOURCE_UNAVAILABLE',
  'SEARCH_FIELD_NOT_ALLOWED',
  'COUNT_SUPPRESSED',
  'SEARCH_UNAVAILABLE',
  'TARGET_NOT_FOUND',
  'MANIFEST_CONFLICT',
  'COMMAND_NOT_ALLOWED',
  'BULK_UNAVAILABLE',
  'GRANT_NOT_FOUND',
  'GRANT_VERSION_CONFLICT',
  'GRANT_INVALID',
  'AUDIT_TARGET_NOT_FOUND',
  'DIAGNOSTIC_VERSION_CONFLICT',
  'DIAGNOSTIC_UNAVAILABLE',
  'STEP_UP_REQUIRED',
  'IDEMPOTENCY_CONFLICT',
  'MFA_RESET_IN_PROGRESS',
  'MFA_RESET_INVALID',
  'IDENTITY_UNAVAILABLE',
  'INTERNAL_ERROR',
]);

export const AdminWorkspaceRoutePolicySchema = z
  .strictObject({
    operationId: AdminWorkspaceOperationIdSchema,
    active: z.boolean(),
    method: z.enum(['GET', 'POST']),
    path: z.string().regex(/^\/api\/v1\/admin(?:\/[A-Za-z0-9{}_.:-]+)*$/u),
    requestSchema: z.string().min(1).max(128),
    successSchema: z.string().min(1).max(128),
    auth: z.literal('session'),
    /** Present only where the route demands recent MFA (401 STEP_UP_REQUIRED). */
    stepUp: z.literal('required').optional(),
    /** Named admin capability the route requires, when it is not inbox-scoped. */
    capability: z
      .string()
      .regex(/^[a-z][a-z0-9_.-]{0,127}$/u)
      .optional(),
    rateLimit: z.number().int().positive(),
    /** Per-party bucket charged beside the per-actor `rateLimit`. */
    partyRateLimit: z.number().int().positive().optional(),
    rateWindowSeconds: z.number().int().positive(),
    rateScope: z.enum(['actor', 'party']),
    rateClass: z.string().regex(/^[a-z][a-z0-9_.-]*$/u),
    timeoutMs: z.number().int().positive().max(30_000),
    cacheControl: z.literal('no-store'),
    idempotency: z.enum(['none', 'required']),
    ifMatch: z.enum(['none', 'required']),
    sloTier: z.enum(['tier_1', 'tier_2']),
    errors: z
      .array(AdminWorkspaceRouteErrorCodeSchema)
      .min(1)
      .max(32)
      .readonly(),
  })
  .readonly();

export type AdminWorkspaceOperationId = z.infer<
  typeof AdminWorkspaceOperationIdSchema
>;
export type AdminWorkspaceRoutePolicy = z.infer<
  typeof AdminWorkspaceRoutePolicySchema
>;
export type AdminWorkspaceRouteErrorCode = z.infer<
  typeof AdminWorkspaceRouteErrorCodeSchema
>;

export const inboxRouteErrors = [
  'INVALID_REQUEST',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'RATE_LIMITED',
  'TASK_SOURCE_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const satisfies readonly AdminWorkspaceRouteErrorCode[];
export const searchRouteErrors = [
  'INVALID_REQUEST',
  'FORBIDDEN',
  'SEARCH_FIELD_NOT_ALLOWED',
  'COUNT_SUPPRESSED',
  'RATE_LIMITED',
  'SEARCH_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const satisfies readonly AdminWorkspaceRouteErrorCode[];
export const bulkRouteErrors = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'TARGET_NOT_FOUND',
  'MANIFEST_CONFLICT',
  'COMMAND_NOT_ALLOWED',
  'RATE_LIMITED',
  'BULK_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const satisfies readonly AdminWorkspaceRouteErrorCode[];
export const grantRouteErrors = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'GRANT_NOT_FOUND',
  'GRANT_VERSION_CONFLICT',
  'GRANT_INVALID',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const satisfies readonly AdminWorkspaceRouteErrorCode[];
export const diagnosticRouteErrors = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'AUDIT_TARGET_NOT_FOUND',
  'DIAGNOSTIC_VERSION_CONFLICT',
  'DIAGNOSTIC_UNAVAILABLE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const satisfies readonly AdminWorkspaceRouteErrorCode[];

export const mfaResetRouteErrors = [
  'INVALID_REQUEST',
  'UNAUTHENTICATED',
  'STEP_UP_REQUIRED',
  'FORBIDDEN',
  'TARGET_NOT_FOUND',
  'IDEMPOTENCY_CONFLICT',
  'MFA_RESET_IN_PROGRESS',
  'MFA_RESET_INVALID',
  'RATE_LIMITED',
  'IDENTITY_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const satisfies readonly AdminWorkspaceRouteErrorCode[];

export const capabilitySnapshotRouteErrors = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const satisfies readonly AdminWorkspaceRouteErrorCode[];

export const adminRoute = (
  operationId: AdminWorkspaceOperationId,
  method: AdminWorkspaceRoutePolicy['method'],
  path: string,
  requestSchema: string,
  successSchema: string,
  rateLimit: number,
  rateClass: string,
  timeoutMs: number,
  idempotency: AdminWorkspaceRoutePolicy['idempotency'],
  ifMatch: AdminWorkspaceRoutePolicy['ifMatch'],
  errors: readonly AdminWorkspaceRouteErrorCode[],
  active: boolean,
): AdminWorkspaceRoutePolicy => ({
  operationId,
  active,
  method,
  path,
  requestSchema,
  successSchema,
  auth: 'session',
  rateLimit,
  rateWindowSeconds: 60,
  rateScope: 'actor',
  rateClass,
  timeoutMs,
  cacheControl: 'no-store',
  idempotency,
  ifMatch,
  sloTier: timeoutMs > 8_000 ? 'tier_2' : 'tier_1',
  errors,
});
