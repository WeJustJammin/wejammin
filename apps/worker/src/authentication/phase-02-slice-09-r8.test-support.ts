import {
  NOW,
  factorRow,
  iso,
  json,
  pendingRow,
} from './dec111-composition.test-support';

/** Shared fixtures of the R8 auth remediation suites (see the sibling r8 tests). */
export const SECOND = Math.floor(NOW / 1000);
export const FRESH = iso(-60);
export const MFA_AMR = [{ method: 'totp', timestamp: SECOND - 60 }];
export const PASSWORD_AMR = [{ method: 'password', timestamp: SECOND - 30 }];

export const AAL1 = { aal: 'aal1', amr: MFA_AMR } as const;
const AAL1_PASSWORD_ONLY = { aal: 'aal1', amr: PASSWORD_AMR } as const;
const AAL2_WITHOUT_MFA_AMR = { aal: 'aal2', amr: PASSWORD_AMR } as const;
const AAL2_NO_AMR_CLAIM = { aal: 'aal2', amr: undefined } as const;
const AAL_CLAIM_ABSENT = { aal: undefined, amr: MFA_AMR } as const;

export const UNPROVEN_TOKENS = [
  ['aal1 with an MFA amr entry', AAL1],
  ['aal1 with only a password amr entry', AAL1_PASSWORD_ONLY],
  ['aal2 without any MFA amr entry', AAL2_WITHOUT_MFA_AMR],
  ['aal2 without an amr claim', AAL2_NO_AMR_CLAIM],
  ['no aal claim', AAL_CLAIM_ABSENT],
] as const;

export const verifiedFactors = () => ({
  auth_mfa_factors_read: () =>
    json({ factors: [factorRow(), pendingRow()], version: '3' }),
});
