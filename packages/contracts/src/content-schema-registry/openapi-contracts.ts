import { z } from 'zod';

import { ApiErrorSchema } from '../api-error.ts';
import { anchorOpenApiSchemaReferences } from '../openapi-reference-normalization.ts';
import * as models from './models.ts';
import * as primitives from './primitives.ts';
import * as requests from './requests.ts';
import * as resources from './resources.ts';

const excludedWorkerEvidence = new Set([
  'BlockDefinitionVersionResourceSchema',
  'BlockLifecycleEventResourceSchema',
]);

const featureSchemaContracts: Record<string, z.ZodTypeAny> = Object.fromEntries(
  [primitives, models, requests, resources]
    .flatMap((module) => Object.entries(module))
    .filter(
      ([name, schema]) =>
        name.endsWith('Schema') &&
        schema !== undefined &&
        !excludedWorkerEvidence.has(name),
    )
    .map(([name, schema]) => [name, schema as z.ZodTypeAny]),
);

export const schemaContracts: Record<string, z.ZodTypeAny> = {
  ApiErrorSchema,
  ...featureSchemaContracts,
};

const browserExcludedSchemaNames = new Set([
  'CmsReleaseKeyIdSchema',
  'CmsEd25519SignatureSchema',
  'BlockRegistrationRequestSchema',
  'BlockLifecycleAdvanceRequestSchema',
  'ReleaseEnvelopeHeadersSchema',
  'PropsSchemaSnapshotSchema',
  'PropsSnapshotAttestationSchema',
  'BlockDefinitionVersionResourceSchema',
  'BlockLifecycleEventResourceSchema',
  'BlockLifecycleEventReceiptSchema',
]);

export const browserSchemaContracts: Record<string, z.ZodTypeAny> =
  Object.fromEntries(
    Object.entries(schemaContracts).filter(
      ([name]) => !browserExcludedSchemaNames.has(name),
    ),
  );

export const componentName = (schemaName: string): string =>
  schemaName.replace(/Schema$/u, '');

export const schemaForName = (
  schemaName: string,
  contracts: Readonly<Record<string, z.ZodTypeAny>> = schemaContracts,
): z.ZodTypeAny => {
  const schema = contracts[schemaName];
  if (!schema) {
    throw new Error(
      `Content schema registry OpenAPI schema ${schemaName} is absent.`,
    );
  }
  return schema;
};

export const schemaReference = (
  schemaName: string,
  contracts: Readonly<Record<string, z.ZodTypeAny>> = schemaContracts,
): Readonly<{ $ref: string }> => {
  schemaForName(schemaName, contracts);
  return { $ref: `#/components/schemas/${componentName(schemaName)}` };
};

export const toJsonSchema = (schemaName: string, schema: z.ZodTypeAny) =>
  anchorOpenApiSchemaReferences(
    componentName(schemaName),
    z.toJSONSchema(schemaForName(schemaName, { [schemaName]: schema }), {
      io: 'input',
      target: 'draft-7',
      unrepresentable: 'any',
    }),
  );
