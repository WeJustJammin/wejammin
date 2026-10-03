import {
  BlockDefinitionVersionResourceSchema,
  BlockLifecycleEventResourceSchema,
  CmsCapabilityGrantListPageSchema,
  CmsCapabilityGrantResourceSchema,
  ContentSchemaRegistryDetailSchema,
  ContentSchemaRegistryListPageSchema,
  ContentTypeVersionResourceSchema,
  FieldDefinitionVersionResourceSchema,
  RelationDefinitionResourceSchema,
  SchemaActivationResourceSchema,
  SchemaDryRunResourceSchema,
  SchemaReviewAssignmentResourceSchema,
  SchemaReviewDecisionResourceSchema,
  SchemaReviewResourceSchema,
} from './contracts';
import type {
  ContentSchemaRegistryDependencies,
  ContentSchemaRegistryError,
  ContentSchemaRegistryOperationId,
  ContentSchemaRegistryPortInput,
  ContentSchemaRegistryResult,
} from './types';

type ResponseSchema = Readonly<{
  safeParse: (
    value: unknown,
  ) =>
    Readonly<{ success: true; data: unknown }> | Readonly<{ success: false }>;
}>;

const responseSchemas: Readonly<
  Record<ContentSchemaRegistryOperationId, ResponseSchema>
> = {
  'CMS-03A-01': ContentTypeVersionResourceSchema,
  'CMS-03A-02': FieldDefinitionVersionResourceSchema,
  'CMS-03A-03': RelationDefinitionResourceSchema,
  'CMS-03A-04': SchemaActivationResourceSchema,
  'CMS-03A-05': BlockDefinitionVersionResourceSchema,
  'CMS-03A-06': ContentSchemaRegistryListPageSchema,
  'CMS-03A-07': ContentSchemaRegistryDetailSchema,
  'CMS-03A-08': BlockLifecycleEventResourceSchema,
  'CMS-03A-09': ContentTypeVersionResourceSchema,
  'CMS-03A-10': SchemaDryRunResourceSchema,
  'CMS-03A-11': SchemaReviewResourceSchema,
  'CMS-03A-12': SchemaReviewDecisionResourceSchema,
  'CMS-03A-13': SchemaReviewResourceSchema,
  'CMS-03A-14': SchemaReviewAssignmentResourceSchema,
  'CMS-03A-15': CmsCapabilityGrantResourceSchema,
  'CMS-03A-16': CmsCapabilityGrantResourceSchema,
  'CMS-03A-17': CmsCapabilityGrantResourceSchema,
  'CMS-03A-18': CmsCapabilityGrantListPageSchema,
};

const portNames: Readonly<
  Record<
    ContentSchemaRegistryOperationId,
    keyof ContentSchemaRegistryDependencies['ports']
  >
> = {
  'CMS-03A-01': 'createTypeDraft',
  'CMS-03A-02': 'addFieldDefinition',
  'CMS-03A-03': 'bindRelation',
  'CMS-03A-04': 'activateSchema',
  'CMS-03A-05': 'registerBlock',
  'CMS-03A-06': 'listContentTypes',
  'CMS-03A-07': 'getContentTypeVersion',
  'CMS-03A-08': 'advanceBlockLifecycle',
  'CMS-03A-09': 'createSchemaSuccessor',
  'CMS-03A-10': 'startSchemaDryRun',
  'CMS-03A-11': 'submitSchemaReview',
  'CMS-03A-12': 'decideSchemaReview',
  'CMS-03A-13': 'getSchemaReview',
  'CMS-03A-14': 'assignSchemaReview',
  'CMS-03A-15': 'grantCapability',
  'CMS-03A-16': 'renewCapabilityGrant',
  'CMS-03A-17': 'revokeCapabilityGrant',
  'CMS-03A-18': 'listCapabilityGrants',
};

const unavailable = (): ContentSchemaRegistryError => ({
  ok: false,
  status: 503,
  code: 'DEPENDENCY_UNAVAILABLE',
  message: 'CMS registry persistence is temporarily unavailable.',
  details: { dependencyClass: 'cms_registry', retryable: true },
  retryAfterSeconds: 5,
});

const timedOut = (): ContentSchemaRegistryError => ({
  ok: false,
  status: 504,
  code: 'DEPENDENCY_DEADLINE_EXCEEDED',
  message: 'CMS registry persistence exceeded its deadline.',
  details: { dependencyClass: 'cms_registry', retryable: true },
  retryAfterSeconds: 5,
});

const invalidResponse = (): ContentSchemaRegistryError => ({
  ok: false,
  status: 502,
  code: 'DEPENDENCY_INVALID_RESPONSE',
  message: 'The CMS registry dependency returned an invalid response.',
  details: { dependencyClass: 'cms_registry', retryable: false },
});

/**
 * A port reports every expected dependency fault as a result: the production
 * adapter turns a transport failure into 503, a deadline into 504 and an
 * invalid body into 502. An exception that still escapes a port is therefore a
 * defect, not a dependency outage, and answers 500 INTERNAL_ERROR with nothing
 * of the exception on the wire. Only an abort is a deadline.
 */
const unexpectedFailure = (): ContentSchemaRegistryError => ({
  ok: false,
  status: 500,
  code: 'INTERNAL_ERROR',
  message: 'An unexpected error occurred.',
  details: {},
});

const isAbort = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  (value as { name?: unknown }).name === 'AbortError';

const withDeadline = async <T>(
  invoke: (signal: AbortSignal) => Promise<ContentSchemaRegistryResult<T>>,
  deadlineMs: number,
): Promise<ContentSchemaRegistryResult<T>> => {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ContentSchemaRegistryError>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(timedOut());
    }, deadlineMs);
  });
  try {
    return await Promise.race([invoke(controller.signal), timeout]);
  } catch (failure) {
    return isAbort(failure) ? timedOut() : unexpectedFailure();
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

export const createContentSchemaRegistryPortRunner = (
  dependencies: ContentSchemaRegistryDependencies,
) => {
  const run = async (
    input: ContentSchemaRegistryPortInput,
  ): Promise<ContentSchemaRegistryResult<unknown>> => {
    const portName = portNames[input.operationId];
    const port = dependencies.ports[portName];
    if (port === undefined) return unavailable();
    const result = await withDeadline<unknown>(
      (signal) =>
        port(input, signal) as Promise<ContentSchemaRegistryResult<unknown>>,
      dependencies.deadlineMs ?? 15_000,
    );
    if (!result.ok) return result;
    const parsed = responseSchemas[input.operationId].safeParse(result.value);
    return parsed.success
      ? { ok: true, value: parsed.data }
      : invalidResponse();
  };

  return { run };
};
