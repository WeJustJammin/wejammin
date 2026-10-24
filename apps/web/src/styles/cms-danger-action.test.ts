// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * The shared destructive-button treatment of the CMS surfaces (DESIGN.md, Components > Buttons:
 * "Destructive actions name the consequence and use Danger only when the action is genuinely
 * destructive", a visible focus ring, a 44 by 44 target). The class is `.cms-danger-action`; its
 * stylesheet `cms-danger-action.css` is loaded by every CMS page and scoped to the `<main>` of
 * each of the three CMS layouts, so it takes effect wherever a destructive action can appear.
 * Stylesheets are read as text, as the registry stylesheet test does.
 */
const here = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));
const read = (relative: string): string => readFileSync(here(relative), 'utf8');
// Prettier wraps the long selector before `button`; the rules are matched with it on one line.
const css = read('./cms-danger-action.css').replace(
  /\)\s*\n\s+button/gu,
  ') button',
);
const editorialCss = read('./cms-editorial.css');
const design = read('../../../../DESIGN.md');

/** The declarations of the first rule whose selector list is exactly `selector`. */
const ruleOf = (selector: string): Record<string, string> | null => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const match = new RegExp(
    `(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`,
    'u',
  ).exec(css);
  if (match === null) return null;
  return Object.fromEntries(
    (match[1] ?? '')
      .split(';')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '')
      .map((entry) => {
        const [name, ...value] = entry.split(':');
        return [(name ?? '').trim(), value.join(':').trim()];
      }),
  );
};

const MAINS = [
  'cms-editorial-main',
  'content-schema-registry-main',
  'cms-template-main',
] as const;
const SCOPE = `:is(${MAINS.map((id) => `#${id}`).join(', ')})`;
const BASE = `${SCOPE} button[type].cms-danger-action`;
const HOVER = `${BASE}:hover:not(:disabled)`;

describe('.cms-danger-action', () => {
  it('is a danger-bordered, danger-text button on the panel colour', () => {
    expect(ruleOf(BASE)).toEqual({
      'border-color': 'var(--cms-danger)',
      background: 'var(--cms-danger-surface)',
      color: 'var(--cms-danger)',
    });
  });

  it('fills with danger on hover, with the panel colour as its text', () => {
    expect(ruleOf(HOVER)).toEqual({
      background: 'var(--cms-danger)',
      color: 'var(--cms-danger-surface)',
    });
  });

  it('does not remove the 44px target, the focus ring or the disabled state of every CMS button', () => {
    expect(ruleOf(BASE)?.outline).toBeUndefined();
    expect(ruleOf(BASE)?.['min-block-size']).toBeUndefined();
    expect(editorialCss).toContain('min-block-size: var(--cms-target)');
    expect(editorialCss).toContain('#cms-editorial-main button:disabled');
  });

  it('falls back to the UI panel colour exactly, on pages that do not load the UI tokens', () => {
    const fallback =
      /--cms-danger-surface:\s*var\(--color-panel,\s*(oklch\([^)]*\))\)/u.exec(
        css,
      )?.[1];
    const ui = read('../../../../packages/ui/src/styles.css');
    expect(fallback).toBeDefined();
    expect(ui).toContain(`--color-panel: ${fallback}`);
  });

  it('defines the danger token itself, so a page without cms-editorial.css still has it', () => {
    expect(css).toMatch(/:root\s*\{[^}]*--cms-danger:\s*oklch\(/u);
  });
});

/* The cascade, per layout. The editorial stylesheet is `@layer components`; an unlayered rule
   beats any layered one. The registry, grant and template stylesheets are unlayered and style
   buttons with classes and elements only, so the id inside `:is(...)` outranks them. */
