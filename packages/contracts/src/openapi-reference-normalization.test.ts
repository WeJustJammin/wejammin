import { describe, expect, it } from 'vitest';

import {
  anchorOpenApiSchemaReferences,
  collectSchemaReferences,
} from './openapi-reference-normalization.ts';

describe('OpenAPI component reference anchoring', () => {
  it('anchors recursive draft-7 definitions inside their emitted component', () => {
    expect(
      anchorOpenApiSchemaReferences('Example', {
        definitions: {
          value: { anyOf: [null, { $ref: '#/definitions/value' }] },
        },
        properties: {
          value: { $ref: '#/definitions/value' },
          other: { $ref: '#/components/schemas/Other' },
          unknown: { $ref: 1 },
        },
      }),
    ).toEqual({
      definitions: {
        value: {
          anyOf: [
            null,
            { $ref: '#/components/schemas/Example/definitions/value' },
          ],
        },
      },
      properties: {
        value: { $ref: '#/components/schemas/Example/definitions/value' },
        other: { $ref: '#/components/schemas/Other' },
        unknown: { $ref: 1 },
      },
    });
    expect(
      anchorOpenApiSchemaReferences('A/B~C', {
        $ref: '#/definitions/value',
      }),
    ).toEqual({
      $ref: '#/components/schemas/A~1B~0C/definitions/value',
    });
  });

  it('preserves literal $ref values inside annotation and sample data', () => {
    const literal = { $ref: '#/definitions/value' };

    expect(
      anchorOpenApiSchemaReferences('Example', {
        const: literal,
        default: literal,
        enum: [literal],
        example: literal,
        examples: [literal],
      }),
    ).toEqual({
      const: literal,
      default: literal,
      enum: [literal],
      example: literal,
      examples: [literal],
    });
  });

  it('anchors references declared under names that match annotation keywords', () => {
    const anchored = { $ref: '#/components/schemas/Example/definitions/value' };

    expect(
      anchorOpenApiSchemaReferences('Example', {
        properties: {
          const: { $ref: '#/definitions/value' },
          default: { $ref: '#/definitions/value' },
          enum: { $ref: '#/definitions/value' },
          example: { $ref: '#/definitions/value' },
          examples: { $ref: '#/definitions/value' },
          properties: { $ref: '#/definitions/value' },
        },
      }),
    ).toEqual({
      properties: {
        const: anchored,
        default: anchored,
        enum: anchored,
        example: anchored,
        examples: anchored,
        properties: anchored,
      },
    });
  });

  it('anchors definitions whose entry names match annotation keywords', () => {
    expect(
      anchorOpenApiSchemaReferences('Example', {
        definitions: {
          default: { $ref: '#/definitions/default' },
          example: { anyOf: [null, { $ref: '#/definitions/example' }] },
        },
      }),
    ).toEqual({
      definitions: {
        default: {
          $ref: '#/components/schemas/Example/definitions/default',
        },
        example: {
          anyOf: [
            null,
            { $ref: '#/components/schemas/Example/definitions/example' },
          ],
        },
      },
    });
  });

  it('keeps anchorable references inside nested subschema containers', () => {
    expect(
      anchorOpenApiSchemaReferences('Example', {
        additionalProperties: { $ref: '#/definitions/value' },
        allOf: [{ $ref: '#/definitions/value' }],
        items: { $ref: '#/definitions/value' },
        not: { $ref: '#/definitions/value' },
      }),
    ).toEqual({
      additionalProperties: {
        $ref: '#/components/schemas/Example/definitions/value',
      },
      allOf: [{ $ref: '#/components/schemas/Example/definitions/value' }],
      items: { $ref: '#/components/schemas/Example/definitions/value' },
      not: { $ref: '#/components/schemas/Example/definitions/value' },
    });
  });

  it('preserves literal $ref values inside vendor extension data', () => {
    const literal = { $ref: '#/definitions/value' };

    expect(
      anchorOpenApiSchemaReferences('Example', {
        'x-custom': literal,
        properties: { value: { 'x-trace': { $ref: '#/definitions/value' } } },
      }),
    ).toEqual({
      'x-custom': literal,
      properties: { value: { 'x-trace': { $ref: '#/definitions/value' } } },
    });
  });

  it('anchors references inside schema-valued vendor extensions', () => {
    expect(
      anchorOpenApiSchemaReferences('Example', {
        'x-request-schema': { $ref: '#/definitions/value' },
      }),
    ).toEqual({
      'x-request-schema': {
        $ref: '#/components/schemas/Example/definitions/value',
      },
    });
  });
});

describe('OpenAPI schema reference collection', () => {
  it('ignores ref-shaped sample and vendor extension data', () => {
    expect(
      collectSchemaReferences({
        example: { $ref: '#/definitions/sample' },
        'x-custom': { $ref: '#/definitions/payload' },
        properties: { value: { $ref: '#/components/schemas/Value' } },
      }),
    ).toEqual([
      {
        path: '/properties/value/$ref',
        reference: '#/components/schemas/Value',
      },
    ]);
  });

  it('collects references from schema-valued vendor extensions', () => {
    expect(
      collectSchemaReferences({
        'x-request-schema': { $ref: '#/components/schemas/Request' },
      }),
    ).toEqual([
      {
        path: '/x-request-schema/$ref',
        reference: '#/components/schemas/Request',
      },
    ]);
  });
});
