import { Buffer } from 'node:buffer';

import { expect } from 'vitest';

import type { Plan } from './phase-02-slice-11-delivery-receiving-upgrade-types';

// Buffers are byte values, not millions of enumerable numeric metadata fields.
// Every non-Buffer own key/value is compared; no digest substitutes for bytes.
function exactValue(
  actual: unknown,
  expected: unknown,
  location: string,
): void {
  if (Buffer.isBuffer(expected)) {
    expect(Buffer.isBuffer(actual), `${location}: Buffer kind`).toBe(true);
    if (!Buffer.isBuffer(actual)) return;
    expect(actual.equals(expected), `${location}: every byte`).toBe(true);
    return;
  }
  if (expected === null || typeof expected !== 'object') {
    expect(actual, location).toBe(expected);
    return;
  }
  const object = actual !== null && typeof actual === 'object';
  expect(object, `${location}: object kind`).toBe(true);
  if (!object) return;
  expect(Array.isArray(actual), `${location}: array kind`).toBe(
    Array.isArray(expected),
  );
  const keys = Reflect.ownKeys(expected);
  expect(Reflect.ownKeys(actual).length, `${location}: exact own keys`).toBe(
    keys.length,
  );
  for (const key of keys) {
    const label = `${location}.${String(key)}`;
    const actualField = Object.getOwnPropertyDescriptor(actual, key);
    const expectedField = Object.getOwnPropertyDescriptor(expected, key);
    expect(
      actualField !== undefined && 'value' in actualField,
      `${label}: own data field`,
    ).toBe(true);
    if (!actualField || !expectedField || !('value' in actualField)) return;
    exactValue(actualField.value, expectedField.value, label);
  }
}

export function expectPlanEqual(actual: Plan, expected: Plan): void {
  exactValue(actual, expected, 'plan');
}

export function expectValueEqual(
  actual: unknown,
  expected: unknown,
  location = 'value',
): void {
  exactValue(actual, expected, location);
}
