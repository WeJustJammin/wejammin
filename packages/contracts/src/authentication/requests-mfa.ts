import { z } from 'zod';

import {
  AuthCsrfHeaderSchema,
  AuthIdempotencyKeySchema,
  AuthMfaFriendlyNameSchema,
  AuthMfaMethodSchema,
  AuthStrongVersionSchema,
  AuthTotpCodeSchema,
} from './primitives.ts';

export const AuthMfaFactorPathSchema = z
  .object({ factorId: z.uuid() })
  .strict();

export const AuthStepUpChallengePathSchema = z
  .object({ challengeId: z.uuid() })
  .strict();

export const TotpEnrollmentStartRequestSchema = z
  .object({
    method: AuthMfaMethodSchema,
    friendlyName: AuthMfaFriendlyNameSchema,
  })
  .strict();

export const MfaFactorVerifyRequestSchema = z
  .object({ code: AuthTotpCodeSchema })
  .strict();

export const MfaFactorRemoveRequestSchema = z
  .object({ reason: z.enum(['user_request', 'factor_compromise']) })
  .strict();

export const StepUpChallengeRequestSchema = z
  .object({ method: AuthMfaMethodSchema, factorId: z.uuid().optional() })
  .strict();

export const StepUpVerifyRequestSchema = z
  .object({ code: AuthTotpCodeSchema })
  .strict();

/** AUTH-API-17 and -18 carry the MFA version `If-Match` and no client key. */
const MfaVersionedHeadersSchema = z
  .object({
    ifMatch: AuthStrongVersionSchema,
    xCsrfToken: AuthCsrfHeaderSchema,
  })
  .strict();

export const TotpEnrollmentStartApiRequestSchema = z
  .object({
    headers: MfaVersionedHeadersSchema,
    body: TotpEnrollmentStartRequestSchema,
  })
  .strict();

export const MfaFactorVerifyApiRequestSchema = z
  .object({
    factorId: z.uuid(),
    headers: MfaVersionedHeadersSchema,
    body: MfaFactorVerifyRequestSchema,
  })
  .strict();

/** AUTH-API-19 is replay-safe, so it alone requires the idempotency key. */
export const MfaFactorRemoveApiRequestSchema = z
  .object({
    factorId: z.uuid(),
    headers: z
      .object({
        idempotencyKey: AuthIdempotencyKeySchema,
        ifMatch: AuthStrongVersionSchema,
        xCsrfToken: AuthCsrfHeaderSchema,
      })
      .strict(),
    body: MfaFactorRemoveRequestSchema,
  })
  .strict();

export const StepUpChallengeApiRequestSchema = z
  .object({
    headers: z.object({ xCsrfToken: AuthCsrfHeaderSchema }).strict(),
    body: StepUpChallengeRequestSchema,
  })
  .strict();

export const StepUpVerifyApiRequestSchema = z
  .object({
    challengeId: z.uuid(),
    headers: z.object({ xCsrfToken: AuthCsrfHeaderSchema }).strict(),
    body: StepUpVerifyRequestSchema,
  })
  .strict();

export type TotpEnrollmentStartRequest = z.infer<
  typeof TotpEnrollmentStartRequestSchema
>;
export type StepUpChallengeRequest = z.infer<
  typeof StepUpChallengeRequestSchema
>;
