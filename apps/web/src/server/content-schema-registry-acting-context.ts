import {
  ActingContextListResponseSchema,
  CONTENT_SCHEMA_REGISTRY_STEP_UP_FRESH_UNTIL_HEADER,
} from '@wejammin/contracts';

export const CONTENT_SCHEMA_REGISTRY_ACTING_CONTEXTS_PATH =
  '/api/v1/me/acting-contexts';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

const STEP_UP_FRESH_MS = 10 * 60 * 1000;
const MAX_DISPLAY_LABEL_LENGTH = 120;
const hasControlCharacter = (value: string): boolean =>
  [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || codePoint === 0x7f;
  });

export type ContentSchemaRegistryDisclosureStepUpState =
  'required' | 'verified';

export interface ResolveActingContextLabelInput {
  readonly actingPartyId: string | null;
  readonly fetchActingContexts: () => Promise<Response>;
  /** Server clock used to reject expired authority; defaults to Date.now. */
  readonly now?: number;
}

const isSafeActingPartyId = (value: string | null): value is string =>
  typeof value === 'string' &&
  value.trim() === value &&
  UUID_PATTERN.test(value);

/**
 * Resolve the human-readable acting-context label for the server-derived
 * acting party from the existing authorized identity read. The raw acting
 * party, context, and person identifiers never leave this server-only module;
 * any unmatched, malformed, or unavailable read fails closed to null.
 */
export const resolveContentSchemaRegistryActingContextLabel = async ({
  actingPartyId,
  fetchActingContexts,
  now = Date.now(),
}: ResolveActingContextLabelInput): Promise<string | null> => {
  if (!isSafeActingPartyId(actingPartyId)) return null;
  if (!Number.isFinite(now)) return null;
  try {
    const response = await fetchActingContexts();
    if (!(response instanceof Response) || !response.ok) return null;
    const parsed = ActingContextListResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) return null;
    const matches = parsed.data.items.filter(
      (item) => item.partyId === actingPartyId,
    );
    // Ambiguous or absent authority is never resolved by guessing a row.
    if (matches.length !== 1) return null;
    const match = matches[0];
    if (match === undefined) return null;
    if (!match.selectable) return null;
    const authorityFreshUntil = Date.parse(match.authorityFreshUntil);
    if (!Number.isFinite(authorityFreshUntil) || authorityFreshUntil <= now)
      return null;
    const label = match.label;
    if (
      label.length === 0 ||
      label.length > MAX_DISPLAY_LABEL_LENGTH ||
      label !== label.trim() ||
      hasControlCharacter(label) ||
      UUID_PATTERN.test(label)
    )
      return null;
    return label;
  } catch {
    return null;
  }
};

/**
 * Parse presentation-only step-up freshness metadata emitted by the Worker on
 * the private service binding. The result is a display state: absence,
 * malformation, or expiry always fails closed to `required`, and the
 * authoritative activation route remains the only gate.
 */
export const parseContentSchemaRegistryStepUpHeaders = (
  headers: Headers,
  now: number = Date.now(),
): ContentSchemaRegistryDisclosureStepUpState => {
  if (!Number.isFinite(now)) return 'required';
  const value = headers.get(CONTENT_SCHEMA_REGISTRY_STEP_UP_FRESH_UNTIL_HEADER);
  if (value === null || value.trim() !== value || value.length === 0)
    return 'required';
  return contentSchemaRegistryStepUpStateFor(value, now);
};

export const contentSchemaRegistryStepUpStateFor = (
  freshUntilValue: string | null | undefined,
  now: number,
): ContentSchemaRegistryDisclosureStepUpState => {
  if (!Number.isFinite(now)) return 'required';
  if (
    freshUntilValue === null ||
    freshUntilValue === undefined ||
    freshUntilValue.length === 0 ||
    freshUntilValue.trim() !== freshUntilValue
  )
    return 'required';
  const freshUntil = Date.parse(freshUntilValue);
  if (!Number.isFinite(freshUntil)) return 'required';
  if (new Date(freshUntil).toISOString() !== freshUntilValue) return 'required';
  return freshUntil > now && freshUntil - now <= STEP_UP_FRESH_MS
    ? 'verified'
    : 'required';
};
