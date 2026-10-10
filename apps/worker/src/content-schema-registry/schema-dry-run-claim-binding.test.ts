/** Controlled unit values only: no persisted claim, SQL, or enduring authority. */
import { describe, expect, it } from 'vitest';

import { decodeCmsSchemaDryRunClaimResponse } from './schema-dry-run-claim-binding';
import {
  CmsSchemaDryRunClaimRequestSchema,
  type CmsSchemaDryRunClaimRequest,
} from './schema-dry-run-claim-request';
import {
  CmsSchemaDryRunClaimResponseSchema,
  type CmsSchemaDryRunClaimResponse,
} from './schema-dry-run-claim-response';
import {
  BINDINGS,
  firstFixture,
  IDS,
  LEVELS,
  levelRecord,
  replaceLevel,
  responseFixture,
} from './schema-dry-run-claim-response-test-support';

const boundRequest = (
  value = responseFixture(),
): CmsSchemaDryRunClaimRequest => ({
  claimedJob: {
    jobId: value.job.id,
    version: value.job.version,
    leaseToken: IDS.other,
  },
  requestedEvent: { ...value.requestedEvent },
});

const capture = (value: unknown): (() => void) => {
  const seen = new Set<object>();
  const checks: (() => void)[] = [];
  const visit = (node: unknown): void => {
    if (typeof node !== 'object' || node === null || seen.has(node)) return;
    seen.add(node);
    const prototype: unknown = Object.getPrototypeOf(node);
    const status = [Object.isFrozen(node), Object.isExtensible(node)];
    const descriptors = Reflect.ownKeys(node).map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(node, key);
      if (descriptor === undefined) throw new Error('Missing descriptor');
      return [key, { ...descriptor }] as const;
    });
    checks.push(() => {
      expect(Object.getPrototypeOf(node)).toBe(prototype);
      expect([Object.isFrozen(node), Object.isExtensible(node)]).toStrictEqual(
        status,
      );
      expect(Reflect.ownKeys(node)).toStrictEqual(
        descriptors.map(([key]) => key),
      );
      for (const [key, descriptor] of descriptors) {
        const current = Object.getOwnPropertyDescriptor(node, key);
        expect(current).toStrictEqual(descriptor);
        expect(current?.value).toBe(descriptor.value);
      }
    });
    visit(prototype);
    for (const [, descriptor] of descriptors) visit(descriptor.value);
  };
  visit(value);
  return () => {
    for (const check of checks) check();
  };
};

const rejected = (
  request: CmsSchemaDryRunClaimRequest,
  value: unknown,
  responseValid: boolean,
  requestValid = true,
): void => {
  const before = [capture(request), capture(value)];
  expect(CmsSchemaDryRunClaimRequestSchema.safeParse(request).success).toBe(
    requestValid,
  );
  expect(CmsSchemaDryRunClaimResponseSchema.safeParse(value).success).toBe(
    responseValid,
  );
  expect(decodeCmsSchemaDryRunClaimResponse(request, value)).toBeNull();
  for (const check of before) check();
};

const accepted = (
  request: CmsSchemaDryRunClaimRequest,
  value: CmsSchemaDryRunClaimResponse,
): void => {
  const before = [capture(request), capture(value)];
  expect(CmsSchemaDryRunClaimRequestSchema.safeParse(request).success).toBe(
    true,
  );
  expect(CmsSchemaDryRunClaimResponseSchema.safeParse(value).success).toBe(
    true,
  );
  const result = decodeCmsSchemaDryRunClaimResponse(request, value);
  expect(result).toStrictEqual(value);
  if (result === null) throw new Error('Expected complete bound response');
  expect(result).not.toBe(value);
  for (const { level, keys } of LEVELS) {
    const output = level === 'outer' ? result : result[level];
    const input = level === 'outer' ? value : value[level];
    expect(Object.isFrozen(output)).toBe(true);
    expect(output).not.toBe(input);
    expect(Reflect.ownKeys(output)).toHaveLength(keys.length);
    expect(Object.keys(output).sort()).toStrictEqual([...keys].sort());
  }
  for (const check of before) check();
};

