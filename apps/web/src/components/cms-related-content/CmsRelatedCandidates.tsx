import * as React from 'react';

import { isPinnable, type RelatedCandidate } from './related-candidates';
import {
  MAX_EXCLUSIONS,
  MAX_PINS,
  type RelatedLists,
} from './related-content-lists';
import { entryName, formatInstant } from './related-format';
import { rateLimitMessage } from '../../lib/rate-limit-message';
import type { CandidateNote } from './use-related-candidates';

interface Props {
  readonly items: readonly RelatedCandidate[];
  readonly lists: RelatedLists;
  readonly hasMore: boolean;
  readonly note: CandidateNote;
  /** A 429's stated wait in whole seconds, or null when none was stated (FE03 :1172). */
  readonly waitSeconds: number | null;
  /** True until a 429's wait has elapsed: Load more stays off. */
  readonly waiting: boolean;
  /** The page's own path: the sign-in link returns here. */
  readonly returnTo: string;
  readonly onPin: (entryId: string) => void;
  readonly onExclude: (entryId: string) => void;
  readonly onLoadMore: () => void;
}

const NOTE_COPY: Readonly<
  Record<Exclude<CandidateNote, 'none' | 'loading' | 'rate_limited'>, string>
> = {
  restarted:
    'The list changed while you were loading it. Reload the list to start again from the first page. Your pins and exclusions are kept.',
  failed:
    'More entries could not be loaded right now. Your pins and exclusions are kept. Try again.',
  signin:
    'Your session ended, so more entries cannot be loaded. Sign in again to continue.',
};

const stateOf = (lists: RelatedLists, id: string): string =>
  lists.pins.some((pin) => pin.toLowerCase() === id.toLowerCase())
    ? `Pinned, position ${lists.pins.findIndex((pin) => pin.toLowerCase() === id.toLowerCase()) + 1}`
    : lists.exclusions.some((entry) => entry.toLowerCase() === id.toLowerCase())
      ? 'Excluded'
      : 'Not chosen';

/**
 * The picker (FE03 :890): only entries the caller can read, from the protected entry list. Every row
 * states its choice in text, so nothing depends on colour, and a pin is offered only for an active
 * entry; any listed entry can be excluded.
 */
export default function CmsRelatedCandidates({
  items,
  lists,
  hasMore,
  note,
  waitSeconds,
  waiting,
  returnTo,
  onPin,
  onExclude,
  onLoadMore,
}: Props): React.ReactElement {
  const pinsFull = lists.pins.length >= MAX_PINS;
  const exclusionsFull = lists.exclusions.length >= MAX_EXCLUSIONS;
  return (
    <section
      aria-labelledby="cms-related-candidates-heading"
      className="cms-related-candidates"
    >
      <h2 id="cms-related-candidates-heading">Choose entries</h2>
      <p>
        These are the entries you can read. Only active entries can be pinned;
        any listed entry can be excluded.
      </p>
      {items.length === 0 ? (
        <p>No other readable entries are loaded.</p>
      ) : (
        <table className="cms-related-table">
          <caption>Readable entries ({items.length} loaded)</caption>
          <thead>
            <tr>
              <th scope="col">Entry</th>
              <th scope="col">Locale</th>
              <th scope="col">Revision state</th>
              <th scope="col">Lifecycle</th>
              <th scope="col">Updated</th>
              <th scope="col">Chosen as</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((entry) => {
              const choice = stateOf(lists, entry.entryId);
              const free = choice === 'Not chosen';
              return (
                <tr key={entry.entryId}>
                  <th scope="row" data-label="Entry">
                    <code>{entry.entryId}</code>
                  </th>
                  <td data-label="Locale">{entry.locale}</td>
                  <td data-label="Revision state">{entry.state}</td>
                  <td data-label="Lifecycle">{entry.lifecycle}</td>
                  <td data-label="Updated">
                    <time dateTime={entry.updatedAt}>
                      {formatInstant(entry.updatedAt)}
                    </time>
                  </td>
                  <td data-label="Chosen as">{choice}</td>
                  <td data-label="Actions" className="cms-related-actions">
                    {isPinnable(entry) ? (
                      <button
                        type="button"
                        aria-disabled={!free || pinsFull}
                        aria-label={`Pin ${entryName(entry.entryId)}`}
                        onClick={() => onPin(entry.entryId)}
                      >
                        Pin
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-disabled={choice === 'Excluded' || exclusionsFull}
                      aria-label={`Exclude ${entryName(entry.entryId)}`}
                      onClick={() => onExclude(entry.entryId)}
                    >
                      Exclude
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {note === 'none' || note === 'loading' ? null : (
        <p role="status">
          {note === 'rate_limited'
            ? rateLimitMessage(waitSeconds)
            : NOTE_COPY[note]}{' '}
          {note === 'signin' ? (
            <a href={`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`}>
              Sign in
            </a>
          ) : null}
        </p>
      )}
      {hasMore ||
      note === 'restarted' ||
      note === 'failed' ||
      note === 'rate_limited' ? (
        <button
          type="button"
          disabled={note === 'loading' || waiting}
          onClick={onLoadMore}
        >
          {note === 'loading'
            ? 'Loading…'
            : note === 'restarted' || !hasMore
              ? 'Reload the list'
              : 'Load more entries'}
        </button>
      ) : null}
    </section>
  );
}
