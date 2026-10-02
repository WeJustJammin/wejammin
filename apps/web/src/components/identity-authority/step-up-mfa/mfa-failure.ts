import { ApiErrorSchema } from '@wejammin/contracts';

export type MfaFailure = Readonly<{
  status: number;
  code: string;
  /** Normalized reason token: reasonCode, violation code or conflict kind. */
  reason: string | null;
  recoveryAction: string | null;
  allowedMethods: readonly string[];
  requestId: string | null;
  retryAfterSeconds: number | null;
}>;

const MAX_RETRY_AFTER_SECONDS = 86_400;

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const positiveSeconds = (value: unknown): number | null => {
  const seconds = typeof value === 'string' ? Number(value) : value;
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
    ? Math.min(Math.ceil(seconds), MAX_RETRY_AFTER_SECONDS)
    : null;
};

const reasonOf = (details: Readonly<Record<string, unknown>>): string | null => {
  const direct = text(details['reasonCode']);
  if (direct !== null) return direct;
  const violations = details['violations'];
  if (Array.isArray(violations)) {
    for (const violation of violations) {
      const code =
        typeof violation === 'object' && violation !== null
          ? text((violation as Record<string, unknown>)['code'])
          : null;
      if (code !== null) return code;
    }
  }
  return text(details['conflict']);
};

const methodsOf = (value: unknown): readonly string[] =>
  Array.isArray(value)
    ? value
        .filter(
          (entry): entry is string =>
            typeof entry === 'string' && entry.length > 0 && entry.length <= 64,
        )
        .slice(0, 8)
    : [];

const base = (status: number): MfaFailure => ({
  status,
  code: `HTTP_${status}`,
  reason: null,
  recoveryAction: null,
  allowedMethods: [],
  requestId: null,
  retryAfterSeconds: null,
});

/** A request that never produced an HTTP response. */
export const networkFailure = (): MfaFailure => ({
  ...base(0),
  code: 'NETWORK_ERROR',
});

/** Reads the BE00 `ApiError` envelope of a failed MFA or step-up response. */
export const parseMfaFailure = async (
  response: Response,
): Promise<MfaFailure> => {
  const headerRetry = positiveSeconds(response.headers.get('retry-after'));
  const parsed = ApiErrorSchema.safeParse(
    await response.json().catch(() => null),
  );
  if (!parsed.success)
    return { ...base(response.status), retryAfterSeconds: headerRetry };
  const details: Readonly<Record<string, unknown>> = parsed.data.details;
  return {
    status: response.status,
    code: parsed.data.code,
    reason: reasonOf(details),
    recoveryAction: text(details['recoveryAction']),
    allowedMethods: methodsOf(details['allowedMethods']),
    requestId: parsed.data.requestId,
    retryAfterSeconds:
      headerRetry ?? positiveSeconds(details['retryAfterSeconds']),
  };
};
