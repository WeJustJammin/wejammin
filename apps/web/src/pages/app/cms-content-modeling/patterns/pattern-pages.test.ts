import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const read = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), 'utf8');

/*
 * The pattern pages are a tested loader plus a tested island
 * (`load-pattern-designer-page.test.ts`, `CmsPatternVersionDesigner*.test.tsx`); this
 * suite reads each Astro file for the response invariants no other test can.
 */
describe.each([
  ['new.astro', 'patternKey: null'],
  ['[patternKey].astro', 'patternKey: Astro.params.patternKey'],
])('%s', (name, keyArgument) => {
  const source = read(name);

  it('renders on demand with no-store headers and answers only GET', () => {
    expect(source).toContain('export const prerender = false');
    expect(source).toContain(
      "Astro.response.headers.set('Cache-Control', 'no-store')",
    );
    expect(source).toContain("Astro.request.method !== 'GET'");
    expect(source).toContain("allow: 'GET'");
  });

  it('delegates to the loader with the page request and the server binding only', () => {
    expect(source).toContain('loadPatternDesignerPage');
    expect(source).toContain(keyArgument);
    expect(source).toContain(
      'createPatternDesignerPageReads(env.PLATFORM_API)',
    );
    expect(source).not.toContain('service_role');
  });

  it('redirects an expired session with a 303 and takes its status from the loader', () => {
    expect(source).toContain(
      "if (outcome.kind === 'redirect') return cmsRedirectResponse(outcome.location)",
    );
    expect(source).toContain(
      "outcome.kind === 'view' ? outcome.status : outcome.notice.status",
    );
  });

  it('hydrates the designer only from a verified view and shows a closed notice otherwise', () => {
    expect(source).toMatch(/outcome\.kind === 'view' \?/u);
    expect(source).toContain('<CmsPatternVersionDesigner');
    expect(source).toContain('client:load');
    expect(source).toContain(
      '<CmsEditorialPageNotice notice={outcome.notice} />',
    );
  });

  it('passes the island the selectors and the CSRF token, never the whole page request', () => {
    expect(source).toContain('context={outcome.view.context}');
    expect(source).toContain('csrfToken={outcome.view.csrfToken}');
    expect(source).not.toContain('Astro.request.headers');
  });
});

describe('the new-pattern page', () => {
  it('starts without a saved version', () => {
    expect(read('new.astro')).toContain('latest={null}');
  });
});

describe('the saved-pattern page', () => {
  it('prefills from the verified latest version', () => {
    expect(read('[patternKey].astro')).toContain(
      'latest={outcome.view.latest}',
    );
  });
});
