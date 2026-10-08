import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CmsEditorialPageNotice from './CmsEditorialPageNotice';

describe('CmsEditorialPageNotice', () => {
  it('renders the fixed sentence, the retry link and the support reference', () => {
    const html = renderToStaticMarkup(
      <CmsEditorialPageNotice
        notice={{
          status: 503,
          title: 'Temporarily unavailable',
          heading: 'Temporarily unavailable',
          message: 'Nothing was loaded; try again shortly.',
          retryHref: '/app/cms-content-modeling/entries',
          requestId: '018f0c45-73fe-7dc2-9c09-68f7ecf132e9',
        }}
      />,
    );
    expect(html).toContain('Nothing was loaded; try again shortly.');
    expect(html).toContain(
      '<a href="/app/cms-content-modeling/entries">Try again</a>',
    );
    expect(html).toContain(
      'Reference: <code>018f0c45-73fe-7dc2-9c09-68f7ecf132e9</code>',
    );
    expect(html).not.toContain('<h1');
  });

  it('omits the retry link and reference when there are none', () => {
    const html = renderToStaticMarkup(
      <CmsEditorialPageNotice
        notice={{
          status: 404,
          title: 'Not found',
          heading: 'Not found',
          message: 'This entry is not available.',
          retryHref: null,
          requestId: null,
        }}
      />,
    );
    expect(html).toContain('This entry is not available.');
    expect(html).not.toContain('Try again');
    expect(html).not.toContain('Reference');
  });

  it('names the way back as a restart when the list position is stale', () => {
    const html = renderToStaticMarkup(
      <CmsEditorialPageNotice
        notice={{
          status: 409,
          title: 'List position is no longer valid',
          heading: 'List position is no longer valid',
          message: 'This position can no longer be reopened.',
          retryHref: '/app/cms-content-modeling/entries',
          requestId: null,
        }}
      />,
    );
    expect(html).toContain('Start from the first page</a>');
    expect(html).not.toContain('Try again');
  });
});
