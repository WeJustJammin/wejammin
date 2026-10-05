import { z } from 'zod';

import {
  ConfigurationTextSchema,
  ConfigurationUuidSchema,
  ConfigurationVersionSchema,
} from './primitives.ts';

/**
 * CFG-05B-06 administrative MFA factor reset (DEC-111 recovery, BE05b).
 * The request names exactly one target person and a reason. Operator,
 * organization, capability, step-up time and every factor identifier are
 * server-derived and never accepted from JSON; the response never carries an
 * Auth UUID, provider factor id or session detail.
 */
/**
 * BE05b states the CFG-05B-06 Idempotency-Key as 16..128 printable ASCII
 * characters with no surrounding whitespace; this is tighter than the generic
 * BE00 header floor (8) because a recovery command is high-consequence. The
 * `admin_mfa_factor_resets.idempotency_key` CHECK and RPC use the same bounds.
 */
export const Cfg05b06IdempotencyKeySchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[\x20-\x7e]+$/u)
  .refine((value) => value.trim() === value);

export const Cfg05b06MfaFactorResetRequestSchema = z.strictObject({
  targetPersonId: ConfigurationUuidSchema,
  reason: ConfigurationTextSchema,
});

export const Cfg05b06MfaFactorResetResponseSchema = z.strictObject({
  resetId: ConfigurationUuidSchema,
  targetPersonId: ConfigurationUuidSchema,
  state: z.enum(['completed', 'reconciling']),
  removedFactorCount: z.number().int().min(0).max(10),
  mfaVersion: ConfigurationVersionSchema,
  outboxEventId: ConfigurationUuidSchema,
});

export type Cfg05b06MfaFactorResetRequest = z.infer<
  typeof Cfg05b06MfaFactorResetRequestSchema
>;
export type Cfg05b06MfaFactorResetResponse = z.infer<
  typeof Cfg05b06MfaFactorResetResponseSchema
>;
