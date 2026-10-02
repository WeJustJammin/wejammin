import { describe, expect, it } from 'vitest';

import {
  CapabilityGrantRequestSchema,
  SchemaReviewAssignmentRequestSchema,
  contentSchemaRegistryRoutePolicies,
} from '../../packages/contracts/src/content-schema-registry';
import { ApiErrorSchema } from '../../packages/contracts/src/api-error';
import {
  ASSIGNMENT_ID,
  assignRevokeBody,
} from '../../apps/worker/src/content-schema-registry/phase-02-slice-09-dec108-test-values';
import {
  expectedErrors,
  fixtureForRoute,
  schemaForRoute,
  successFixtures,
} from './phase-02-slice-09-operation-boundaries-fixtures';
import {
  operationIds,
  requiredFields,
  declaredRequestFields,
} from './phase-02-slice-09-operation-boundaries-fields';

describe('P2-S09 exact operation contracts', () => {
  it('[P2-S09-AC-264] validates every operation against an explicit field map and rejects unknown fields', () => {
    expect(
      contentSchemaRegistryRoutePolicies.map(({ operationId }) => operationId),
    ).toEqual(operationIds);
    for (const operationId of operationIds) {
      const schema = schemaForRoute(operationId, 'request');
      const fixture = fixtureForRoute(operationId);
      expect(schema.safeParse(fixture).success, `${operationId} fixture`).toBe(
        true,
      );
      expect(
        schema.safeParse({ ...fixture, __s09_unknown_field: 'reject' }).success,
        `${operationId} unknown field`,
      ).toBe(false);
      for (const fieldName of requiredFields(operationId)) {
        const missing = { ...fixture };
        delete missing[fieldName];
        expect(
          schema.safeParse(missing).success,
          `${operationId} required ${fieldName}`,
        ).toBe(false);
      }
      expect(
        declaredRequestFields[operationId].includes('__s09_unknown_field'),
      ).toBe(false);
    }
  });

  it('[P2-S09-AC-264] proves the revoke variant of CMS-03A-14 and refuses a mixed variant', () => {
    expect(
      SchemaReviewAssignmentRequestSchema.safeParse(assignRevokeBody).success,
    ).toBe(true);
    expect(
      SchemaReviewAssignmentRequestSchema.safeParse({
        ...assignRevokeBody,
        assignmentId: undefined,
      }).success,
    ).toBe(false);
    expect(
      SchemaReviewAssignmentRequestSchema.safeParse({
        ...assignRevokeBody,
        reviewerPersonId: ASSIGNMENT_ID,
      }).success,
    ).toBe(false);
  });

  it('[P2-S09-AC-264] CMS-03A-15 carries no owner or grantor field and only grantable capabilities', () => {
    const fixture = fixtureForRoute('CMS-03A-15');
    for (const smuggled of ['ownerPersonId', 'grantorId', 'organizationId'])
      expect(
        CapabilityGrantRequestSchema.safeParse({
          ...fixture,
          [smuggled]: ASSIGNMENT_ID,
        }).success,
        smuggled,
      ).toBe(false);
    expect(
      CapabilityGrantRequestSchema.safeParse({
        ...fixture,
        capability: 'cms.schema_review',
      }).success,
    ).toBe(false);
  });

  it('[P2-S09-AC-264] maps each generated request and success schema to its exact route policy and ApiError envelope', () => {
    for (const route of contentSchemaRegistryRoutePolicies) {
      expect(
        schemaForRoute(route.operationId, 'request').safeParse(
          fixtureForRoute(route.operationId),
        ).success,
      ).toBe(true);
      expect(
        schemaForRoute(route.operationId, 'success').safeParse(
          successFixtures[route.successSchema],
        ).success,
        `${route.operationId} success fixture`,
      ).toBe(true);
      expect(route.errors, `${route.operationId} error map`).toEqual(
        expectedErrors[route.operationId],
      );
      for (const [code, status] of Object.entries(route.errors)) {
        expect(
          ApiErrorSchema.safeParse({
            code,
            message: 'safe operation error',
            requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            details: {},
          }).success,
        ).toBe(true);
        expect(status).toBeGreaterThanOrEqual(400);
        expect(status).toBeLessThanOrEqual(599);
      }
    }
  });
});