const changedEvent = (key: string, value: unknown) => {
  const response = responseFixture();
  Object.defineProperty(response.requestedEvent, key, { value });
  if (key === 'eventId')
    Object.defineProperty(response.job, 'originatingEventId', { value });
  if (key === 'aggregateId') {
    Object.defineProperty(response.job, 'id', { value });
    Object.defineProperty(response.report, 'jobId', { value });
  }
  return response;
};

describe('controlled claimed dry-run response caller binding', () => {
  it('preserves full19 acquired version and distinct plan/original versions in the complete bound response', () => {
    const value = responseFixture({
      job: { version: '9223372036854775807' },
      plan: { version: '9007199254740999' },
      requestedEvent: { aggregateVersion: '7', causationId: IDS.owner },
    });
    const request = boundRequest(value);
    expect([
      request.claimedJob.version,
      value.plan.version,
      request.requestedEvent.aggregateVersion,
    ]).toStrictEqual(['9223372036854775807', '9007199254740999', '7']);
    accepted(request, value);
  });

  it('preserves distinct valid full19 acquired plan and original versions', () => {
    const value = responseFixture({
      job: { version: '9223372036854775807' },
      plan: { version: '9223372036854775805' },
      requestedEvent: { aggregateVersion: '9223372036854775799' },
    });
    accepted(boundRequest(value), value);
  });

  it('accepts a privately valid UUIDv7 lease token without mutating either input', () => {
    const value = responseFixture();
    const request = boundRequest(value);
    Object.defineProperty(request.claimedJob, 'leaseToken', {
      value: '01926e18-7f00-7abc-8def-123456789abc',
    });
    accepted(request, value);
  });

  it('rejects a privately valid coherent foreign job and original-event tuple without repairing it', () => {
    const value = responseFixture({
      job: { id: IDS.other, originatingEventId: IDS.owner, version: '29' },
      report: { jobId: IDS.other },
      requestedEvent: {
        aggregateId: IDS.other,
        eventId: IDS.owner,
        aggregateVersion: '3',
        correlationId: IDS.target,
        causationId: IDS.source,
      },
    });
    rejected(boundRequest(), value, true);
  });

  it('rejects a privately valid wrong acquired job version while preserving the distinct plan and event versions', () => {
    const value = responseFixture({ job: { version: '9223372036854775807' } });
    rejected(boundRequest(), value, true);
  });

  it.each([
    ['eventId', IDS.owner],
    ['aggregateId', IDS.other],
    ['aggregateVersion', '19'],
    ['correlationId', IDS.owner],
    ['causationId', IDS.owner],
  ])(
    'rejects privately valid changed original %s with coherent internal links',
    (key, value) => {
      rejected(boundRequest(), changedEvent(key, value), true);
    },
  );

  // These three literal controls exercise private parsing, not an independently
  // distinguishable redundant caller comparison of fixed event literals.
  it.each([
    ['eventType', 'job.completed'],
    ['schemaVersion', 2],
    ['aggregateType', 'content'],
  ])(
    'rejects changed fixed original %s through the private response parser',
    (key, value) => {
      rejected(boundRequest(), changedEvent(String(key), value), false);
    },
  );

  it('rejects changed nonnull original causationId even when the returned event is privately valid', () => {
    const original = responseFixture({
      requestedEvent: { causationId: IDS.owner },
    });
    rejected(boundRequest(original), responseFixture(), true);
  });

  it.each([
    ['pending null source', firstFixture()],
    ['completed null active', firstFixture({ state: 'completed' })],
    [
      'completed target active',
      firstFixture({ state: 'completed', activeVersionId: IDS.target }),
    ],
    [
      'completed later active',
      firstFixture({ state: 'completed', activeVersionId: IDS.other }),
    ],
  ] as const)(
    'preserves privately valid controlled %s shape without SQL eligibility proof',
    (_label, value) => {
      accepted(boundRequest(value), value);
    },
  );

  it('accepts a coherent changed owner tuple because the request supplies no owner authority', () => {
    const value = responseFixture({
      job: { actingPartyId: IDS.other },
      report: { ownerId: IDS.other },
      candidate: { ownerId: IDS.other },
      planScope: { ownerId: IDS.other },
    });
    accepted(boundRequest(), value);
  });

  it.each(BINDINGS)(
    'rejects private internal relation violation $path before caller binding',
    ({ changes }) => {
      rejected(boundRequest(), responseFixture(changes), false);
    },
  );

  describe.each(LEVELS)('complete response $level shape', ({ level, keys }) => {
    it.each([
      'missing',
      'extra',
      'inherited',
      'symbol',
      'hidden',
      'null',
    ] as const)(
      'rejects %s without projecting away private shape or mutating inputs',
      (kind) => {
        const value = responseFixture();
        const target = levelRecord(value, level);
        const [required] = keys;
        if (kind === 'missing') delete target[required];
        if (kind === 'extra') target.extra = 'controlled-extra';
        if (kind === 'inherited') {
          Object.setPrototypeOf(target, { [required]: target[required] });
          delete target[required];
          expect(Object.hasOwn(target, required)).toBe(false);
        }
        if (kind === 'symbol' || kind === 'hidden')
          Object.defineProperty(
            target,
            kind === 'symbol' ? Symbol('extra') : 'hiddenExtra',
            {
              value: 'controlled-extra',
              enumerable: false,
            },
          );
        rejected(
          boundRequest(),
          replaceLevel(value, level, kind === 'null' ? null : target),
          false,
        );
      },
    );
  });

  it.each([
    ['undefined', undefined],
    ['array', []],
    ['scalar', 'invalid'],
    ['legacy plan only', responseFixture().plan],
    ['legacy plan wrapper', { plan: responseFixture().plan }],
    ['data wrapper', { data: responseFixture() }],
  ])(
    'rejects %s rather than falling back to a plan or wrapper',
    (_label, value) => {
      rejected(boundRequest(), value, false);
    },
  );

  it.each([
    ['job', 'version', '0'],
    ['job', 'version', '9223372036854775808'],
    ['job', 'type', 'object.verify'],
    ['plan', 'sourceCount', '-1'],
    ['plan', 'targetHash', 'not-a-hash'],
    ['plan', 'progress', 2],
  ] as const)(
    'rejects malformed %s.%s without coercion',
    (level, key, value) => {
      const response = responseFixture();
      rejected(
        boundRequest(),
        replaceLevel(response, level, { ...response[level], [key]: value }),
        false,
      );
    },
  );

  describe.each(['outer', 'claimedJob', 'requestedEvent'] as const)(
    'complete request %s validation',
    (level) => {
      it.each(['missing', 'extra', 'inherited', 'symbol', 'hidden'] as const)(
        'rejects %s request shape even when the response is privately valid',
        (kind) => {
          const request = boundRequest();
          const target = level === 'outer' ? request : request[level];
          const key =
            level === 'outer'
              ? 'claimedJob'
              : level === 'claimedJob'
                ? 'leaseToken'
                : 'causationId';
          const descriptor = Object.getOwnPropertyDescriptor(target, key);
          if (descriptor === undefined)
            throw new Error('Missing controlled request descriptor');
          if (kind === 'missing') Reflect.deleteProperty(target, key);
          if (kind === 'inherited') {
            Object.setPrototypeOf(target, { [key]: descriptor.value });
            Reflect.deleteProperty(target, key);
          }
          if (kind === 'extra' || kind === 'symbol' || kind === 'hidden')
            Object.defineProperty(
              target,
              kind === 'symbol' ? Symbol('extra') : 'extra',
              {
                value: 'controlled-extra',
                enumerable: kind === 'extra',
              },
            );
          rejected(request, responseFixture(), true, false);
        },
      );
    },
  );

  it.each([
    ['claimedJob', 'leaseToken', 'not-a-uuid'],
    ['claimedJob', 'version', '9223372036854775808'],
    ['claimedJob', 'jobId', IDS.other],
    ['requestedEvent', 'aggregateVersion', '1.5'],
    ['requestedEvent', 'schemaVersion', '1'],
  ] as const)(
    'validates malformed request %s.%s instead of trusting its static type',
    (level, key, value) => {
      const request = boundRequest();
      Object.defineProperty(request[level], key, { value });
      rejected(request, responseFixture(), true, false);
    },
  );
});
