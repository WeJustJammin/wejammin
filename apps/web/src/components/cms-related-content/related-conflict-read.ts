import type {
  EntryDraftDetailResource,
  RelatedContentRuleRead,
} from '@wejammin/contracts';
import { isCmsUuid } from '@wejammin/contracts/client';

import {
  loadCmsValidators,
  loadedCmsValidators,
} from '../../lib/cms-contract-validators';
import { BROWSER_READ_DEADLINE_MS } from '../../lib/read-deadline';
import {
  rateLimitWaitSeconds,
  retryingSafeRead,
} from '../../lib/safe-read-retry';
import type { RelatedConflictReadResult } from './related-content-types';

interface ReadContext {
  readonly signal: AbortSignal;
  readonly isCurrent: () => boolean;
  readonly fetcher: typeof fetch;
}

type ReadFailure = Exclude<RelatedConflictReadResult, { kind: 'reviewed' }>;
type StageResult<T> =
  { readonly kind: 'verified'; readonly value: T } | ReadFailure;
type Checkpoint = () => void;
type Decoder<T> = (
  body: unknown,
  response: Response,
  check: Checkpoint,
) => Promise<T | null>;

const aborted = (): DOMException =>
  new DOMException('Read canceled', 'AbortError');

/** Retry waits are canceled too: no timer or subsequent GET can outlive its review. */
const retryDelay = (
  milliseconds: number,
  signal: AbortSignal,
  check: Checkpoint,
): Promise<void> => {
  check();
  return new Promise((resolve, reject) => {
    const cancel = (): void => {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      reject(aborted());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', cancel);
      try {
        check();
        resolve();
      } catch (error) {
        reject(error);
      }
    }, milliseconds);
    signal.addEventListener('abort', cancel, { once: true });
  });
};

const requestStage = (
  path: string,
  context: ReadContext,
  check: Checkpoint,
): Promise<Response> =>
  retryingSafeRead(
    async () => {
      check();
      const response = await context.fetcher(path, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        headers: { accept: 'application/json' },
        signal: context.signal,
      });
      check();
      return response;
    },
    {
      sleep: (milliseconds) => retryDelay(milliseconds, context.signal, check),
    },
  );

const decodeStage = async <T>(
  response: Response,
  decode: Decoder<T>,
  check: Checkpoint,
): Promise<StageResult<T>> => {
  check();
  if (!(response instanceof Response)) return { kind: 'failed', status: null };
  if (response.status === 429) {
    const retryAfterSeconds = await rateLimitWaitSeconds(response);
    check();
    return { kind: 'rate_limited', retryAfterSeconds };
  }
  if (response.status !== 200)
    return { kind: 'failed', status: response.status };
  const body: unknown = await response.json();
  check();
  const value = await decode(body, response, check);
  check();
  return value === null
    ? { kind: 'failed', status: null }
    : { kind: 'verified', value };
};

/** The deadline covers the response body and lazy validation as well as fetch/retries. */
const protectedRead = async <T>(
  path: string,
  context: ReadContext,
  decode: Decoder<T>,
): Promise<StageResult<T>> => {
  const controller = new AbortController();
  const check = (): void => {
    if (
      controller.signal.aborted ||
      context.signal.aborted ||
      !context.isCurrent()
    )
      throw aborted();
  };
  const cancel = (): void => controller.abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectAbort: (() => void) | undefined;
  try {
    check();
    context.signal.addEventListener('abort', cancel, { once: true });
    const canceled = new Promise<never>((_resolve, reject) => {
      rejectAbort = () => reject(aborted());
      controller.signal.addEventListener('abort', rejectAbort, { once: true });
    });
    timer = setTimeout(cancel, BROWSER_READ_DEADLINE_MS);
    const read = async (): Promise<StageResult<T>> => {
      const response = await requestStage(
        path,
        { ...context, signal: controller.signal },
        check,
      );
      check();
      return decodeStage(response, decode, check);
    };
    return await Promise.race([read(), canceled]);
  } catch {
    return { kind: 'failed', status: null };
  } finally {
    clearTimeout(timer);
    context.signal.removeEventListener('abort', cancel);
    if (rejectAbort !== undefined)
      controller.signal.removeEventListener('abort', rejectAbort);
  }
};

const readDraft = (
  path: string,
  entryId: string,
  context: ReadContext,
): Promise<StageResult<EntryDraftDetailResource>> =>
  protectedRead(path, context, async (body, response, check) => {
    const validators = loadedCmsValidators() ?? (await loadCmsValidators());
    check();
    const parsed = validators.EntryDraftDetailResourceSchema.safeParse(body);
    const etag = response.headers.get('etag');
    return parsed.success &&
      parsed.data.entry.id === entryId &&
      etag !== null &&
      validators.entryDraftDetailEtagMatchesResource(etag, parsed.data)
      ? parsed.data
      : null;
  });

const readRule = (
  path: string,
  entryId: string,
  context: ReadContext,
): Promise<StageResult<RelatedContentRuleRead>> =>
  protectedRead(path, context, async (body, response, check) => {
    const validators = loadedCmsValidators() ?? (await loadCmsValidators());
    check();
    const parsed = validators.RelatedContentRuleReadSchema.safeParse(body);
    if (
      !parsed.success ||
      !validators.relatedRuleReadAnswersEntry(parsed.data, entryId)
    )
      return null;
    const rule = parsed.data.rule;
    return rule === null || response.headers.get('etag') === `"${rule.version}"`
      ? parsed.data
      : null;
  });

/** FE03 :1224 / DEC-195: protected draft FIRST, saved rule SECOND, never a read after an empty rule. */
export const readRelatedConflict = async (input: {
  readonly entryId: string;
  readonly signal: AbortSignal;
  readonly isCurrent: () => boolean;
  readonly fetcher?: typeof fetch;
}): Promise<RelatedConflictReadResult> => {
  if (!isCmsUuid(input.entryId) || input.signal.aborted || !input.isCurrent())
    return { kind: 'failed', status: null };
  const context: ReadContext = { ...input, fetcher: input.fetcher ?? fetch };
  const path = `/api/v1/cms/entries/${encodeURIComponent(input.entryId)}`;
  const draft = await readDraft(path, input.entryId, context);
  if (input.signal.aborted || !input.isCurrent())
    return { kind: 'failed', status: null };
  if (draft.kind !== 'verified') return draft;
  const saved = await readRule(
    `${path}/related-content`,
    input.entryId,
    context,
  );
  if (input.signal.aborted || !input.isCurrent())
    return { kind: 'failed', status: null };
  if (saved.kind !== 'verified') return saved;
  return {
    kind: 'reviewed',
    snapshot: {
      draft: draft.value,
      rule: saved.value.rule,
      expectedVersion: saved.value.rule?.version ?? draft.value.entry.version,
    },
  };
};
