import { describe, expect, it } from 'vitest';

import {
  SchemaActivationPreparationSchema,
  SchemaDryRunResourceSchema,
  SchemaReviewResourceSchema,
  getContentSchemaRegistryBrowserOpenApiComponentSchemas,
  getContentSchemaRegistryOpenApiComponentSchemas,
} from './index';
import {
  compatibleTemplate,
  completedPassedDryRun,
  frozenEvidence,
  openReview,
  preparation,
  uuid,
  uuid3,
} from './review-fixtures.test-support';

const issueMessages = (value: unknown): string[] => {
  const result = SchemaReviewResourceSchema.safeParse(value);
  return result.success
    ? []
    : result.error.issues.map(({ message }) => message);
};

const withDryRun = (dryRun: Record<string, unknown>) => ({
  ...openReview,
  frozenEvidence: {
    ...frozenEvidence,
    dryRun: { ...frozenEvidence.dryRun, ...dryRun },
  },
});

describe('SchemaReviewResource binds frozen evidence to the review', () => {
  it('accepts consistent candidate, dry-run, and passed evidence', () => {
    expect(SchemaReviewResourceSchema.safeParse(openReview).success).toBe(true);
  });

  it('rejects frozen evidence for a different candidate version', () => {
    expect(
      issueMessages({
        ...openReview,
        frozenEvidence: { ...frozenEvidence, contentTypeVersionId: uuid3 },
      }),
    ).toEqual(['frozen_evidence_must_name_the_review_candidate_version']);
  });

  it('rejects a review dry-run id that differs from the frozen dry run', () => {
    expect(issueMessages({ ...openReview, dryRunId: uuid })).toEqual([
      'frozen_dry_run_must_be_the_review_dry_run',
    ]);
  });

  it.each([
    ['queued state', { state: 'queued', result: null, reportHash: null }],
    ['running state', { state: 'running', result: null, reportHash: null }],
    ['failed state', { state: 'failed', result: null, reportHash: null }],
    ['failed result', { result: 'failed' }],
    ['null result', { result: null }],
    ['null report hash', { reportHash: null }],
  ])('rejects a frozen dry run that is not passed: %s', (_label, dryRun) => {
    expect(issueMessages(withDryRun(dryRun))).toEqual([
      'frozen_dry_run_must_be_completed_and_passed_with_report_hash',
    ]);
  });

  it('reports every broken binding independently', () => {
    expect(
      issueMessages({
        ...openReview,
        dryRunId: uuid,
        frozenEvidence: {
          ...frozenEvidence,
          contentTypeVersionId: uuid3,
          dryRun: { ...frozenEvidence.dryRun, result: null, reportHash: null },
        },
      }),
    ).toEqual([
      'frozen_evidence_must_name_the_review_candidate_version',
      'frozen_dry_run_must_be_the_review_dry_run',
      'frozen_dry_run_must_be_completed_and_passed_with_report_hash',
    ]);
  });
});

describe('SchemaDryRunResource classification', () => {
  it('never carries unknown, which only a draft version may declare', () => {
    expect(
      SchemaDryRunResourceSchema.safeParse(completedPassedDryRun).success,
    ).toBe(true);
    for (const classification of ['additive', 'conditional', 'breaking'])
      expect(
        SchemaDryRunResourceSchema.safeParse({
          ...completedPassedDryRun,
          classification,
        }).success,
      ).toBe(true);
    expect(
      SchemaDryRunResourceSchema.safeParse({
        ...completedPassedDryRun,
        classification: 'unknown',
      }).success,
    ).toBe(false);
  });
});

describe('activationPreparation.templateCompatibility is nullable and optional', () => {
  it('accepts omission and explicit null, and still rejects a malformed value', () => {
    const omitted = SchemaActivationPreparationSchema.parse(preparation);
    expect(Object.hasOwn(omitted, 'templateCompatibility')).toBe(false);
    const nulled = SchemaActivationPreparationSchema.parse({
      ...preparation,
      templateCompatibility: null,
    });
    expect(nulled.templateCompatibility).toBeNull();
    expect(
      SchemaActivationPreparationSchema.parse({
        ...preparation,
        templateCompatibility: compatibleTemplate,
      }).templateCompatibility,
    ).toEqual(compatibleTemplate);
    expect(
      SchemaActivationPreparationSchema.safeParse({
        ...preparation,
        templateCompatibility: { ...compatibleTemplate, compatible: false },
      }).success,
    ).toBe(false);
    expect(
      SchemaActivationPreparationSchema.safeParse({
        ...preparation,
        extra: 1,
      }).success,
    ).toBe(false);
  });

  it('generates a nullable, non-required property in both OpenAPI views', () => {
    for (const schemas of [
      getContentSchemaRegistryOpenApiComponentSchemas(),
      getContentSchemaRegistryBrowserOpenApiComponentSchemas(),
    ]) {
      const preparationSchema = schemas.SchemaActivationPreparation as {
        required: string[];
        properties: { templateCompatibility: { anyOf: { type?: string }[] } };
      };
      expect(preparationSchema.required).not.toContain('templateCompatibility');
      expect(
        preparationSchema.properties.templateCompatibility.anyOf.map(
          (member) => member.type,
        ),
      ).toContain('null');
      expect(
        preparationSchema.properties.templateCompatibility.anyOf,
      ).toHaveLength(2);
    }
  });
});
