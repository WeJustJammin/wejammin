// @vitest-environment jsdom

/**
 * The lifecycle edges of the CONNECTED CMS-03C-17 taxonomy field (P2-S12-AC-135; FE03
 * "Network and retry contract" and the Slice 12 states): the real host and control, the real
 * selector read, and only the fetch boundary faked. Nothing here is mocked at module level.
 *
 * Three intended failures, each outside the frozen core cases:
 * 1. React.StrictMode's development remount aborts the first read from its effect cleanup,
 *    and the effect's "this key was already read" guard then suppresses the second setup, so
 *    the control never leaves its loading state and no term is ever offered;
 * 2. a same-scope refreshToken reload leaves the previously verified page's choices enabled
 *    while that reload is still in flight, so an unverified choice can be made;
 * 3. a 429 wait holds only the retry closed: Start again still dispatches a GET during the
 *    wait.
 */

import type { JsonValue } from '@wejammin/contracts';
import * as React from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { rateLimitMessage } from '../../lib/safe-read-retry';
import CmsFieldEditor from './CmsFieldEditor';
import {
  byLabel,
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  mountElement,
} from './cms-editor-dom.test-support';
import type { CmsFieldDescriptor } from './cms-field-descriptor';
import type { TaxonomyContextInput } from './cms-taxonomy-field-connection';
import {
  ENTRY_LOCALE,
  ENTRY_TYPE_KEY,
  LOAD_NEXT_LABEL,
  START_AGAIN_LABEL,
  TRY_AGAIN_LABEL,
  advanceTimers,
  decodedTaxonomyField,
  deferred,
  failureResponse,
  noticeContains,
  readQuery,
  recordingFetcher,
  servedPage,
  settle,
  termCheckboxes,
  termUid,
} from './cms-taxonomy-connected-fixtures.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

interface HostProps {
  readonly descriptor: CmsFieldDescriptor;
  readonly context?: TaxonomyContextInput | undefined;
  readonly value?: JsonValue | null | undefined;
  readonly onChange: (value: JsonValue | null) => void;
}

/** The stateful host of the real forms: it owns the value, so a read can never write one. */
const Host = ({
  descriptor,
  context,
  value,
  onChange,
}: HostProps): React.ReactElement => {
  const [current, setCurrent] = React.useState<JsonValue | null>(value ?? null);
  return (
    <CmsFieldEditor
      descriptor={descriptor}
      value={current}
      issues={[]}
      taxonomyContext={context}
      onChange={(next) => {
        setCurrent(next);
        onChange(next);
      }}
    />
  );
};

interface Mounted {
  readonly container: HTMLDivElement;
  readonly rerender: (next?: Partial<HostProps>) => void;
  readonly unmount: () => void;
  readonly onValue: ReturnType<typeof vi.fn<(value: JsonValue | null) => void>>;
}

interface MountOptions {
  /** Mounts inside React.StrictMode, whose development remount reruns every effect. */
  readonly strict?: boolean | undefined;
}

const renderHost = (props: HostProps, strict: boolean): React.ReactElement => {
  const host = (
    <Host
      descriptor={props.descriptor}
      context={props.context}
      value={props.value}
      onChange={props.onChange}
    />
  );
  return strict ? <React.StrictMode>{host}</React.StrictMode> : host;
};

const mountLifecycle = (
  over: Partial<HostProps> = {},
  options: MountOptions = {},
): Mounted => {
  const onValue = vi.fn<(value: JsonValue | null) => void>();
  const base: HostProps = {
    descriptor: over.descriptor ?? decodedTaxonomyField(),
    context: over.context,
    value: over.value ?? null,
    onChange: onValue,
  };
  const strict = options.strict === true;
  const mounted = mountElement(renderHost(base, strict));
  return {
    container: mounted.container,
    unmount: mounted.unmount,
    onValue,
    rerender: (next) =>
      mounted.rerender(renderHost({ ...base, ...next }, strict)),
  };
};

const contextFor = (
  fetcher: typeof fetch,
  refreshToken?: number,
): TaxonomyContextInput => ({
  typeKey: ENTRY_TYPE_KEY,
  locale: ENTRY_LOCALE,
  fetcher,
  ...(refreshToken === undefined ? {} : { refreshToken }),
});

