import * as React from 'react';

import type { SignInEntry } from './sign-in-entry';

export interface SignInEmailFormProps {
  readonly returnTo: string;
  readonly entry: SignInEntry;
}

/**
 * The passwordless email form (AUTH-API-02). The recovery entry offers only
 * the `recovery` intent; the ordinary entry offers sign-in and recovery. It is
 * a native form post, rendered on the server.
 */
export default function SignInEmailForm({
  returnTo,
  entry,
}: SignInEmailFormProps): React.ReactElement {
  return (
    <form method="post" action="/auth/start" className="infra-stack">
      <input type="hidden" name="returnTo" value={returnTo} />
      <label htmlFor="email">Email address</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        maxLength={254}
      />
      {entry === 'recovery' ? null : (
        <button type="submit" name="intent" value="sign_in">
          Email me a sign-in link
        </button>
      )}
      <button type="submit" name="intent" value="recovery">
        Recover my account
      </button>
    </form>
  );
}
