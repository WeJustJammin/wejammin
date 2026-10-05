import * as React from 'react';

import {
  CMS_CAPABILITY_GROUPS,
  capabilityOptionText,
} from './cms-capability-grant-labels';
import type {
  CmsCapabilityGrantQueryState,
  CmsCapabilityGrantResource,
  GrantableCmsCapability,
} from './cms-capability-grant-types';

const STATES: readonly CmsCapabilityGrantResource['state'][] = [
  'active',
  'lapsed',
  'revoked',
];
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface CmsCapabilityGrantFiltersProps {
  readonly query: CmsCapabilityGrantQueryState;
  readonly person: string;
  readonly onQuery: (next: CmsCapabilityGrantQueryState) => void;
  /** Island-local person filter; never serialized into the URL. */
  readonly onPerson: (value: string) => void;
  readonly onReset: () => void;
}

/** Capability and state are URL state; the person filter stays in memory. */
export default function CmsCapabilityGrantFilters({
  query,
  person,
  onQuery,
  onPerson,
  onReset,
}: CmsCapabilityGrantFiltersProps): React.ReactElement {
  // A half-typed value stays local; a blank or valid UUID becomes the filter.
  const [typing, setTyping] = React.useState<string | null>(null);
  const draft = typing ?? person;
  const invalid = draft.trim() !== '' && !UUID.test(draft.trim());
  return (
    <fieldset className="content-schema-registry-filters">
      <legend>Filter grants</legend>
      <div className="content-schema-registry-filter-grid">
        <label>
          Capability
          <select
            name="filterCapability"
            value={query.capability ?? ''}
            onChange={(event) =>
              onQuery({
                ...query,
                cursor: undefined,
                capability:
                  event.target.value === ''
                    ? undefined
                    : (event.target.value as GrantableCmsCapability),
              })
            }
          >
            <option value="">All capabilities</option>
            {CMS_CAPABILITY_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.capabilities.map((capability) => (
                  <option key={capability} value={capability}>
                    {capabilityOptionText(capability)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label>
          State
          <select
            name="filterState"
            value={query.state ?? ''}
            onChange={(event) =>
              onQuery({
                ...query,
                cursor: undefined,
                state:
                  event.target.value === ''
                    ? undefined
                    : (event.target
                        .value as CmsCapabilityGrantResource['state']),
              })
            }
          >
            <option value="">All states</option>
            {STATES.map((state) => (
              <option key={state} value={state}>
                {state[0]?.toUpperCase()}
                {state.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Person ID
          <input
            name="filterPerson"
            type="text"
            autoComplete="off"
            spellCheck={false}
            className="cms-capability-grant-mono"
            value={draft}
            aria-invalid={invalid ? 'true' : undefined}
            onChange={(event) => {
              const next = event.target.value.trim();
              if (next === '' || UUID.test(next)) {
                setTyping(null);
                onPerson(next);
              } else setTyping(event.target.value);
            }}
          />
        </label>
      </div>
      <p className="content-schema-registry-help">
        The person filter stays in this page and is never added to the address.
      </p>
      <button type="button" data-action="reset-filters" onClick={onReset}>
        Reset filters
      </button>
    </fieldset>
  );
}
