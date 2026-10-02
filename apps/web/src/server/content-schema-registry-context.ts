import { z } from 'zod';

import {
  ContentSchemaRegistryDetailSchema,
  ContentSchemaRegistryListPageSchema,
  parseContentSchemaRegistryQuery,
} from './content-schema-registry-contracts';
import {
  AuthoritySchema,
  ReadCapabilities,
  SessionSchema,
  UuidSchema,
} from './content-schema-registry-context-types';
import type {
  ContentSchemaRegistryAuthority,
  ContentSchemaRegistrySession,
} from './content-schema-registry-context-types';
import {
  degradedDetailState,
  degradedListState,
  detailState,
  listState,
  pageFor,
} from './content-schema-registry-context-presentation';
import { resolveContentSchemaRegistryActingContextLabel } from './content-schema-registry-acting-context';
import type {
  ContentSchemaRegistryResult,
  ResolveInput,
} from './content-schema-registry-context-presentation';
import {
  genericDegradedResult,
  platformFailure,
  platformOutcome,
  resultForPlatformOutcome,
} from './content-schema-registry-context-outcomes';

export type {
  ContentSchemaRegistryAuthority,
  ContentSchemaRegistryPorts,
  ContentSchemaRegistrySession,
} from './content-schema-registry-context-types';
export {
  createContentSchemaRegistryPorts,
  readContentSchemaRegistryPorts,
} from './content-schema-registry-context-support';
export type {
  ContentSchemaRegistryResult,
  ResolveInput,
} from './content-schema-registry-context-presentation';

