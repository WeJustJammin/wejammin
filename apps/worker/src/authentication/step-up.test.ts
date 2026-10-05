import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  freshUntilFor,
  isFreshProof,
  MFA_METHOD_REGISTRY,
  reauthenticateError,
  STEP_UP_FORWARD_TOLERANCE_SECONDS,
  STEP_UP_FRESHNESS_SECONDS,
  stepUpRequiredError,
} from './step-up';

const NOW = Date.parse('2026-10-02T14:00:00Z');
const at = (offsetSeconds: number): string =>
  new Date(NOW + offsetSeconds * 1000).toISOString();

describe('DEC-111 step-up proof window', () => {
  it('[P2-S09-AC-886][P2-S09-AC-887] locks the 600 s freshness window, the 30 s tolerance and the method registry', () => {
    expect(STEP_UP_FRESHNESS_SECONDS).toBe(600);
    expect(STEP_UP_FORWARD_TOLERANCE_SECONDS).toBe(30);
    expect(MFA_METHOD_REGISTRY).toEqual(['totp']);
  });

  it.each([
    ['just minted', 0, true],
    ['one minute old', -60, true],
    ['exactly 600 s old', -600, true],
    ['601 s old', -601, false],
    ['30 s ahead (tolerated skew)', 30, true],
    ['31 s ahead (future dated beyond the bound)', 31, false],
  ] as const)('[P2-S09-AC-885] %s', (_name, offset, expected) => {
    expect(isFreshProof(at(offset), NOW)).toBe(expected);
  });

  it('[P2-S09-AC-602] treats an absent or malformed proof as stale', () => {
    expect(isFreshProof(null, NOW)).toBe(false);
    expect(isFreshProof('not-a-time', NOW)).toBe(false);
  });

  it('[P2-S09-AC-885] derives freshUntil as proof time plus 600 s in UTC', () => {
    expect(freshUntilFor('2026-10-02T14:05:00Z')).toBe(
      '2026-10-02T14:15:00.000Z',
    );
  });

  it('builds the exact STEP_UP_REQUIRED 401 from the registry, never a 403', () => {
    expect(stepUpRequiredError()).toEqual({
      ok: false,
      status: 401,
      code: 'STEP_UP_REQUIRED',
      message: 'Recent verification is required.',
      details: { recoveryAction: 'step_up', allowedMethods: ['totp'] },
    });
  });

  it('builds the reauthenticate 401 without MFA method detail', () => {
    expect(reauthenticateError()).toMatchObject({
      ok: false,
      status: 401,
      code: 'UNAUTHENTICATED',
      details: { recoveryAction: 'reauthenticate' },
    });
  });
});

describe('DEC-111 registry and window are protected code constants', () => {
  it('[P2-S09-AC-887] the MFA method registry is an immutable ordered list whose launch contents are exactly [totp]', () => {
    expect(Object.isFrozen(MFA_METHOD_REGISTRY)).toBe(true);
    expect(() =>
      (MFA_METHOD_REGISTRY as unknown as string[]).push('sms'),
    ).toThrow(TypeError);
    expect([...MFA_METHOD_REGISTRY]).toStrictEqual(['totp']);
    expect(stepUpRequiredError().details).toStrictEqual({
      recoveryAction: 'step_up',
      allowedMethods: ['totp'],
    });
  });

  it('[P2-S09-AC-886] the freshness window is not caller-selectable: the verifier takes only the proof and the clock and reads no environment or settings value', () => {
    expect(isFreshProof.length).toBe(2);
    const code = readFileSync(
      fileURLToPath(new URL('./step-up.ts', import.meta.url)),
      'utf8',
    )
      .replace(/\/\*[\s\S]*?\*\//gu, '')
      .replace(/\/\/.*$/gmu, '');
    expect(code).not.toMatch(
      /\b(process\.env|env\.|context\.|settings|configuration)\b/u,
    );
    expect(code).toContain('export const STEP_UP_FRESHNESS_SECONDS = 600;');
  });
});
