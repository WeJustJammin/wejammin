import {
  CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER,
  CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER,
  CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER,
  CONTENT_SCHEMA_REGISTRY_HUMAN_CAPABILITIES,
  CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANT_HEADER,
  CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS,
  CONTENT_SCHEMA_REGISTRY_STEP_UP_FRESH_UNTIL_HEADER,
} from '@wejammin/contracts';

const humanCapabilities = new Set<string>(
  CONTENT_SCHEMA_REGISTRY_HUMAN_CAPABILITIES,
);
const presentationVariants = new Set<string>(
  CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS,
);

export type ContentSchemaRegistryRefetchReason =
  'list-read' | 'detail-read' | 'mutation' | 'reconnect';
export type ContentSchemaRegistryPresentationVariant =
  (typeof CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS)[number];

/** Parse only server-emitted CMS capabilities used by the web projection. */
export const parseContentSchemaRegistryCapabilities = (
  value: string | null,
): readonly string[] => {
  if (value === null) return [];
  const capabilities: string[] = [];
  for (const candidate of value.split(',')) {
    const capability = candidate.trim();
    if (!humanCapabilities.has(capability) || capabilities.includes(capability))
      continue;
    capabilities.push(capability);
    if (
      capabilities.length === CONTENT_SCHEMA_REGISTRY_HUMAN_CAPABILITIES.length
    )
      break;
  }
  return capabilities;
};

export const parseContentSchemaRegistryPresentationVariant = (
  value: string | null,
): ContentSchemaRegistryPresentationVariant | null =>
  value !== null && presentationVariants.has(value)
    ? (value as ContentSchemaRegistryPresentationVariant)
    : null;

/**
 * Accept only a canonical RFC3339 millisecond instant so a malformed private
 * disclosure header is dropped rather than forwarded to the browser.
 */
const parseContentSchemaRegistryStepUpFreshUntil = (
  value: string | null,
): string | null => {
  if (value === null || value.length === 0) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
    ? value
    : null;
};

export const isSafeUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
    value,
  );

export const parseContentSchemaRegistryContextId = (
  value: string | null,
): string | null => (value !== null && isSafeUuid(value) ? value : null);

export const parseContentSchemaRegistryContextHeaders = (headers: Headers) => ({
  actorId: parseContentSchemaRegistryContextId(
    headers.get(CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER),
  ),
  actingPartyId: parseContentSchemaRegistryContextId(
    headers.get(CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER),
  ),
  capabilities: parseContentSchemaRegistryCapabilities(
    headers.get(CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER),
  ),
  presentationVariant: parseContentSchemaRegistryPresentationVariant(
    headers.get(CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANT_HEADER),
  ),
  stepUpFreshUntil: parseContentSchemaRegistryStepUpFreshUntil(
    headers.get(CONTENT_SCHEMA_REGISTRY_STEP_UP_FRESH_UNTIL_HEADER),
  ),
});

export const SESSION_COOKIE_NAMES = new Set([
  'wj_access',
  'wj_refresh',
  'wj_session_ref',
  'wj_csrf',
  'wj_auth_flow',
]);

export const QUERY_KEYS = [
  'resourceKind',
  'keyPrefix',
  'lifecycle',
  'state',
  'limit',
  'cursor',
  'sort',
  'direction',
] as const;

export const hasSessionCookie = (request: Request): boolean => {
  const raw = request.headers.get('cookie');
  if (raw === null) return false;
  return raw.split(';').some((part) => {
    const separator = part.indexOf('=');
    if (separator <= 0) return false;
    return SESSION_COOKIE_NAMES.has(part.slice(0, separator).trim());
  });
};

export const forwardedQuery = (url: URL): string => {
  const query = new URLSearchParams();
  for (const key of QUERY_KEYS) {
    const value = url.searchParams.get(key);
    if (value !== null) query.set(key, value);
  }
  const serialized = query.toString();
  return serialized.length > 0 ? `?${serialized}` : '';
};
