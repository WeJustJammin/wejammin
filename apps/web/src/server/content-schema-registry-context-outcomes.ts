import { z } from 'zod';

import type { ContentSchemaRegistryUiError } from '../components/content-schema-registry/content-schema-registry-types';
import { safeContentSchemaRegistryErrorMessage } from '../components/content-schema-registry/content-schema-registry-types';
import {
  ContentSchemaRegistryListQuerySchema,
  parseContentSchemaRegistryQuery,
} from './content-schema-registry-contracts';
import { isContentSchemaRegistryPlatformError } from './content-schema-registry-platform-shared';
import {
  degradedDetailState,
  degradedListState,
  pageFor,
} from './content-schema-registry-context-presentation';
import type {
  ContentSchemaRegistryResult,
  ResolveInput,
} from './content-schema-registry-context-presentation';
import type {
  ContentSchemaRegistryAuthority,
  ContentSchemaRegistrySession,
} from './content-schema-registry-context-types';

export const platformFailure = (
  error: unknown,
): ContentSchemaRegistryResult | null => {
  if (!isContentSchemaRegistryPlatformError(error)) return null;
  if (error.kind === 'unauthenticated') {
    return { kind: 'unauthenticated', reason: 'missing_session' };
  }
  if (error.kind === 'forbidden') return { kind: 'forbidden' };
  if (error.kind === 'not_found') return { kind: 'not_found' };
  return null;
};

export type DependencyErrorCode =
  | 'DEPENDENCY_INVALID_RESPONSE'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'DEPENDENCY_DEADLINE_EXCEEDED';

export type PlatformOutcome =
  | {
      readonly kind: 'degraded';
      readonly code: DependencyErrorCode;
      readonly status: 502 | 503 | 504;
      readonly retryable: boolean;
      readonly retryAfterSeconds: number | null;
      readonly etag: string | null;
    }
  | {
      readonly kind: 'error';
      readonly error: ContentSchemaRegistryUiError;
      readonly retryable: boolean;
      readonly status: 400 | 422 | 429 | 500;
      readonly retryAfterSeconds: number | null;
    };

const metadataFor = (error: {
  readonly retryAfterSeconds: number | null;
  readonly retryable: boolean | null;
  readonly etag: string | null;
}) => ({
  retryable: error.retryable === true,
  retryAfterSeconds: error.retryAfterSeconds,
  etag: error.etag,
});

export const pageQuery = (
  request: Request,
): z.infer<typeof ContentSchemaRegistryListQuerySchema> => {
  try {
    return parseContentSchemaRegistryQuery(new URL(request.url));
  } catch {
    return ContentSchemaRegistryListQuerySchema.parse({});
  }
};

export const platformOutcome = (
  error: unknown,
  requestId: string,
): PlatformOutcome | null => {
  if (!isContentSchemaRegistryPlatformError(error)) return null;
  switch (error.kind) {
    case 'dependency_invalid_response':
      return {
        kind: 'degraded',
        code: 'DEPENDENCY_INVALID_RESPONSE',
        status: 502,
        ...metadataFor(error),
      };
    case 'dependency_unavailable':
    case 'unavailable':
      return {
        kind: 'degraded',
        code: 'DEPENDENCY_UNAVAILABLE',
        status: 503,
        ...metadataFor(error),
      };
    case 'dependency_deadline_exceeded':
      return {
        kind: 'degraded',
        code: 'DEPENDENCY_DEADLINE_EXCEEDED',
        status: 504,
        ...metadataFor(error),
      };
    case 'invalid_request':
      return {
        kind: 'error',
        error: {
          code: 'INVALID_REQUEST',
          message:
            error.apiError?.message ??
            safeContentSchemaRegistryErrorMessage('INVALID_REQUEST'),
          requestId: error.apiError?.requestId ?? requestId,
        },
        retryable: false,
        status: 400,
        retryAfterSeconds: error.retryAfterSeconds,
      };
    case 'validation_failed':
      return {
        kind: 'error',
        error: {
          code: 'VALIDATION_FAILED',
          message:
            error.apiError?.message ??
            safeContentSchemaRegistryErrorMessage('VALIDATION_FAILED'),
          requestId: error.apiError?.requestId ?? requestId,
        },
        retryable: false,
        status: 422,
        retryAfterSeconds: error.retryAfterSeconds,
      };
    case 'rate_limited':
      return {
        kind: 'error',
        error: {
          code: 'RATE_LIMITED',
          message:
            error.apiError?.message ??
            safeContentSchemaRegistryErrorMessage('RATE_LIMITED'),
          requestId: error.apiError?.requestId ?? requestId,
        },
        retryable: true,
        status: 429,
        retryAfterSeconds: error.retryAfterSeconds,
      };
    case 'internal_error':
      return {
        kind: 'error',
        error: {
          code: 'INTERNAL_ERROR',
          message:
            error.apiError?.message ??
            safeContentSchemaRegistryErrorMessage('INTERNAL_ERROR'),
          requestId: error.apiError?.requestId ?? requestId,
        },
        retryable: true,
        status: 500,
        retryAfterSeconds: error.retryAfterSeconds,
      };
    default:
      return null;
  }
};

