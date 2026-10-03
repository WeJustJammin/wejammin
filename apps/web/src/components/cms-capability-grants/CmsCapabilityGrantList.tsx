import * as React from 'react';

import CmsCapabilityGrantRowActions from './CmsCapabilityGrantRowActions';
import { capabilityLabel } from './cms-capability-grant-labels';
import type {
  CmsCapabilityGrantListPage,
  CmsCapabilityGrantQueryState,
  CmsCapabilityGrantResource,
} from './cms-capability-grant-types';

type Item = CmsCapabilityGrantResource;

const STATE_VIEW: Readonly<
  Record<Item['state'], { readonly icon: string; readonly text: string }>
> = {
  active: { icon: '●', text: 'Active' },
  lapsed: { icon: '◐', text: 'Lapsed' },
  revoked: { icon: '○', text: 'Revoked' },
};

export interface CmsCapabilityGrantListProps {
  readonly page: CmsCapabilityGrantListPage;
  readonly query: CmsCapabilityGrantQueryState;
  readonly commandsDisabled: boolean;
  /** Id of the visible reason the commands are disabled, if any. */
  readonly disabledReasonId?: string | undefined;
  readonly openGrantId: string | null;
  readonly onSort: (sort: 'validThrough' | 'updatedAt') => void;
  readonly onRenew: (grant: Item, trigger: HTMLButtonElement) => void;
  readonly onRevoke: (grant: Item, trigger: HTMLButtonElement) => void;
  readonly onGrantAgain: (grant: Item) => void;
  readonly onNextPage: () => void;
  readonly rowForm: (grant: Item) => React.ReactNode;
}

const SortHeader = ({
  sort,
  label,
  query,
  onSort,
}: {
  readonly sort: 'validThrough' | 'updatedAt';
  readonly label: string;
  readonly query: CmsCapabilityGrantQueryState;
  readonly onSort: CmsCapabilityGrantListProps['onSort'];
}): React.ReactElement => (
  <th
    scope="col"
    {...(query.sort === sort
      ? {
          'aria-sort':
            query.direction === 'asc'
              ? ('ascending' as const)
              : ('descending' as const),
        }
      : {})}
  >
    <button type="button" data-sort={sort} onClick={() => onSort(sort)}>
      {label}
    </button>
  </th>
);

/** CMS-03A-18 rows: server-authoritative, derived state as text plus icon. */
export default function CmsCapabilityGrantList(
  props: CmsCapabilityGrantListProps,
): React.ReactElement {
  // Mobile (<= 768 px) shows capability, state and valid-through per row and
  // keeps the remaining facts behind a per-row disclosure (FE03 responsive
  // contract). The cells stay in the document on every width; only CSS hides
  // them, so there is one copy of each fact and the disclosure is inert on
  // tablet and desktop where the button is not rendered visibly.
  const [factsOpen, setFactsOpen] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const toggleFacts = (id: string): void =>
    setFactsOpen((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  return (
    <>
      <table className="cms-capability-grant-table">
        <caption>CMS capability grants</caption>
        <thead>
          <tr>
            <th scope="col">Capability</th>
            <th scope="col">Person ID</th>
            <th scope="col">State</th>
            <SortHeader
              sort="validThrough"
              label="Valid through"
              query={props.query}
              onSort={props.onSort}
            />
            <SortHeader
              sort="updatedAt"
              label="Last updated"
              query={props.query}
              onSort={props.onSort}
            />
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {props.page.items.flatMap((grant) => {
            const view = STATE_VIEW[grant.state];
            const open = props.openGrantId === grant.id;
            const expanded = factsOpen.has(grant.id);
            return [
              <tr
                key={grant.id}
                data-grant-id={grant.id}
                {...(expanded ? { 'data-facts-open': 'true' } : {})}
              >
                <td data-capability-cell>
                  <strong>{capabilityLabel(grant.capability)}</strong>{' '}
                  <code data-capability-key>{grant.capability}</code>
                  <button
                    type="button"
                    data-facts-toggle="true"
                    aria-expanded={expanded}
                    aria-controls={`cms-grant-person-${grant.id} cms-grant-updated-${grant.id}`}
                    onClick={() => toggleFacts(grant.id)}
                  >
                    {expanded ? 'Hide' : 'Show'} details for{' '}
                    {capabilityLabel(grant.capability)} grant ending{' '}
                    {grant.validThrough}
                  </button>
                </td>
                <td id={`cms-grant-person-${grant.id}`} data-person-cell>
                  <code>{grant.subjectPersonId}</code>
                </td>
                <td data-state-cell>
                  <span aria-hidden="true">{view.icon}</span> {view.text}
                </td>
                <td data-term-cell>
                  Valid through {grant.validThrough} (UTC)
                  <br />
                  <small>
                    Ends <time dateTime={grant.endsAt}>{grant.endsAt}</time>
                  </small>
                </td>
                <td id={`cms-grant-updated-${grant.id}`} data-updated-cell>
                  <time dateTime={grant.updatedAt}>{grant.updatedAt}</time>
                </td>
                <td data-actions-cell>
                  <CmsCapabilityGrantRowActions
                    grant={grant}
                    disabled={props.commandsDisabled}
                    disabledReasonId={props.disabledReasonId}
                    onRenew={props.onRenew}
                    onRevoke={props.onRevoke}
                    onGrantAgain={props.onGrantAgain}
                  />
                </td>
              </tr>,
              ...(open
                ? [
                    <tr key={`${grant.id}-form`} data-row-form>
                      <td colSpan={6}>{props.rowForm(grant)}</td>
                    </tr>,
                  ]
                : []),
            ];
          })}
        </tbody>
      </table>
      {props.page.nextCursor === null ? null : (
        <p>
          <button
            type="button"
            data-action="next-page"
            onClick={props.onNextPage}
          >
            Next page
          </button>
        </p>
      )}
    </>
  );
}
