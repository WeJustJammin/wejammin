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