export const resultForPlatformOutcome = (
  input: ResolveInput,
  outcome: PlatformOutcome,
  context: Readonly<{
    readonly session?: ContentSchemaRegistrySession;
    readonly authority?: ContentSchemaRegistryAuthority;
  }> = {},
): ContentSchemaRegistryResult => {
  const query = pageQuery(input.request);
  const list =
    input.route === 'list'
      ? outcome.kind === 'error'
        ? {
            status: 'error' as const,
            error: outcome.error,
            retryable: outcome.retryable,
            httpStatus: outcome.status,
            retryAfterSeconds: outcome.retryAfterSeconds,
          }
        : degradedListState(input.requestId, outcome.code, {
            retryable: outcome.retryable,
            httpStatus: outcome.status,
            retryAfterSeconds: outcome.retryAfterSeconds,
            etag: outcome.etag,
          })
      : { status: 'empty' as const, reason: 'no-records' as const };
  const detail =
    input.route === 'detail'
      ? outcome.kind === 'error'
        ? {
            status: 'error' as const,
            error: outcome.error,
            retryable: outcome.retryable,
            httpStatus: outcome.status,
            retryAfterSeconds: outcome.retryAfterSeconds,
          }
        : degradedDetailState(input.requestId, outcome.code, {
            retryable: outcome.retryable,
            httpStatus: outcome.status,
            retryAfterSeconds: outcome.retryAfterSeconds,
            etag: outcome.etag,
          })
      : null;
  const page = pageFor({
    request: input.request,
    requestId: input.requestId,
    query,
    list,
    detail,
    contentTypeId: input.contentTypeId ?? null,
    versionId: input.versionId ?? null,
    ...context,
    state: outcome.kind === 'error' ? 'ready' : 'degraded',
    now: (input.now ?? Date.now)(),
  });
  if (outcome.kind === 'degraded') {
    return { kind: 'degraded', page, status: outcome.status };
  }
  return { kind: 'error', page, status: outcome.status };
};

export const genericDegradedResult = (
  input: ResolveInput,
  code: DependencyErrorCode = 'DEPENDENCY_UNAVAILABLE',
  context: Readonly<{
    readonly session?: ContentSchemaRegistrySession;
    readonly authority?: ContentSchemaRegistryAuthority;
  }> = {},
): ContentSchemaRegistryResult => {
  const query = pageQuery(input.request);
  const page = pageFor({
    request: input.request,
    requestId: input.requestId,
    query,
    list:
      input.route === 'list'
        ? degradedListState(input.requestId, code, { httpStatus: 503 })
        : { status: 'empty', reason: 'no-records' },
    detail:
      input.route === 'detail'
        ? degradedDetailState(input.requestId, code, { httpStatus: 503 })
        : null,
    contentTypeId: input.contentTypeId ?? null,
    versionId: input.versionId ?? null,
    ...context,
    state: 'degraded',
    now: (input.now ?? Date.now)(),
  });
  return { kind: 'degraded', page, status: 503 };
};
