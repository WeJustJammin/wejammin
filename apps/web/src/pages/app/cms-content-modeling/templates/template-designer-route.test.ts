import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./new.astro', import.meta.url)),
  'utf8',
);
const editSource = readFileSync(
  fileURLToPath(new URL('./[templateKey].astro', import.meta.url)),
  'utf8',
);

describe('CMS-11 protected template designer page', () => {
  it('renders on demand with no-store headers and a navigable focus target', () => {
    expect(source).toContain('export const prerender = false');
    expect(source).toContain(
      "Astro.response.headers.set('Cache-Control', 'no-store')",
    );
    expect(source).toContain('lang="en"');
    expect(source).toContain('id="page-title"');
    expect(source).toContain('tabindex="-1"');
    expect(source).toContain('aria-label="Skip navigation"');
    expect(source).toContain('route-heading-focus.ts');
  });

  it('loads only the protected selector context and gates the hydrated form', () => {
    expect(source).toContain('readCmsTemplateContext');
    expect(source).toContain('env.PLATFORM_API');
    expect(source).toContain('TemplateDesignerContextSchema.safeParse');
    expect(source).toContain('cmsEditorialCsrfCookie');
    expect(source).toContain('context !== null ?');
    expect(source).toContain('client:load');
    expect(source).not.toContain('service_role');
    expect(source).not.toContain('approvalEvidenceHash');
  });

  it('redirects an expired session and never turns denial/degradation into a form', () => {
    expect(source).toContain('selector.status === 401');
    expect(source).toContain('Astro.redirect');
    expect(source).toContain(
      'Astro.response.status = selector.ok ? 502 : selector.status',
    );
    expect(source).toContain('context === null ?');
  });
});

describe('CMS-11 protected template successor page', () => {
  it('loads canonical detail and selectors before hydrating the edit form', () => {
    expect(editSource).toContain('export const prerender = false');
    expect(editSource).toContain(
      "Astro.response.headers.set('Cache-Control', 'no-store')",
    );
    expect(editSource).toContain('readCmsTemplateDetail');
    expect(editSource).toContain('readCmsTemplateContext');
    expect(editSource).toContain('TemplateVersionDetailSchema.safeParse');
    expect(editSource).toContain('CmsTemplateEditDesigner');
    expect(editSource).toContain('detail !== null && context !== null');
    expect(editSource).toContain('client:load');
    expect(editSource).not.toContain('service_role');
  });
});
