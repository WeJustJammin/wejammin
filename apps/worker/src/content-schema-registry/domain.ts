import { createContentSchemaRegistryPortRunner } from './runtime-port';
import type {
  ContentSchemaRegistryDependencies,
  ContentSchemaRegistryPortInput,
  ContentSchemaRegistryResult,
} from './types';

/**
 * BE00 Idempotency Canonicalization: `(actor_id, operation, key_hash)` is the
 * unique serialization point and it lives in PostgreSQL, inside the same
 * transaction as the mutation. The Worker therefore keeps no replay cache of
 * its own: a Worker-side short-circuit could not see the actor-scoped binding,
 * could not survive an isolate restart, and answered with a code BE00 does not
 * define. Every request, retry or not, reaches the named RPC, and the database
 * replays the committed response or refuses a mismatch with `IDEMPOTENCY_MISMATCH`.
 */
export const createContentSchemaRegistryDomain = (
  dependencies: ContentSchemaRegistryDependencies,
) => {
  const runner = createContentSchemaRegistryPortRunner(dependencies);
  const execute = (
    input: ContentSchemaRegistryPortInput,
  ): Promise<ContentSchemaRegistryResult<unknown>> => runner.run(input);
  return { execute };
};