describe('the connected taxonomy field under React.StrictMode', () => {
  it('[P2-S12-AC-135] offers the first page when the real control mounts inside React.StrictMode', async () => {
    const fd = recordingFetcher([
      servedPage({ items: [{ n: 1, label: 'Post-rock' }] }),
      servedPage({ items: [{ n: 1, label: 'Post-rock' }] }),
      servedPage({ items: [{ n: 1, label: 'Post-rock' }] }),
    ]);
    const mounted = mountLifecycle(
      { context: contextFor(fd.fetcher) },
      { strict: true },
    );
    await settle();
    expect(fd.calls.length).toBeGreaterThanOrEqual(1);
    expect(termCheckboxes(mounted.container)).toHaveLength(1);
    expect(
      byLabel<HTMLInputElement>(mounted.container, 'Post-rock').value,
    ).toBe(termUid(1));
  });
});

describe('the connected taxonomy field during a reload', () => {
  it('[P2-S12-AC-135] closes the retained choices while a same-scope reload is pending, and reopens them on success', async () => {
    const pending = deferred<Response>();
    const fd = recordingFetcher([
      servedPage({
        items: [
          { n: 1, label: 'Alpha' },
          { n: 2, label: 'Beta' },
        ],
      }),
      pending.promise,
    ]);
    const context = contextFor(fd.fetcher, 0);
    const mounted = mountLifecycle({
      context,
      value: { termIds: [termUid(2)] },
    });
    await settle();
    expect(byLabel<HTMLInputElement>(mounted.container, 'Beta').checked).toBe(
      true,
    );
    mounted.rerender({ context: contextFor(fd.fetcher, 1) });
    await settle();
    expect(fd.calls).toHaveLength(2);
    expect(readQuery(fd.calls, 1).has('cursor')).toBe(false);
    expect(termCheckboxes(mounted.container)).toHaveLength(2);
    for (const box of termCheckboxes(mounted.container))
      expect(box.disabled).toBe(true);
    expect(byLabel<HTMLInputElement>(mounted.container, 'Beta').checked).toBe(
      true,
    );
    expect(mounted.onValue).not.toHaveBeenCalled();
    await settle(() =>
      pending.resolve(
        servedPage({ items: [{ n: 3, label: 'Gamma' }], pageVersion: '9' }),
      ),
    );
    expect(termCheckboxes(mounted.container)).toHaveLength(1);
    expect(byLabel<HTMLInputElement>(mounted.container, 'Gamma').disabled).toBe(
      false,
    );
    expect(mounted.onValue).not.toHaveBeenCalled();
  });
});

describe('the connected taxonomy field during a 429 wait', () => {
  it('[P2-S12-AC-135] dispatches no read from any command during the wait, and lets a deliberate Start again through after it', async () => {
    vi.useFakeTimers();
    const fd = recordingFetcher([
      servedPage({
        items: [
          { n: 1, label: 'Alpha' },
          { n: 2, label: 'Beta' },
        ],
        nextCursor: 'cursor-one',
      }),
      failureResponse(429, { retryAfterSeconds: 30 }),
      servedPage({
        items: [
          { n: 1, label: 'Alpha' },
          { n: 2, label: 'Beta' },
        ],
        nextCursor: 'cursor-one',
        pageVersion: '9',
      }),
    ]);
    const mounted = mountLifecycle({ context: contextFor(fd.fetcher) });
    await settle();
    await click(buttonNamed(mounted.container, LOAD_NEXT_LABEL));
    await settle();
    expect(fd.calls).toHaveLength(2);
    expect(readQuery(fd.calls, 1).get('cursor')).toBe('cursor-one');
    expect(noticeContains(mounted.container, rateLimitMessage(30))).toBe(true);
    expect(termCheckboxes(mounted.container)).toHaveLength(2);
    await click(buttonNamed(mounted.container, TRY_AGAIN_LABEL));
    await click(buttonNamed(mounted.container, START_AGAIN_LABEL));
    await settle();
    expect(fd.calls).toHaveLength(2);
    await advanceTimers(29_000);
    await click(buttonNamed(mounted.container, TRY_AGAIN_LABEL));
    await click(buttonNamed(mounted.container, START_AGAIN_LABEL));
    await settle();
    expect(fd.calls).toHaveLength(2);
    await advanceTimers(1_000);
    await click(buttonNamed(mounted.container, START_AGAIN_LABEL));
    await settle();
    expect(fd.calls).toHaveLength(3);
    expect(readQuery(fd.calls, 2).has('cursor')).toBe(false);
    expect(termCheckboxes(mounted.container)).toHaveLength(2);
  });
});
