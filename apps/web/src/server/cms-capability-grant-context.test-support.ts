import { vi } from 'vitest';
import {
  CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER,
  CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER,
  CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER,
  CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANT_HEADER,
  CONTENT_SCHEMA_REGISTRY_STEP_UP_FRESH_UNTIL_HEADER,
} from '@wejammin/contracts';

import {
  CONSOLE_PATH,
  GRANT_ORIGIN,
  GRANT_REQUEST_ID,
  grantListPage,
} from './cms-capability-grant.test-support';
import { createCmsCapabilityGrantPlatformPorts } from './cms-capability-grant-platform-api';
import { resolveCmsCapabilityGrantPage } from './cms-capability-grant-context';

export const GRANT_NOW = Date.parse('2026-10-02T12:00:00.000Z');
export const GRANT_STEP_UP_FRESH_UNTIL = new Date(
  GRANT_NOW + 5 * 60 * 1000,
).toISOString();
export const GRANT_ACTOR_ID = '5a1c9e2b-4d37-7f08-9b6e-c01d2a3f4e51';
export const GRANT_PARTY_ID = 'b7e402d9-81aa-7c35-a4f0-9d6e18b2c370';
export const GRANT_CONTEXT_LABEL = 'Northwind Collective';

export interface GrantBindingOptions {
  readonly status?: number;
  readonly errorCode?: string;
  readonly retryAfter?: string;
  readonly body?: unknown;
  readonly throws?: boolean;
  readonly omitStepUp?: boolean;
}

/** A scripted PLATFORM_API binding for the CMS-03A-18 read plus acting contexts. */
export const grantBinding = (options: GrantBindingOptions = {}) => {
  const requests: Request[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const request = input instanceof Request ? input : new Request(input);
    requests.push(request);
    if (options.throws === true) throw new TypeError('binding unavailable');
    if (request.url.includes('/api/v1/me/acting-contexts'))
      return Response.json({
        projectionVersion: '1',
        items: [
          {
            contextId: GRANT_PARTY_ID,
            partyId: GRANT_PARTY_ID,
            kind: 'organization',
            label: GRANT_CONTEXT_LABEL,
            avatarRef: null,
            selectable: true,
            authorityFreshUntil: new Date(
              GRANT_NOW + 60 * 60 * 1000,
            ).toISOString(),
          },
        ],
        nextCursor: null,
        hasMore: false,
      });
    const status = options.status ?? 200;
    if (status !== 200)
      return Response.json(
        {
          code: options.errorCode ?? 'FORBIDDEN',
          details: {},
          message: 'Refused.',
          requestId: GRANT_REQUEST_ID,
        },
        {
          status,
          headers:
            options.retryAfter === undefined
              ? {}
              : { 'retry-after': options.retryAfter },
        },
      );
    const headers = new Headers({ 'content-type': 'application/json' });
    headers.set(
      CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER,
      'cms.schema_designer',
    );
    headers.set(
      CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANT_HEADER,
      'ownerFull',
    );
    headers.set(CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER, GRANT_ACTOR_ID);
    headers.set(CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER, GRANT_PARTY_ID);
    if (options.omitStepUp !== true)
      headers.set(
        CONTENT_SCHEMA_REGISTRY_STEP_UP_FRESH_UNTIL_HEADER,
        GRANT_STEP_UP_FRESH_UNTIL,
      );
    return new Response(JSON.stringify(options.body ?? grantListPage()), {
      status: 200,
      headers,
    });
  });
  return { binding: { fetch }, fetch, requests };
};

export const grantPageRequest = (
  init: { readonly cookie?: string | null; readonly search?: string } = {},
): Request =>
  new Request(`${GRANT_ORIGIN}${CONSOLE_PATH}${init.search ?? ''}`, {
    headers:
      init.cookie === null
        ? {}
        : { cookie: init.cookie ?? 'wj_access=opaque; wj_csrf=csrf-cookie' },
  });

export const resolveGrantPage = async (
  options: GrantBindingOptions = {},
  input: { readonly request?: Request } = {},
) => {
  const bound = grantBinding(options);
  const result = await resolveCmsCapabilityGrantPage({
    request: input.request ?? grantPageRequest(),
    ports: createCmsCapabilityGrantPlatformPorts(bound.binding),
    requestId: GRANT_REQUEST_ID,
    now: () => GRANT_NOW,
  });
  return { result, bound };
};
