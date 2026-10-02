import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CmsTemplateDesigner from './CmsTemplateDesigner';

const context = {
  contentTypes: [
    {
      id: '018f0c45-73fe-7dc2-9c09-68f7ecf132da',
      typeKey: 'release_note',
      activeVersionId: '018f0c45-73fe-7dc2-9c09-68f7ecf132db',
      activeVersion: 2,
      sourceLocale: 'en-US',
    },
  ],
  registeredBlocks: [{ blockKey: 'hero.banner', blockVersion: 2 }],
};

describe('CMS-11 template designer shell', () => {
  it('renders a native form with protected selectors and no privileged evidence fields', () => {
    const html = renderToStaticMarkup(
      <CmsTemplateDesigner context={context} csrfToken="csrf-token" />,
    );
    expect(html).toContain('<form');
    expect(html).toContain('Define template draft');
    expect(html).toContain('release_note');
    expect(html).toContain('hero.banner');
    expect(html).toContain('Add slot');
    expect(html).toContain('Add binding');
    expect(html).toContain('header');
    expect(html).toContain('provenance');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain('service_role');
    expect(html).not.toContain('approvalEvidenceHash');
  });

  it('disables submission when a selector or CSRF prerequisite is absent', () => {
    const noTypes = renderToStaticMarkup(
      <CmsTemplateDesigner
        context={{ ...context, contentTypes: [] }}
        csrfToken="csrf-token"
      />,
    );
    expect(noTypes).toContain('No active content types are available');
    expect(noTypes).toMatch(/<button[^>]+disabled=""[^>]*>Create draft/u);

    const noCsrf = renderToStaticMarkup(
      <CmsTemplateDesigner context={context} csrfToken="" />,
    );
    expect(noCsrf).toContain('Reload to restore the protected form session');
    expect(noCsrf).toMatch(/<button[^>]+disabled=""[^>]*>Create draft/u);
  });
});
