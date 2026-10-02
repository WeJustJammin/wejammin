import {
  Cfg05b01InboxResponseSchema,
  ConfigurationUuidSchema,
} from '@wejammin/contracts';

import type {
  AdminWorkspaceAsyncState,
  AdminWorkspaceRecord,
} from '../components/platform-configuration/admin-workspace-types';
import { readWorkerCapabilitySnapshot } from './platform-configuration-capability-snapshot';
import {
  forwardPlatformConfigurationRequest,
  resolvePlatformConfigurationBinding,
} from './platform-configuration-platform-api';

export type AdminWorkspaceTab = 'inbox' | 'capabilities' | 'audit';
export type AdminWorkspaceAccess =
  'full' | 'read-only' | 'partial-hidden' | 'disabled' | 'not-rendered';

export type AdminWorkspaceResolution = Readonly<{
  readonly kind: 'ready' | 'unauthenticated';
  readonly access: AdminWorkspaceAccess;
  readonly initial: AdminWorkspaceAsyncState;
  readonly capabilities: readonly string[];
}>;

export const ADMIN_WORKSPACE_CONTRACT_SOURCE =
  '05b-admin-workspace-operations.md';

const activeCapabilityNames = new Set([
  'admin.inbox.read',
  'admin.capability.grant',
  'admin.audit.read',
]);

const grantCapabilityNames = new Set(['admin.capability.grant']);

const safeObject = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null
    ? (value as Readonly<Record<string, unknown>>)
    : {};

