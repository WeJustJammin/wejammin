import type {
  CorrelationId,
  DiagnosticResponse,
  RequestContext,
  RequestId,
} from '@wejammin/contracts';
import type { Logger } from '@wejammin/observability/logging';
import type { Context } from 'hono';
import type { Ac265HostedDependencies } from './ac265-hosted/types';
import type { JobStatusDependencies } from './jobs/job-status';
import type { UploadCompletionRouteDependencies } from './upload-completion/upload-intent-completion';
import type {
  AuthenticationDependencies,
  AuthenticationSession,
} from './authentication/types';
import type { ContentSchemaRegistryDependencies } from './content-schema-registry/types';
import type { CmsEditorialDependencies } from './cms-editorial/types';
import type { CmsTemplateDependencies } from './cms-composition/template-routes';
import type { CmsLocaleDependencies } from './cms-composition/locale-routes';
import type { CmsTaxonomyDependencies } from './cms-composition/taxonomy-routes';
import type { CmsPatternInstanceDependencies } from './cms-composition/pattern-instance-routes';
import type { CmsRelatedContentDependencies } from './cms-composition/related-content-routes';
import type { IdentityAuthorityDependencies } from './identity-authority/types';
import type { ProfileOwnershipDependencies } from './profile-ownership/types';
import type { ProfilePortfolioDependencies } from './profile-portfolio/types';
import type {
  AdminWorkspaceDependencies,
  PlatformConfigurationDependencies,
} from './platform-configuration/types';
import type { WorkerBindings } from './worker-bindings';

export type MaybePromise<T> = T | Promise<T>;
export type ErrorCaptureContext = {
  correlationId: CorrelationId;
  operation: string;
  requestId: RequestId;
  routeTemplate: string;
};
export const DIAGNOSTICS_CAPABILITY = 'diagnostics.read' as const;
export type DiagnosticCheck = DiagnosticResponse['checks'][number];
export type DiagnosticAuditEvent = Readonly<{
  action: typeof DIAGNOSTICS_CAPABILITY;
  actorId: string | null;
  actingPartyId: string | null;
  correlationId: CorrelationId;
  decision: 'allow' | 'deny';
  reason: string | null;
  requestId: RequestId;
  target: 'worker-diagnostics';
}>;
type Variables = {
  captureAttempted: boolean;
  correlationId: CorrelationId;
  errorCode?: string;
  errorHandled: boolean;
  identityAuth?: AuthenticationDependencies;
  logger: Logger;
  operation: string;
  requestId: RequestId;
  startedAt: number;
};
export type WorkerContext = Context<{
  Bindings: WorkerBindings;
  Variables: Variables;
}>;
export type WorkerApp = import('hono').Hono<{
  Bindings: WorkerBindings;
  Variables: Variables;
}>;
export type WebhookRouteRegistration = Readonly<{
  path: `/api/v1/webhooks/${string}`;
  handler: (request: Request) => MaybePromise<Response>;
}>;
export type WorkerDependencies = {
  ac265Hosted?: Ac265HostedDependencies;
  auth?: AuthenticationDependencies;
  contentSchemaRegistry?: ContentSchemaRegistryDependencies;
  cmsEditorial?: CmsEditorialDependencies;
  cmsTemplate?: CmsTemplateDependencies;
  cmsLocale?: CmsLocaleDependencies;
  cmsTaxonomy?: CmsTaxonomyDependencies;
  cmsPatternInstance?: CmsPatternInstanceDependencies;
  cmsRelatedContent?: CmsRelatedContentDependencies;
  identityAuthority?: IdentityAuthorityDependencies;
  profileOwnership?: ProfileOwnershipDependencies;
  profilePortfolio?: ProfilePortfolioDependencies;
  platformConfiguration?: PlatformConfigurationDependencies;
  adminWorkspace?: AdminWorkspaceDependencies;
  auditDiagnosticAccess?: (event: DiagnosticAuditEvent) => MaybePromise<void>;
  checkReadiness?: (
    request: Request,
    env: WorkerBindings,
  ) => MaybePromise<boolean | Readonly<{ ready: boolean }>>;
  captureException: (error: unknown, context: ErrorCaptureContext) => void;
  composeDiagnostics?: (
    requestContext: RequestContext,
    request: Request,
    env: WorkerBindings,
  ) => MaybePromise<readonly DiagnosticCheck[]>;
  createLogger: (bindings: WorkerBindings) => Logger;
  isStepUpFresh?: (
    requestContext: RequestContext,
    request: Request,
    env: WorkerBindings,
  ) => MaybePromise<boolean>;
  now: () => number;
  nowDate?: () => Date;
  jobs?: JobStatusDependencies;
  uploadCompletion?: UploadCompletionRouteDependencies;
  uploadIntent?: (request: Request) => MaybePromise<Response>;
  webhookRoutes?: readonly WebhookRouteRegistration[];
  resolveRequestContext?: (
    request: Request,
    env: WorkerBindings,
    signal?: AbortSignal,
    session?: AuthenticationSession,
  ) => MaybePromise<unknown>;
};
