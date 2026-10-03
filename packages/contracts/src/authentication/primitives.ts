import { z } from 'zod';

import {
  AUTH_RETURN_TARGET_MAX_LENGTH,
  isRelativeFirstPartyPath,
} from './return-target.ts';

export { isRelativeFirstPartyPath };

export const AuthProviderCodeSchema = z.enum([
  'email',
  'google',
  'apple',
  'facebook',
  'soundcloud',
]);

export type AuthProviderCode = z.infer<typeof AuthProviderCodeSchema>;

export const AuthReturnTargetSchema = z
  .string()
  .min(1, 'return_target_invalid')
  .max(AUTH_RETURN_TARGET_MAX_LENGTH, 'return_target_invalid')
  .refine(isRelativeFirstPartyPath, 'return_target_invalid');

export const AuthIsoTimeSchema = z.iso
  .datetime({ offset: true })
  .refine((value) => value.endsWith('Z'), 'datetime_invalid');

export const AuthDecimalVersionSchema = z
  .string()
  .regex(/^[1-9][0-9]{0,18}$/u, 'version_invalid')
  .refine(
    (value) => BigInt(value) <= 9_223_372_036_854_775_807n,
    'version_out_of_range',
  );

export const AuthIdempotencyKeySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[\x20-\x7e]+$/u)
  .refine((value) => value.trim() === value);

const authStrongVersionPattern = /^"[1-9][0-9]{0,18}"$/u;

export const AuthStrongVersionSchema = z
  .string()
  .regex(authStrongVersionPattern)
  .refine(
    (value) =>
      !authStrongVersionPattern.test(value) ||
      BigInt(value.slice(1, -1)) <= 9_223_372_036_854_775_807n,
    'version_out_of_range',
  );

export const AuthEmptyBodySchema = z.object({}).strict();

export const AuthCsrfHeaderSchema = z.string().min(16).max(256);

/** Enabled MFA method registry ids; launch contents are exactly `totp`. */
export const AuthMfaMethodSchema = z.enum(['totp']);

export const isNfcWithoutControl = (value: string): boolean =>
  value === value.normalize('NFC') && !/\p{Cc}/u.test(value);

/** NFC, trimmed, 1-80 characters, no control character or newline. */
export const AuthMfaFriendlyNameSchema = z
  .string()
  .trim()
  .min(1, 'friendly_name_invalid')
  .max(80, 'friendly_name_invalid')
  .refine(isNfcWithoutControl, 'friendly_name_invalid');

/** Exactly six ASCII digits; no spaces, hyphens, or other characters. */
export const AuthTotpCodeSchema = z
  .string()
  .regex(/^[0-9]{6}$/u, 'code_invalid');

export const AuthProviderLaunchStateSchema = z.enum([
  'enabled',
  'temporarily_unavailable',
]);

export const AUTH_PROVIDER_REGISTRY = [
  {
    code: 'email',
    launchState: 'enabled',
    adapter: 'supabase_passwordless',
    setupGate: 'delivery_recovery_enumeration_safe',
  },
  {
    code: 'google',
    launchState: 'setup_required',
    adapter: 'supabase_oidc',
    setupGate: 'callback_key_rotation_consent_rollback',
  },
  {
    code: 'apple',
    launchState: 'setup_required',
    adapter: 'supabase_oidc',
    setupGate: 'relay_email_callback_rotation',
  },
  {
    code: 'facebook',
    launchState: 'setup_required',
    adapter: 'supabase_oidc',
    setupGate: 'callback_scope_review',
  },
  {
    code: 'soundcloud',
    launchState: 'conditional',
    adapter: 'supabase_oauth2_custom',
    setupGate: 'app_review_endpoint_arbitrary_2xx_rollback',
  },
  {
    code: 'tiktok',
    launchState: 'disabled',
    adapter: 'none',
    setupGate: 'post_launch_decision',
  },
  {
    code: 'bandlab',
    launchState: 'unsupported',
    adapter: 'none',
    setupGate: 'official_stable_oidc_and_terms',
  },
] as const;
