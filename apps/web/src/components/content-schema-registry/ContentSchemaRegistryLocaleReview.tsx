import * as React from 'react';

import { LOCALE_CONFIG_MESSAGES } from '@wejammin/contracts';

import {
  diffAgainstSource,
  localeControlId,
  type LocaleConfig,
  type LocaleConfigDraft,
  type LocaleIssue,
} from './content-schema-registry-locale-config';
import {
  issueFocusId,
  type LocaleDraftController,
} from './use-locale-config-draft';

const focusById = (id: string): void => {
  document.getElementById(id)?.focus();
};

const pathLabel = (issue: LocaleIssue): string => issue.path.join(' / ');

/** Linked error summary: each message with its field path. */
export const ContentSchemaRegistryLocaleSummary = ({
  controller,
}: {
  readonly controller: LocaleDraftController;
}): React.ReactElement | null => {
  const { issues, formId, cycle } = controller;
  if (issues.length === 0) return null;
  const first = cycle[0];
  return (
    <section
      id={localeControlId(formId, { control: 'summary' })}
      tabIndex={-1}
      role="alert"
      data-locale-summary
      className="content-schema-registry-command-error"
    >
      <h3>Review the language settings</h3>
      <ul>
        {issues.map((issue, position) => (
          <li key={`${pathLabel(issue)}-${position}`}>
            <a
              href={`#${issueFocusId(formId, issue)}`}
              onClick={(event) => {
                event.preventDefault();
                focusById(issueFocusId(formId, issue));
              }}
            >
              {`${pathLabel(issue)}: ${issue.message}`}
            </a>
          </li>
        ))}
      </ul>
      {issues.some(
        (issue) => issue.message === LOCALE_CONFIG_MESSAGES.chainCycle,
      ) && first !== undefined ? (
        <p>
          <a
            data-locale-cycle
            href={`#${localeControlId(formId, { control: 'chain', target: first })}`}
            onClick={(event) => {
              event.preventDefault();
              focusById(
                localeControlId(formId, { control: 'chain', target: first }),
              );
            }}
          >
            {`Languages on a cycle: ${cycle.join(', ')}`}
          </a>
        </p>
      ) : null}
    </section>
  );
};

const List = ({
  heading,
  items,
}: {
  readonly heading: string;
  readonly items: readonly string[];
}): React.ReactElement | null =>
  items.length === 0 ? null : (
    <>
      <h4>{heading}</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </>
  );

/** FE03 "Review changes": added, removed and reordered, never classified here. */
export const ContentSchemaRegistryLocaleReview = ({
  draft,
  source,
}: {
  readonly draft: LocaleConfigDraft;
  readonly source: LocaleConfig | null;
}): React.ReactElement => {
  const diff = diffAgainstSource(source, draft);
  return (
    <section data-locale-review aria-labelledby="locale-review-heading">
      <h3 id="locale-review-heading">Review changes</h3>
      <List heading="Added languages" items={diff.added} />
      <List heading="Removed languages" items={diff.removed} />
      <List
        heading="Languages with a changed fallback order"
        items={diff.reordered}
      />
      {diff.added.length + diff.removed.length + diff.reordered.length === 0 ? (
        <p>No language changes.</p>
      ) : null}
      <p>
        Removing a language or changing a retained fallback order is treated as
        a breaking change and needs a migration plan at dry run
      </p>
    </section>
  );
};
