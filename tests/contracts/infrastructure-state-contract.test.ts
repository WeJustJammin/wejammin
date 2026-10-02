import { InfrastructureViewStateSchema } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const OPERATION_ID = '22222222-2222-4222-8222-222222222222';
const NOW = '2026-08-30T12:00:00.000Z';
const LATER = '2026-08-30T12:01:00.000Z';
const RECORD = InfrastructureViewStateSchema.parse({
  status: 'success',
  record: {
    id: '33333333-3333-4333-8333-333333333333',
    label: 'Canonical record',
    summary: 'Validated infrastructure state.',
    version: '"1"',
    modifiedAt: NOW,
    facts: { region: 'local' },
    provenance: [],
  },
}).record;
const ERROR = {
  code: 'VALIDATION_FAILED',
  details: {},
  message: 'Review the highlighted values.',
  requestId: REQUEST_ID,
} as const;

describe('Slice 02 infrastructure state contract', () => {
  it('rejects retained state beyond the bounded safe-field map', () => {
    expect(
      InfrastructureViewStateSchema.safeParse({
        status: 'validation_error',
        httpStatus: 422,
        error: ERROR,
        retainedInput: Object.fromEntries(
          Array.from({ length: 33 }, (_, index) => [`field${index}`, index]),
        ),
      }).success,
    ).toBe(false);
  });

  it('represents degraded mode without unsafe last-known-good content', async () => {
    const { presentInfrastructureState } =
      await import('../../packages/ui/src/infrastructure/presentation.ts');
    const state = InfrastructureViewStateSchema.parse({
      status: 'degraded',
      requestId: REQUEST_ID,
      scope: 'Infrastructure records',
      lastKnownGood: null,
    });
    expect(presentInfrastructureState(state)).toMatchObject({
      status: 'degraded',
      lastKnownGood: null,
      freshnessLabel: null,
    });
  });

  it('preserves every declared typed-state alternative', async () => {
    const { presentInfrastructureState } =
      await import('../../packages/ui/src/infrastructure/presentation.ts');
    const states = [
      {
        status: 'validation_error',
        httpStatus: 400,
        error: ERROR,
        retainedInput: {},
      },
      {
        status: 'capability_gate',
        recovery: 'request_capability',
        requiredCapability: 'infrastructure.read',
      },
      {
        status: 'dependency_error',
        httpStatus: 502,
        requestId: REQUEST_ID,
        safeRetryDelaysMs: [250, 750],
      },
      {
        status: 'dependency_error',
        httpStatus: 504,
        requestId: REQUEST_ID,
        safeRetryDelaysMs: [250, 750],
      },
      { status: 'empty', reason: 'no_records' },
      { status: 'empty', reason: 'non_disclosure' },
    ].map((state) =>
      presentInfrastructureState(InfrastructureViewStateSchema.parse(state)),
    );
    expect(states.map((state) => state.status)).toEqual([
      'validation_error',
      'capability_gate',
      'dependency_error',
      'dependency_error',
      'empty',
      'empty',
    ]);
  });

  it('P1-S02-AC-001', async () => {
    const { presentInfrastructureState } =
      await import('../../packages/ui/src/infrastructure/presentation.ts');
    const state = InfrastructureViewStateSchema.parse({ status: 'idle' });
    expect(presentInfrastructureState(state)).toMatchObject({
      status: 'idle',
      busy: false,
    });
  });

  it('P1-S02-AC-002', async () => {
    const { presentInfrastructureState } =
      await import('../../packages/ui/src/infrastructure/presentation.ts');
    const state = InfrastructureViewStateSchema.parse({
      status: 'loading',
      startedAt: NOW,
      preserveSafePriorContent: false,
    });
    expect(presentInfrastructureState(state)).toMatchObject({
      status: 'loading',
      showSkeleton: true,
    });
  });

  it('P1-S02-AC-003', async () => {
    const { presentInfrastructureState } =
      await import('../../packages/ui/src/infrastructure/presentation.ts');
    const state = InfrastructureViewStateSchema.parse({
      status: 'validation_error',
      httpStatus: 422,
      error: ERROR,
      retainedInput: { label: 'kept' },
    });
    expect(presentInfrastructureState(state)).toMatchObject({
      status: 'validation_error',
      retainsInput: true,
    });
  });

  it('P1-S02-AC-004', async () => {
    const { presentInfrastructureState } =
      await import('../../packages/ui/src/infrastructure/presentation.ts');
    const state = InfrastructureViewStateSchema.parse({
      status: 'unauthenticated',
      returnTo: '/app/infrastructure',
    });
    expect(presentInfrastructureState(state)).toMatchObject({
      status: 'unauthenticated',
      returnTo: '/app/infrastructure',
    });
  });

  it('P1-S02-AC-005', async () => {
    const { presentInfrastructureState } =
      await import('../../packages/ui/src/infrastructure/presentation.ts');
    const state = InfrastructureViewStateSchema.parse({
      status: 'capability_gate',
      recovery: 'request_capability',
      requiredCapability: 'infrastructure.write',
    });
    expect(presentInfrastructureState(state)).toMatchObject({
      status: 'capability_gate',
      protectedLabelsVisible: false,
    });
  });

  it('P1-S02-AC-006', async () => {
    const { presentInfrastructureState } =
      await import('../../packages/ui/src/infrastructure/presentation.ts');
    const state = InfrastructureViewStateSchema.parse({ status: 'not_found' });
    expect(presentInfrastructureState(state)).toMatchObject({
      status: 'not_found',
      disclosureSafe: true,
    });
  });

  it('P1-S02-AC-007', async () => {
    const { presentInfrastructureState } =
      await import('../../packages/ui/src/infrastructure/presentation.ts');
    const state = InfrastructureViewStateSchema.parse({
      status: 'conflict',
      currentVersion: '"2"',
      retainedInput: { label: 'draft' },
    });
    expect(presentInfrastructureState(state)).toMatchObject({
      status: 'conflict',
      currentVersion: '"2"',
      retainsInput: true,
    });
  });

  it('P1-S02-AC-008', async () => {
    const { presentInfrastructureState } =
      await import('../../packages/ui/src/infrastructure/presentation.ts');
    const state = InfrastructureViewStateSchema.parse({
      status: 'rate_wait',
      retryAt: LATER,
      retainedInput: { label: 'draft' },
    });
    expect(presentInfrastructureState(state)).toMatchObject({
      status: 'rate_wait',
      retryAt: LATER,
      retainsInput: true,
    });
  });

  it('P1-S02-AC-009', async () => {
    const { presentInfrastructureState } =
      await import('../../packages/ui/src/infrastructure/presentation.ts');
    const state = InfrastructureViewStateSchema.parse({
      status: 'dependency_error',
      httpStatus: 503,
      requestId: REQUEST_ID,
      safeRetryDelaysMs: [250, 750],
    });
    expect(presentInfrastructureState(state)).toMatchObject({
      status: 'dependency_error',
      requestId: REQUEST_ID,
      safeRetry: true,
    });
  });

  it('P1-S02-AC-010', async () => {
    const { presentInfrastructureState } =
      await import('../../packages/ui/src/infrastructure/presentation.ts');
    const state = InfrastructureViewStateSchema.parse({
      status: 'empty',
      reason: 'filter_miss',
    });
    expect(presentInfrastructureState(state)).toMatchObject({
      status: 'empty',
      emptyReason: 'filter_miss',
    });
  });

  it('P1-S02-AC-011', async () => {
    const { presentInfrastructureState } =
      await import('../../packages/ui/src/infrastructure/presentation.ts');
    const state = InfrastructureViewStateSchema.parse({
      status: 'success',
      record: RECORD,
    });
    expect(presentInfrastructureState(state)).toMatchObject({
      status: 'success',
      recordVersion: '"1"',
    });
  });

  it('P1-S02-AC-012', async () => {
    const { presentInfrastructureState } =
      await import('../../packages/ui/src/infrastructure/presentation.ts');
    const state = InfrastructureViewStateSchema.parse({
      status: 'optimistic_pending',
      operationId: OPERATION_ID,
      canonicalPreimage: RECORD,
    });
    expect(presentInfrastructureState(state)).toMatchObject({
      status: 'optimistic_pending',
      operationId: OPERATION_ID,
    });
  });

  it('P1-S02-AC-013', async () => {
    const { presentInfrastructureState } =
      await import('../../packages/ui/src/infrastructure/presentation.ts');
    const state = InfrastructureViewStateSchema.parse({
      status: 'optimistic_rollback',
      operationId: OPERATION_ID,
      canonicalPreimage: RECORD,
      error: ERROR,
    });
    expect(presentInfrastructureState(state)).toMatchObject({
      status: 'optimistic_rollback',
      restoredPreimage: true,
    });
  });

  it('P1-S02-AC-014', async () => {
    const { presentInfrastructureState } =
      await import('../../packages/ui/src/infrastructure/presentation.ts');
    const state = InfrastructureViewStateSchema.parse({
      status: 'disabled',
      prerequisite: 'infrastructure.write',
    });
    expect(presentInfrastructureState(state)).toMatchObject({
      status: 'disabled',
      prerequisite: 'infrastructure.write',
    });
  });

  it('P1-S02-AC-015', async () => {
    const { presentInfrastructureState } =
      await import('../../packages/ui/src/infrastructure/presentation.ts');
    const state = InfrastructureViewStateSchema.parse({
      status: 'degraded',
      requestId: REQUEST_ID,
      scope: 'Infrastructure records',
      lastKnownGood: { record: RECORD, verifiedAt: NOW },
    });
    expect(presentInfrastructureState(state)).toMatchObject({
      status: 'degraded',
      freshnessLabel: NOW,
    });
  });
});
