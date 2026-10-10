import type { JobEffectInput } from '@wejammin/application';
import { expect, vi } from 'vitest';

import { createClaimedSchemaMigrationPreparation } from './claimed-schema-migration-preparation';
import { SCHEMA_MIGRATION_RPC as RPC } from './migration-worker-constants';
import type { MigrationWorkerPort } from './migration-worker-types';
import { CmsSchemaDryRunClaimRequestSchema } from './schema-dry-run-claim-request';
import { CmsSchemaDryRunClaimResponseSchema } from './schema-dry-run-claim-response';
import {
  firstFixture,
  IDS,
} from './schema-dry-run-claim-response-test-support';

export const TOKEN = 'a0000000-0000-4000-8000-000000000001';
export const CAUSE = 'b0000000-0000-4000-8000-000000000002';
export const FOREIGN = 'c0000000-0000-4000-8000-000000000003';
export const ACQUIRED = '9223372036854775807';
export const PRECLAIM = '9223372036854775805';
export const ORIGINAL = '9223372036854775799';
export const DEADLINE = {
  code: 'DEPENDENCY_DEADLINE_EXCEEDED',
  retryable: true,
};

// Controlled ports and contract values, not persisted report or lease proof.
export const fixture = (
  cause: string | null = null,
  version = ACQUIRED,
  leaseToken = TOKEN,
) => {
  const base = firstFixture({ state: 'ready', progress: 1 });
  const response = {
    ...base,
    job: { ...base.job, version },
    requestedEvent: {
      ...base.requestedEvent,
      aggregateVersion: ORIGINAL,
      causationId: cause,
    },
  };
  const input = {
    job: {
      id: IDS.job,
      type: 'cms.schema.dry_run',
      state: 'running',
      version: PRECLAIM,
      leaseUntilMs: null,
    },
    envelope: { ...response.requestedEvent },
    leaseToken,
    claimedLease: {
      jobId: IDS.job,
      leaseToken,
      expectedVersion: PRECLAIM,
      version,
      leaseUntilMs: 2_000,
    },
  } satisfies JobEffectInput;
  // Per-fixture prototype: an inherited-scalar mutant cannot alter Object.prototype.
  Object.setPrototypeOf(input.job, { inheritedMarker: 'unchanged' });
  const request = {
    claimedJob: { jobId: IDS.job, version, leaseToken },
    requestedEvent: { ...response.requestedEvent },
  };
  expect(CmsSchemaDryRunClaimRequestSchema.safeParse(request).success).toBe(
    true,
  );
  expect(CmsSchemaDryRunClaimResponseSchema.safeParse(response).success).toBe(
    true,
  );
  const call = vi.fn<MigrationWorkerPort['call']>(async () => response);
  const telemetry = vi.fn();
  const controller = new AbortController();
  const options = { signal: controller.signal, attempt: 2 };
  const worker = createClaimedSchemaMigrationPreparation({
    port: { call },
    workerId: 'claimed-worker',
    now: () => 1_000,
    leaseDurationMs: 30_000,
    telemetry,
  });
  return {
    input,
    request,
    response,
    call,
    telemetry,
    controller,
    options,
    worker,
  };
};
type Fixture = ReturnType<typeof fixture>;
export const readCall = (f: Fixture) => [
  RPC.readPlan,
  f.request,
  f.options.signal,
];
export const processed = (f: Fixture, result = {}) => ({
  kind: 'processed',
  claimRequest: f.request,
  reportId: IDS.report,
  result: {
    outcome: 'completed',
    migrationPlanId: IDS.plan,
    schemaVersionId: IDS.target,
    eventId: null,
    state: 'ready',
    cursor: '0',
    progress: 1,
    retryAfterMs: null,
    reasonCode: null,
    activationSwitched: false,
    ...result,
  },
});
export const deferred = <T>() => {
  let complete: (value: T) => void = () => {
    throw new Error('Deferred not initialized');
  };
  const promise = new Promise<T>((resolve) => {
    complete = resolve;
  });
  return { promise, complete };
};

type ObjectSnapshot = Readonly<{
  value: object;
  prototype: unknown;
  descriptors: readonly (readonly [PropertyKey, PropertyDescriptor])[];
  frozen: boolean;
  extensible: boolean;
}>;
const capture = (roots: readonly unknown[]): readonly ObjectSnapshot[] => {
  const seen = new Set<object>();
  const entries: ObjectSnapshot[] = [];
  const visit = (value: unknown): void => {
    if (typeof value !== 'object' || value === null || seen.has(value)) return;
    seen.add(value);
    const prototype: unknown = Object.getPrototypeOf(value);
    // Ordered pairs retain constructor/symbols without descriptor-map type traps.
    const descriptors = Reflect.ownKeys(value).map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined) throw new Error('Missing own descriptor');
      return [key, { ...descriptor }] as const;
    });
    entries.push({
      value,
      prototype,
      descriptors,
      frozen: Object.isFrozen(value),
      extensible: Object.isExtensible(value),
    });
    visit(prototype);
    for (const [, descriptor] of descriptors) visit(descriptor.value);
  };
  roots.forEach(visit);
  return entries;
};

/** Observe the actual raw alternative reply, including every nested prototype. */
export const preserve = (f: Fixture, reply: unknown = f.response) => {
  const roots = () => [f.input, reply];
  const before = capture(roots());
  return () => {
    const after = capture(roots());
    expect(after).toHaveLength(before.length);
    after.forEach((entry, index) => {
      const previous = before[index];
      if (previous === undefined) throw new Error('Missing object snapshot');
      expect(entry.value).toBe(previous.value);
      expect(entry.prototype).toBe(previous.prototype);
      expect(entry.descriptors).toStrictEqual(previous.descriptors);
      entry.descriptors.forEach(([, descriptor], position) => {
        expect(descriptor.value).toBe(
          previous.descriptors[position]?.[1].value,
        );
      });
      expect(entry.frozen).toBe(previous.frozen);
      expect(entry.extensible).toBe(previous.extensible);
    });
  };
};
