import type { MigrationPlanRecord } from './migration-worker-plan-types';

export const toMigrationPlanRecord = (
  value: Record<string, unknown>,
): MigrationPlanRecord => ({
  id: value.id as string,
  contentTypeId: value.contentTypeId as string,
  fromVersionId: value.fromVersionId as string | null,
  toVersionId: value.toVersionId as string,
  state: value.state as MigrationPlanRecord['state'],
  version: value.version as string,
  cursor: value.cursor as string,
  progress: value.progress as number,
  sourceCount: value.sourceCount as string,
  targetCount: value.targetCount as string,
  rowErrorCount: value.rowErrorCount as string,
  migratedCount: value.migratedCount as string,
  failedCount: value.failedCount as string,
  classification: value.classification as MigrationPlanRecord['classification'],
  transformKey: value.transformKey as string | null,
  transformVersion: value.transformVersion as string | null,
  compilerHash: value.compilerHash as string,
  sourceHash: value.sourceHash as string,
  targetHash: value.targetHash as string,
  activeVersionId: value.activeVersionId as string | null,
  leaseOwner: value.leaseOwner as string | null,
  leaseToken: value.leaseToken as string | null,
  leaseExpiresAt: value.leaseExpiresAt as string | null,
});
