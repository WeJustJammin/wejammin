import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * [P2-S12-AC-272] "A browser never calls CMS-03C-18 to CMS-03C-21 because no browser route, form, proxy
 * or client type exists for them." CMS-03C-18 to -21 are internal RPCs and jobs (BE03c 191), never
 * routes. Every `/api/v1/` literal in the composition island is one of the browser routes the island
 * owns (CMS-03C-02, -13, -14, -15 and the entry reads), and none names an internal operation.
 */
const DIRECTORY = import.meta.dirname;
const SOURCES = readdirSync(DIRECTORY).filter(
  (name) => /\.(ts|tsx)$/u.test(name) && !/\.test(-support)?\./u.test(name),
);
const OWNED = [
  '/api/v1/cms/patterns/selector',
  '/api/v1/cms/compositions/pattern-instances',
  '/api/v1/cms/compositions/pattern-updates',
  '/api/v1/cms/compositions/instances/',
  '/api/v1/cms/entries/',
];

describe('composition island: browser routes', () => {
  it('[P2-S12-AC-272] reads real source files', () => {
    expect(SOURCES.length).toBeGreaterThan(20);
    expect(SOURCES).toContain('composition-commands.ts');
  });

  it('[P2-S12-AC-272] every route literal is a route the island owns, and none is an internal operation', () => {
    const literals = SOURCES.flatMap((name) =>
      Array.from(
        readFileSync(resolve(DIRECTORY, name), 'utf8').matchAll(
          /\/api\/v1\/[A-Za-z0-9/_${}.()-]*/gu,
        ),
        (match) => match[0],
      ),
    );
    expect(literals.length).toBeGreaterThan(5);
    for (const literal of literals) {
      expect(
        OWNED.some((owned) => literal.startsWith(owned)),
        literal,
      ).toBe(true);
      expect(literal).not.toMatch(
        /03c-?(18|19|20|21)|rpc|internal|overlap|executor|preflight/iu,
      );
    }
    expect(
      SOURCES.filter((name) =>
        /CMS-03C-(18|19|20|21)\b/u.test(
          readFileSync(resolve(DIRECTORY, name), 'utf8'),
        ),
      ),
    ).toEqual([]);
  });
});
