import type { ContentSchemaRegistryCapability } from './route-policy-contract';

export const CONTENT_SCHEMA_REGISTRY_OPERATION_IDS = [
  'CMS-03A-01',
  'CMS-03A-02',
  'CMS-03A-03',
  'CMS-03A-04',
  'CMS-03A-05',
  'CMS-03A-06',
  'CMS-03A-07',
  'CMS-03A-08',
] as const;

export type ContentSchemaRegistryOperationId =
  (typeof CONTENT_SCHEMA_REGISTRY_OPERATION_IDS)[number];

/** Internal response metadata used by server-rendered CMS façades only. */
export const CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER =
  'x-content-schema-registry-capabilities' as const;

/** Trusted dependency-read proof consumed by the browser retry gate. */
export const CONTENT_SCHEMA_REGISTRY_RETRYABLE_HEADER =
  'x-content-schema-registry-retryable' as const;

/** Internal presentation proof for the server-rendered protected workbench. */
export const CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANT_HEADER =
  'x-content-schema-registry-presentation-variant' as const;

/** Authenticated context identifiers for the private web projection only. */
export const CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER =
  'x-content-schema-registry-actor-id' as const;
export const CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER =
  'x-content-schema-registry-acting-party-id' as const;

/** Server-derived MFA disclosure expiry; private projection only, not authority. */
export const CONTENT_SCHEMA_REGISTRY_STEP_UP_FRESH_UNTIL_HEADER =
  'x-content-schema-registry-step-up-fresh-until' as const;

/** Host reserved for the web-to-API service binding projection request. */
export const CONTENT_SCHEMA_REGISTRY_PRIVATE_SERVICE_HOST =
  'platform-api.internal' as const;

/** Human-read capabilities that may cross the private web/API boundary. */
export const CONTENT_SCHEMA_REGISTRY_HUMAN_CAPABILITIES = [
  'cms.schema_designer',
  'cms.schema_registry.read',
] as const satisfies readonly ContentSchemaRegistryCapability[];

/** Variants are server-selected presentation scopes, never browser roles. */
export const CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS = [
  'entitledRead',
  'ownerFull',
  'guardianMandate',
  'juniorRestricted',
  'businessMandate',
  'staffCaseScoped',
  'adminStepUp',
  'forbiddenHidden',
  'disabledPrerequisite',
] as const;

export type {
  ContentSchemaRegistryCapability,
  ContentSchemaRegistryErrorCode,
  ContentSchemaRegistryErrorStatus,
  ContentSchemaRegistryOpenApiSuccessSchemaName,
  ContentSchemaRegistryPath,
  ContentSchemaRegistryRequestSchemaName,
  ContentSchemaRegistrySuccessSchemaName,
  RouteContract,
} from './route-policy-contract';
