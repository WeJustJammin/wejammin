const MEDIA_TYPE =
  /^[a-z0-9][a-z0-9!#$&^_.+-]{0,62}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,62}$/u;

/**
 * BE00 `UNSUPPORTED_MEDIA_TYPE` details are exactly `{ allowedMediaTypes }`,
 * the route allowlist. A body-carrying composition command accepts JSON only,
 * so that is the fallback; a route that accepts no request media (a read)
 * states an empty allowlist. Anything other than a short list of well-formed
 * media types is dropped, never forwarded.
 */
export const mediaTypeDetails = (
  source: unknown,
): Readonly<{ allowedMediaTypes: readonly string[] }> => {
  const candidate =
    typeof source === 'object' && source !== null && !Array.isArray(source)
      ? (source as Readonly<Record<string, unknown>>).allowedMediaTypes
      : undefined;
  return {
    allowedMediaTypes:
      Array.isArray(candidate) &&
      candidate.length <= 8 &&
      candidate.every(
        (value): value is string =>
          typeof value === 'string' && MEDIA_TYPE.test(value),
      )
        ? [...candidate]
        : ['application/json'],
  };
};
