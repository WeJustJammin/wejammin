export type SignInEntry = 'sign_in' | 'recovery';

/**
 * The sign-in page entry named by the `intent` query value. Only the exact
 * value `recovery` opens the recovery entry (the AUTH-API-02 `recovery`
 * intent); every other value is the ordinary sign-in entry.
 */
export const signInEntryFrom = (value: string | null): SignInEntry =>
  value === 'recovery' ? 'recovery' : 'sign_in';

/** The sign-in heading for each entry. */
export const SIGN_IN_ENTRY_HEADING: Readonly<Record<SignInEntry, string>> = {
  sign_in: 'Continue to your workspace',
  recovery: 'Recover your account',
};
