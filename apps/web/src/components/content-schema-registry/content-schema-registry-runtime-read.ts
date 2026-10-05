import { CONTENT_SCHEMA_REGISTRY_RETRYABLE_HEADER } from '@wejammin/contracts/client';

import { addClientBindingIdHeader } from '../../lib/client-binding';
import {
  CONTENT_SCHEMA_REGISTRY_MAX_RETRIES,
  CONTENT_SCHEMA_REGISTRY_RETRY_DELAYS_MS,
  parseContentSchemaRegistryRetryAfter,
} from './content-schema-registry-runtime-constants';

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;
type Sleeper = (milliseconds: number) => Promise<void>;

export interface ContentSchemaRegistryReadResult {
  readonly outcome: 'success' | 'degraded';
  readonly attempts: number;
  readonly response: Response | null;
  /** Whether the server explicitly authorized another dependency retry. */
  readonly retryable: boolean;
  /** Server Retry-After metadata, preserved for the recovery UI. */
  readonly retryAfterSeconds: number | null;
}

const defaultSleep: Sleeper = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const retryableReadStatus = (status: number): boolean =>
  status === 502 || status === 503 || status === 504;

const serverDeclaredRetryable = (response: Response): boolean =>
  retryableReadStatus(response.status) &&
  response.headers.get(CONTENT_SCHEMA_REGISTRY_RETRYABLE_HEADER) === 'true';

const retryAfterFor = (response: Response): number | null =>
  parseContentSchemaRegistryRetryAfter(response.headers.get('retry-after'));

/** Retry a canonical protected read only after a trusted server declaration. */
export const executeContentSchemaRegistryRead = async (input: {
  readonly url: string;
  readonly fetcher?: Fetcher;
  readonly sleep?: Sleeper;
}): Promise<ContentSchemaRegistryReadResult> => {
  const fetcher = input.fetcher ?? fetch;
  const sleep = input.sleep ?? defaultSleep;
  let attempts = 0;
  while (attempts <= CONTENT_SCHEMA_REGISTRY_MAX_RETRIES) {
    attempts += 1;
    let response: Response;
    try {
      response = await fetcher(
        input.url,
        await addClientBindingIdHeader(input.url, {
          method: 'GET',
          headers: new Headers({
            accept: 'text/html',
            'cache-control': 'no-store',
          }),
          credentials: 'same-origin',
          redirect: 'manual',
        }),
      );
    } catch {
      return {
        outcome: 'degraded',
        attempts,
        response: null,
        retryable: false,
        retryAfterSeconds: null,
      };
    }
    if (
      serverDeclaredRetryable(response) &&
      attempts <= CONTENT_SCHEMA_REGISTRY_MAX_RETRIES
    ) {
      await sleep(CONTENT_SCHEMA_REGISTRY_RETRY_DELAYS_MS[attempts - 1] ?? 750);
      continue;
    }
    return {
      outcome:
        response.status >= 200 && response.status < 400
          ? 'success'
          : 'degraded',
      attempts,
      response,
      retryable: serverDeclaredRetryable(response),
      retryAfterSeconds: retryAfterFor(response),
    };
  }
  return {
    outcome: 'degraded',
    attempts,
    response: null,
    retryable: false,
    retryAfterSeconds: null,
  };
};
