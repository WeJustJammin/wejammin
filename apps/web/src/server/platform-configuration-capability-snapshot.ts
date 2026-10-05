import { Cfg05b07CapabilitySnapshotResponseSchema } from '@wejammin/contracts';

import {
  filterPlatformConfigurationCookies,
  type PlatformConfigurationPlatformApiBinding,
} from './platform-configuration-platform-api';

/** CFG-05B-07, reached only through the private Worker service binding. */
export const PLATFORM_CONFIGURATION_CAPABILITY_SNAPSHOT_PATH =
  '/api/v1/admin/capability-snapshot';

const INTERNAL_ORIGIN = 'https://platform-configuration.internal';
const forwardedHeaders = [
  'accept',
  'x-correlation-id',
  'x-request-id',
] as const;

const isBinding = (
  value: unknown,
): value is PlatformConfigurationPlatformApiBinding =>
  typeof value === 'object' &&
  value !== null &&
  'fetch' in value &&
  typeof value.fetch === 'function';

/**
 * Read the acting-party-bound `admin.*` capability snapshot the Worker derives
 * for the verified session (BE05b CFG-05B-07).
 *
 * The call is server-to-server: only the named session cookies and trace
 * headers cross, never a caller role, capability, query or identifier. Every
 * failure (no binding, no session, transport error, non-200, non-JSON,
 * contract mismatch) resolves to an empty list, so the caller's capability
 * check fails closed.
 */
export const readWorkerCapabilitySnapshot = async (
  request: Request,
  binding: unknown,
): Promise<readonly string[]> => {
  if (!isBinding(binding)) return [];
  const cookies = filterPlatformConfigurationCookies(
    request.headers.get('cookie'),
  );
  if (cookies === null) return [];
  const headers = new Headers({ cookie: cookies, origin: INTERNAL_ORIGIN });
  for (const name of forwardedHeaders) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  try {
    const upstream = await binding.fetch(
      new Request(
        new URL(
          PLATFORM_CONFIGURATION_CAPABILITY_SNAPSHOT_PATH,
          INTERNAL_ORIGIN,
        ),
        { method: 'GET', headers },
      ),
    );
    if (
      !(upstream instanceof Response) ||
      upstream.status !== 200 ||
      !/^application\/json(?:\s*;|$)/iu.test(
        upstream.headers.get('content-type') ?? '',
      )
    ) {
      return [];
    }
    const parsed = Cfg05b07CapabilitySnapshotResponseSchema.safeParse(
      await upstream.json(),
    );
    return parsed.success ? parsed.data.capabilities : [];
  } catch {
    return [];
  }
};
