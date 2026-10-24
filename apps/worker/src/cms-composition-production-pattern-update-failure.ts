import {
  CMS_SLICE_12_OPERATION_REASONS,
  CmsSlice12ReasonCodeSchema,
  CmsVersionSchema,
  cmsSlice12ReasonStatus,
} from '@wejammin/contracts';

import {
  SERIALIZATION_TOKENS,
  STRUCTURED_TOKENS,
} from './cms-editorial-production-error-tokens';
import {
  isRecord,
  structuredMembersFromDetailText,
  violationsFromDetailText,
} from './cms-editorial-production-errors';
import {
  failure,
  type PatternUpdateError,
} from './cms-composition/pattern-update-ports';
import type { PatternUpdateOperation } from './cms-composition/pattern-update-operations';
import {
  BLOCK_RULES_REASON,
  blockRulesDetails,
} from './cms-composition/block-rules-refusal';

/**
 * CMS-03C-13/14/15 RPC failure to port refusal. Named tokens only: the whole `message` of a platform raise selects the
 * refusal (PostgREST answers a `P0001` raise 4xx, so the HTTP status decides only the 5xx class); prose, hints and the
 * DETAIL never select one (BE03c 1298-1304).
 *  - a Slice 12 reason token this operation publishes (`CMS_SLICE_12_OPERATION_REASONS`) keeps its one catalog status
 *    and names itself in `details.reasonCode` with no other member; the producer's pointer DETAIL is not relayed,
 *    except for DEC-210 `block_rules_violated`, whose instance pointer is a bounded violation;
 *  - the generic BE00 tokens the SQL raises map through the closed per-operation tables below; a plain 422 keeps only
 *    the producer pointers its own request grammar allows;
 *  - any other token, including a Slice 12 reason of another operation (and so `pattern_cycle`,
 *    `pattern_depth_exceeded` and `pattern_nodes_exceeded`, which CMS-03C-15 does not publish and an `active` target
 *    cannot reach), is a contract failure: the scrubbed 500;
 *  - a 4xx that no platform raise produced (PostgREST `PGRST*`, a raw SQLSTATE, an engine `40001`, a non-object body)
 *    is the scrubbed 500; every 5xx is a retryable 503.
 */
const PROVIDER_RETRY_SECONDS = 15;

/** The machine token of a product answer, or null when the payload is not one (BE03c 1298-1302). */
const tokenOf = (payload: unknown): string | null => {
  if (!isRecord(payload) || typeof payload.code !== 'string') return null;
  const code = payload.code.trim().toUpperCase();
  const message =
    typeof payload.message === 'string' ? payload.message.trim() : '';
  if (code === 'P0001') return message;
  if (code === '40001')
    return SERIALIZATION_TOKENS.has(message) ? message : null;
  return STRUCTURED_TOKENS.has(code) ? code : null;
};

/** The pointers each operation's request grammar can name; every other pointer is dropped. */
const SELECTOR_POINTER = /^\/(?:limit|contentTypeId)$/u;
const UPDATE_POINTER =
  /^\/(?:action|targetPatternVersion|expectedVersion|instances(?:\/\d{1,2}(?:\/(?:instanceId|expectedVersion|choices(?:\/\d{1,3}(?:\/(?:path|choice))?)?))?)?)$/u;

const pointers =
  (allowed: RegExp) =>
  (detail: unknown): PatternUpdateError => {
    const violations = violationsFromDetailText(detail, undefined).filter(
      (violation) => allowed.test(violation.path),
    );
    return failure(422, violations.length === 0 ? {} : { violations });
  };

/** The entry or instance version pair of a stale CAS operand; the instance id is not an allowlisted member. */
const versionPair = (detail: unknown): PatternUpdateError => {
  const members = structuredMembersFromDetailText(detail);
  const pair: Record<string, string> = {};
  for (const key of ['expectedVersion', 'currentVersion'] as const) {
    const parsed = CmsVersionSchema.safeParse(members[key]);
    if (parsed.success) pair[key] = parsed.data;
  }
  return failure(409, pair);
};

type Refusal = (detail: unknown) => PatternUpdateError;
const COMMON: Readonly<Record<string, Refusal>> = {
  INVALID_REQUEST: () => failure(400),
  UNAUTHENTICATED: () => failure(401),
  NOT_FOUND: () => failure(404),
  DEPENDENCY_UNAVAILABLE: () => failure(503, {}, PROVIDER_RETRY_SECONDS),
};
const BY_OPERATION: Readonly<
  Record<PatternUpdateOperation, Readonly<Record<string, Refusal>>>
> = {
  'CMS-03C-13': {
    CONFLICT: () => failure(409),
    VALIDATION_FAILED: pointers(SELECTOR_POINTER),
  },
  'CMS-03C-14': {},
  // DEC-206: a read with no conflict and no validation answer; only the COMMON tokens and capability_missing are its own.
  cmsCompositionInstancesRead: {},
  'CMS-03C-15': {
    VERSION_MISMATCH: versionPair,
    CONFLICT: () => failure(409),
    IDEMPOTENCY_MISMATCH: () => failure(409),
    IDEMPOTENCY_CONFLICT: () => failure(409),
    VALIDATION_FAILED: pointers(UPDATE_POINTER),
  },
};

// `tokenOf` returns a token only for a record payload, so every `payload` below a non-null token is a record.
export const patternUpdateRpcFailure = (
  operation: PatternUpdateOperation,
  status: number,
  payload: unknown,
): PatternUpdateError => {
  const token = tokenOf(payload);
  if (token === 'INTERNAL_ERROR') return failure(500);
  if (status >= 500) return failure(503, {}, PROVIDER_RETRY_SECONDS);
  if (token === null) return failure(500);
  const reason = CmsSlice12ReasonCodeSchema.safeParse(token);
  if (reason.success) {
    if (
      !(
        CMS_SLICE_12_OPERATION_REASONS[operation] as readonly string[]
      ).includes(reason.data)
    )
      return failure(500);
    // DEC-210: the one reason that relays its pointer (`/instances/{i}/choices` or `/instances/{i}`).
    return failure(
      cmsSlice12ReasonStatus(reason.data),
      reason.data === BLOCK_RULES_REASON
        ? blockRulesDetails(
            (payload as Readonly<Record<string, unknown>>).details,
            'CMS-03C-15',
          )
        : { reasonCode: reason.data },
    );
  }
  const refusal = Object.hasOwn(COMMON, token)
    ? COMMON[token]
    : Object.hasOwn(BY_OPERATION[operation], token)
      ? BY_OPERATION[operation][token]
      : undefined;
  return refusal === undefined
    ? failure(500)
    : refusal((payload as Readonly<Record<string, unknown>>).details);
};
