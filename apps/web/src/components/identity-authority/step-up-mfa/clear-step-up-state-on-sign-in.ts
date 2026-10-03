import { clearAllStepUpState } from './step-up-binding';

/**
 * The sign-in page is the only way back in after logout or an expired session,
 * so a tab that reaches it holds no step-up detour any more: every draft and
 * pending-command envelope (with its original Idempotency-Key) is dropped.
 */
try {
  clearAllStepUpState(window.sessionStorage);
} catch {
  // Blocked storage holds no step-up state to clear.
}
