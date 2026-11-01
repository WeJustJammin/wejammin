import {
  SERIALIZATION_TOKENS,
  STRUCTURED_TOKENS,
} from '../cms-editorial-production-error-tokens';
import { isRecord } from '../cms-editorial-production-error-details';

/** SQLSTATE of a platform `RAISE`: the whole token is the PostgREST `message`. */
const PLATFORM_RAISE_SQLSTATE = 'P0001';
/** SQLSTATE of a CAS refusal: only a named CAS token is a product answer. */
const CAS_SQLSTATE = '40001';

/**
 * True only when a provider error payload can be a product answer: a platform raise
 * (`P0001`), a CAS refusal (`40001` whose whole message is a `SERIALIZATION_TOKENS`
 * member) or a structured BE00 token in `code`.
 *
 * Anything else answered with a 4xx - PostgREST `PGRST*` (missing RPC, bad service
 * credential), a raw SQLSTATE such as `42702`, an engine `40001 serialization_failure`
 * (transient, not a stale operand), or a body that is not an object - is not generated
 * by the operation catalog. BE03c 1298-1302 treats it as a contract failure (scrubbed
 * 500) instead of the caller's refusal that the HTTP status alone would suggest.
 */
export const carriesProductToken = (payload: unknown): boolean => {
  if (!isRecord(payload) || typeof payload.code !== 'string') return false;
  const code = payload.code.trim().toUpperCase();
  if (code === CAS_SQLSTATE)
    return (
      typeof payload.message === 'string' &&
      SERIALIZATION_TOKENS.has(payload.message.trim())
    );
  return code === PLATFORM_RAISE_SQLSTATE || STRUCTURED_TOKENS.has(code);
};
