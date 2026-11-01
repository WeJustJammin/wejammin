import {
  entryFactsOf,
  isDiffOf,
  isSelectorPage,
  type EntryFacts,
} from './composition-guards';
import { readJson, type ReadOptions } from './composition-transport';
import type { SelectorPage, UpdateDiff } from './composition-types';

/** The selector's default page size (CMS-03C-13: default 25, maximum 50). */
export const SELECTOR_PAGE_LIMIT = 25;

type Failure = Extract<
  Awaited<ReturnType<typeof readJson>>,
  { kind: 'failed' | 'rate_limited' }
>;
const failed = (status: number | null): Failure => ({
  kind: 'failed',
  status,
  reason: null,
});

/** The next page of the pattern selector; the signed cursor lives in component state only (FE03 886). */
export const readSelectorPage = async (
  contentTypeId: string,
  cursor: string | null,
  options: ReadOptions = {},
): Promise<{ kind: 'page'; page: SelectorPage } | Failure> => {
  const query = new URLSearchParams({ contentTypeId });
  if (cursor !== null) query.set('cursor', cursor);
  query.set('limit', String(SELECTOR_PAGE_LIMIT));
  const answer = await readJson(
    `/api/v1/cms/patterns/selector?${query.toString().replaceAll('+', '%20')}`,
    options,
  );
  if (answer.kind !== 'ok') return answer;
  return isSelectorPage(answer.body)
    ? { kind: 'page', page: answer.body }
    : failed(200);
};

/** The three-way diff of one instance. Every open is a fresh read; a diff is never cached (FE03 2708). */
export const readUpdateDiff = async (
  instanceId: string,
  options: ReadOptions = {},
): Promise<{ kind: 'diff'; diff: UpdateDiff } | Failure> => {
  const answer = await readJson(
    `/api/v1/cms/compositions/instances/${instanceId}/update-diff`,
    options,
  );
  if (answer.kind !== 'ok') return answer;
  return isDiffOf(answer.body, instanceId)
    ? { kind: 'diff', diff: answer.body }
    : failed(200);
};

/** The entry's current version and draft revision, refetched where a command needs a fresh `If-Match`. */
export const readEntryFacts = async (
  entryId: string,
  options: ReadOptions = {},
): Promise<({ kind: 'facts' } & EntryFacts) | Failure> => {
  const answer = await readJson(`/api/v1/cms/entries/${entryId}`, options);
  if (answer.kind !== 'ok') return answer;
  const facts = entryFactsOf(answer.body, entryId);
  return facts === null ? failed(200) : { kind: 'facts', ...facts };
};
