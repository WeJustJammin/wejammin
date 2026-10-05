// @vitest-environment jsdom

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { refetchContentSchemaRegistryCanonical } from './content-schema-registry-runtime-dom-refetch';
import {
  REVIEW_ID,
  reviewResource,
} from './content-schema-review-dec108.test-support';
import {
  requireRegion,
  renderDocument,
  reviewPageProps,
  WorkbenchUnderTest,
} from './content-schema-review-dec108-render.test-support';

/**
 * FE03 reviewState `loading`: an in-flight review read renders a skeleton for
 * the known layout with a polite live region, and keeps the last review facts.
 * The in-flight read is produced by the production canonical refetch of the
 * review route (not by a prop): the page is server-rendered with a review, a
 * read is started and held open, and the delayed loading presentation is
 * observed in the live document.
 */

const REVIEW_PATH = `/app/cms-content-modeling/schema-reviews/${REVIEW_ID}`;

const reviewMarkup = (): string =>
  renderToStaticMarkup(
    React.createElement(
      WorkbenchUnderTest,
      reviewPageProps(reviewResource(), {
        variant: 'schemaReviewAssigned',
        access: 'read-only',
      }),
    ),
  );

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('review read in flight (production canonical refetch)', () => {
  it('[P2-S09-AC-950] a read held open past 250 ms shows the skeleton, aria-busy and a polite live region over the kept review facts, and removes them when the read settles', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<main id="main">${reviewMarkup()}</main>`;
    const root = document.querySelector<HTMLElement>(
      '[data-workbench="content-schema-registry"]',
    );
    expect(root).not.toBeNull();
    // Nothing in flight yet: no skeleton, not busy.
    expect(document.querySelector('[data-cms-loading-skeleton]')).toBeNull();
    expect(root?.getAttribute('aria-busy')).toBeNull();

    let settle: ((response: Response) => void) | undefined;
    const held = new Promise<Response>((done) => {
      settle = done;
    });
    const fetcher = vi.fn<typeof fetch>(async () => held);
    vi.stubGlobal('fetch', fetcher);

    const refetch = refetchContentSchemaRegistryCanonical({
      document,
      canonicalUrl: REVIEW_PATH,
      reason: 'detail-read',
    });
    // Before the 250 ms delay nothing flashes.
    vi.advanceTimersByTime(249);
    expect(document.querySelector('[data-cms-loading-skeleton]')).toBeNull();
    vi.advanceTimersByTime(1);

    const skeleton = document.querySelector<HTMLElement>(
      '[data-cms-loading-skeleton]',
    );
    expect(skeleton).not.toBeNull();
    expect(skeleton?.className).toBe(
      'content-schema-registry-loading-skeleton',
    );
    expect(skeleton?.getAttribute('aria-hidden')).toBe('true');
    expect(skeleton?.parentElement).toBe(root);
    expect(root?.getAttribute('aria-busy')).toBe('true');
    const live = document.querySelector<HTMLElement>(
      '[data-cms-canonical-status]',
    );
    expect(live?.getAttribute('role')).toBe('status');
    expect(live?.getAttribute('aria-live')).toBe('polite');
    expect(live?.textContent).toBe('Loading current records.');
    // The last verified review facts stay in place while the read is open.
    expect(
      requireRegion(document as unknown as Document, /schema review/iu)
        .textContent,
    ).toContain('Required decisions');

    settle?.(
      new Response(`<html><body><main>${reviewMarkup()}</main></body></html>`, {
        status: 200,
      }),
    );
    await refetch;
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'GET' });
    expect(document.querySelector('[data-cms-loading-skeleton]')).toBeNull();
    expect(
      document
        .querySelector('[data-workbench="content-schema-registry"]')
        ?.getAttribute('aria-busy'),
    ).toBeNull();
  });
});

describe('review panel loading state markup', () => {
  it('[P2-S09-AC-950] the loading state renders the aria-hidden skeleton element and one polite, busy status naming the read, with no review facts', () => {
    const document_ = renderDocument(
      reviewPageProps(reviewResource(), {
        variant: 'schemaReviewAssigned',
        access: 'read-only',
        initialReview: { status: 'loading' },
      }),
    );
    const region = requireRegion(document_, /schema review/iu);
    const skeleton = region.querySelector(
      '.content-schema-registry-loading-skeleton',
    );
    expect(skeleton).not.toBeNull();
    expect(skeleton?.getAttribute('aria-hidden')).toBe('true');
    const status = region.querySelector('[role="status"]');
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.getAttribute('aria-busy')).toBe('true');
    expect(status?.textContent).toBe('Loading the review.');
    expect(region.querySelector('dl, form')).toBeNull();
  });
});
