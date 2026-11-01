import {
  TaxonomySelectorPageSchema,
  TaxonomySelectorTermSchema,
  type JsonValue,
  type TaxonomySelectorPage,
  type TaxonomySelectorTerm,
} from '@wejammin/contracts';
import * as React from 'react';
import { act } from 'react';
import { vi } from 'vitest';

import CmsTaxonomyFieldEditor from './CmsTaxonomyFieldEditor';
import { mountElement } from './cms-editor-dom.test-support';
import type { CmsTaxonomyDescriptor } from './cms-field-descriptor';
import { fieldUuid } from './cms-field-fixtures.test-support';
import type { CmsFieldIssue } from './cms-field-issue';
import { isJsonRecord } from './cms-field-value-structured';

/**
 * Fixtures and the stateful host for the CMS-03C-17 taxonomy field control.
 *
 * Every term and page is parsed through the real selector contract, so a
 * fixture that drifts from the server projection fails here instead of inside a
 * render. `mountTaxonomy` wires the control the way the real forms do: the host
 * owns the value and the control's `onChange` flows back into it.
 */

/** A distinct valid `termId` per fixture index. */
export const termUid = (index: number): string => fieldUuid(700 + index);

/** The vocabulary identity every fixture term shares unless it opts out. */
export const FIXTURE_TAXONOMY_ID = fieldUuid(600);
export const FIXTURE_TAXONOMY_VERSION_ID = fieldUuid(601);
/** Another lineage, and another version of it, under the same taxonomy key. */
export const FOREIGN_TAXONOMY_ID = fieldUuid(620);
export const FOREIGN_TAXONOMY_VERSION_ID = fieldUuid(621);

export type TaxonomyShape = 'flat' | 'hierarchical';

export interface TermSpec {
  readonly n: number;
  readonly termKey: string;
  /** `null` is the contract's "no label for this locale": the key shows. */
  readonly label?: string | null;
  readonly taxonomyKey?: string;
  /** Same key under another lineage id or version id is not the same term set. */
  readonly taxonomyId?: string;
  readonly taxonomyVersionId?: string;
  readonly shape?: TaxonomyShape;
  readonly parentId?: string | null;
}

export const taxonomyTerm = (spec: TermSpec): TaxonomySelectorTerm =>
  TaxonomySelectorTermSchema.parse({
    taxonomyId: spec.taxonomyId ?? FIXTURE_TAXONOMY_ID,
    taxonomyVersionId: spec.taxonomyVersionId ?? FIXTURE_TAXONOMY_VERSION_ID,
    taxonomyKey: spec.taxonomyKey ?? 'genre-tags',
    shape: spec.shape ?? 'flat',
    termId: termUid(spec.n),
    termKey: spec.termKey,
    parentId: spec.parentId ?? null,
    label: spec.label === undefined ? spec.termKey : spec.label,
  });

export const taxonomyPage = (
  terms: readonly TermSpec[],
  over: {
    readonly nextCursor?: string | null;
    readonly pageVersion?: string;
  } = {},
): TaxonomySelectorPage =>
  TaxonomySelectorPageSchema.parse({
    items: terms.map(taxonomyTerm),
    nextCursor: over.nextCursor ?? null,
    pageVersion: over.pageVersion ?? '7',
  });

/** The one accepted taxonomy value shape (BE03b "Value encodings"). */
export const taxonomyValue = (termIds: readonly string[]): JsonValue => ({
  termIds: [...termIds],
});

/** The ids a stored value carries, ignoring anything that is not a string. */
export const selectedTermIds = (value: JsonValue | null): readonly string[] => {
  if (!isJsonRecord(value)) return [];
  const ids: unknown = value.termIds;
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is string => typeof id === 'string');
};

/** The own keys of a written value: a write is exactly `{ termIds }`, no more. */
export const writeKeys = (
  value: JsonValue | null | undefined,
): readonly string[] => (isJsonRecord(value) ? Object.keys(value) : []);

