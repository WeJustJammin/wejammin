import { z } from 'zod';

import {
  ContentTypeResourceSchema,
  ContentTypeVersionResourceSchema,
} from './resources-core.ts';
import {
  FieldDefinitionVersionResourceSchema,
  RelationDefinitionResourceSchema,
} from './resources-fields.ts';
import { SchemaArtifactResourceSchema } from './resources-artifacts.ts';
import { BlockDefinitionRegistryRecordSchema } from './resources-blocks.ts';
import {
  CapabilityBindingResourceSchema,
  TemplateBindingResourceSchema,
} from './resources-bindings.ts';
import { SchemaActivationPreparationSchema } from './resources-workflow.ts';

export const ContentSchemaRegistryRecordSchema = z.discriminatedUnion(
  'resourceKind',
  [
    ContentTypeResourceSchema,
    ContentTypeVersionResourceSchema,
    FieldDefinitionVersionResourceSchema,
    RelationDefinitionResourceSchema,
    SchemaArtifactResourceSchema,
    BlockDefinitionRegistryRecordSchema,
    TemplateBindingResourceSchema,
    CapabilityBindingResourceSchema,
  ],
);

export const ContentSchemaRegistryListPageSchema = z
  .strictObject({
    items: z.array(ContentSchemaRegistryRecordSchema).max(100).readonly(),
    nextCursor: z.string().min(1).max(512).nullable(),
  })
  .readonly();

export const ContentSchemaRegistryDetailSchema = z
  .strictObject({
    resourceKind: z.literal('content_type_version'),
    resource: ContentTypeVersionResourceSchema,
    fields: z.array(FieldDefinitionVersionResourceSchema).max(128).readonly(),
    relations: z.array(RelationDefinitionResourceSchema).max(128).readonly(),
    schemaArtifact: SchemaArtifactResourceSchema,
    templateBindings: z.array(TemplateBindingResourceSchema).max(32).readonly(),
    capabilityBindings: z
      .array(CapabilityBindingResourceSchema)
      .max(32)
      .readonly(),
    blockDefinitions: z
      .array(BlockDefinitionRegistryRecordSchema)
      .max(128)
      .readonly(),
    activationPreparation: SchemaActivationPreparationSchema,
  })
  .readonly();

export type ContentSchemaRegistryRecord = z.infer<
  typeof ContentSchemaRegistryRecordSchema
>;
