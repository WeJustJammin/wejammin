import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from '../../../../infra/openapi-document.mjs';
import { SchemaActivationPreparationSchema } from './resources.ts';
import {
  completedPassedDryRun,
  preparation,
  uuid,
} from './review-fixtures.test-support.ts';

const sealedPassed = {
  ...preparation.dryRunRef,
  sourceCount: completedPassedDryRun.sourceCount,
  targetCount: completedPassedDryRun.targetCount,
  rowErrorCount: 0,
  sourceHash: completedPassedDryRun.sourceHash,
  targetHash: completedPassedDryRun.targetHash,
  reportHash: completedPassedDryRun.reportHash,
};

const withRef = (dryRunRef: Record<string, unknown>) => ({
  ...preparation,
  dryRunRef,
});

const issues = (value: unknown): string[] => {
  const result = SchemaActivationPreparationSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe('activationPreparation.dryRunRef sealed report evidence', () => {
  it('[P2-S09-AC-963] [P2-S09-AC-1039] carries the sealed counts and hashes of a passed report', () => {
    const parsed = SchemaActivationPreparationSchema.parse(
      withRef(sealedPassed),
    );
    expect(parsed.dryRunRef).toMatchObject({
      sourceCount: sealedPassed.sourceCount,
      targetCount: sealedPassed.targetCount,
      rowErrorCount: 0,
      sourceHash: sealedPassed.sourceHash,
      targetHash: sealedPassed.targetHash,
      reportHash: sealedPassed.reportHash,
    });
  });

  it('[P2-S09-AC-963] carries the sealed counts and hashes of a failed report with row errors', () => {
    expect(
      SchemaActivationPreparationSchema.safeParse(
        withRef({ ...sealedPassed, result: 'failed', rowErrorCount: 3 }),
      ).success,
    ).toBe(true);
  });

  it('[P2-S09-AC-963] keeps the evidence members optional so a bare reference still parses', () => {
    expect(
      SchemaActivationPreparationSchema.safeParse(preparation).success,
    ).toBe(true);
  });

  it.each(['queued', 'running', 'failed'] as const)(
    '[P2-S09-AC-963] [P2-S09-AC-1039] rejects final evidence on an unsealed %s reference',
    (state) => {
      const base = {
        id: uuid,
        state,
        result: null,
        jobId: null,
        ...(state === 'failed' ? { failureCode: 'SCAN_ABORTED' } : {}),
      };
      for (const member of [
        { sourceCount: 1 },
        { targetCount: 1 },
        { rowErrorCount: 0 },
        { sourceHash: sealedPassed.sourceHash },
        { targetHash: sealedPassed.targetHash },
        { reportHash: sealedPassed.reportHash },
      ])
        expect(issues(withRef({ ...base, ...member }))).toContain(
          'an unsealed dry-run cannot carry final report evidence',
        );
    },
  );

  it('[P2-S09-AC-963] accepts explicit nulls on an unsealed reference', () => {
    expect(
      SchemaActivationPreparationSchema.safeParse(
        withRef({
          id: uuid,
          state: 'running',
          result: null,
          jobId: null,
          sourceCount: null,
          targetCount: null,
          rowErrorCount: null,
          sourceHash: null,
          targetHash: null,
          reportHash: null,
        }),
      ).success,
    ).toBe(true);
  });

  it('[P2-S09-AC-963] requires the sealed evidence members together once any is present', () => {
    expect(issues(withRef({ ...sealedPassed, reportHash: null }))).toContain(
      'a completed dry-run must expose sealed report evidence',
    );
    const partial: Record<string, unknown> = { ...sealedPassed };
    delete partial.targetHash;
    expect(issues(withRef(partial))).toContain(
      'a completed dry-run must expose sealed report evidence',
    );
  });

  it('[P2-S09-AC-963] requires zero row errors for passed and nonzero for failed', () => {
    expect(issues(withRef({ ...sealedPassed, rowErrorCount: 2 }))).toContain(
      'a passed dry-run requires zero row errors',
    );
    expect(
      issues(withRef({ ...sealedPassed, result: 'failed', rowErrorCount: 0 })),
    ).toContain('a sealed failing scan must carry the actual scan errors');
  });

  it('[P2-S09-AC-963] rejects non-hash and negative values and unknown members', () => {
    expect(
      SchemaActivationPreparationSchema.safeParse(
        withRef({ ...sealedPassed, reportHash: 'nope' }),
      ).success,
    ).toBe(false);
    expect(
      SchemaActivationPreparationSchema.safeParse(
        withRef({ ...sealedPassed, sourceCount: -1 }),
      ).success,
    ).toBe(false);
    expect(
      SchemaActivationPreparationSchema.safeParse(
        withRef({ ...sealedPassed, compilerHash: sealedPassed.reportHash }),
      ).success,
    ).toBe(false);
  });

  it('[P2-S09-AC-963] publishes the six optional nullable members on the OpenAPI dryRunRef', () => {
    const schemas = (
      buildOpenApiDocument() as unknown as {
        components: {
          schemas: Record<
            string,
            { properties: Record<string, { anyOf: Record<string, unknown>[] }> }
          >;
        };
      }
    ).components.schemas;
    const ref =
      schemas.SchemaActivationPreparation?.properties.dryRunRef?.anyOf.find(
        (entry) => entry.properties !== undefined,
      ) as { required?: string[]; properties: Record<string, unknown> };
    for (const member of [
      'sourceCount',
      'targetCount',
      'rowErrorCount',
      'sourceHash',
      'targetHash',
      'reportHash',
    ]) {
      expect(ref.properties[member]).toBeDefined();
      expect(ref.required).not.toContain(member);
    }
  });
});
