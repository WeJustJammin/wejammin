import {
  EmphasisPutRequestSchema,
  ProfilePortfolioUuidSchema,
} from '@wejammin/contracts';

import type { WorkerContext } from '../index';
import type { AuthenticationResult } from '../authentication/types';
import {
  configureProfilePortfolioRoute,
  parseProfilePath,
  type SchemaLike,
} from './route-support';
import type { ActiveProfilePortfolioOperation } from './runtime-helpers';

export const ReelItemPathSchema: SchemaLike<Readonly<{ reelItemId: string }>> =
  {
    safeParse(value) {
      const reelItemId =
        typeof value === 'object' &&
        value !== null &&
        typeof (value as { reelItemId?: unknown }).reelItemId === 'string'
          ? (value as { reelItemId: string }).reelItemId
          : null;
      const valid =
        reelItemId !== null &&
        ProfilePortfolioUuidSchema.safeParse(reelItemId).success;
      return valid
        ? { success: true, data: { reelItemId } }
        : {
            success: false,
            error: {
              issues: [{ path: ['reelItemId'], message: 'Invalid UUID.' }],
            },
          };
    },
  };

export const emphasisBodySchema: SchemaLike<unknown> = {
  safeParse(value) {
    const parsed = EmphasisPutRequestSchema.safeParse(value);
    if (parsed.success) return parsed;
    if (
      typeof value !== 'object' ||
      value === null ||
      !Array.isArray((value as { orderedRefs?: unknown }).orderedRefs)
    )
      return parsed;
    const refs = (value as { orderedRefs: unknown[] }).orderedRefs;
    const keys = refs.map((ref) =>
      typeof ref === 'object' && ref !== null
        ? `${String((ref as { sourceId?: unknown }).sourceId)}/${String((ref as { sourceVersion?: unknown }).sourceVersion)}`
        : 'invalid',
    );
    if (new Set(keys).size === keys.length) return parsed;
    const uniqueRefs = refs.filter(
      (ref, index) => keys.indexOf(keys[index] as string) === index,
    );
    const structural = EmphasisPutRequestSchema.safeParse({
      ...(value as Record<string, unknown>),
      orderedRefs: uniqueRefs,
    });
    return structural.success ? { success: true, data: value } : parsed;
  },
};

/**
 * The path is parsed here but its refusal is the handler's to report: BE00
 * "Hono Middleware Order" validates path, query and body (step 6) only after
 * the origin, CSRF and session steps, so a malformed path never answers an
 * unauthenticated or cross-origin request.
 */
export const usePath = async <T>(
  context: WorkerContext,
  operationId: ActiveProfilePortfolioOperation,
  schema: SchemaLike<T>,
  value: Readonly<Record<string, string>>,
  callback: (path: AuthenticationResult<T>) => Promise<Response>,
): Promise<Response> => {
  configureProfilePortfolioRoute(context, operationId);
  return callback(parseProfilePath(schema, value));
};
