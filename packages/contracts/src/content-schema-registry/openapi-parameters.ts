import { z } from 'zod';

import type { ContentSchemaRegistryRoutePolicy } from './route-policy.ts';
import { schemaReference } from './openapi-contracts.ts';

export const pathParameters = (
  path: string,
): ReadonlyArray<Record<string, unknown>> =>
  [...path.matchAll(/\{([^}]+)\}/gu)].map(([, name]) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  }));

export const listQueryParameters = (
  contracts: Readonly<Record<string, z.ZodTypeAny>>,
): ReadonlyArray<Record<string, unknown>> => [
  {
    name: 'resourceKind',
    in: 'query',
    required: false,
    schema: schemaReference(
      'ContentSchemaRegistryResourceKindSchema',
      contracts,
    ),
  },
  {
    name: 'keyPrefix',
    in: 'query',
    required: false,
    schema: { type: 'string', pattern: '^[a-z][a-z0-9._-]{0,63}$' },
  },
  {
    name: 'lifecycle',
    in: 'query',
    required: false,
    schema: {
      type: 'string',
      enum: ['active', 'retired', 'deprecated', 'supported', 'withdrawn'],
    },
  },
  {
    name: 'state',
    in: 'query',
    required: false,
    schema: {
      type: 'string',
      enum: [
        'draft',
        'review',
        'approved',
        'scheduled',
        'active',
        'superseded',
        'retired',
        'blocked',
        'compiled',
      ],
    },
  },
  {
    name: 'limit',
    in: 'query',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
  },
  {
    name: 'cursor',
    in: 'query',
    required: false,
    schema: { type: 'string', minLength: 1, maxLength: 512 },
  },
  {
    name: 'sort',
    in: 'query',
    required: false,
    schema: {
      type: 'string',
      enum: ['key', 'createdAt', 'updatedAt', 'version'],
      default: 'key',
    },
  },
  {
    name: 'direction',
    in: 'query',
    required: false,
    schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
  },
];

export const capabilityGrantListQueryParameters = (
  contracts: Readonly<Record<string, z.ZodTypeAny>>,
): ReadonlyArray<Record<string, unknown>> => [
  {
    name: 'subjectPersonId',
    in: 'query',
    required: false,
    schema: { type: 'string', format: 'uuid' },
  },
  {
    name: 'capability',
    in: 'query',
    required: false,
    schema: schemaReference('GrantableCmsCapabilitySchema', contracts),
  },
  {
    name: 'state',
    in: 'query',
    required: false,
    schema: schemaReference('CmsCapabilityGrantStateSchema', contracts),
  },
  {
    name: 'limit',
    in: 'query',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
  },
  {
    name: 'cursor',
    in: 'query',
    required: false,
    schema: { type: 'string', minLength: 1, maxLength: 512 },
  },
  {
    name: 'sort',
    in: 'query',
    required: false,
    schema: {
      type: 'string',
      enum: ['updatedAt', 'validThrough'],
      default: 'updatedAt',
    },
  },
  {
    name: 'direction',
    in: 'query',
    required: false,
    schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
  },
];

export const mutationHeaderParameters = (
  route: ContentSchemaRegistryRoutePolicy,
): ReadonlyArray<Record<string, unknown>> => {
  const parameters: Array<Record<string, unknown>> = [];
  if (route.idempotency === 'required')
    parameters.push({
      name: 'Idempotency-Key',
      in: 'header',
      required: true,
      schema: {
        type: 'string',
        minLength: 8,
        maxLength: 128,
        pattern: '^[\\x20-\\x7e]{8,128}$',
      },
    });
  if (route.ifMatch === 'required')
    parameters.push({
      name: 'If-Match',
      in: 'header',
      required: true,
      schema: {
        type: 'string',
        pattern: '^"[1-9][0-9]{0,18}"$',
        description: 'Strong quoted decimal PostgreSQL bigint version.',
      },
    });
  if (route.rawBodySignature === 'required')
    parameters.push(
      {
        name: 'X-WeJammin-Release-Key-Id',
        in: 'header',
        required: true,
        schema: { $ref: '#/components/schemas/CmsReleaseKeyId' },
      },
      {
        name: 'X-WeJammin-Release-Issued-At',
        in: 'header',
        required: true,
        schema: schemaReference('CmsInstantSchema'),
      },
      {
        name: 'X-WeJammin-Release-Nonce',
        in: 'header',
        required: true,
        schema: schemaReference('CmsUuidSchema'),
      },
      {
        name: 'X-WeJammin-Release-Signature',
        in: 'header',
        required: true,
        schema: schemaReference('CmsEd25519SignatureSchema'),
      },
    );
  return parameters;
};
