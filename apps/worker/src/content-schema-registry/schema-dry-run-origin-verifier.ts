import { SCHEMA_MIGRATION_RPC } from './migration-worker-constants';
import type { MigrationWorkerPort } from './migration-worker-types';
import { CmsSchemaDryRunOriginRequestSchema } from './schema-dry-run-origin-request';

/** Origin identity is a read, not a claim or permission to execute stages. */
export const createCmsSchemaDryRunOriginVerifier = ({
  port,
}: Readonly<{ port: MigrationWorkerPort }>) => ({
  verify: async (envelope: unknown, signal: AbortSignal): Promise<boolean> => {
    if (signal.aborted) return false;
    const parsed = CmsSchemaDryRunOriginRequestSchema.safeParse({
      originEvent: envelope,
    });
    if (!parsed.success) return false;
    const response = await port.call(
      SCHEMA_MIGRATION_RPC.readPlan,
      parsed.data,
      signal,
    );
    return response === true;
  },
});