/** The descriptor the CMS-03B-14 projection yields for a taxonomy field. */
export const taxonomyDescriptor = (
  over: Partial<CmsTaxonomyDescriptor> = {},
): CmsTaxonomyDescriptor => ({
  fieldId: fieldUuid(13),
  key: 'topics',
  label: 'Topics',
  helpText: undefined,
  required: false,
  order: 13,
  kind: 'taxonomy',
  ...over,
});

export interface TaxonomyOptions {
  readonly descriptor?: CmsTaxonomyDescriptor;
  readonly page?: TaxonomySelectorPage;
  /** The value the control starts with; the host owns it after mount. */
  readonly value?: JsonValue | null;
  readonly error?: string;
  readonly issues?: readonly CmsFieldIssue[];
  readonly disabled?: boolean;
}

/** A re-render changes props only: the host's value is its own state. */
export type TaxonomyRerenderOptions = Omit<TaxonomyOptions, 'value'>;

interface HostProps extends TaxonomyOptions {
  readonly onValue: (value: JsonValue | null) => void;
  readonly onBlur: () => void;
}

/** The stateful host: an edit flows back into `value` exactly as in the forms. */
const TaxonomyHost = ({
  descriptor,
  page,
  value: initialValue,
  error,
  issues,
  disabled,
  onValue,
  onBlur,
}: HostProps): React.ReactElement => {
  const [value, setValue] = React.useState<JsonValue | null>(
    initialValue ?? null,
  );
  return (
    <CmsTaxonomyFieldEditor
      descriptor={descriptor ?? taxonomyDescriptor()}
      page={page ?? taxonomyPage([])}
      value={value}
      error={error}
      issues={issues ?? []}
      disabled={disabled}
      onBlur={onBlur}
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
    />
  );
};

export interface TaxonomyMounted {
  readonly container: HTMLDivElement;
  readonly unmount: () => void;
  readonly onValue: ReturnType<typeof vi.fn<(value: JsonValue | null) => void>>;
  readonly onBlur: ReturnType<typeof vi.fn<() => void>>;
  /** Re-renders the same host with new props (never a new starting value). */
  readonly rerender: (over?: TaxonomyRerenderOptions) => void;
  /** The value the control last emitted, or undefined when it never did. */
  readonly emitted: () => JsonValue | null | undefined;
}

export const mountTaxonomy = (over: TaxonomyOptions = {}): TaxonomyMounted => {
  const onValue = vi.fn<(value: JsonValue | null) => void>();
  const onBlur = vi.fn<() => void>();
  const base: HostProps = { ...over, onValue, onBlur };
  const mounted = mountElement(<TaxonomyHost {...base} />);
  return {
    container: mounted.container,
    unmount: mounted.unmount,
    onValue,
    onBlur,
    rerender: (next = {}) =>
      mounted.rerender(<TaxonomyHost {...base} {...next} />),
    emitted: () => onValue.mock.calls.at(-1)?.[0],
  };
};

/** The folded text of every element an element's `aria-describedby` names. */
export const describedText = (
  element: HTMLElement,
  root: Document = element.ownerDocument,
): string =>
  (element.getAttribute('aria-describedby') ?? '')
    .split(/\s+/u)
    .filter((id) => id !== '')
    .map((id) => root.getElementById(id)?.textContent ?? '')
    .join(' ')
    .trim();

/** The single polite status region of the control: the announced count. */
export const liveRegion = (container: HTMLElement): HTMLElement | null =>
  container.querySelector<HTMLElement>('[role="status"][aria-live="polite"]');

/** The selection count the control announces, or '' when it has no region. */
export const announcedCount = (container: HTMLElement): string =>
  liveRegion(container)?.textContent ?? '';

/** The term ids of the value the control last emitted. */
export const emittedTermIds = (mounted: TaxonomyMounted): readonly string[] =>
  selectedTermIds(mounted.emitted() ?? null);

export const termCheckboxes = (
  container: HTMLElement,
): readonly HTMLInputElement[] =>
  Array.from(
    container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
  );

/** A real focus loss, as React's `onBlur` receives it. */
export const blurOut = async (element: HTMLElement): Promise<void> => {
  await act(async () => {
    element.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  });
};
