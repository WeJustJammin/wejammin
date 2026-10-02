import * as React from 'react';

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

const RowActions = ({
  grant,
  disabled,
  props,
}: {
  readonly grant: Item;
  readonly disabled: boolean;
  readonly props: CmsCapabilityGrantListProps;
}): React.ReactElement => {
  const label = capabilityLabel(grant.capability);
  const personId = `cms-grant-person-${grant.id}`;
  if (grant.state === 'revoked')
    return (
      <button
        type="button"
        data-action="grant-again"
        disabled={disabled}
        aria-describedby={personId}
        onClick={() => props.onGrantAgain(grant)}
      >
        Grant again
      </button>
    );
  const name = (verb: string): string =>
    `${verb} ${label} grant ending ${grant.validThrough}`;
  return (
    <>
      <button
        type="button"
        data-action="renew"
        disabled={disabled}
        aria-label={name('Renew')}
        aria-describedby={personId}
        onClick={(event) => props.onRenew(grant, event.currentTarget)}
      >
        Renew
      </button>
      <button
        type="button"
        data-action="revoke"
        disabled={disabled}
        aria-label={name('Revoke')}
        aria-describedby={personId}
        onClick={(event) => props.onRevoke(grant, event.currentTarget)}
      >
        Revoke
      </button>
    </>
  );
};

/** CMS-03A-18 rows: server-authoritative, derived state as text plus icon. */
export default function CmsCapabilityGrantList(
  props: CmsCapabilityGrantListProps,
): React.ReactElement {
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
            return [
              <tr key={grant.id} data-grant-id={grant.id}>
                <td data-capability-cell>
                  <strong>{capabilityLabel(grant.capability)}</strong>{' '}
                  <code data-capability-key>{grant.capability}</code>
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
                <td>
                  <time dateTime={grant.updatedAt}>{grant.updatedAt}</time>
                </td>
                <td data-actions-cell>
                  <RowActions
                    grant={grant}
                    props={props}
                    disabled={props.commandsDisabled}
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
