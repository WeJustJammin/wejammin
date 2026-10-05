// @vitest-environment jsdom

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ContentSchemaRegistryWorkbenchIsland from './ContentSchemaRegistryWorkbenchIsland';
import {
  createContentSchemaRegistryInvalidationHint,
  type ContentSchemaRegistryInvalidationChannel,
} from './content-schema-registry-invalidation';
import {
  approveDecision,
  APPROVE_A_ID,
  REVIEW_ID,
  reviewResource,
} from './content-schema-review-dec108.test-support';
import {
  islandMarkup,
  islandPropsFixture,
  mountView,
  settle,
  unmountMountedViews,
} from './content-schema-registry-island-refetch.test-support';

/**
 * FE03 review and dry-run state: cross-tab BroadcastChannel carries an
 * invalidation hint only, each tab performs its own protected canonical read of
 * the review route, and focus never moves on that refetch.
 */

const REVIEW_PATH = `/app/cms-content-modeling/schema-reviews/${REVIEW_ID}`;

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

const reviewState = (review: ReturnType<typeof reviewResource>) => ({
  status: 'success' as const,
  data: review,
  version: review.version,
  stale: false,
});

const reviewProps = () =>
  islandPropsFixture({
    variant: 'schemaReviewAssigned',
    access: 'read-only',
    contentTypeId: null,
    versionId: null,
    reviewId: REVIEW_ID,
    initialDetail: null,
    initialReview: reviewState(
      reviewResource({ permittedNextActions: ['record_decision'] }),
    ),
    expectedVersion: '3',
    canonicalUrl: REVIEW_PATH,
    retryUrl: REVIEW_PATH,
    canonicalRefetchUrl: REVIEW_PATH,
  });

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

describe('review route canonical refetch on invalidation', () => {
  it('[P2-S09-AC-1021] refetches the review with one protected GET, no body or mutation header, and keeps focus', async () => {
    const refreshed = reviewResource({
      version: '4',
      recordedDecisionCount: 1,
      distinctApprovalCount: 1,
      requiredDecisionCount: 2,
      decisions: [approveDecision(APPROVE_A_ID)],
      permittedNextActions: ['record_decision'],
    });
    const fetchStub = vi.fn(
      async () =>
        new Response(
          islandMarkup({
            state: 'ready',
            variant: 'schemaReviewAssigned',
            access: 'read-only',
            supportReference: 'r',
            reviewId: REVIEW_ID,
            initialList: { status: 'empty', reason: 'no-records' },
            initialDetail: null,
            initialReview: reviewState(refreshed),
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchStub);
    const view = mountView(
      <ContentSchemaRegistryWorkbenchIsland {...reviewProps()} />,
    );
    await settle();
    fetchStub.mockClear();
    const radio = view.container.querySelector<HTMLInputElement>(
      'input[name="decision"][value="approve"]',
    );
    expect(radio).not.toBeNull();
    radio?.focus();
    await act(async () => {
      channel.emit(createContentSchemaRegistryInvalidationHint());
      await new Promise((resolve) => setTimeout(resolve, 600));
    });
    await settle();
    const reads = fetchStub.mock.calls as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ][];
    expect(reads).toHaveLength(1);
    const [input, init] = reads[0] as [RequestInfo | URL, RequestInit];
    expect(String(input)).toContain(REVIEW_PATH);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(init?.body ?? null).toBeNull();
    const headers = new Headers(init?.headers);
    for (const name of ['idempotency-key', 'if-match', 'content-type'])
      expect(headers.has(name)).toBe(false);
    expect(view.container.textContent).toContain('Recorded decisions');
    expect(view.container.textContent).toMatch(/Recorded decisions\s*1/u);
    expect(document.activeElement).toBe(
      view.container.querySelector('input[name="decision"][value="approve"]'),
    );
  });

  it('[P2-S09-AC-1021] ignores a message that carries data instead of a bare hint', async () => {
    const fetchStub = vi.fn(async () => new Response('', { status: 500 }));
    vi.stubGlobal('fetch', fetchStub);
    mountView(<ContentSchemaRegistryWorkbenchIsland {...reviewProps()} />);
    await settle();
    fetchStub.mockClear();
    await act(async () => {
      channel.emit({
        type: 'content-schema-registry.invalidate',
        reviewId: REVIEW_ID,
      });
      await new Promise((resolve) => setTimeout(resolve, 600));
    });
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-1021] the version-detail route state (where the dry-run is read) refetches on a bare hint with one protected GET, no mutation header, and keeps focus', async () => {
    const props = islandPropsFixture({});
    const refreshedDetail = props.initialDetail;
    const fetchStub = vi.fn(
      async () =>
        new Response(
          islandMarkup({
            state: 'ready',
            variant: props.variant,
            access: props.access,
            supportReference: 'r',
            initialList: { status: 'empty', reason: 'no-records' },
            initialDetail: refreshedDetail,
            initialReview: null,
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchStub);
    const view = mountView(<ContentSchemaRegistryWorkbenchIsland {...props} />);
    await settle();
    fetchStub.mockClear();
    const focusTarget = view.container.querySelector<HTMLElement>(
      'form[data-operation-id="CMS-03A-02"] button[type="submit"]',
    );
    expect(focusTarget).not.toBeNull();
    focusTarget?.focus();
    const focused = document.activeElement;
    await act(async () => {
      channel.emit(createContentSchemaRegistryInvalidationHint());
      await new Promise((resolve) => setTimeout(resolve, 600));
    });
    await settle();
    const reads = fetchStub.mock.calls as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ][];
    expect(reads).toHaveLength(1);
    const [input, init] = reads[0] as [RequestInfo | URL, RequestInit];
    expect(String(input)).toContain(props.canonicalRefetchUrl);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(init?.body ?? null).toBeNull();
    const headers = new Headers(init?.headers);
    for (const name of ['idempotency-key', 'if-match', 'content-type'])
      expect(headers.has(name)).toBe(false);
    expect(document.activeElement).toBe(focused);
  });
});
