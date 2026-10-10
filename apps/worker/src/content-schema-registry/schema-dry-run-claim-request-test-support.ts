import { expect } from 'vitest';

import {
  CmsSchemaDryRunClaimRequestSchema,
  type CmsSchemaDryRunClaimRequest,
} from './schema-dry-run-claim-request';

export const JOB_ID = '10000000-0000-4000-8000-000000000001';
export const LEASE_TOKEN = '20000000-0000-4000-8000-000000000002';
export const EVENT_ID = '30000000-0000-4000-8000-000000000003';
export const CORRELATION_ID = '40000000-0000-4000-8000-000000000004';
export const CAUSATION_ID = '50000000-0000-4000-8000-000000000005';
export const OTHER_ID = '60000000-0000-4000-8000-000000000006';
export const HIGH_VERSION = '9007199254740993';
export const MAX_VERSION = '9223372036854775807';

// Controlled contract values only: no persisted receipt or live SQL authority.
export const requestFixture = (
  causationId: string | null = null,
  version = HIGH_VERSION,
  aggregateVersion = '7',
): CmsSchemaDryRunClaimRequest => ({
  claimedJob: { jobId: JOB_ID, version, leaseToken: LEASE_TOKEN },
  requestedEvent: {
    eventId: EVENT_ID,
    eventType: 'job.requested',
    schemaVersion: 1,
    aggregateType: 'job',
    aggregateId: JOB_ID,
    aggregateVersion,
    correlationId: CORRELATION_ID,
    causationId,
  },
});

export const REQUEST_LEVELS = [
  { level: 'outer', keys: ['claimedJob', 'requestedEvent'] },
  { level: 'claimedJob', keys: ['jobId', 'version', 'leaseToken'] },
  {
    level: 'requestedEvent',
    keys: [
      'eventId',
      'eventType',
      'schemaVersion',
      'aggregateType',
      'aggregateId',
      'aggregateVersion',
      'correlationId',
      'causationId',
    ],
  },
] as const;

export type RequestLevel = (typeof REQUEST_LEVELS)[number]['level'];

export const requestAtLevel = (
  level: RequestLevel,
  amend: (target: Record<string, unknown>) => void,
): Readonly<{
  input: Record<string, unknown>;
  target: Record<string, unknown>;
}> => {
  const fixture = requestFixture();
  const input: Record<string, unknown> = { ...fixture };
  const target: Record<string, unknown> =
    level === 'outer' ? input : { ...fixture[level] };
  if (level !== 'outer') input[level] = target;
  amend(target);
  return { input, target };
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const snapshotObject = (value: unknown): unknown => {
  if (!isObject(value)) return value;
  const prototype: unknown = Object.getPrototypeOf(value);
  return {
    descriptors: Object.getOwnPropertyDescriptors(value),
    prototype,
    frozen: Object.isFrozen(value),
    extensible: Object.isExtensible(value),
  };
};

export const snapshotRequest = (input: unknown): unknown => ({
  outer: snapshotObject(input),
  claimedJob: snapshotObject(isObject(input) ? input.claimedJob : undefined),
  requestedEvent: snapshotObject(
    isObject(input) ? input.requestedEvent : undefined,
  ),
});

export const expectRejected = (input: unknown): void => {
  const before = snapshotRequest(input);
  expect(CmsSchemaDryRunClaimRequestSchema.safeParse(input).success).toBe(
    false,
  );
  expect(snapshotRequest(input)).toStrictEqual(before);
};

export const inheritRequired = (
  target: Record<string, unknown>,
  key: string,
): void => {
  const value = target[key];
  delete target[key];
  Object.setPrototypeOf(target, { [key]: value });
  expect(Object.hasOwn(target, key)).toBe(false);
  expect(target[key]).toBe(value);
};

export const addInvisibleOwn = (
  target: Record<string, unknown>,
  kind: 'symbol' | 'non-enumerable',
): void => {
  Object.defineProperty(
    target,
    kind === 'symbol' ? Symbol('extra') : 'hiddenExtra',
    { value: 'unexpected', enumerable: kind === 'symbol' },
  );
};
