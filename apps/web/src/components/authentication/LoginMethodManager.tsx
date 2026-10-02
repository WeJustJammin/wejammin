import AccountMergePanel from './login-method-manager/AccountMergePanel';
import LoginMethodsPanel from './login-method-manager/LoginMethodsPanel';
import useAccountSecurity from './login-method-manager/use-account-security';
import LoginMethodErrorPanel from './login-method-manager/LoginMethodErrorPanel';
import type { LoginMethodManagerProps } from './login-method-manager/types';

export function LoginMethodManager(props: LoginMethodManagerProps) {
  const { state, actions } = useAccountSecurity(props);
  const error = state.error;
  return (
    <section
      className="infra-workbench"
      aria-labelledby="security-workbench-heading"
      aria-busy={state.pending !== null}
    >
      <header className="infra-page-header">
        <p className="infra-eyebrow">Account security</p>
        <h2 id="security-workbench-heading">Login methods</h2>
        <p>
          The server computes which methods are removable. Provider identity
          details, tokens, emails, and candidate accounts never appear here.
        </p>
      </header>

      <p role="status" aria-live="polite" aria-atomic="true">
        {state.announcement}
      </p>

      {error !== null && (
        <LoginMethodErrorPanel
          error={error}
          refreshDisabled={state.pending !== null}
          onRefresh={() => void actions.refresh()}
        />
      )}

      <LoginMethodsPanel state={state} actions={actions} />
      <AccountMergePanel state={state} actions={actions} />
    </section>
  );
}

export default LoginMethodManager;
