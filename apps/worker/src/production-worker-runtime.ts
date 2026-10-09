import { createLogger } from '@wejammin/observability/logging';

import { createProductionAc265HostedDependencies } from './ac265-hosted/production';
import type { Ac265HostedDependencies } from './ac265-hosted/types';
import type { JobStatusDependencies } from './jobs/job-status';
import {
  createProductionJobStatusDependencies,
  type JobStatusProductionFetch,
} from './jobs/job-status-production';
import { createProductionAuthenticationDependencies } from './authentication/production';
import type { AuthenticationDependencies } from './authentication/types';
import type { CmsLocaleDependencies } from './cms-composition/locale-routes';
import type { CmsPatternInstanceDependencies } from './cms-composition/pattern-instance-routes';
import type { CmsRelatedContentDependencies } from './cms-composition/related-content-routes';
import type { CmsTaxonomyDependencies } from './cms-composition/taxonomy-routes';
import type { CmsTemplateDependencies } from './cms-composition/template-routes';
import type { CmsEditorialDependencies } from './cms-editorial/types';
import type { ProductionCmsEditorialOptions } from './production-worker-runtime-cms';
import { createProductionCmsCompositionDependencies } from './production-worker-runtime-cms';
import {
  createProductionContentSchemaRegistryDependencies,
  type ContentSchemaRegistryProductionOptions,
} from './content-schema-registry/production';
import type { ContentSchemaRegistryDependencies } from './content-schema-registry/types';
import { createProductionIdentityAuthorityDependencies } from './identity-authority/production';
import type { IdentityAuthorityDependencies } from './identity-authority/types';
import { createProductionProfileOwnershipDependencies } from './profile-ownership/production';
import type { ProfileOwnershipDependencies } from './profile-ownership/types';
import { createProductionProfilePortfolioDependencies } from './profile-portfolio/production';
import type { ProfilePortfolioDependencies } from './profile-portfolio/types';
import { createProductionPlatformConfigurationDependencies } from './platform-configuration/production';
import { createProductionRequestContextResolver } from './platform-configuration/production-context';
import type { PlatformConfigurationDependencies } from './platform-configuration/types';
import type { PlatformConfigurationProductionOptions } from './platform-configuration/production';
import type { UploadCompletionRouteDependencies } from './upload-completion/upload-intent-completion';
import type { WorkerApp, WorkerBindings, WorkerDependencies } from './index';

type ProductionPlatformConfigurationOptions = Pick<
  PlatformConfigurationProductionOptions,
  | 'resolveReleasePrincipal'
  | 'resolveServiceConsumer'
  | 'resolveRequestContext'
  | 'resolveCapabilities'
>;

export type ProductionContentSchemaRegistryOptions = Pick<
  ContentSchemaRegistryProductionOptions,
  | 'verifyRelease'
  | 'releaseVerifier'
  | 'rateLimit'
  | 'humanOrigins'
  | 'releaseOrigins'
  | 'maxResponseBytes'
  | 'deadlineMs'
  | 'now'
  | 'telemetry'
  | 'logger'
>;

/**
 * Deployment overrides for the CMS editorial bundle. Environment, transport,
 * the server auth limiter, and the capability resolver are composed by the
 * runtime, so this surface only carries deployment tuning plus the injectable
 * session/rate seams used by focused composition tests.
 */
export {
  createProductionSchemaMigrationPreparationWorker,
  createProductionSchemaMigrationWorker,
  migrationQueueOutcome,
  productionMigrationTelemetry,
} from './production-worker-runtime-cms';
export type {
  ProductionCmsEditorialOptions,
  ProductionSchemaMigrationWorkerOptions,
} from './production-worker-runtime-cms';

