import type { JsonValue } from '@wejammin/contracts';
import * as React from 'react';

import CmsRichTextRenderer from '../cms-rich-text/CmsRichTextRenderer';
import {
  isCmsUnavailableDescriptor,
  type CmsFieldDescriptor,
} from './cms-field-descriptor';
import { isJsonRecord } from './cms-field-value-structured';

export interface CmsFieldValueViewProps {
  readonly descriptor: CmsFieldDescriptor;
  readonly value: JsonValue | null;
  /** The closed provenance of the side, to tell "cleared" from "no value". */
  readonly provenance?: string | undefined;
}

const text = (value: JsonValue | null | undefined): string =>
  value === null || value === undefined
    ? ''
    : typeof value === 'string'
      ? value
      : String(value);

const Scalar = ({
  kind,
  value,
}: {
  readonly kind: string;
  readonly value: JsonValue;
}): React.ReactElement => {
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (kind === 'datetime' && typeof value === 'string')
    return <time dateTime={value}>{value}</time>;
  return (
    <span className={kind === 'long_text' ? 'cms-value-multiline' : undefined}>
      {text(value)}
    </span>
  );
};

/**
 * A typed, read-only rendering of one field value: the same kind of thing the
 * editor edits, shown as what it is (text, a number, a date, rich text, a list,
 * an object's declared properties, a relation's linked entries) and never as a
 * JSON dump. Every string passes through React's escaping; rich text goes
 * through the typed renderer, which refuses what the grammar refuses.
 */
export default function CmsFieldValueView({
  descriptor,
  value,
  provenance,
}: CmsFieldValueViewProps): React.ReactElement {
  if (isCmsUnavailableDescriptor(descriptor)) return <span>Not available</span>;
  if (value === null)
    return (
      <span className="cms-value-none">
        {provenance === 'explicit_null' ? 'Cleared' : 'No value'}
      </span>
    );
  if (descriptor.kind === 'rich_text')
    return <CmsRichTextRenderer value={value} />;
  if (descriptor.kind === 'list')
    return Array.isArray(value) ? (
      <ol>
        {value.map((item, index) => (
          <li key={index}>
            <Scalar kind={descriptor.itemKind} value={item} />
          </li>
        ))}
      </ol>
    ) : (
      <span className="cms-value-none">No value</span>
    );
  if (descriptor.kind === 'object')
    return isJsonRecord(value) ? (
      <dl>
        {descriptor.properties
          .filter((property) => Object.hasOwn(value, property.key))
          .map((property) => {
            const propertyValue = value[property.key] ?? null;
            return (
              <React.Fragment key={property.key}>
                <dt>{property.label}</dt>
                <dd>
                  {property.kind === 'rich_text' ? (
                    <CmsRichTextRenderer value={propertyValue} />
                  ) : propertyValue === null ? (
                    <span className="cms-value-none">No value</span>
                  ) : (
                    <Scalar kind={property.kind} value={propertyValue} />
                  )}
                </dd>
              </React.Fragment>
            );
          })}
      </dl>
    ) : (
      <span className="cms-value-none">No value</span>
    );
  if (descriptor.kind === 'relation') {
    const targets =
      isJsonRecord(value) && Array.isArray(value.targets) ? value.targets : [];
    return targets.length === 0 ? (
      <span className="cms-value-none">No linked entries</span>
    ) : (
      <ul>
        {targets.map((target, index) => {
          const record = isJsonRecord(target) ? target : {};
          const pinned = record.expectedTargetVersion;
          return (
            <li key={index}>
              Entry <code>{text(record.targetId ?? null)}</code>
              {typeof pinned === 'string'
                ? `, pinned to version ${pinned}`
                : ''}
            </li>
          );
        })}
      </ul>
    );
  }
  return <Scalar kind={descriptor.kind} value={value} />;
}
