import { describe, expect, it } from 'vitest';

import { issues } from './admission-common';
import {
  MAX_DETAILS_BYTES,
  MAX_DETAILS_KEYS,
  withinDetailsCeiling,
} from './error-detail-values';
import { safeDetails } from './production-errors';

const bytes = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;

describe('withinDetailsCeiling', () => {
  it('keeps details at or under both ceilings untouched', () => {
    const details = { reasonCode: 'OWNER_REQUIRED' };
    expect(withinDetailsCeiling(details)).toBe(details);
  });

  it('drops details with more keys than BE00 allows', () => {
    const many = Object.fromEntries(
      Array.from({ length: MAX_DETAILS_KEYS + 1 }, (_, index) => [
        `key${index}`,
        index,
      ]),
    );
    expect(withinDetailsCeiling(many)).toEqual({});
  });

  it('drops oversized details that carry no violations list', () => {
    expect(
      withinDetailsCeiling({ note: 'x'.repeat(MAX_DETAILS_BYTES) }),
    ).toEqual({});
    expect(
      withinDetailsCeiling({
        note: 'x'.repeat(MAX_DETAILS_BYTES),
        violations: 'not-an-array',
      }),
    ).toEqual({});
  });

  it('sheds trailing violations until the details fit', () => {
    const violation = { path: '/field', message: 'x'.repeat(1000) };
    const kept = withinDetailsCeiling({
      reasonCode: 'POLICY_NOT_MET',
      violations: Array.from({ length: 12 }, () => violation),
    }) as { reasonCode: string; violations: unknown[] };
    expect(kept.reasonCode).toBe('POLICY_NOT_MET');
    expect(kept.violations.length).toBeGreaterThan(0);
    expect(kept.violations.length).toBeLessThan(12);
    expect(bytes(kept)).toBeLessThanOrEqual(MAX_DETAILS_BYTES);
  });

  it('keeps the remaining keys when every violation had to go', () => {
    const rest = withinDetailsCeiling({
      reasonCode: 'POLICY_NOT_MET',
      violations: [{ path: '/field', message: 'x'.repeat(MAX_DETAILS_BYTES) }],
    });
    expect(rest).toEqual({ reasonCode: 'POLICY_NOT_MET' });
  });

  it('drops everything when the remaining keys alone exceed the ceiling', () => {
    expect(
      withinDetailsCeiling({
        note: 'x'.repeat(MAX_DETAILS_BYTES),
        violations: [{ path: '/field' }],
      }),
    ).toEqual({});
  });

  it('returns the remaining keys when only an empty violations list pushed it over', () => {
    const padding = MAX_DETAILS_BYTES - bytes({ note: '' });
    const rest = { note: 'x'.repeat(padding) };
    expect(bytes(rest)).toBe(MAX_DETAILS_BYTES);
    expect(withinDetailsCeiling({ ...rest, violations: [] })).toEqual(rest);
  });
});

describe('violation codes from zod issues', () => {
  it('reports a closed constraint code and omits one that is not a lowercase token', () => {
    expect(
      issues({
        issues: [
          { path: ['a'], message: 'Too big', code: 'too_big' },
          { path: ['b'], message: 'Odd', code: 'Not-A-Token' },
          { path: ['c'], message: 'No code at all' },
        ],
      }),
    ).toEqual({
      violations: [
        { path: '/a', code: 'too_big', message: 'The value is invalid.' },
        { path: '/b', message: 'The value is invalid.' },
        { path: '/c', message: 'The value is invalid.' },
      ],
    });
  });
});

describe('429 rate details', () => {
  const rate = (details: Record<string, unknown>) =>
    safeDetails({ details }, 429);
  const base = { limit: 5, retryAfterSeconds: 30 };

  it('copies only a canonical UTC resetAt', () => {
    expect(rate({ ...base, resetAt: '2026-10-02T12:00:00.000Z' })).toEqual({
      ...base,
      resetAt: '2026-10-02T12:00:00.000Z',
    });
    expect(rate({ ...base, resetAt: 'tomorrow' })).toEqual(base);
    expect(rate({ ...base, resetAt: 1_757_000_000 })).toEqual(base);
  });
});
