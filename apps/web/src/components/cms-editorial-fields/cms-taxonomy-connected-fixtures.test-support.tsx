import type { JsonValue } from '@wejammin/contracts';
import * as React from 'react';
import { act } from 'react';
import { vi } from 'vitest';

import CmsFieldEditor from './CmsFieldEditor';
import { mountElement } from './cms-editor-dom.test-support';
import type { CmsFieldDescriptor } from './cms-field-descriptor';
import { describeCmsAuthoringFields } from './cms-field-descriptor-decode';
import { authoringField, fieldUuid } from './cms-field-fixtures.test-support';
import type { CmsFieldIssue } from './cms-field-issue';
import { isJsonRecord } from './cms-field-value-structured';
import type { TaxonomyContextInput as ProductionTaxonomyContext } from './cms-taxonomy-field-connection';

/*
 * Fixtures, the fetch boundary and the stateful host of the CONNECTED CMS-03C-17 taxonomy field
 * selector: CmsFieldEditor with the planned optional taxonomyContext prop
 * (`{ typeKey, locale, fetcher?, refreshToken? }`), as CMS-03B-01/10/11 consumes it; P2-S12-AC-135;
 * FE03 "Slice 12 governed definition, composition, taxonomy, locale and related-content surfaces";
 * BE03c CMS-03C-17. Only fetch is replaced, through the injected taxonomyContext.fetcher.
 *
 * CONNECTED_COPY is the exact fixed copy of each read state, never taken from a response, and every
 * reader, page verification and global-fetch fallback in this file stays real.
 */

/** The one path CMS-03C-17 is served on (BE03c Route Registry). */
export const SELECTOR_PATH = '/api/v1/cms/taxonomies/selector';

/** The page size the contract defaults to (BE03c: default 50, maximum 100). */
export const SELECTOR_LIMIT = 50;

export const TAXONOMY_FIELD_KEY = 'topics';

export const ENTRY_TYPE_KEY = 'article';
export const ENTRY_LOCALE = 'en-US';

/** The exact fixed copy of each read state. */
export const CONNECTED_COPY = {
  /** No taxonomyContext: the typed unavailable notice CmsUnavailableField shows. */
  noContext:
    'Taxonomy terms cannot be set yet: the taxonomy source is not available.',
  /** The Slice 12 no-records copy: no active vocabulary lists this field. */
  empty: 'No vocabulary lists this field',
  signedOut:
    'Your session ended, so these terms cannot be loaded. Sign in again to continue.',
  forbidden: 'You do not have access to these terms.',
  notFound: 'This vocabulary is not available to this account.',
  degraded:
    'These terms could not be loaded right now. Your selection is kept. Try again.',
} as const;

/** The text a first read announces itself in while its page is in flight. */
export const LOADING_PATTERN = /Loading/u;

/** The three commands the connected selector offers, all native buttons. */
export const LOAD_NEXT_LABEL = 'Load next terms';
export const START_AGAIN_LABEL = 'Start again';
export const TRY_AGAIN_LABEL = 'Try again';

/** Distinct contract-valid ids: one lineage, one version, one id per term. */
export const TAXONOMY_LINEAGE_ID = fieldUuid(600);
export const TAXONOMY_VERSION_ID = fieldUuid(601);
export const ERROR_REQUEST_ID = fieldUuid(999);
export const termUid = (n: number): string => fieldUuid(700 + n);

export interface TermSpec {
  readonly n: number;
  /** null is the contract's "no label for this locale": the key shows instead. */
  readonly label?: string | null;
}

const termRow = (spec: TermSpec): Readonly<Record<string, unknown>> => ({
  taxonomyId: TAXONOMY_LINEAGE_ID,
  taxonomyVersionId: TAXONOMY_VERSION_ID,
  taxonomyKey: TAXONOMY_FIELD_KEY,
  shape: 'flat',
  termId: termUid(spec.n),
  termKey: 'term-' + String(spec.n),
  parentId: null,
  label: spec.label === undefined ? 'Term ' + String(spec.n) : spec.label,
});

export interface PageSpec {
  readonly items?: readonly TermSpec[];
  readonly nextCursor?: string | null;
  readonly pageVersion?: string;
}

/** A 200 relay of one strict page: quoted page-version ETag and Cache-Control: no-store. */
export const servedPage = ({
  items = [{ n: 1 }, { n: 2 }],
  nextCursor = null,
  pageVersion = '7',
}: PageSpec = {}): Response =>
  new Response(
    JSON.stringify({ items: items.map(termRow), nextCursor, pageVersion }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        etag: '"' + pageVersion + '"',
      },
    },
  );

