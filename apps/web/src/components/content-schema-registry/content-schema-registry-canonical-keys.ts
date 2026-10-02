import type { ContentSchemaRegistryWorkbenchIslandProps } from './ContentSchemaRegistryWorkbenchIsland';

/**
 * Keys accepted on the canonical projection. The tuple is typechecked against
 * the serializable Island props so the accepted set can never silently drift
 * from the real contract. The check is compile-time only (type-only import),
 * so no runtime component module is pulled into the codec.
 *
 * Every declared island prop must be accepted (no real prop is rejected), and
 * every accepted key must be a declared prop or the known page-level state key
 * that the detail route also serializes into the island attributes.
 */
const CONTENT_SCHEMA_REGISTRY_PROJECTION_KEY_LIST = [
  'state',
  'variant',
  'access',
  'actorId',
  'actingPartyId',
  'actingContextLabel',
  'stepUpState',
  'stepUpFreshUntil',
  'requestId',
  'initialList',
  'initialDetail',
  'query',
  'contractFields',
  'contentTypeId',
  'versionId',
  'cursor',
  'expectedVersion',
  'canonicalUrl',
  'listUrl',
  'retryUrl',
  'csrfToken',
  'canonicalRefetchUrl',
] as const;

export type ContentSchemaRegistryProjectionKey =
  (typeof CONTENT_SCHEMA_REGISTRY_PROJECTION_KEY_LIST)[number];

// loading/offline/message are browser-owned presentation props added by the
// Island itself; they are never serialized into the server island attributes,
// so the accepted-keyset covers exactly the serialized contract surface.
type CoversDeclaredProps = [
  Exclude<
    keyof ContentSchemaRegistryWorkbenchIslandProps,
    'children' | 'loading' | 'offline' | 'message'
  >,
] extends [ContentSchemaRegistryProjectionKey]
  ? true
  : never;

type AcceptsOnlyKnownKeys = [
  Exclude<
    ContentSchemaRegistryProjectionKey,
    keyof ContentSchemaRegistryWorkbenchIslandProps | 'state'
  >,
] extends [never]
  ? true
  : never;

// Compile-time keyset integrity guards; drift fails the type-check.
const projectionKeyCoversProps: CoversDeclaredProps = true;
const projectionKeyAcceptsOnlyKnown: AcceptsOnlyKnownKeys = true;
void projectionKeyCoversProps;
void projectionKeyAcceptsOnlyKnown;

export const CONTENT_SCHEMA_REGISTRY_PROJECTION_KEYS: ReadonlySet<ContentSchemaRegistryProjectionKey> =
  new Set(CONTENT_SCHEMA_REGISTRY_PROJECTION_KEY_LIST);