export const resolveContentSchemaRegistryPage = async (
  input: ResolveInput,
): Promise<ContentSchemaRegistryResult> => {
  if (input.request.method !== 'GET') return { kind: 'invalid_record' };
  if (input.ports === null) {
    return { kind: 'unauthenticated', reason: 'missing_session' };
  }

  let session: ContentSchemaRegistrySession;
  try {
    const candidate = await input.ports.verifySession(input.request);
    const parsed = SessionSchema.safeParse(candidate);
    if (!parsed.success) {
      return { kind: 'unauthenticated', reason: 'missing_session' };
    }
    session = parsed.data;
    if (session.expiresAt <= (await input.ports.now())) {
      return { kind: 'unauthenticated', reason: 'expired_session' };
    }
  } catch (error) {
    const failure = platformFailure(error);
    if (failure !== null) return failure;
    const outcome = platformOutcome(error, input.requestId);
    if (outcome !== null) return resultForPlatformOutcome(input, outcome);
    return genericDegradedResult(input);
  }

  const queryResult = (() => {
    try {
      return {
        success: true as const,
        data: parseContentSchemaRegistryQuery(new URL(input.request.url)),
      };
    } catch (error) {
      const issues =
        error instanceof z.ZodError
          ? error.issues.map((issue) => issue.message)
          : ['The query is invalid.'];
      return { success: false as const, issues };
    }
  })();
  if (!queryResult.success) {
    return { kind: 'invalid_query', issues: queryResult.issues };
  }

  let contentTypeId: string | null = null;
  let versionId: string | null = null;
  if (input.route === 'detail') {
    if (
      input.contentTypeId === undefined ||
      input.versionId === undefined ||
      !UuidSchema.safeParse(input.contentTypeId).success ||
      !UuidSchema.safeParse(input.versionId).success
    ) {
      return { kind: 'invalid_record' };
    }
    contentTypeId = input.contentTypeId;
    versionId = input.versionId;
  }

  let authority: ContentSchemaRegistryAuthority;
  try {
    const candidate = await input.ports.resolveAuthority({
      request: input.request,
      session,
      route: input.route,
      contentTypeId,
      versionId,
    });
    const parsed = AuthoritySchema.safeParse(candidate);
    if (
      !parsed.success ||
      !parsed.data.capabilities.some((capability) =>
        ReadCapabilities.has(capability),
      )
    ) {
      return { kind: 'forbidden' };
    }
    authority = parsed.data;
  } catch (error) {
    const failure = platformFailure(error);
    if (failure !== null) return failure;
    const outcome = platformOutcome(error, input.requestId);
    if (outcome !== null)
      return resultForPlatformOutcome(input, outcome, { session });
    return genericDegradedResult(input, 'DEPENDENCY_UNAVAILABLE', { session });
  }

  // Presentation-only disclosure. The label comes from the authorized
  // identity read and is matched on the trusted server acting party; any
  // failure degrades the disclosure rather than the protected read, and no
  // identifier ever reaches the page projection.
  const disclosureNow = (input.now ?? Date.now)();
  const actingPartyId =
    'actingPartyId' in authority ? authority.actingPartyId : null;
  const loadActingContexts = input.ports.loadActingContexts;
  const actingContextLabel =
    actingPartyId !== null && loadActingContexts !== undefined
      ? await resolveContentSchemaRegistryActingContextLabel({
          actingPartyId,
          now: disclosureNow,
          fetchActingContexts: () =>
            Promise.resolve(loadActingContexts({ request: input.request })),
        })
      : null;
  const disclosureForPage = {
    now: disclosureNow,
    ...(actingContextLabel === null ? {} : { actingContextLabel }),
  };

  if (input.route === 'list') {
    try {
      const parsed = ContentSchemaRegistryListPageSchema.safeParse(
        await input.ports.loadList({
          request: input.request,
          session,
          authority,
          query: queryResult.data,
        }),
      );
      if (!parsed.success) {
        return {
          kind: 'degraded',
          status: 502,
          page: pageFor({
            request: input.request,
            requestId: input.requestId,
            session,
            authority,
            query: queryResult.data,
            list: degradedListState(
              input.requestId,
              'DEPENDENCY_INVALID_RESPONSE',
              { httpStatus: 502 },
            ),
            detail: null,
            contentTypeId,
            versionId,
            state: 'degraded',
            ...disclosureForPage,
          }),
        };
      }
      return {
        kind: 'authorized',
        page: pageFor({
          request: input.request,
          requestId: input.requestId,
          session,
          authority,
          query: queryResult.data,
          list: listState(parsed.data),
          detail: null,
          contentTypeId,
          versionId,
          state: 'ready',
          ...disclosureForPage,
        }),
      };
    } catch (error) {
      const failure = platformFailure(error);
      if (failure !== null) return failure;
      const outcome = platformOutcome(error, input.requestId);
      if (outcome !== null)
        return resultForPlatformOutcome(input, outcome, {
          session,
          authority,
        });
      return genericDegradedResult(input, 'DEPENDENCY_UNAVAILABLE', {
        session,
        authority,
      });
    }
  }

  try {
    const parsed = ContentSchemaRegistryDetailSchema.safeParse(
      await input.ports.loadDetail({
        request: input.request,
        session,
        authority,
        contentTypeId: contentTypeId as string,
        versionId: versionId as string,
      }),
    );
    if (!parsed.success) {
      return {
        kind: 'degraded',
        status: 502,
        page: pageFor({
          request: input.request,
          requestId: input.requestId,
          session,
          authority,
          query: queryResult.data,
          list: { status: 'empty', reason: 'no-records' },
          detail: degradedDetailState(
            input.requestId,
            'DEPENDENCY_INVALID_RESPONSE',
            { httpStatus: 502 },
          ),
          contentTypeId,
          versionId,
          state: 'degraded',
          ...disclosureForPage,
        }),
      };
    }
    if (
      parsed.data.resource.contentTypeId !== contentTypeId ||
      parsed.data.resource.id !== versionId
    ) {
      return { kind: 'not_found' };
    }
    return {
      kind: 'authorized',
      page: pageFor({
        request: input.request,
        requestId: input.requestId,
        session,
        authority,
        query: queryResult.data,
        list: { status: 'empty', reason: 'no-records' },
        detail: detailState(parsed.data),
        contentTypeId,
        versionId,
        state: 'ready',
        ...disclosureForPage,
      }),
    };
  } catch (error) {
    const failure = platformFailure(error);
    if (failure !== null) return failure;
    const outcome = platformOutcome(error, input.requestId);
    if (outcome !== null)
      return resultForPlatformOutcome(input, outcome, {
        session,
        authority,
      });
    return genericDegradedResult(input, 'DEPENDENCY_UNAVAILABLE', {
      session,
      authority,
    });
  }
};
