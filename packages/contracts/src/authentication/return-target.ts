/**
 * Zod-free first-party return-target rules. The browser step-up helpers use
 * them directly so a protected route's island ships no zod (AC261); the
 * authentication schemas wrap the same functions, so the rule cannot drift.
 */
const hasAmbiguousEncoding = (value: string): boolean => {
  try {
    return (
      /%(?:25|2e|2f|5c)/iu.test(value) ||
      decodeURIComponent(value).includes('\\')
    );
  } catch {
    return true;
  }
};

export const isRelativeFirstPartyPath = (value: string): boolean =>
  value.startsWith('/') &&
  !value.startsWith('//') &&
  !value.includes('\\') &&
  ![...value].some((character) => {
    const codePoint = character.charCodeAt(0);
    return codePoint <= 31 || codePoint === 127;
  }) &&
  !hasAmbiguousEncoding(value) &&
  (() => {
    try {
      const parsed = new URL(value, 'https://wejammin.invalid');
      const allowedPath =
        /^(?:\/$|\/(?:account|app|auth|settings|system)(?:\/|$))/u.test(
          parsed.pathname,
        );
      const nestedRedirect = [...parsed.searchParams].some(
        ([key, candidate]) =>
          /^(?:callback|continue|next|redirect|returnto)$/iu.test(key) &&
          /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(candidate),
      );
      return (
        parsed.origin === 'https://wejammin.invalid' &&
        allowedPath &&
        !nestedRedirect
      );
    } catch {
      return false;
    }
  })();

export const AUTH_RETURN_TARGET_MAX_LENGTH = 512;

/** The exact rule of `AuthReturnTargetSchema`, without zod. */
export const isAuthReturnTarget = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length >= 1 &&
  value.length <= AUTH_RETURN_TARGET_MAX_LENGTH &&
  isRelativeFirstPartyPath(value);
