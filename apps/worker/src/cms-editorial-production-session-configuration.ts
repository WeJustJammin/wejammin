import { MAX_ORIGIN_LENGTH } from './cms-editorial-production-types';

export const configuredOriginList = (
  value: string | undefined,
): readonly string[] =>
  value === undefined || value.trim() === ''
    ? []
    : value.split(',').map((origin) => origin.trim());

export const validateOriginList = (
  origins: readonly string[] | undefined,
  ConfigurationError: new (message?: string) => Error,
): readonly string[] => {
  const values = origins ?? [];
  if (!Array.isArray(values))
    throw new ConfigurationError('Origin allowlists must be arrays.');
  for (const origin of values) {
    if (
      typeof origin !== 'string' ||
      origin.length === 0 ||
      origin.length > MAX_ORIGIN_LENGTH ||
      origin === '*' ||
      [...origin].some((character) => {
        const codePoint = character.codePointAt(0);
        return (
          codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f)
        );
      })
    )
      throw new ConfigurationError(
        'Origin allowlists must contain explicit HTTP(S) origins.',
      );
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new ConfigurationError(
        'Origin allowlists must contain explicit HTTP(S) origins.',
      );
    }
    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
      parsed.username !== '' ||
      parsed.password !== '' ||
      parsed.pathname !== '/' ||
      parsed.search !== '' ||
      parsed.hash !== ''
    )
      throw new ConfigurationError(
        'Origin allowlists must contain explicit HTTP(S) origins.',
      );
  }
  return Object.freeze([...values]);
};
