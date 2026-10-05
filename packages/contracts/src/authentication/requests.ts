import { z } from 'zod';

import {
  AuthCsrfHeaderSchema,
  AuthEmptyBodySchema,
  AuthIdempotencyKeySchema,
  AuthProviderCodeSchema,
  AuthReturnTargetSchema,
} from './primitives.ts';

const AuthIfMatchHeaderSchema = z.string().min(1).max(128);
const AuthMutationHeadersSchema = z
  .object({
    idempotencyKey: AuthIdempotencyKeySchema,
    ifMatch: AuthIfMatchHeaderSchema,
    xCsrfToken: AuthCsrfHeaderSchema,
  })
  .strict();

export const EmailStartRequestSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(3)
      .max(254)
      .email('email_invalid')
      .transform((value) => value.normalize('NFC')),
    intent: z.enum(['sign_in', 'recovery']),
    returnTo: AuthReturnTargetSchema,
  })
  .strict();

export const OAuthStartRequestSchema = z
  .object({
    provider: AuthProviderCodeSchema,
    intent: z.enum(['sign_in', 'link', 'prove_merge']),
    returnTo: AuthReturnTargetSchema,
    mergeId: z.uuid().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const needsMerge = value.intent === 'prove_merge';
    if (needsMerge !== (value.mergeId !== undefined)) {
      context.addIssue({
        code: 'custom',
        message: 'merge_id_invalid',
        path: ['mergeId'],
      });
    }
  });

export const AuthCallbackQuerySchema = z
  .object({
    state: z.string().min(1).max(2048),
    code: z.string().min(1).max(2048).optional(),
    error: z.string().min(1).max(128).optional(),
    error_code: z.string().min(1).max(128).optional(),
    error_description: z.string().min(1).max(2048).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const hasCode = value.code !== undefined;
    const hasProviderError =
      value.error !== undefined || value.error_code !== undefined;
    if (hasCode === hasProviderError) {
      context.addIssue({
        code: 'custom',
        message: 'AUTH_CALLBACK_INVALID',
        path: ['code'],
      });
    }
  });

export const AuthCallbackApiRequestSchema = z
  .object({ query: AuthCallbackQuerySchema })
  .strict();

export const SessionRefreshRequestSchema = AuthEmptyBodySchema;
export const PersonBootstrapRequestSchema = AuthEmptyBodySchema;

export const SessionRefreshApiRequestSchema = z
  .object({
    headers: z.object({ xCsrfToken: AuthCsrfHeaderSchema }).strict(),
    body: SessionRefreshRequestSchema,
  })
  .strict();

export const PersonBootstrapApiRequestSchema = z
  .object({
    headers: z.object({ idempotencyKey: AuthIdempotencyKeySchema }).strict(),
    body: PersonBootstrapRequestSchema,
  })
  .strict();

export const LogoutRequestSchema = z
  .object({ scope: z.enum(['current', 'all']).optional() })
  .strict();

export const LogoutApiRequestSchema = z
  .object({
    headers: z
      .object({
        idempotencyKey: AuthIdempotencyKeySchema,
        xCsrfToken: AuthCsrfHeaderSchema,
      })
      .strict(),
    body: LogoutRequestSchema,
  })
  .strict();

export const AuthProviderPathSchema = z
  .object({ provider: AuthProviderCodeSchema })
  .strict();

export const AuthIdentityPathSchema = z
  .object({ identityId: z.uuid() })
  .strict();

export const AuthMergePathSchema = z.object({ mergeId: z.uuid() }).strict();

export const LinkIntentRequestSchema = z
  .object({ returnTo: AuthReturnTargetSchema })
  .strict();

export const UnlinkRequestSchema = z
  .object({ reason: z.enum(['user_request', 'provider_compromise']) })
  .strict();

export const MergeCreateRequestSchema = z
  .object({ returnTo: AuthReturnTargetSchema })
  .strict();

export const MergeProofRequestSchema = z
  .object({
    provider: AuthProviderCodeSchema,
    returnTo: AuthReturnTargetSchema,
  })
  .strict();

export const MergeConfirmRequestSchema = z
  .object({
    conflictPlanVersion: z.string().regex(/^[1-9][0-9]*$/u, 'version_invalid'),
    acknowledgements: z
      .array(z.string().min(1).max(64))
      .min(1)
      .max(50)
      .refine((values) => new Set(values).size === values.length, {
        message: 'acknowledgement_unknown',
      }),
  })
  .strict();

export const LinkIntentApiRequestSchema = z
  .object({
    provider: AuthProviderCodeSchema,
    headers: AuthMutationHeadersSchema,
    body: LinkIntentRequestSchema,
  })
  .strict();

export const UnlinkApiRequestSchema = z
  .object({
    identityId: z.uuid(),
    headers: AuthMutationHeadersSchema,
    body: UnlinkRequestSchema,
  })
  .strict();

export const MergeCreateApiRequestSchema = z
  .object({
    headers: AuthMutationHeadersSchema,
    body: MergeCreateRequestSchema,
  })
  .strict();

export const MergeProofApiRequestSchema = z
  .object({
    mergeId: z.uuid(),
    headers: AuthMutationHeadersSchema,
    body: MergeProofRequestSchema,
  })
  .strict();

export const MergeConfirmApiRequestSchema = z
  .object({
    mergeId: z.uuid(),
    headers: AuthMutationHeadersSchema,
    body: MergeConfirmRequestSchema,
  })
  .strict();

export type EmailStartRequest = z.infer<typeof EmailStartRequestSchema>;
export type OAuthStartRequest = z.infer<typeof OAuthStartRequestSchema>;
export type AuthCallbackQuery = z.infer<typeof AuthCallbackQuerySchema>;
export type LogoutRequest = z.infer<typeof LogoutRequestSchema>;
