export type AsyncRpcTransportFailureReason =
  | 'timeout'
  | 'request_failed'
  | 'http_error'
  | 'invalid_content_length'
  | 'response_too_large'
  | 'body_read_failed'
  | 'invalid_utf8'
  | 'malformed_json'
  | 'malformed_response';

export type AsyncRpcTransportFailureCode =
  'DEPENDENCY_UNAVAILABLE' | 'MANUAL_REVIEW';

/**
 * Safe, typed failure from the Supabase RPC transport. The reason is
 * diagnostic-only; no dependency payload or response bytes are retained.
 */
export class AsyncRpcTransportError extends Error {
  readonly code: AsyncRpcTransportFailureCode;
  readonly errorCode: AsyncRpcTransportFailureCode;
  readonly retryable: boolean;
  readonly disposition: 'dependency_unavailable' | 'manual_review';

  constructor(
    readonly reason: AsyncRpcTransportFailureReason,
    disposition: 'dependency_unavailable' | 'manual_review',
  ) {
    super(
      disposition === 'manual_review'
        ? 'Supabase RPC response requires manual review.'
        : 'Supabase RPC dependency is unavailable.',
    );
    this.name = 'AsyncRpcTransportError';
    this.code =
      disposition === 'manual_review'
        ? 'MANUAL_REVIEW'
        : 'DEPENDENCY_UNAVAILABLE';
    this.errorCode = this.code;
    this.retryable = disposition === 'dependency_unavailable';
    this.disposition = disposition;
  }
}

export class AsyncRpcDependencyError extends AsyncRpcTransportError {
  constructor(reason: AsyncRpcTransportFailureReason) {
    super(reason, 'dependency_unavailable');
    this.name = 'AsyncRpcDependencyError';
  }
}

export class AsyncRpcManualReviewError extends AsyncRpcTransportError {
  constructor(reason: AsyncRpcTransportFailureReason) {
    super(reason, 'manual_review');
    this.name = 'AsyncRpcManualReviewError';
  }
}

/**
 * A client-class (4xx) refusal that the database raised as
 * `RAISE EXCEPTION '<token>' USING ERRCODE = 'P0001'` and PostgREST answered as
 * `{ code: 'P0001', message: '<token>' }`. It is still an `http_error`
 * dependency failure, so every caller that does not look at it behaves exactly
 * as before; a caller that owns the token's meaning (for example the
 * publication sweep, which recomputes a stale accessibility proof) can read
 * `refusal`. Only an identifier-shaped token of at most 64 characters is ever
 * carried: free text, other SQLSTATEs and the rest of the body never are.
 */
export class AsyncRpcRefusalError extends AsyncRpcDependencyError {
  constructor(readonly refusal: string) {
    super('http_error');
    this.name = 'AsyncRpcRefusalError';
  }
}
