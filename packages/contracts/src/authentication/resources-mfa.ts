import { z } from 'zod';

import {
  AuthDecimalVersionSchema,
  AuthIsoTimeSchema,
  AuthMfaFriendlyNameSchema,
  AuthMfaMethodSchema,
} from './primitives.ts';

const MfaFactorSchema = z
  .object({
    id: z.uuid(),
    method: AuthMfaMethodSchema,
    friendlyName: AuthMfaFriendlyNameSchema,
    state: z.enum(['pending', 'verified', 'reconciling']),
    verifiedAt: AuthIsoTimeSchema.nullable(),
    lastUsedAt: AuthIsoTimeSchema.nullable(),
    pendingExpiresAt: AuthIsoTimeSchema.nullable(),
  })
  .strict();

/**
 * The per-account MFA factor list. `id` is an application UUID, never the
 * provider factor id; `stepUp` is computed from the verified token only and
 * is `{ fresh: false, freshUntil: null }` when the proof is absent or stale.
 */
export const MfaFactorsResourceSchema = z
  .object({
    factors: z.array(MfaFactorSchema).max(10),
    allowedMethods: z.array(AuthMfaMethodSchema).max(5),
    stepUp: z
      .object({ fresh: z.boolean(), freshUntil: AuthIsoTimeSchema.nullable() })
      .strict()
      .refine(({ fresh, freshUntil }) => fresh === (freshUntil !== null), {
        message: 'step_up_fresh_until_matches_freshness',
        path: ['freshUntil'],
      }),
    version: AuthDecimalVersionSchema,
  })
  .strict();

/**
 * The one-time TOTP enrollment response: `otpauthUri` and `manualEntryKey`
 * exist only in this body and are never stored, logged, or replayed. 26
 * base32 characters is the RFC 4226 minimum 128-bit secret; 128 is a
 * defensive ceiling.
 */
export const TotpEnrollmentStartSchema = z
  .object({
    factorId: z.uuid(),
    method: AuthMfaMethodSchema,
    friendlyName: AuthMfaFriendlyNameSchema,
    otpauthUri: z
      .string()
      .max(2048)
      .regex(/^otpauth:\/\/totp\//u),
    manualEntryKey: z.string().regex(/^[A-Z2-7]{26,128}$/u),
    expiresAt: AuthIsoTimeSchema,
    version: AuthDecimalVersionSchema,
  })
  .strict();

export const StepUpChallengeSchema = z
  .object({
    challengeId: z.uuid(),
    method: AuthMfaMethodSchema,
    factorId: z.uuid(),
    friendlyName: AuthMfaFriendlyNameSchema,
    expiresAt: AuthIsoTimeSchema,
  })
  .strict();

/** Contains no token: cookies are rotated by the Worker, never returned. */
export const StepUpResultSchema = z
  .object({
    verified: z.literal(true),
    method: AuthMfaMethodSchema,
    stepUpAt: AuthIsoTimeSchema,
    freshUntil: AuthIsoTimeSchema,
  })
  .strict();

export type MfaFactorsResource = z.infer<typeof MfaFactorsResourceSchema>;
export type TotpEnrollmentStart = z.infer<typeof TotpEnrollmentStartSchema>;
export type StepUpChallenge = z.infer<typeof StepUpChallengeSchema>;
export type StepUpResult = z.infer<typeof StepUpResultSchema>;
