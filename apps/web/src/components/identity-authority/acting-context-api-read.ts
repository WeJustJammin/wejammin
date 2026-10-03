import {
  ActingContextListResponseSchema,
  SessionResourceSchema,
} from '@wejammin/contracts';
import type { ActingContextListResource } from '@wejammin/contracts';

import {
  addClientBindingIdHeader,
  clearClientBindingId,
  getClientBindingId,
} from '../../lib/client-binding';
import { ActingContextRequestError } from './acting-context-errors';
import { clearAllStepUpState } from './step-up-mfa/step-up-binding';
import {
  ActiveSessionReadError,
  contextChangeError,
  isRecoverableSessionContextError,
  readBoundedApiError,
} from './acting-context-request-support';

const MAX_ACTING_CONTEXT_PAGES = 32;

const readActiveSession = async (): Promise<{
  readonly personId: string | null;
  readonly actingPartyId: string | null;
}> => {
  const endpoint = '/api/v1/auth/session';
  let response: Response;
  try {
    const init = await addClientBindingIdHeader(endpoint, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    if (new Headers(init.headers).get('x-client-binding-id') === null)
      throw new Error('This tab cannot verify an isolated context.');
    response = await fetch(endpoint, init);
  } catch {
    throw new Error('The current context could not be verified.');
  }
  if (!response.ok) {
    const error = await readBoundedApiError(response);
    throw new ActiveSessionReadError(
      error !== null &&
        isRecoverableSessionContextError(response.status, error.code),
    );
  }
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error('The current context could not be verified.');
  }
  const parsed = SessionResourceSchema.safeParse(value);
  if (!parsed.success)
    throw new Error('The current context could not be verified.');
  return {
    personId: parsed.data.personId,
    actingPartyId: parsed.data.actingPartyId,
  };
};

const readActingContextPage = async (
  endpoint: string,
): Promise<ActingContextListResource> => {
  let response: Response;
  try {
    const init = await addClientBindingIdHeader(endpoint, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    if (new Headers(init.headers).get('x-client-binding-id') === null)
      throw new Error('This tab cannot verify an isolated context.');
    response = await fetch(endpoint, init);
  } catch {
    throw new ActingContextRequestError(
      'The context change may have reached the server, but its result could not be verified. Reload before continuing.',
      true,
    );
  }
  if (!response.ok) throw contextChangeError(response.status);
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw contextChangeError(502);
  }
  const parsed = ActingContextListResponseSchema.safeParse(value);
  if (!parsed.success) throw contextChangeError(502);
  return parsed.data;
};

export const readActingContexts =
  async (): Promise<ActingContextListResource> => {
    const items: ActingContextListResource['items'][number][] = [];
    const contextIds = new Set<string>();
    const cursors = new Set<string>();
    let cursor: string | null = null;
    let projectionVersion: string | null = null;

    for (
      let pageIndex = 0;
      pageIndex < MAX_ACTING_CONTEXT_PAGES;
      pageIndex += 1
    ) {
      const endpoint =
        cursor === null
          ? '/api/v1/me/acting-contexts'
          : `/api/v1/me/acting-contexts?cursor=${encodeURIComponent(cursor)}`;
      const page = await readActingContextPage(endpoint);
      if (
        (projectionVersion !== null &&
          page.projectionVersion !== projectionVersion) ||
        page.hasMore !== (page.nextCursor !== null)
      )
        throw contextChangeError(502);
      projectionVersion = page.projectionVersion;

      for (const item of page.items) {
        if (contextIds.has(item.contextId)) throw contextChangeError(502);
        contextIds.add(item.contextId);
        items.push(item);
      }
      if (!page.hasMore)
        return { ...page, items, nextCursor: null, hasMore: false };

      const nextCursor = page.nextCursor;
      if (nextCursor === null || cursors.has(nextCursor))
        throw contextChangeError(502);
      cursors.add(nextCursor);
      cursor = nextCursor;
    }

    throw new ActingContextRequestError(
      'The context list exceeds safe pagination limits. Reload before continuing.',
      true,
    );
  };

interface ResolvedTabContext {
  readonly session: {
    readonly personId: string | null;
    readonly actingPartyId: string | null;
  };
  readonly resource: ActingContextListResource;
  readonly active: ActingContextListResource['items'][number];
  readonly revertedToSelf: boolean;
}

export const readCurrentTabContext = async (): Promise<ResolvedTabContext> => {
  const previousClientBindingId = await getClientBindingId();
  if (previousClientBindingId === null)
    throw new Error('This tab cannot verify an isolated context.');
  let session: ResolvedTabContext['session'];
  let revertedToSelf = false;
  try {
    session = await readActiveSession();
  } catch (cause) {
    if (
      !(cause instanceof ActiveSessionReadError) ||
      !cause.recoverableContextBinding ||
      !(await clearClientBindingId())
    )
      throw cause;
    // The server no longer honours this tab's context: whatever step-up draft
    // or command envelope it left behind belongs to a context that is gone.
    clearAllStepUpState(
      typeof window === 'undefined' ? null : window.sessionStorage,
    );
    session = await readActiveSession();
    const retriedClientBindingId = await getClientBindingId();
    if (
      retriedClientBindingId === null ||
      retriedClientBindingId === previousClientBindingId
    )
      throw new Error('The current context could not be verified.', { cause });
    revertedToSelf = true;
  }

  const resource = await readActingContexts();
  const selectedPartyId = session.actingPartyId ?? session.personId;
  const active =
    selectedPartyId === null
      ? undefined
      : resource.items.find((item) => item.partyId === selectedPartyId);
  if (active === undefined) throw new Error('No current context found.');
  if (
    revertedToSelf &&
    (session.personId === null ||
      (session.actingPartyId !== null &&
        session.actingPartyId !== session.personId) ||
      active.kind !== 'person' ||
      active.partyId !== session.personId)
  )
    throw new Error('The server did not confirm a self context.');
  return { session, resource, active, revertedToSelf };
};
