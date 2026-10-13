/**
 * The release-level CMS schema-migration worker id. Both the legacy event-path
 * worker and the claimed Job-path preparation own the plan lease under this one
 * id, so a crash redelivery re-leases the plan instead of waiting out the 30 s
 * plan lease.
 */
export const cmsSchemaMigrationWorkerId = (environment: {
  readonly APP_ENVIRONMENT: string;
  readonly APP_RELEASE: string;
}): string =>
  `cms-schema-migration-${environment.APP_ENVIRONMENT}-${environment.APP_RELEASE}`;
