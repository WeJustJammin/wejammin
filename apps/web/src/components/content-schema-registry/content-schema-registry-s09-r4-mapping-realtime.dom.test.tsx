// @vitest-environment jsdom

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ContentSchemaRegistryWorkbenchIsland from './ContentSchemaRegistryWorkbenchIsland';
import {
  createContentSchemaRegistryInvalidationHint,
  subscribeContentSchemaRegistryInvalidation,
  type ContentSchemaRegistryInvalidationChannel,
} from './content-schema-registry-invalidation';
import {
  DETAIL,
  islandMarkup,
  islandPropsFixture,
  mountView,
  settle,
  unmountMountedViews,
} from './content-schema-registry-island-refetch.test-support';
import {
  approvedReviewPreparation,
  passedDryRunPreparation,
  startDryRunPreparation,
} from './content-schema-registry-activation-preparation.test-support';
import {
  approvedProtectedReview,
  draftDetail,
} from './content-schema-review-dec108.test-support';
import {
  renderDocument,
  reviewSuccess,
  successDetail,
  versionPageProps,
} from './content-schema-review-dec108-render.test-support';

/**
 * FE03 realtime, ETag and idempotency UI behavior: the only cross-tab message
 * is a bare invalidation hint that triggers the receiver's own protected read;
 * commands carry the strong ETag of the version they were rendered for and an
 * idempotency key that is stable per operation.
 */

class FakeChannel implements ContentSchemaRegistryInvalidationChannel {
  readonly posted: unknown[] = [];
  private listener: ((event: { readonly data: unknown }) => void) | null = null;
  postMessage(message: unknown): void {
    this.posted.push(message);
  }
  addEventListener(
    _type: 'message',
    listener: (event: { readonly data: unknown }) => void,
  ): void {
    this.listener = listener;
  }
  removeEventListener(): void {
    this.listener = null;
  }
  close(): void {}
  emit(data: unknown): void {
    this.listener?.({ data });
  }
}

let channel: FakeChannel;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  channel = new FakeChannel();
  vi.stubGlobal(
    'BroadcastChannel',
    class {
      constructor() {
        return channel;
      }
    },
  );
});

afterEach(() => {
  unmountMountedViews();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const REFRESHED_LABEL = 'Label from the canonical read';
const bodyFor = (label: string | null): string =>
  islandMarkup({
    state: 'ready',
    variant: 'ownerFull',
    access: 'full',
    supportReference: 'r',
    initialList: { status: 'empty', reason: 'no-records' },
    initialDetail: {
      status: 'success',
      data: {
        ...DETAIL,
        resource:
          label === null ? DETAIL.resource : { ...DETAIL.resource, label },
      },
      version: '1',
      stale: false,
    },
    initialReview: null,
  });

describe('invalidation-only realtime', () => {
  it('[P2-S09-AC-264] a bare hint calls the refetch with no argument and every data-bearing or malformed message is ignored', () => {
    const calls: unknown[][] = [];
    const subscription = subscribeContentSchemaRegistryInvalidation({
      channel,
      onInvalidate: (...args: unknown[]) => {
        calls.push(args);
      },
    });
    for (const message of [
      { type: 'content-schema-registry.invalidate', versionId: 'v' },
      { type: 'content-schema-registry.invalidate', label: 'INJECTED' },
      { type: 'something-else' },
      'content-schema-registry.invalidate',
      null,
      [],
      { type: 'content-schema-registry.invalidate', rows: [1, 2, 3] },
    ])
      channel.emit(message);
    expect(calls).toHaveLength(0);
    channel.emit(createContentSchemaRegistryInvalidationHint());
    expect(calls).toStrictEqual([[]]);
    subscription.unsubscribe();
  });

  it('[P2-S09-AC-264] the hint triggers one protected GET and the refreshed page comes from that response, never from the message', async () => {
    // The island's own mount read answers with the current label; every later
    // read answers with a new one.
    let reads = 0;
    const fetchStub = vi.fn(async () => {
      reads += 1;
      return new Response(bodyFor(reads === 1 ? null : REFRESHED_LABEL), {
        status: 200,
      });
    });
    vi.stubGlobal('fetch', fetchStub);
    const view = mountView(
      <ContentSchemaRegistryWorkbenchIsland {...islandPropsFixture()} />,
    );
    await settle();
    fetchStub.mockClear();
    expect(view.container.textContent).not.toContain(REFRESHED_LABEL);
    await act(async () => {
      channel.emit({
        type: 'content-schema-registry.invalidate',
        label: 'INJECTED',
      });
      await new Promise((resolve) => setTimeout(resolve, 600));
    });
    expect(fetchStub).not.toHaveBeenCalled();
    expect(view.container.textContent).not.toContain('INJECTED');
    await act(async () => {
      channel.emit(createContentSchemaRegistryInvalidationHint());
      await new Promise((resolve) => setTimeout(resolve, 600));
    });
    await settle();
    expect(fetchStub).toHaveBeenCalledTimes(1);
    const [, init] = fetchStub.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(init.method ?? 'GET').toBe('GET');
    expect(init.body ?? null).toBeNull();
    const headers = new Headers(init.headers);
    for (const name of ['idempotency-key', 'if-match', 'content-type'])
      expect(headers.has(name)).toBe(false);
    expect(view.container.textContent).toContain(REFRESHED_LABEL);
    expect(view.container.textContent).not.toContain('INJECTED');
  });
});

describe('ETag and idempotency on the rendered commands', () => {
  const docs = () =>
    [
      [
        'CMS-03A-02',
        renderDocument(
          versionPageProps({
            initialDetail: successDetail(
              draftDetail(approvedReviewPreparation),
            ),
            initialReview: reviewSuccess(approvedProtectedReview()),
          }),
        ),
      ],
      [
        'CMS-03A-10',
        renderDocument(
          versionPageProps({
            initialDetail: successDetail(draftDetail(startDryRunPreparation)),
          }),
        ),
      ],
      [
        'CMS-03A-11',
        renderDocument(
          versionPageProps({
            initialDetail: successDetail(draftDetail(passedDryRunPreparation)),
          }),
        ),
      ],
    ] as const;

  it('[P2-S09-AC-264] each command carries the strong ETag of the rendered version and, where the schema has it, the same expectedVersion', () => {
    for (const [operationId, doc] of docs()) {
      const form = doc.querySelector<HTMLFormElement>(
        `form[data-operation-id="${operationId}"]`,
      )!;
      const ifMatch = (form.elements.namedItem('if-match') as HTMLInputElement)
        .value;
      expect(ifMatch).toMatch(/^"[1-9][0-9]*"$/u);
      const expected = form.elements.namedItem(
        'expectedVersion',
      ) as HTMLInputElement | null;
      if (expected !== null) expect(`"${expected.value}"`).toBe(ifMatch);
    }
  });

  it('[P2-S09-AC-264] each command has its own idempotency key, stable across a re-render of the same state', () => {
    const keys = (): string[] =>
      docs().map(
        ([operationId, doc]) =>
          (
            doc
              .querySelector<HTMLFormElement>(
                `form[data-operation-id="${operationId}"]`,
              )!
              .elements.namedItem('idempotency-key') as HTMLInputElement
          ).value,
      );
    const first = keys();
    expect(new Set(first).size).toBe(first.length);
    for (const key of first) expect(key.length).toBeGreaterThanOrEqual(8);
    expect(keys()).toStrictEqual(first);
  });
});