const safeText = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const safeUuid = (value: unknown): string | null => {
  const parsed = ConfigurationUuidSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const errorState = (
  status: number,
  requestId: string,
): AdminWorkspaceAsyncState => ({
  status:
    status === 401 || status === 403
      ? 'error'
      : status >= 500
        ? 'degraded'
        : 'error',
  data: null,
  requestId,
  retryable: status >= 500,
  error: {
    code:
      status === 401
        ? 'UNAUTHENTICATED'
        : status === 403
          ? 'FORBIDDEN'
          : 'DEPENDENCY_UNAVAILABLE',
    message:
      status === 401
        ? 'Sign in again to continue.'
        : status === 403
          ? 'This workspace is not available in the current context.'
          : 'The workspace request is temporarily unavailable.',
    requestId,
  },
});

const hiddenResolution = (requestId: string): AdminWorkspaceResolution => ({
  kind: 'ready',
  access: 'not-rendered',
  initial: {
    status: 'empty',
    data: [],
    reason: 'not-disclosed',
    requestId,
  },
  capabilities: [],
});

const projectionRecord = (
  item: Readonly<Record<string, unknown>>,
  aggregateFreshness: string,
  partialSources: readonly string[],
): AdminWorkspaceRecord | null => {
  const taskId = safeUuid(item.taskId);
  const sourceId = safeUuid(item.sourceId);
  const sourceVersion = safeText(item.sourceVersion);
  const sourceType = safeText(item.sourceType);
  const taskClass = safeText(item.taskClass);
  const requiredCapability = safeText(item.requiredCapability);
  const freshnessAt = safeText(item.freshnessAt);
  const state = safeText(item.state);
  const freshness = safeText(item.freshness);
  const severity = safeText(item.severity);
  const sourceStatus = safeText(item.sourceStatus);
  if (
    taskId === null ||
    sourceId === null ||
    sourceVersion === null ||
    sourceType === null ||
    taskClass === null ||
    requiredCapability === null ||
    freshnessAt === null ||
    state === null ||
    freshness === null ||
    severity === null ||
    sourceStatus === null ||
    typeof item.canAct !== 'boolean'
  )
    return null;
  return {
    id: taskId,
    version: sourceVersion,
    state,
    provenance: [
      {
        source: sourceType,
        evidence: `task:${taskId}:source:${sourceId}`,
        at: freshnessAt,
        visibility: 'authorized',
      },
    ],
    projection: {
      operationId: 'CFG-05B-01',
      taskId,
      sourceType,
      sourceId,
      sourceVersion,
      taskClass,
      requiredCapability,
      assigneePersonId: safeUuid(item.assigneePersonId),
      dueAt: safeText(item.dueAt),
      severity,
      freshnessAt,
      freshness,
      state,
      sourceStatus,
      canAct: item.canAct,
      aggregateFreshness,
      partialSources,
    },
  };
};

const readInbox = async (
  request: Request,
  binding: unknown,
): Promise<Readonly<{ response: Response; value: unknown | null }>> => {
  let response: Response;
  try {
    response = await forwardPlatformConfigurationRequest(
      request,
      binding,
      '/api/v1/admin/inbox',
      'GET',
    );
  } catch {
    response = new Response(null, { status: 503 });
  }
  if (!response.ok) return { response, value: null };
  try {
    return { response, value: await response.json() };
  } catch {
    return {
      response: new Response(null, { status: 502 }),
      value: null,
    };
  }
};

export const resolveAdminWorkspace = async (input: {
  readonly request: Request;
  readonly binding: unknown;
  readonly localApiOrigin?: string;
  readonly tab: AdminWorkspaceTab;
  readonly requestId: string;
  readonly baseAccess?: AdminWorkspaceAccess;
  readonly capabilitySnapshot?: readonly string[];
  readonly forceHidden?: boolean;
}): Promise<AdminWorkspaceResolution> => {
  if (input.forceHidden || input.baseAccess === 'not-rendered')
    return hiddenResolution(input.requestId);
  const binding = resolvePlatformConfigurationBinding(
    input.binding,
    input.localApiOrigin,
  );
  const { response, value } = await readInbox(input.request, binding);
  if (response.status === 401)
    return {
      kind: 'unauthenticated',
      access: 'disabled',
      initial: errorState(401, input.requestId),
      capabilities: [],
    };
  if (response.status === 403) return hiddenResolution(input.requestId);
  if (!response.ok || value === null)
    return {
      kind: 'ready',
      access: 'disabled',
      initial: errorState(response.status, input.requestId),
      capabilities: [],
    };
  const parsed = Cfg05b01InboxResponseSchema.safeParse(value);
  if (!parsed.success)
    return {
      kind: 'ready',
      access: 'disabled',
      initial: {
        status: 'degraded',
        data: null,
        requestId: input.requestId,
        retryable: true,
      },
      capabilities: [],
    };
  // The Worker's CFG-05B-07 projection is the capability source. Any failure
  // reads as an empty list, so the grant affordance fails closed.
  const capabilities = [
    ...new Set([
      ...(input.capabilitySnapshot ?? []),
      ...(await readWorkerCapabilitySnapshot(input.request, binding)),
    ]),
  ];
  const aggregateFreshness = parsed.data.aggregateFreshness;
  const partialSources = parsed.data.partialSources;
  const data = parsed.data.items
    .map((item) =>
      projectionRecord(safeObject(item), aggregateFreshness, partialSources),
    )
    .filter((item): item is AdminWorkspaceRecord => item !== null);
  const canAct = data.some(
    (record) => safeObject(record.projection).canAct === true,
  );
  const hasGrantCapability = capabilities.some((value) =>
    grantCapabilityNames.has(value),
  );
  const hasActiveCapability = capabilities.some((value) =>
    activeCapabilityNames.has(value),
  );
  const access: AdminWorkspaceAccess =
    hasGrantCapability || canAct
      ? 'full'
      : hasActiveCapability || response.ok
        ? 'read-only'
        : 'not-rendered';
  const firstVersion = data[0]?.version;
  return {
    kind: 'ready',
    access,
    initial: {
      status: 'success',
      data,
      ...(firstVersion === undefined ? {} : { version: firstVersion }),
      stale: aggregateFreshness === 'stale',
      lastVerifiedAt: parsed.data.generatedAt,
      requestId: input.requestId,
    },
    capabilities,
  };
};

export default resolveAdminWorkspace;
