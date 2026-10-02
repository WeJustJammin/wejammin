import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from '../../../../infra/openapi-document.mjs';

type Schema = {
  required?: string[];
  properties: Record<string, Record<string, unknown>>;
};
const schemas = (
  buildOpenApiDocument() as unknown as {
    components: { schemas: Record<string, Schema> };
  }
).components.schemas;

describe('WP2c follow-up OpenAPI projections', () => {
  it('publishes a bounded identifier-free owner-only review assignment list', () => {
    const review = schemas.SchemaReviewResource;
    expect(review).toBeDefined();
    const assignments = review?.properties.assignments as {
      maxItems: number;
      items: Schema;
    };
    expect(assignments.maxItems).toBe(8);
    expect(Object.keys(assignments.items.properties).sort()).toEqual([
      'assignmentId',
      'endsAt',
      'reviewerLabel',
      'startsAt',
      'state',
      'version',
    ]);
    expect(assignments.items.properties.reviewerLabel).toMatchObject({
      minLength: 1,
      maxLength: 120,
    });
  });

  it('publishes an optional nullable sealed failureCode on dryRunRef', () => {
    const preparation = schemas.SchemaActivationPreparation;
    const dryRunRef = (
      preparation?.properties.dryRunRef as unknown as {
        anyOf: Schema[];
      }
    ).anyOf.find((entry) => entry.properties !== undefined);
    expect(dryRunRef?.required).not.toContain('failureCode');
    expect(dryRunRef?.properties.failureCode).toMatchObject({
      anyOf: [{ pattern: '^[A-Z][A-Z0-9_]{0,63}$' }, { type: 'null' }],
    });
  });
});