export const createRuntimeDependencies = (
  jobs?: JobStatusDependencies,
  uploadCompletion?: UploadCompletionRouteDependencies,
  checkReadiness?: WorkerDependencies['checkReadiness'],
  auth?: AuthenticationDependencies,
  identityAuthority?: IdentityAuthorityDependencies,
  profileOwnership?: ProfileOwnershipDependencies,
  profilePortfolio?: ProfilePortfolioDependencies,
  platformConfiguration?: PlatformConfigurationDependencies,
  resolveRequestContext?: WorkerDependencies['resolveRequestContext'],
  contentSchemaRegistry?: ContentSchemaRegistryDependencies,
  ac265Hosted?: Ac265HostedDependencies,
  cmsEditorial?: CmsEditorialDependencies,
  cmsTemplate?: CmsTemplateDependencies,
  cmsLocale?: CmsLocaleDependencies,
  cmsPatternInstance?: CmsPatternInstanceDependencies,
  cmsTaxonomy?: CmsTaxonomyDependencies,
  cmsRelatedContent?: CmsRelatedContentDependencies,
): WorkerDependencies => ({
  captureException: () => {},
  createLogger: (bindings) =>
    createLogger({
      environment: bindings.APP_ENVIRONMENT,
      release: bindings.APP_RELEASE,
      service: 'wejammin-api',
    }),
  ...(checkReadiness === undefined ? {} : { checkReadiness }),
  ...(auth === undefined ? {} : { auth }),
  ...(identityAuthority === undefined ? {} : { identityAuthority }),
  ...(profileOwnership === undefined ? {} : { profileOwnership }),
  ...(profilePortfolio === undefined ? {} : { profilePortfolio }),
  ...(platformConfiguration === undefined ? {} : { platformConfiguration }),
  ...(resolveRequestContext === undefined ? {} : { resolveRequestContext }),
  ...(contentSchemaRegistry === undefined ? {} : { contentSchemaRegistry }),
  ...(ac265Hosted === undefined ? {} : { ac265Hosted }),
  ...(cmsEditorial === undefined ? {} : { cmsEditorial }),
  ...(cmsTemplate === undefined ? {} : { cmsTemplate }),
  ...(cmsLocale === undefined ? {} : { cmsLocale }),
  ...(cmsPatternInstance === undefined ? {} : { cmsPatternInstance }),
  ...(cmsTaxonomy === undefined ? {} : { cmsTaxonomy }),
  ...(cmsRelatedContent === undefined ? {} : { cmsRelatedContent }),
  ...(jobs === undefined ? {} : { jobs }),
  ...(uploadCompletion === undefined ? {} : { uploadCompletion }),
  now: Date.now,
});

export const createProductionWorkerAppRuntime = (
  createApp: (dependencies: WorkerDependencies) => WorkerApp,
  environment: WorkerBindings,
  fetchImpl: JobStatusProductionFetch,
  uploadCompletion?: UploadCompletionRouteDependencies,
  checkReadiness?: WorkerDependencies['checkReadiness'],
  platformConfigurationOptions?: ProductionPlatformConfigurationOptions,
  contentSchemaRegistryOptions?: ProductionContentSchemaRegistryOptions,
  cmsEditorialOptions?: ProductionCmsEditorialOptions,
): WorkerApp => {
  const auth = createProductionAuthenticationDependencies({
    environment,
    fetchImpl,
  });
  const platformConfiguration =
    createProductionPlatformConfigurationDependencies({
      environment,
      fetchImpl,
      ...(platformConfigurationOptions ?? {}),
    });
  const resolveCapabilities =
    platformConfigurationOptions?.resolveCapabilities ??
    platformConfiguration.readCapabilityKeys;
  const resolveRequestContext =
    platformConfiguration.resolveRequestContext ??
    createProductionRequestContextResolver(auth, resolveCapabilities);
  const contentSchemaRegistry =
    createProductionContentSchemaRegistryDependencies({
      environment,
      fetchImpl,
      auth,
      resolveRequestContext,
      ...(resolveCapabilities === undefined ? {} : { resolveCapabilities }),
      ...(contentSchemaRegistryOptions ?? {}),
    });
  const ac265Hosted = createProductionAc265HostedDependencies(
    environment,
    fetchImpl,
  );
  const {
    cmsEditorial,
    cmsTemplate,
    cmsLocale,
    cmsPatternInstance,
    cmsTaxonomy,
    cmsRelatedContent,
  } = createProductionCmsCompositionDependencies(
    environment,
    fetchImpl,
    auth,
    resolveCapabilities,
    cmsEditorialOptions,
  );
  return createApp(
    createRuntimeDependencies(
      createProductionJobStatusDependencies({ environment, fetchImpl }),
      uploadCompletion,
      checkReadiness,
      auth,
      createProductionIdentityAuthorityDependencies({ environment, fetchImpl }),
      createProductionProfileOwnershipDependencies({ environment, fetchImpl }),
      createProductionProfilePortfolioDependencies({ environment, fetchImpl }),
      platformConfiguration,
      resolveRequestContext,
      contentSchemaRegistry,
      ac265Hosted,
      cmsEditorial,
      cmsTemplate,
      cmsLocale,
      cmsPatternInstance,
      cmsTaxonomy,
      cmsRelatedContent,
    ),
  );
};
