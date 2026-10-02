// @vitest-environment jsdom

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import ContentSchemaRegistryDetail from './ContentSchemaRegistryDetail';
import { draftDetail } from './content-schema-review-dec108.test-support';
import { successDetail } from './content-schema-review-dec108-render.test-support';

/**
 * FE03: a draft's locale configuration is read-only in the protected detail,
 * as the list of languages and, per target, "{target}: {a} → {b} → {default}".
 */

const render = (overrides: Record<string, unknown>): string =>
  renderToStaticMarkup(
    React.createElement(ContentSchemaRegistryDetail, {
      state: successDetail(draftDetail(undefined, overrides)),
      backUrl: '/app/cms-content-modeling',
      retryUrl: '/app/cms-content-modeling',
      supportReference: 'support-1',
    }),
  );

describe('protected detail locale configuration', () => {
  it('[P2-S09-AC-1239] [P2-S09-AC-1238] [P2-S09-AC-1232] lists the languages, source, default and each fallback order', () => {
    const markup = render({
      supportedLocales: ['en-US', 'fr', 'fr-CA'],
      fallbackChains: { fr: ['en-US'], 'fr-CA': ['fr', 'en-US'] },
      sourceLocale: 'en-US',
      defaultLocale: 'en-US',
    });
    expect(markup).toContain('Languages');
    expect(markup).toContain('Source language');
    expect(markup).toContain('Default language');
    expect(markup).toContain('fr: en-US');
    expect(markup).toContain('fr-CA: fr → en-US');
    expect(markup).not.toContain('<input');
    expect(markup).not.toContain('<button');
    expect(markup).toContain('Locale configuration hash');
  });

  it('says so when the type has a single language', () => {
    const markup = render({
      supportedLocales: ['en-US'],
      fallbackChains: {},
    });
    expect(markup).toContain(
      'No fallback orders: this version has one language.',
    );
  });
});

describe('review frozen evidence locale configuration', () => {
  it('[P2-S09-AC-1238] [P2-S09-AC-1232] shows the frozen locale configuration hash beside the definition hash', async () => {
    const { default: ReviewFacts } =
      await import('./ContentSchemaRegistryReviewFacts');
    const { reviewResource } =
      await import('./content-schema-review-dec108.test-support');
    const review = reviewResource();
    const markup = renderToStaticMarkup(
      React.createElement(ReviewFacts, { review }),
    );
    expect(markup).toContain('Locale configuration hash');
    expect(markup).toContain(review.frozenEvidence.localeConfigHash);
  });
});
