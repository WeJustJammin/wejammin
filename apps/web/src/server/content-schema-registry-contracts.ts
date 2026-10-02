import { z } from 'zod';
import {
  BlockDefinitionRegistryRecordSchema,
  ContentSchemaRegistryDetailSchema,
  ContentSchemaRegistryListPageSchema,
  ContentSchemaRegistryListQuerySchema,
  ContentSchemaRegistryRecordSchema,
  ContentSchemaRegistryResourceKindSchema,
  ContentTypeDraftRequestSchema,
  ContentTypeVersionResourceSchema,
  FieldDefinitionVersionResourceSchema,
  FieldSchemaChangeRequestSchema,
  RelationBindingRequestSchema,
  RelationDefinitionResourceSchema,
  SchemaActivationRequestSchema,
  SchemaActivationResourceSchema,
  SchemaReviewResourceSchema,
} from '@wejammin/contracts';
import type {
  SchemaActivationPreparation,
  SchemaReviewResource,
} from '@wejammin/contracts';

export type { SchemaActivationPreparation, SchemaReviewResource };

export {
  BlockDefinitionRegistryRecordSchema as ContentSchemaRegistrySafeBlockProjectionSchema,
  ContentSchemaRegistryDetailSchema,
  ContentSchemaRegistryListPageSchema,
  ContentSchemaRegistryListQuerySchema,
  ContentSchemaRegistryRecordSchema,
  ContentSchemaRegistryResourceKindSchema,
  ContentTypeDraftRequestSchema,
  ContentTypeVersionResourceSchema,
  FieldDefinitionVersionResourceSchema,
  FieldSchemaChangeRequestSchema,
  RelationBindingRequestSchema,
  RelationDefinitionResourceSchema,
  SchemaActivationRequestSchema,
  SchemaActivationResourceSchema,
  SchemaReviewResourceSchema,
};

export type ContentSchemaRegistrySafeBlockProjection = z.infer<
  typeof BlockDefinitionRegistryRecordSchema
>;
export type ContentSchemaRegistryRecord = z.infer<
  typeof ContentSchemaRegistryRecordSchema
>;
export type ContentSchemaRegistryQuery = z.infer<
  typeof ContentSchemaRegistryListQuerySchema
>;
export type ContentSchemaRegistryListPage = z.infer<
  typeof ContentSchemaRegistryListPageSchema
>;
export type ContentSchemaRegistryDetail = z.infer<
  typeof ContentSchemaRegistryDetailSchema
>;
export type ContentSchemaRegistryResourceKind = z.infer<
  typeof ContentSchemaRegistryResourceKindSchema
>;
export type ContentTypeDraftRequest = z.infer<
  typeof ContentTypeDraftRequestSchema
>;
export type FieldSchemaChangeRequest = z.infer<
  typeof FieldSchemaChangeRequestSchema
>;
export type RelationBindingRequest = z.infer<
  typeof RelationBindingRequestSchema
>;
export type SchemaActivationRequest = z.infer<
  typeof SchemaActivationRequestSchema
>;
export type ContentTypeVersionResource = z.infer<
  typeof ContentTypeVersionResourceSchema
>;
export type FieldDefinitionVersionResource = z.infer<
  typeof FieldDefinitionVersionResourceSchema
>;
export type RelationDefinitionResource = z.infer<
  typeof RelationDefinitionResourceSchema
>;
export type SchemaActivationResource = z.infer<
  typeof SchemaActivationResourceSchema
>;

const CONTENT_SCHEMA_REGISTRY_QUERY_KEYS = [
  'resourceKind',
  'keyPrefix',
  'lifecycle',
  'state',
  'limit',
  'cursor',
  'sort',
  'direction',
] as const;

export const parseContentSchemaRegistryQuery = (
  url: URL,
): ContentSchemaRegistryQuery => {
  const params = url.searchParams;
  const input: Record<string, string> = {};
  for (const key of CONTENT_SCHEMA_REGISTRY_QUERY_KEYS) {
    const value = params.get(key);
    if (value !== null) input[key] = value;
  }
  return ContentSchemaRegistryListQuerySchema.parse(input);
};

/** Serialize only the validated query fields into bookmarkable URL state. */
export const serializeContentSchemaRegistryQuery = (
  query: ContentSchemaRegistryQuery,
): string => {
  const params = new URLSearchParams();
  for (const key of CONTENT_SCHEMA_REGISTRY_QUERY_KEYS) {
    const value = query[key];
    if (value !== undefined) params.set(key, String(value));
  }
  return params.toString();
};

export const contentSchemaRegistryListUrl = (
  query: ContentSchemaRegistryQuery,
): string => {
  const serialized = serializeContentSchemaRegistryQuery(query);
  return `/app/cms-content-modeling${serialized.length > 0 ? `?${serialized}` : ''}`;
};

export const safeContentSchemaRegistryReturnPath = (url: URL): string => {
  const candidate = `${url.pathname}${url.search}`;
  return candidate.startsWith('/') && !candidate.startsWith('//')
    ? candidate
    : '/app/cms-content-modeling';
};
