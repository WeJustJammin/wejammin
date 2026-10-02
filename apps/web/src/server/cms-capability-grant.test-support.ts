import { vi } from 'vitest';
import { CmsCapabilityGrantResourceSchema } from '@wejammin/contracts';
import type { CmsCapabilityGrantResource } from '@wejammin/contracts';

import { forwardContentSchemaRegistryMutation } from './content-schema-registry-platform-api';

/** Shared fixtures and a scripted-binding driver for the DEC-119/120 grant console server tests. */

export const GRANT_ORIGIN = 'https://app.test';
export const GRANT_ID = '6d1e8b24-5c93-7a0f-8e47-b2d6c9f13a85';
export const SUBJECT_ID = 'f08a3c62-91d4-7b5e-a620-4c7e1d9b08f3';
export const OTHER_SUBJECT_ID = '2b9e5d71-c3a8-7f06-9d14-e85a0b6c3f27';
export const GRANT_REQUEST_ID = '6a3173d9-f113-4aa4-91c3-3fbc137ea258';
export const GRANT_INSTANT = '2026-10-02T12:00:00.000Z';
export const GRANTS_PATH = '/api/v1/cms/capability-grants';
export const CONSOLE_PATH = '/app/cms-content-modeling/capability-grants';

export const grantResource = (
  overrides: Record<string, unknown> = {},
): CmsCapabilityGrantResource =>
  CmsCapabilityGrantResourceSchema.parse({
    id: GRANT_ID,
    version: '2',
    contentHash: 'c'.repeat(64),
    createdAt: GRANT_INSTANT,
    updatedAt: GRANT_INSTANT,
    resourceKind: 'cms_capability_grant',
    state: 'active',
    subjectPersonId: SUBJECT_ID,
    capability: 'cms.author',
    validFrom: '2026-10-02',
    validThrough: '2026-10-31',
    endsAt: '2026-11-01T00:00:00.000Z',
    lastAction: 'granted',
    reason: null,
    ...overrides,
  });

export const grantListPage = (
  items: readonly CmsCapabilityGrantResource[] = [grantResource()],
  nextCursor: string | null = null,
) => ({ items, nextCursor });

export interface GrantTarget {
  readonly operationId: 'CMS-03A-15' | 'CMS-03A-16' | 'CMS-03A-17';
  readonly grantId?: string;
}

export const forwardGrant = forwardContentSchemaRegistryMutation as unknown as (
  request: Request,
  binding: unknown,
  target: GrantTarget,
) => Promise<Response>;

export interface GrantCall {
  readonly target: GrantTarget;
  readonly payload?: unknown;
  readonly form?: Readonly<Record<string, string>>;
  readonly headers?: Readonly<Record<string, string | null>>;
  readonly upstream: {
    readonly status: number;
    readonly body: unknown;
    readonly headers?: Readonly<Record<string, string>>;
  };
}

const defaults: Record<string, string> = {
  cookie: 'wj_access=session; wj_csrf=csrf; tracking=omit',
  origin: GRANT_ORIGIN,
  'x-request-id': GRANT_REQUEST_ID,
  'x-csrf-token': 'csrf',
  'idempotency-key': 'cms-grant-12345678',
  'if-match': '"2"',
};

/** Drive the browser mutation facade against one scripted private upstream. */
export interface GrantCallResult {
  readonly response: Response;
  readonly fetch: ReturnType<typeof vi.fn>;
  readonly forwarded: Request | null;
  readonly forwardedBody: unknown;
}

export const callGrant = async (input: GrantCall): Promise<GrantCallResult> => {
  let forwarded: Request | null = null;
  let forwardedBody: unknown = null;
  const fetch = vi.fn(async (value: RequestInfo | URL) => {
    forwarded = value instanceof Request ? value : new Request(value);
    forwardedBody = JSON.parse(await forwarded.clone().text()) as unknown;
    return new Response(JSON.stringify(input.upstream.body), {
      status: input.upstream.status,
      headers: {
        'content-type': 'application/json',
        ...input.upstream.headers,
      },
    });
  });
  const headers = new Headers();
  for (const [name, value] of Object.entries({
    ...defaults,
    ...input.headers,
  }))
    if (value !== null) headers.set(name, value);
  const json = input.form === undefined;
  headers.set(
    'content-type',
    json ? 'application/json' : 'application/x-www-form-urlencoded',
  );
  const response = await forwardGrant(
    new Request(`${GRANT_ORIGIN}${CONSOLE_PATH}`, {
      method: 'POST',
      headers,
      body: json
        ? JSON.stringify(input.payload)
        : new URLSearchParams(input.form as Record<string, string>),
    }),
    { fetch },
    input.target,
  );
  return { response, fetch, forwarded, forwardedBody };
};

/** A private-service ApiError body, as the platform emits it. */
export const grantApiError = (
  code: string,
  details = {},
  message = 'Refused.',
) => ({ code, details, message, requestId: GRANT_REQUEST_ID }) as const;
