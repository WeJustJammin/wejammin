/** FE01 `<OneTimeCodeField>`: `maxlength` 12 tolerates a pasted "123 456". */
export const ONE_TIME_CODE_MAX_LENGTH = 12;

export const ONE_TIME_CODE_COPY = {
  invalid: 'Enter the 6-digit code from your authenticator app.',
  incorrect: "That code didn't work. Check the code and try again.",
} as const;

/** Removes whitespace and hyphens; nothing else is altered. */
export const normalizeOneTimeCode = (raw: string): string =>
  raw.replace(/[\s-]+/gu, '');

export type OneTimeCodeValidation =
  | Readonly<{ ok: true; code: string }>
  | Readonly<{ ok: false; message: string }>;

/** Exactly six ASCII digits after normalization; only then may a request be sent. */
export const validateOneTimeCode = (raw: string): OneTimeCodeValidation => {
  const code = normalizeOneTimeCode(raw);
  return /^[0-9]{6}$/u.test(code)
    ? { ok: true, code }
    : { ok: false, message: ONE_TIME_CODE_COPY.invalid };
};
