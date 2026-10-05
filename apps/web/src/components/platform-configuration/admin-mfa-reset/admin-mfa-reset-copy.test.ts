import { describe, expect, it } from 'vitest';

import { ADMIN_RESET_COPY } from './admin-mfa-reset-values';

/**
 * FE05 `AdminMfaFactorResetForm` exact copy, pinned as literals so a drifted
 * constant cannot hide behind tests that compare the constant to itself. The
 * component tests assert that each outcome renders these constants.
 */
describe('AdminMfaFactorResetForm exact copy', () => {
  it('[P2-S09-AC-1109] names the missing step-up prerequisite', () => {
    expect(ADMIN_RESET_COPY.prerequisite).toBe(
      "Verify your identity to reset a person's two-step verification.",
    );
  });

  it('[P2-S09-AC-1110] gives the person ID helper copy', () => {
    expect(ADMIN_RESET_COPY.personHelp).toBe(
      "Enter the person's ID exactly as it appears in the admin directory.",
    );
  });

  it('[P2-S09-AC-1114] [P2-S09-AC-1115] announces completed and reconciling outcomes', () => {
    expect(ADMIN_RESET_COPY.completed).toBe(
      'Two-step verification was reset for this person.',
    );
    expect(ADMIN_RESET_COPY.reconciling).toBe(
      'The reset was recorded and is finishing. Check back shortly.',
    );
  });

  it('[P2-S09-AC-1116] tells the operator nothing was saved after step-up', () => {
    expect(ADMIN_RESET_COPY.notSaved).toBe('Your entries were not saved.');
  });

  it('[P2-S09-AC-1118] [P2-S09-AC-1119] [P2-S09-AC-1120] [P2-S09-AC-1122] carries the exact refusal copy', () => {
    expect(ADMIN_RESET_COPY.forbidden).toBe(
      'You do not have permission to reset two-step verification.',
    );
    expect(ADMIN_RESET_COPY.notFound).toBe('That person could not be found.');
    expect(ADMIN_RESET_COPY.inProgress).toBe(
      'A reset for this person is already finishing.',
    );
    expect(ADMIN_RESET_COPY.selfTarget).toBe(
      'You cannot reset your own two-step verification. Ask another administrator.',
    );
  });

  it('[P2-S09-AC-1121] asks the operator to refresh and re-enter after an idempotency conflict', () => {
    expect(ADMIN_RESET_COPY.refresh).toMatch(/refresh/iu);
    expect(ADMIN_RESET_COPY.refresh).toMatch(/enter the details again/iu);
  });

  it('[P2-S09-AC-1125] names the sole-administrator runbook path as plain text', () => {
    expect(ADMIN_RESET_COPY.runbook).toContain(
      'docs/runbooks/platform/sole-admin-mfa-lockout.md',
    );
  });
});