describe('.cms-danger-action cascade', () => {
  // The selector as the stylesheet writes it, not a copy kept in this test.
  const written =
    /^\s*(:is\([^)]*\)\s+button\[type\]\.cms-danger-action)\s*\{/mu.exec(
      css,
    )?.[1];

  const competing = [
    '../components/content-schema-registry/content-schema-registry.css',
    '../components/cms-capability-grants/cms-capability-grants.css',
    '../components/cms-composition/cms-template-designer.css',
  ].map((path) => ({ path, text: read(path) }));

  it('writes the scope selector', () => {
    expect(written).toBe(BASE);
  });

  it('is unlayered, so it outranks the layered editorial button rules', () => {
    expect(css.replace(/\/\*[\s\S]*?\*\//gu, '')).not.toContain('@layer');
    expect(editorialCss).toContain('@layer components');
  });

  it.each(competing)(
    'outranks $path: no id selector, no !important, no layer',
    ({ text }) => {
      const selectors = text
        .replace(/\/\*[\s\S]*?\*\//gu, '')
        .split('{')
        .map((chunk) => chunk.split('}').pop() ?? '')
        .join('\n');
      expect(selectors).not.toMatch(/#[a-z]/iu);
      expect(text).not.toContain('!important');
      expect(text).not.toContain('@layer');
    },
  );

  it.each(MAINS)('matches a destructive button inside <main id=%s>', (id) => {
    for (const type of ['submit', 'button']) {
      document.body.innerHTML = `<main id="${id}"><form><button type="${type}" class="cms-danger-action">Retire</button></form></main>`;
      const button = document.querySelector('button') as HTMLButtonElement;
      expect(button.matches(written ?? ':not(*)')).toBe(true);
    }
  });

  it('does not match a plain button or a button outside a CMS main', () => {
    document.body.innerHTML =
      '<main id="cms-editorial-main"><button type="button">Cancel</button></main><main id="other"><button type="button" class="cms-danger-action">x</button></main>';
    for (const button of Array.from(document.querySelectorAll('button')))
      expect(button.matches(written ?? ':not(*)')).toBe(false);
  });
});

/* Every CMS page loads the stylesheet and names its <main> in the scope, so a destructive action
   added to any of them is styled. */
describe('.cms-danger-action reaches every CMS page', () => {
  const pagesRoot = here('../pages/app/cms-content-modeling');
  const astroFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = `${dir}/${name}`;
      if (!statSync(path).isFile()) return astroFiles(path);
      return path.endsWith('.astro') ? [path] : [];
    });
  const document_ = read(
    '../components/cms-editorial/CmsEditorialDocument.astro',
  );
  const pages = astroFiles(pagesRoot).map((path) => ({
    name: path.slice(pagesRoot.length + 1),
    source: readFileSync(path, 'utf8'),
  }));

  it('finds the CMS pages', () => {
    expect(pages.length).toBeGreaterThanOrEqual(21);
  });

  it('the editorial document shell loads it', () => {
    expect(document_).toContain("styles/cms-danger-action.css'");
  });

  it.each(pages)('$name loads it and is covered by the scope', ({ source }) => {
    const shell = /<CmsEditorialDocument[\s>]/u.test(source);
    const own = /<main id="([^"]+)"/u.exec(source)?.[1];
    const main = shell ? 'cms-editorial-main' : own;
    expect(MAINS as readonly (string | undefined)[]).toContain(main);
    expect(shell || source.includes("styles/cms-danger-action.css'")).toBe(
      true,
    );
  });
});

/* WCAG 2.1 contrast of the two states, computed from the OKLCH tokens themselves. */
const oklchToLuminance = (l: number, c: number, hue: number): number => {
  const h = (hue * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
  const g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
  const bl = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_;
  const clamp = (v: number): number => Math.min(1, Math.max(0, v));
  return 0.2126 * clamp(r) + 0.7152 * clamp(g) + 0.0722 * clamp(bl);
};
const token = (name: string): [number, number, number] => {
  const match = new RegExp(
    `--${name}:\\s*oklch\\((\\d+(?:\\.\\d+)?)%\\s+([\\d.]+)\\s+([\\d.]+)\\)`,
    'u',
  ).exec(`${css}\n${read('../../../../packages/ui/src/styles.css')}`);
  if (match === null) throw new Error(`token ${name} not found`);
  return [Number(match[1]) / 100, Number(match[2]), Number(match[3])];
};
const contrast = (
  one: [number, number, number],
  other: [number, number, number],
): number => {
  const a = oklchToLuminance(...one);
  const b = oklchToLuminance(...other);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

describe('.cms-danger-action contrast', () => {
  const danger = token('cms-danger');
  const panel = token('color-panel');
  it('keeps danger text on the panel at AA for small text (4.5:1)', () => {
    expect(contrast(danger, panel)).toBeGreaterThanOrEqual(4.5);
  });
  it('keeps the panel text on the danger fill at AA (4.5:1)', () => {
    expect(contrast(panel, danger)).toBeGreaterThanOrEqual(4.5);
  });
  it('uses the hue of the DESIGN.md Danger colour', () => {
    const named =
      /danger:\s*"oklch\(\d+(?:\.\d+)?%\s+[\d.]+\s+([\d.]+)\)"/u.exec(design);
    expect(Number(named?.[1])).toBe(danger[2]);
  });
});