const ERROR_CODE: Readonly<Record<number, string>> = {
  401: 'UNAUTHENTICATED',
  403: 'TAXONOMY_FORBIDDEN',
  404: 'TAXONOMY_NOT_FOUND',
  429: 'RATE_LIMITED',
};

export interface FailureSpec {
  /** A 429's stated wait, sent as both Retry-After and details.retryAfterSeconds. */
  readonly retryAfterSeconds?: number;
}

/** A typed ApiError refusal of a read, with no usable page. */
export const failureResponse = (
  status: number,
  { retryAfterSeconds }: FailureSpec = {},
): Response =>
  new Response(
    JSON.stringify({
      code: ERROR_CODE[status] ?? 'DEPENDENCY_UNAVAILABLE',
      message: 'Refused without disclosing a provider detail.',
      requestId: ERROR_REQUEST_ID,
      details: retryAfterSeconds === undefined ? {} : { retryAfterSeconds },
    }),
    {
      status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        ...(retryAfterSeconds === undefined
          ? {}
          : { 'retry-after': String(retryAfterSeconds) }),
      },
    },
  );

export interface RecordedRead {
  readonly url: string;
  readonly method: string | undefined;
  readonly credentials: RequestCredentials | undefined;
  readonly cache: RequestCache | undefined;
  readonly signal: AbortSignal | null;
}

export interface RecordingFetcher {
  readonly fetcher: typeof fetch;
  readonly calls: RecordedRead[];
}

const hrefOf = (input: RequestInfo | URL): string =>
  input instanceof Request
    ? input.url
    : input instanceof URL
      ? input.href
      : input;

/** The browser boundary: exactly one queued answer per read, taken in order. */
export const recordingFetcher = (
  answers: readonly (Response | Error | Promise<Response>)[],
): RecordingFetcher => {
  const calls: RecordedRead[] = [];
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const answer = answers[calls.length];
    calls.push({
      url: hrefOf(input),
      method: init?.method,
      credentials: init?.credentials,
      cache: init?.cache,
      signal: init?.signal ?? null,
    });
    if (answer === undefined)
      throw new Error('unexpected read ' + String(calls.length - 1));
    if (answer instanceof Error) throw answer;
    return await answer;
  });
  return { fetcher, calls };
};

export interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason?: unknown) => void;
}

/** An answer the test releases by hand, to pin what a late result may change. */
export const deferred = <T,>(): Deferred<T> => {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((settle, fail) => {
    resolve = settle;
    reject = fail;
  });
  return { promise, resolve, reject };
};

const address = (calls: readonly RecordedRead[], index: number): URL =>
  new URL(calls[index]?.url ?? '/', 'https://wejammin.test');

export const readPath = (
  calls: readonly RecordedRead[],
  index: number,
): string => address(calls, index).pathname;

export const readQuery = (
  calls: readonly RecordedRead[],
  index: number,
): URLSearchParams => address(calls, index).searchParams;

/** Every query key a read sent, so a test can prove no other key was appended. */
export const readQueryKeys = (
  calls: readonly RecordedRead[],
  index: number,
): readonly string[] => [...readQuery(calls, index).keys()];

/** The descriptor the real CMS-03B-14 decode yields for a taxonomy field. */
export const decodedTaxonomyField = (
  over: { readonly key?: string; readonly label?: string } = {},
): CmsFieldDescriptor => {
  const [descriptor] = describeCmsAuthoringFields([
    authoringField({
      n: 13,
      key: over.key ?? TAXONOMY_FIELD_KEY,
      kind: 'taxonomy',
      label: over.label ?? 'Topics',
    }),
  ]);
  if (descriptor === undefined)
    throw new Error('the decode yielded no taxonomy descriptor');
  return descriptor;
};

/** The planned optional prop: the read scope the host owns and the injected boundary. */
export interface TaxonomyContextInput extends ProductionTaxonomyContext {
  readonly typeKey: string;
  readonly locale: string;
  readonly fetcher?: typeof fetch;
  readonly refreshToken?: number;
}

export interface ConnectedTaxonomyOptions {
  readonly descriptor?: CmsFieldDescriptor;
  readonly context?: TaxonomyContextInput | undefined;
  readonly value?: JsonValue | null;
  readonly issues?: readonly CmsFieldIssue[];
  readonly disabled?: boolean;
}

interface HostProps extends ConnectedTaxonomyOptions {
  readonly onValue: (value: JsonValue | null) => void;
}

/**
 * The stateful host of the real forms: it owns the value, so a read can never write one,
 * and an edit flows back into value exactly as CMS-03B-01/10/11 wire it.
 */
