/**
 * The automatic retry of a safe protected read (FE03 "Network and retry contract", :1173): a
 * 502, 503 or 504 whose ApiError declares `details.retryable: true` (BE00 172) is retried at
 * most twice, after 250 ms and after 750 ms. Anything else is the caller's answer at once: a
 * network failure, a 429 (which waits for `Retry-After` instead), a 4xx, a 500 and a dependency
 * error that does not declare a retry safe. After the second retry the last answer is returned
 * so the caller can show its degraded state.
 *
 * `rateLimitWaitSeconds` and `rateLimitMessage` are the other half of the same contract line (FE03
 * :1172): a 429 waits for `Retry-After` and announces the remaining wait, and the caller keeps
 * the person's input.
 *
 * Only reads belong here. A mutation reconciles its status and reuses its idempotency key
 * instead of retrying blindly.
 */
export const SAFE_READ_RETRY_DELAYS_MS = [250, 750] as const;

export type Sleep = (milliseconds: number) => Promise<void>;

const defaultSleep: Sleep = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const isDependencyStatus = (status: number): boolean =>
  status === 502 || status === 503 || status === 504;

/** Whether the answer is a dependency ApiError that declares a retry safe. */
const declaresRetryable = async (response: Response): Promise<boolean> => {
  if (!isDependencyStatus(response.status)) return false;
  try {
    const body: unknown = JSON.parse(await response.clone().text());
    if (typeof body !== 'object' || body === null) return false;
    const details = (body as { readonly details?: unknown }).details;
    return (
      typeof details === 'object' &&
      details !== null &&
      (details as { readonly retryable?: unknown }).retryable === true
    );
  } catch {
    return false;
  }
};

export const retryingSafeRead = async (
  read: () => Promise<Response>,
  options: { readonly sleep?: Sleep } = {},
): Promise<Response> => {
  const sleep = options.sleep ?? defaultSleep;
  let response = await read();
  for (const delay of SAFE_READ_RETRY_DELAYS_MS) {
    if (!(await declaresRetryable(response))) return response;
    await sleep(delay);
    response = await read();
  }
  return response;
};

/** The longest wait a 429 may ask for; a larger value is not believed. */
export const RATE_LIMIT_WAIT_MAX_SECONDS = 86_400;

/** RFC 9110 delay-seconds: `1*DIGIT`, so leading zeros are well-formed; the value is range-checked after. */
const WHOLE_SECONDS = /^\d+$/u;

const isWholeSeconds = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= RATE_LIMIT_WAIT_MAX_SECONDS;

/** `details.retryAfterSeconds` of an ApiError body: a number, `undefined` (absent) or `false` (unusable). */
const statedBySeconds = async (
  response: Response,
): Promise<number | undefined | false> => {
  try {
    const body: unknown = JSON.parse(await response.clone().text());
    if (typeof body !== 'object' || body === null) return undefined;
    const details = (body as { readonly details?: unknown }).details;
    if (typeof details !== 'object' || details === null) return undefined;
    const stated = (details as { readonly retryAfterSeconds?: unknown })
      .retryAfterSeconds;
    if (stated === undefined) return undefined;
    return isWholeSeconds(stated) ? stated : false;
  } catch {
    return undefined;
  }
};

/**
 * The whole seconds a 429 asks the browser to wait: the `Retry-After` header, or the ApiError's
 * `details.retryAfterSeconds` when the header is absent. A header that is not 1 to 86400 whole
 * seconds, a body value that is unusable and a header and body that disagree are all `null`, so
 * the caller says only "wait a moment" instead of announcing a delay nobody stated.
 */
export const rateLimitWaitSeconds = async (
  response: Response,
): Promise<number | null> => {
  const stated = await statedBySeconds(response);
  if (stated === false) return null;
  const header = response.headers.get('retry-after');
  if (header === null) return stated ?? null;
  if (!WHOLE_SECONDS.test(header)) return null;
  const seconds = Number(header);
  if (!isWholeSeconds(seconds)) return null;
  return stated !== undefined && stated !== seconds ? null : seconds;
};

// The message lives in its own module so a page that only announces a 429 does not load the retry loop.
export { rateLimitMessage } from './rate-limit-message';
