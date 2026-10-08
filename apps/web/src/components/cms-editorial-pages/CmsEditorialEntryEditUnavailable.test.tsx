import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CmsEditorialEntryEditUnavailable from './CmsEditorialEntryEditUnavailable';

describe('CmsEditorialEntryEditUnavailable', () => {
  it('states the reason and the verified facts, with ways back, and renders no value', () => {
    const html = renderToStaticMarkup(
      <CmsEditorialEntryEditUnavailable
        view={{
          kind: 'unavailable',
          facts: {
            lifecycle: 'active',
            state: 'draft',
            locale: 'en-US',
            validationState: 'valid',
            revisionNumber: '2',
          },
          message: 'This draft cannot be edited here.',
          retryHref: '/app/cms-content-modeling/entries/x',
          historyHref: '/app/cms-content-modeling/entries/x/revisions',
        }}
      />,
    );
    expect(html).toContain('Editing is unavailable');
    expect(html).toContain('This draft cannot be edited here.');
    expect(html).toContain('<dd>active</dd>');
    expect(html).toContain(
      '<a href="/app/cms-content-modeling/entries/x">Try again</a>',
    );
    expect(html).toContain('/app/cms-content-modeling/entries/x/revisions');
    expect(html).not.toContain('<input');
  });
});
