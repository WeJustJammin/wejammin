import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CmsEditorialPreflightSummary from './CmsEditorialPreflightSummary';
import { preflightReportFixture } from './cms-workflow-fixtures.test-support';

const render = (
  results: readonly {
    category: string;
    outcome: string;
    reasonCode: string | null;
  }[],
  headingId = 'checks-title',
): string =>
  renderToStaticMarkup(
    <CmsEditorialPreflightSummary
      headingId={headingId}
      results={results as never}
    />,
  );

describe('CmsEditorialPreflightSummary (FE03 Slice 11 checks)', () => {
  it('lists all 17 categories in registry order as one semantic list', () => {
    const html = render(preflightReportFixture().results);
    expect(html.match(/<li/gu)).toHaveLength(17);
    expect(html).toContain('<ol');
    expect(html.indexOf('Content contract')).toBeLessThan(
      html.indexOf('Authority and availability'),
    );
    expect(html).toContain('aria-labelledby="checks-title"');
    expect(html).toContain('<h3 id="checks-title" tabindex="-1">Checks</h3>');
  });

  it('is a level-2 region heading inside the panel and level 3 inside a refusal', () => {
    const html = renderToStaticMarkup(
      <CmsEditorialPreflightSummary
        headingId="checks-title"
        headingLevel={2}
        results={preflightReportFixture().results}
      />,
    );
    expect(html).toContain('<h2 id="checks-title" tabindex="-1">Checks</h2>');
  });

  it('says outcome and reason in words and announces the counts politely', () => {
    const html = render(
      preflightReportFixture({
        contract: { outcome: 'failed', reasonCode: 'value_invalid' },
        accessibility: { outcome: 'unavailable', reasonCode: 'checker_failed' },
      }).results,
    );
    expect(html).toContain('15 of 17 checks passed, 1 failed, 1 unavailable.');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Failed');
    expect(html).toContain('A field value is invalid.');
    expect(html).toContain('Unavailable');
    expect(html).toContain(
      'This check could not run. It is a degraded check, not an error.',
    );
  });

  it('names an unbuilt provider as a not-yet-available area and offers no override', () => {
    const html = render(
      preflightReportFixture({
        media: { outcome: 'failed', reasonCode: 'provider_unbuilt_reference' },
      }).results,
    );
    expect(html).toContain(
      'Checks for this reference type are not available yet.',
    );
    expect(html).not.toMatch(/override|skip|ignore|publish anyway/iu);
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<a ');
  });

  it('never prints an unregistered token, a provider key or a count', () => {
    const html = render([
      {
        category: 'security',
        outcome: 'failed',
        reasonCode: 'raw_internal_token',
      },
    ]);
    expect(html).toContain('This check did not pass.');
    expect(html).not.toContain('raw_internal_token');
    expect(html).not.toContain('preflight.security');
  });

  it('reads a refusal list that holds only the checks that did not pass', () => {
    const html = render([
      { category: 'contract', outcome: 'failed', reasonCode: 'value_invalid' },
    ]);
    expect(html).toContain('0 of 1 check passed, 1 failed, 0 unavailable.');
  });
});