const ConnectedTaxonomyHost = ({
  descriptor,
  context,
  value: initial,
  issues,
  disabled,
  onValue,
}: HostProps): React.ReactElement => {
  const [value, setValue] = React.useState<JsonValue | null>(initial ?? null);
  return (
    <CmsFieldEditor
      descriptor={descriptor ?? decodedTaxonomyField()}
      value={value}
      issues={issues ?? []}
      disabled={disabled}
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
      taxonomyContext={context}
    />
  );
};

export interface ConnectedMounted {
  readonly container: HTMLDivElement;
  readonly unmount: () => void;
  /** Re-renders the same host with new props; the value it holds stays the host's. */
  readonly rerender: (over?: ConnectedTaxonomyOptions) => void;
  readonly onValue: ReturnType<typeof vi.fn<(value: JsonValue | null) => void>>;
  readonly emitted: () => JsonValue | null | undefined;
  readonly emittedIds: () => readonly string[];
  /** The value the host holds right now: the last accepted edit, else the mount value. */
  readonly currentValue: () => JsonValue | null;
}

export const mountConnectedTaxonomy = (
  over: ConnectedTaxonomyOptions = {},
): ConnectedMounted => {
  const onValue = vi.fn<(value: JsonValue | null) => void>();
  const base: HostProps = { ...over, onValue };
  const mounted = mountElement(<ConnectedTaxonomyHost {...base} />);
  return {
    container: mounted.container,
    unmount: mounted.unmount,
    onValue,
    currentValue: () => onValue.mock.calls.at(-1)?.[0] ?? over.value ?? null,
    rerender: (next = {}) =>
      mounted.rerender(<ConnectedTaxonomyHost {...base} {...next} />),
    emitted: () => onValue.mock.calls.at(-1)?.[0],
    emittedIds: () => selectedTermIds(onValue.mock.calls.at(-1)?.[0] ?? null),
  };
};

/** The ids a written value carries, ignoring anything that is not a string. */
export const selectedTermIds = (value: JsonValue | null): readonly string[] => {
  if (!isJsonRecord(value)) return [];
  const ids: unknown = value.termIds;
  return Array.isArray(ids)
    ? ids.filter((id): id is string => typeof id === 'string')
    : [];
};

/** The own keys of a written value: a write is exactly { termIds }, no more. */
export const writeKeys = (
  value: JsonValue | null | undefined,
): readonly string[] => (isJsonRecord(value) ? Object.keys(value) : []);

export const termCheckboxes = (
  container: HTMLElement,
): readonly HTMLInputElement[] =>
  Array.from(
    container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
  );

/** The text of every term label: the accessible name of each term checkbox. */
export const labelTexts = (container: HTMLElement): readonly string[] =>
  Array.from(container.querySelectorAll('li label')).map((label) =>
    (label.textContent ?? '').trim(),
  );

const liveRegions = (container: HTMLElement): readonly HTMLElement[] =>
  Array.from(
    container.querySelectorAll<HTMLElement>('[role="status"], [role="alert"]'),
  );

/** Whether a live region announces a state's fixed copy. */
export const noticeContains = (container: HTMLElement, copy: string): boolean =>
  liveRegions(container).some((region) =>
    (region.textContent ?? '').includes(copy),
  );

export const noticeMatches = (
  container: HTMLElement,
  pattern: RegExp,
): boolean =>
  liveRegions(container).some((region) =>
    pattern.test(region.textContent ?? ''),
  );

/** The announced selection count, whole: an off-page id still counts. */
export const announcedCount = (container: HTMLElement): string =>
  Array.from(
    container.querySelectorAll<HTMLElement>(
      '[role="status"][aria-live="polite"]',
    ),
  )
    .map((region) => region.textContent ?? '')
    .find((text) => /terms? selected/u.test(text)) ?? '';

export const signInHref = (container: HTMLElement): string | null =>
  container
    .querySelector<HTMLAnchorElement>('a[href^="/auth/sign-in"]')
    ?.getAttribute('href') ?? null;

/** Whether a button with that exact accessible name is offered. */
export const hasButton = (container: HTMLElement, name: string): boolean =>
  Array.from(container.querySelectorAll('button')).some(
    (button) =>
      (button.getAttribute('aria-label') ?? button.textContent ?? '').trim() ===
      name,
  );

/** Settle microtasks inside act: a released answer, applied the way React does. */
export const settle = async (work?: () => void): Promise<void> => {
  await act(async () => {
    work?.();
    for (let index = 0; index < 20; index += 1) await Promise.resolve();
  });
};

/** Advance fake timers inside act, then settle. */
export const advanceTimers = async (milliseconds: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
    for (let index = 0; index < 20; index += 1) await Promise.resolve();
  });
};
