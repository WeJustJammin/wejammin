import {
  CMS_HASH_PATTERN,
  isCmsUuid,
  isCmsVersion,
} from '@wejammin/contracts/client';

import { startReadDeadline } from '../../lib/read-deadline';
import { withinDeadline } from '../../lib/read-within-deadline';
import {
  rateLimitWaitSeconds,
  retryingSafeRead,
} from '../../lib/safe-read-retry';

/*
 * The refetch after a 409 (FE03 :891, :1122; zod-free). Both the plain version conflict and
 * `locale_limit_reached` mean the entry or its source moved since the page loaded, so the form reads the
 * draft detail again (CMS-03B-11, the same-origin proxy that already verified the strict resource) and
 * offers the current version, source revision, fingerprint and source text. It adopts none of them itself:
 * a new `sourceHash` stamped onto a translation of the OLD source text would hide its staleness, so the
 * person reviews the refreshed source text and adopts it explicitly.
 */

export interface LocaleSourceSnapshot {
  readonly version: string;
  readonly sourceRevisionId: string;
  readonly sourceHash: string;
  /** Source text of each localizable field, by field id; null when it is empty or not plain text. */
  readonly texts: Readonly<Record<string, string | null>>;
}

export type LocaleSourceRefreshResult =
  | { readonly kind: 'ready'; readonly snapshot: LocaleSourceSnapshot }
  | { readonly kind: 'failed'; readonly status: number | null }
  | {
      readonly kind: 'rate_limited';
      readonly retryAfterSeconds: number | null;
    };

type Json = Readonly<Record<string, unknown>>;
const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const textOf = (value: unknown): string | null =>
  typeof value === 'string'
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : null;

/** The snapshot when `body` is the draft detail of THIS entry's source-locale head, else null. */
export const parseSourceSnapshot = (
  body: unknown,
  entryId: string,
  sourceLocale: string,
  fieldIds: readonly string[],
): LocaleSourceSnapshot | null => {
  if (!isRecord(body) || !isRecord(body.entry) || !isRecord(body.revision))
    return null;
  const { entry, revision } = body;
  if (
    entry.id !== entryId ||
    typeof entry.version !== 'string' ||
    !isCmsVersion(entry.version) ||
    typeof revision.id !== 'string' ||
    !isCmsUuid(revision.id) ||
    typeof body.contentHash !== 'string' ||
    !CMS_HASH_PATTERN.test(body.contentHash) ||
    typeof body.locale !== 'string' ||
    body.locale.toLowerCase() !== sourceLocale.toLowerCase() ||
    !Array.isArray(body.fields)
  )
    return null;
  const values = new Map<string, unknown>();
  for (const field of body.fields)
    if (isRecord(field) && typeof field.fieldId === 'string')
      values.set(field.fieldId, field.value);
  return {
    version: entry.version,
    sourceRevisionId: revision.id,
    sourceHash: body.contentHash,
    texts: Object.fromEntries(
      fieldIds.map((fieldId) => [fieldId, textOf(values.get(fieldId))]),
    ),
  };
};

/** One bounded, abortable, no-store GET of the draft detail (the shared read deadline); a failure adopts nothing. */
export const refreshLocaleSource = async (input: {
  readonly entryId: string;
  readonly sourceLocale: string;
  readonly fieldIds: readonly string[];
  readonly fetcher?: typeof fetch;
  readonly signal?: AbortSignal;
}): Promise<LocaleSourceRefreshResult> => {
  const fetcher = input.fetcher ?? fetch;
  const deadline = startReadDeadline(input.signal);
  try {
    const response = await withinDeadline(
      deadline,
      retryingSafeRead(() =>
        fetcher(`/api/v1/cms/entries/${input.entryId}`, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          redirect: 'error',
          headers: { accept: 'application/json' },
          signal: deadline.signal,
        }),
      ),
    );
    if (!(response instanceof Response))
      return { kind: 'failed', status: null };
    if (response.status === 429)
      return {
        kind: 'rate_limited',
        retryAfterSeconds: await withinDeadline(
          deadline,
          rateLimitWaitSeconds(response),
        ),
      };
    if (response.status !== 200)
      return { kind: 'failed', status: response.status };
    const snapshot = parseSourceSnapshot(
      await withinDeadline(deadline, response.json()),
      input.entryId,
      input.sourceLocale,
      input.fieldIds,
    );
    return snapshot === null
      ? { kind: 'failed', status: null }
      : { kind: 'ready', snapshot };
  } catch {
    return { kind: 'failed', status: null };
  } finally {
    deadline.clear();
  }
};
