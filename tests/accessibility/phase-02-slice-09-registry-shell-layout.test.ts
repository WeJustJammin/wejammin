import { readFileSync } from 'node:fs';

import { beforeAll, describe, expect, it } from 'vitest';

const CSS_URL = new URL(
  '../../apps/web/src/components/content-schema-registry/content-schema-registry.css',
  import.meta.url,
);

let css = '';
beforeAll(() => {
  css = readFileSync(CSS_URL, 'utf8');
});

const block = (query: string): string => {
  const start = css.indexOf(query);
  expect(start, `${query} block`).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let index = css.indexOf('{', start); index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(start, index + 1);
    }
  }
  return css.slice(start);
};

describe('[P2-S09-AC-245] [P2-S09-AC-246] the route stylesheet declares the shell, sidebar and rail layout', () => {
  it('hides the sidebar on mobile and shows it beside the grid from 769 px', () => {
    expect(css).toMatch(
      /\.content-schema-registry-sidebar\s*\{[^}]*display:\s*none/u,
    );
    const tablet = block('@media (min-width: 48.0625rem)');
    expect(tablet).toMatch(
      /\.content-schema-registry-shell\s*\{[^}]*display:\s*grid/u,
    );
    expect(tablet).toMatch(
      /\.content-schema-registry-sidebar\s*\{[^}]*display:\s*block/u,
    );
  });

  it('collapses the sidebar body only inside the tablet band and hides the toggle at desktop', () => {
    // Range syntax: a rem max-width of 64.0624 rounds up to 1025 px in Chrome.
    const band = block('@media (width > 48rem) and (width < 64.0625rem)');
    expect(band).toMatch(/data-collapsed=["']true["']/u);
    expect(band).toMatch(
      /\.content-schema-registry-sidebar-nav\s*\{[^}]*display:\s*none/u,
    );
    const desktop = block('@media (min-width: 64.0625rem)');
    expect(desktop).toMatch(
      /\.content-schema-registry\s+\.content-schema-registry-sidebar-toggle\s*\{[^}]*display:\s*none/u,
    );
  });

  it('switches composition by container width without changing semantics', () => {
    expect(css).toMatch(
      /\.content-schema-registry-shell-main\s*\{[^}]*container-type:\s*inline-size/u,
    );
    expect(css).toMatch(/@container registry-main \(max-width: 39\.99rem\)/u);
    expect(css).toMatch(/@container registry-main \(min-width: 44rem\)/u);
  });

  it('places the rail beside the detail body only when the detail has the row to itself and the column is wide and keeps it sticky', () => {
    expect(css).toMatch(/@container registry-main \(min-width: 44rem\)/u);
    expect(css).toMatch(/\.content-schema-registry-action-rail\s*\{[^}]*\}/u);
    expect(block('@container registry-main (min-width: 44rem)')).toContain(
      'position: sticky',
    );
  });

  it('spans the grid by role, not by position, and lets a lone detail take the full row', () => {
    expect(css).not.toContain(':nth-child');
    expect(css).toMatch(
      /\.content-schema-registry-grid\s*>\s*\.content-schema-registry-detail:first-child\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/u,
    );
    expect(css).toMatch(
      /\.content-schema-registry-grid\s*>\s*\.content-schema-registry-list-column\s*\{[^}]*grid-column:\s*span 7/u,
    );
  });

  it('keeps 12 columns, a 24 px gutter and a 90rem (1440 px) maximum at desktop', () => {
    const desktop = block('@media (min-width: 64.0625rem)');
    expect(desktop).toContain('--registry-columns: 12');
    expect(desktop).toContain('--registry-gutter: 1.5rem');
    expect(css).toMatch(/max-width:\s*90rem/u);
    expect(css).toMatch(
      /\.content-schema-registry\s*\{[^}]*box-sizing:\s*border-box/u,
    );
  });
});
