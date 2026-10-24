import * as React from 'react';

import { DOMAIN_PROVIDER_COPY } from './taxonomy-designer-copy';
import { TAXONOMY_DOMAINS_ID } from './taxonomy-designer-ids';
import {
  CANONICAL_DOMAINS,
  CANONICAL_DOMAIN_LABEL,
  CANONICAL_DOMAIN_PROVIDER_BUILT,
  type CanonicalDomain,
} from './taxonomy-vocabulary';

interface Props {
  readonly declared: readonly CanonicalDomain[];
  readonly onToggle: (domain: CanonicalDomain) => void;
  readonly issues: readonly string[];
}

/**
 * The canonical overlap domains this vocabulary declares (FE03 :886, DEC-135): a checkbox
 * group of the six domains, each stating whether a provider can check it. A declared domain
 * with no provider is accepted as a draft and refused at submission, activation and term
 * action, so the person is told before they submit and the reviewers see the declaration.
 */
export default function CmsTaxonomyDomains({
  declared,
  onToggle,
  issues,
}: Props): React.ReactElement {
  const unavailable = CANONICAL_DOMAINS.filter(
    (domain) =>
      declared.includes(domain) && !CANONICAL_DOMAIN_PROVIDER_BUILT[domain],
  );
  const names = (list: readonly CanonicalDomain[]): string =>
    list.map((domain) => CANONICAL_DOMAIN_LABEL[domain]).join(', ');
  return (
    <fieldset
      id={TAXONOMY_DOMAINS_ID}
      tabIndex={-1}
      aria-describedby={`cms-taxonomy-domains-help${issues.length > 0 ? ' cms-taxonomy-domains-errors' : ''}`}
    >
      <legend>Canonical domains this vocabulary declares</legend>
      <p id="cms-taxonomy-domains-help">
        A term is checked against the canonical records of every declared domain
        and is refused when it matches one. A domain left unchecked is never
        checked. Reviewers see this declaration when they approve the version.
      </p>
      {CANONICAL_DOMAINS.map((domain) => {
        const built = CANONICAL_DOMAIN_PROVIDER_BUILT[domain];
        const descriptionId = `cms-taxonomy-domain-${domain}-provider`;
        return (
          <div key={domain} className="cms-taxonomy-domain">
            <label>
              <input
                type="checkbox"
                checked={declared.includes(domain)}
                aria-describedby={descriptionId}
                onChange={() => onToggle(domain)}
              />
              {CANONICAL_DOMAIN_LABEL[domain]}
            </label>
            <small id={descriptionId}>
              {built
                ? DOMAIN_PROVIDER_COPY.built
                : DOMAIN_PROVIDER_COPY.unbuilt}
            </small>
          </div>
        );
      })}
      <p role="status" aria-live="polite">
        {declared.length === 0
          ? 'This vocabulary declares no canonical domain, so its terms are never checked against canonical records.'
          : `This vocabulary declares: ${names(CANONICAL_DOMAINS.filter((d) => declared.includes(d)))}.`}
        {unavailable.length === 0
          ? ''
          : ` Not available yet: ${names(unavailable)}. The draft can be saved, but it cannot be submitted for review or activated while it declares ${unavailable.length === 1 ? 'that domain' : 'those domains'}.`}
      </p>
      {issues.length > 0 ? (
        <ul id="cms-taxonomy-domains-errors" className="cms-field-errors">
          {issues.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
    </fieldset>
  );
}
