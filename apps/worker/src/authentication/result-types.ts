import type { ApiError, SessionResource } from '@wejammin/contracts';

export type AuthenticationSession = Readonly<{
  authUserId: string;
  sessionId: string;
  accountState: SessionResource['accountState'];
  personId: string | null;
  actingPartyId: string | null;
  /**
   * Private acting-context binding id from the service-role session
   * projection (`auth_session_read`). Internal only: it never reaches
   * `SessionResource`, responses, logs, or telemetry.
   */
  actingContextId?: string | null;
  expiresAt: string;
  stepUpAt: string | null;
  /**
   * Latest valid primary sign-in `amr` time (BE01a "Primary-authentication
   * recency"); absent or null when the token carries none. Used only by
   * first-factor enrollment.
   */
  primaryAuthAt?: string | null;
}>;

export type AuthenticationError = Readonly<{
  ok: false;
  status:
    400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 502 | 503 | 504 | 500;
  code: string;
  message: string;
  details?: ApiError['details'];
  retryAfterSeconds?: number;
}>;

export type AuthenticationResult<T> =
  Readonly<{ ok: true; value: T }> | AuthenticationError;
