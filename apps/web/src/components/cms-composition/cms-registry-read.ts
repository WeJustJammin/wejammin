import { rateLimitMessage } from '../../lib/rate-limit-message';
import { registryChanges, type BlockSelector } from './cms-registry-changes';
import {
  readTemplateContext,
  type TemplateContextResult,
} from './cms-template-context-read';
import type { RegistryReadOutcome } from './registry-read-types';

/*
 * The on-demand chunk (`cms-registry-read`, CMS_ON_DEMAND_CHUNKS): the designer context reader, its structural rules
 * and the comparison of two reads. It loads when a 409 `block_registry_digest_mismatch` asks for the block choices
 * again (FE03 1048, review V19 M2), never with the route; `registry-read-on-demand.ts` is the only importer.
 */
const failure = (result: TemplateContextResult): RegistryReadOutcome => {
  if (result.kind === 'rejected' && result.status === 429)
    return {
      state: {
        kind: 'failed',
        message: rateLimitMessage(result.retryAfterSeconds ?? null),
        rateLimited: true,
      },
      context: null,
      ...(result.retryAfterSeconds === undefined
        ? {}
        : { waitSeconds: result.retryAfterSeconds }),
    };
  return {
    state: {
      kind: 'failed',
      rateLimited: false,
      message:
        result.kind === 'rejected' && result.status === 401
          ? 'Your session expired. Sign in again.'
          : result.kind === 'rejected' && result.status === 403
            ? 'Template designer access is required for this acting context.'
            : 'The block choices could not be read.',
    },
    context: null,
  };
};

/** Reads the designer context and compares its block selectors with `before`. */
export const readRegistry = async (
  before: readonly BlockSelector[],
): Promise<RegistryReadOutcome> => {
  const read = await readTemplateContext();
  if (read.kind !== 'loaded') return failure(read);
  const { added, removed } = registryChanges(
    before,
    read.context.registeredBlocks,
  );
  return {
    state: {
      kind: 'read',
      lines: [
        'The block registry changed while you were editing. Your values are kept; check your block choices, then save again.',
        ...(added.length === 0 ? [] : [`Added: ${added.join(', ')}`]),
        ...(removed.length === 0 ? [] : [`Removed: ${removed.join(', ')}`]),
        ...(added.length === 0 && removed.length === 0
          ? ['The block choices are unchanged.']
          : []),
      ],
    },
    context: read.context,
  };
};
