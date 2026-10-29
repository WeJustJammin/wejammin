import { describe, expect, it } from 'vitest';

/*
 * FE03 gives every protected CMS route a `no-store` policy, and the Slice 09 precedent
 * (P2-S09-AC-1067) asserts it on the 303 to sign-in. `Astro.redirect()` builds its own Response, so
 * the `Cache-Control` a page sets on `Astro.response` never reaches it (pw5 run 1). Every page
 * therefore answers a redirect through the one shared builder (`cmsRedirectResponse`, which is
 * `authPageRedirect`), and no page may build a redirect any other way.
 */
const pages = Object.entries(
  import.meta.glob<string>('./**/*.astro', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
);

/**
 * Every page of this tree. A new page must be added here on purpose, which puts it under the
 * rules below (the glob alone would let an unreviewed page pass by being absent from a count).
 */
const EXPECTED_PAGES = [
  './capability-grants.astro',
  './[contentTypeId]/versions/[versionId].astro',
  './definition-reviews/index.astro',
  './definition-reviews/[reviewId].astro',
  './entries/[entryId].astro',
  './entries/[entryId]/composition.astro',
  './entries/[entryId]/conflicts/[conflictId].astro',
  './entries/[entryId]/locales/[locale].astro',
  './entries/[entryId]/related-content.astro',
  './entries/[entryId]/revisions.astro',
  './entries/[entryId]/workflow.astro',
  './entries/index.astro',
  './entries/new.astro',
  './index.astro',
  './patterns/new.astro',
  './patterns/[patternKey].astro',
  './reviews/index.astro',
  './reviews/[reviewId].astro',
  './schema-reviews/[reviewId].astro',
  './taxonomies/new.astro',
  './taxonomies/[taxonomyId].astro',
  './templates/new.astro',
  './templates/[templateKey].astro',
] as const;

const HELPER_IMPORT =
  /^import \{ cmsRedirectResponse \} from '(\.\.\/)+components\/cms-editorial-pages\/cms-editorial-page-outcome';$/mu;

/** Anything that reads as a redirect of the page itself. */
const REDIRECT_SIGNALS = [
  /'redirect'/u,
  /\/auth\/sign-in/u,
  /kind === 'unauthenticated'/u,
  /stepUpTargetForLocation/u,
];

/** Every way a page could build a redirect other than the shared helper. */
const FORBIDDEN: readonly (readonly [string, RegExp])[] = [
  [
    'Astro.redirect (any spacing or bracket form)',
    /\bAstro\s*(\.\s*|\[\s*['"`])redirect\b/u,
  ],
  ['destructured redirect from Astro', /\bredirect\b[^;\n]*=\s*Astro\b/u],
  ['Response.redirect', /\bResponse\s*\.\s*redirect\b/u],
  ['a 30x status', /\bstatus\s*(:|=)\s*30\d\b/u],
  ['a 30x number passed to a Response', /\bnew Response\([^)]*\b30\d\b/su],
  [
    'a Location header written by hand',
    /\bheaders\s*\.\s*set\(\s*['"`]location['"`]/iu,
  ],
  [
    'a location header member',
    /['"`]?\blocation['"`]?\s*:\s*[^\n]*\bnew Response\b|\bnew Response\([^)]*\blocation\s*:/isu,
  ],
];

/** The violations a page source has; empty when it follows the rules. */
const violations = (source: string): string[] => {
  const found = FORBIDDEN.filter(([, pattern]) => pattern.test(source)).map(
    ([name]) => name,
  );
  const redirects = REDIRECT_SIGNALS.some((signal) => signal.test(source));
  if (redirects && !HELPER_IMPORT.test(source))
    found.push('a redirect without the shared helper import');
  if (redirects && !/\bcmsRedirectResponse\(/u.test(source))
    found.push('a redirect that never calls the shared helper');
  return found;
};

describe('CMS content-modeling page redirects', () => {
  it('covers exactly the pages of the tree', () => {
    expect(pages.map(([key]) => key).sort()).toEqual(
      [...EXPECTED_PAGES].sort(),
    );
  });

  it.each(pages)(
    '%s builds every redirect through the shared helper',
    (_key, source) => {
      expect(violations(source)).toEqual([]);
    },
  );

  it('every page of the tree redirects, so every page is held to the helper', () => {
    expect(
      pages.filter(([, source]) => /\bcmsRedirectResponse\(/u.test(source)),
    ).toHaveLength(EXPECTED_PAGES.length);
  });
});

/*
 * Inverse probes: each synthetic page below is a bypass the real pages must never contain. They
 * are strings, not page edits; the rules above must flag every one and pass the clean page.
 */
const CLEAN = `---
import { cmsRedirectResponse } from '../../../components/cms-editorial-pages/cms-editorial-page-outcome';
if (outcome.kind === 'redirect') return cmsRedirectResponse(outcome.location);
---
`;
const IMPORT_LINE =
  "import { cmsRedirectResponse } from '../../../components/cms-editorial-pages/cms-editorial-page-outcome';\n";

describe('page redirect guard inverse probes', () => {
  it('passes the clean page', () => {
    expect(violations(CLEAN)).toEqual([]);
  });

  it.each([
    ['Response.redirect', `${CLEAN}return Response.redirect(url, 303);`],
    [
      'a hand-built 30x Response',
      `${CLEAN}return new Response(null, { status: 302, headers: { Location: url } });`,
    ],
    [
      'a hand-built 303 Response',
      `${CLEAN}return new Response(null, {\n  headers: { Location: url },\n  status: 303,\n});`,
    ],
    [
      'Astro.redirect with whitespace',
      `${CLEAN}return Astro.redirect (url, 303);`,
    ],
    [
      'Astro.redirect across a newline',
      `${CLEAN}return Astro\n  .redirect(url, 303);`,
    ],
    ["Astro['redirect']", `${CLEAN}return Astro['redirect'](url, 303);`],
    [
      'a destructured redirect',
      `${CLEAN}const { redirect } = Astro;\nreturn redirect(url, 303);`,
    ],
    ['a status assignment', `${CLEAN}Astro.response.status = 302;`],
    [
      'a Location header set by hand',
      `${CLEAN}Astro.response.headers.set('Location', url);`,
    ],
  ])('flags %s', (_name, source) => {
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it.each([
    [
      'a page that returns a redirect without importing the helper',
      "if (outcome.kind === 'redirect') return other(outcome.location);\n",
    ],
    [
      'a page that imports the helper but redirects another way',
      `${IMPORT_LINE}if (outcome.kind === 'redirect') return go(outcome.location);\n`,
    ],
    [
      'a sign-in redirect without the helper',
      'return go(`/auth/sign-in?returnTo=${x}`);\n',
    ],
    [
      'a helper imported from the wrong module',
      "import { cmsRedirectResponse } from './local';\nreturn cmsRedirectResponse(x); // '/auth/sign-in'\n",
    ],
  ])('flags %s', (_name, source) => {
    expect(violations(source)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/redirect without|never calls/u),
      ]),
    );
  });
});
