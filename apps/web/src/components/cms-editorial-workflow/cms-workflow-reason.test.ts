import * as validators from '@wejammin/contracts/cms-editorial/validators';
import { describe, expect, it } from 'vitest';

import {
  countCharacters,
  validateAssignmentReason,
  validateDecisionReason,
} from './cms-workflow-reason';

describe('decision reason', () => {
  it('counts Unicode characters, not UTF-16 units', () => {
    expect(countCharacters('abc')).toBe(3);
    expect(countCharacters('😀😀')).toBe(2);
    expect(countCharacters('')).toBe(0);
  });

  it('accepts a safe NFC reason of one to 2000 characters', () => {
    expect(validateDecisionReason(validators, 'Matches the brief.')).toBeNull();
    expect(validateDecisionReason(validators, '😀'.repeat(2000))).toBeNull();
  });

  it.each([
    ['', 'Enter a reason.'],
    ['😀'.repeat(2001), 'Use at most 2000 characters.'],
    ['é', 'Use the composed form of accented letters (Unicode NFC).'],
    ['line\u0000break', 'Remove control and text-direction characters.'],
    ['bidi‮flip', 'Remove control and text-direction characters.'],
    ['a <b> {c}', 'Remove the characters < > { and }.'],
  ])('refuses %j inline with fixed copy', (reason, message) => {
    expect(validateDecisionReason(validators, reason)).toBe(message);
  });
});

describe('assignment reason', () => {
  it('is optional and bounded to 256 composed characters', () => {
    expect(validateAssignmentReason(validators, '')).toBeNull();
    expect(validateAssignmentReason(validators, 'Legal slot.')).toBeNull();
    expect(validateAssignmentReason(validators, '😀'.repeat(256))).toBeNull();
    expect(validateAssignmentReason(validators, 'x'.repeat(257))).toBe(
      'Use at most 256 characters.',
    );
    expect(validateAssignmentReason(validators, 'e\u0301')).toBe(
      'Use the composed form of accented letters (Unicode NFC).',
    );
  });
});
