import { vi } from 'vitest';

import type { WorkerBindings } from '../index';
import { normalizeAuthProductionOptions } from './production-support';
import { createSupabaseMfaProvider } from './production-mfa-provider';
import {
  MANUAL_KEY,
  NOW,
  OTPAUTH_URI,
  PROVIDER_FACTOR_ID,
  requestFor,
} from './mfa-test-support';

export const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'dec-111-test',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  SUPABASE_URL: 'https://staging.example.supabase.co',
};

export const json = (value: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

export type Fetch = ReturnType<typeof vi.fn>;

export const build = (
  fetchImpl: Fetch,
  extra: Partial<Parameters<typeof createSupabaseMfaProvider>[1]> = {},
  clock: { now: number } = { now: NOW },
) => {
  const config = normalizeAuthProductionOptions({
    environment,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    now: () => clock.now,
  });
  const sleep = vi.fn(async () => undefined);
  return {
    sleep,
    clock,
    provider: createSupabaseMfaProvider(config, {
      issuer: 'WeJammin (staging)',
      sleep,
      timeoutMs: 5_000,
      ...extra,
    }),
  };
};

export const signal = new AbortController().signal;
export const request = requestFor();
export const enrollInput = { request, friendlyName: 'Phone authenticator' };
export const enrollPayload = {
  id: PROVIDER_FACTOR_ID,
  type: 'totp',
  friendly_name: 'Phone authenticator',
  totp: { qr_code: '<svg></svg>', secret: MANUAL_KEY, uri: OTPAUTH_URI },
};
