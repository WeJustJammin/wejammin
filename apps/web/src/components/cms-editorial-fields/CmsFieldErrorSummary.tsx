import * as React from 'react';

import { focusCmsField } from './cms-field-focus';

export interface CmsFieldErrorSummaryItem {
  /** The stable field id the message belongs to, or null for a form-level one. */
  readonly fieldId: string | null;
  readonly label: string;
  readonly message: string;
}

export interface CmsFieldErrorSummaryProps {
  readonly id: string;
  readonly heading: string;
  readonly items: readonly CmsFieldErrorSummaryItem[];
}

/**
 * The linked error summary: a focusable group whose entries are native links to
 * the invalid controls. Focus moves to the group when it is first shown (the
 * host calls `focus()` on the forwarded ref), and a link moves focus straight to
 * its control, so keyboard and screen reader users land on the problem.
 */
const CmsFieldErrorSummary = React.forwardRef<
  HTMLDivElement,
  CmsFieldErrorSummaryProps
>(function CmsFieldErrorSummary({ id, heading, items }, ref) {
  return (
    <div
      ref={ref}
      id={id}
      data-cms-editorial-validation-summary="true"
      tabIndex={-1}
      role="group"
      aria-labelledby={`${id}-heading`}
    >
      <h2 id={`${id}-heading`}>{heading}</h2>
      <ul>
        {items.map((item, index) => (
          <li key={`${item.fieldId ?? 'form'}-${index}`}>
            {item.fieldId === null ? (
              `${item.label}: ${item.message}`
            ) : (
              <a
                href={`#field-${item.fieldId}`}
                onClick={(event) => {
                  const fieldId = item.fieldId;
                  if (fieldId !== null && focusCmsField(fieldId))
                    event.preventDefault();
                }}
              >
                {item.label}: {item.message}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
});

export default CmsFieldErrorSummary;
