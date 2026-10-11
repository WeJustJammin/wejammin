import type {
  AsyncRpcClient,
  AsyncRpcClientOptions,
  AsyncRpcEnvironment,
} from './async-runtime-rpc-types';
import {
  ASYNC_RPC_DEADLINE_MS,
  ASYNC_RPC_MAX_RESPONSE_BYTES,
  PLATFORM_API_PROFILE,
} from './async-runtime-rpc-types';
import {
  AsyncRpcDependencyError,
  AsyncRpcManualReviewError,
  AsyncRpcTransportError,
} from './async-runtime-rpc-errors';
import {
  httpFailure,
  parseResponseBody,
  readBoundedResponse,
  responseLength,
} from './async-runtime-rpc-response';
import { supabaseRpcHeaders } from './supabase-rpc-headers';

const normalizeRpcOptions = (options: AsyncRpcClientOptions) => {
  if (options === null || typeof options !== 'object') {
    throw new Error('Async RPC transport limits are invalid.');
  }
  const deadlineMs = options.deadlineMs ?? ASYNC_RPC_DEADLINE_MS;
  const maxResponseBytes =
    options.maxResponseBytes ?? ASYNC_RPC_MAX_RESPONSE_BYTES;
  if (
    !Number.isSafeInteger(deadlineMs) ||
    deadlineMs < 1 ||
    deadlineMs > ASYNC_RPC_DEADLINE_MS ||
    !Number.isSafeInteger(maxResponseBytes) ||
    maxResponseBytes < 1 ||
    maxResponseBytes > ASYNC_RPC_MAX_RESPONSE_BYTES
  ) {
    throw new Error('Async RPC transport limits are invalid.');
  }
  return { deadlineMs, maxResponseBytes } as const;
};

const fetchClient = (
  fetcher: typeof fetch = globalThis.fetch,
  options: AsyncRpcClientOptions = {},
): AsyncRpcClient => {
  const { deadlineMs, maxResponseBytes } = normalizeRpcOptions(options);
  return async <T>(
    env: AsyncRpcEnvironment,
    operation: Parameters<AsyncRpcClient>[1],
    input: Record<string, unknown>,
    externalSignal?: AbortSignal,
  ): Promise<T> => {
    if (
      env.SUPABASE_URL.trim() === '' ||
      env.SUPABASE_SECRET_KEY.trim() === ''
    ) {
      throw new Error('Supabase RPC configuration unavailable');
    }
    const url = new URL(
      `/rest/v1/rpc/${operation}`,
      env.SUPABASE_URL,
    ).toString();
    const controller = new AbortController();
    let timedOut = false;
    let externallyAborted = false;
    let rejectDeadline: ((reason?: unknown) => void) | undefined;
    const deadline = new Promise<never>((_, reject) => {
      rejectDeadline = reject;
    });
    void deadline.catch(() => undefined);
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      rejectDeadline?.(new AsyncRpcDependencyError('timeout'));
    }, deadlineMs);
    const abortExternal = (): void => {
      externallyAborted = true;
      controller.abort();
      rejectDeadline?.(new AsyncRpcDependencyError('timeout'));
    };
    if (externalSignal?.aborted) abortExternal();
    externalSignal?.addEventListener('abort', abortExternal, { once: true });
    if (externallyAborted) {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', abortExternal);
      throw new AsyncRpcDependencyError('timeout');
    }

    try {
      let response: Response;
      try {
        response = await Promise.race([
          Promise.resolve().then(() =>
            fetcher(url, {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Accept-Profile': PLATFORM_API_PROFILE,
                ...supabaseRpcHeaders(env.SUPABASE_SECRET_KEY),
                'Content-Profile': PLATFORM_API_PROFILE,
                'content-type': 'application/json',
              },
              body: JSON.stringify(input),
              signal: controller.signal,
            }),
          ),
          deadline,
        ]);
      } catch (error) {
        if (timedOut || externallyAborted)
          throw new AsyncRpcDependencyError('timeout');
        if (error instanceof AsyncRpcTransportError) throw error;
        throw new AsyncRpcDependencyError('request_failed');
      }

      if (
        response === null ||
        typeof response !== 'object' ||
        typeof response.ok !== 'boolean' ||
        response.headers === null ||
        typeof response.headers.get !== 'function'
      ) {
        throw new AsyncRpcManualReviewError('malformed_response');
      }
      if (!response.ok) {
        throw await httpFailure(response, controller.signal);
      }
      responseLength(response, maxResponseBytes);
      const body = await readBoundedResponse(
        response,
        maxResponseBytes,
        controller.signal,
      );
      return parseResponseBody(body) as T;
    } catch (error) {
      if (timedOut || externallyAborted)
        throw new AsyncRpcDependencyError('timeout');
      if (error instanceof AsyncRpcTransportError) throw error;
      throw new AsyncRpcDependencyError('request_failed');
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', abortExternal);
    }
  };
};

export const createSupabaseRpc = fetchClient;
