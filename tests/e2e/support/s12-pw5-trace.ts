/**
 * The identifier scan of the Slice 12 definition journeys (P2-S12-AC-273): every URL, request and console line a page
 * produces while a journey runs, and its storage afterwards, must hold no person id and no content hash. Not
 * type-checked by `pnpm type-check`; the journeys spec is its only caller.
 */
import { expect, type Page, type Request } from '@playwright/test';

/** Everything a page sends or shows that could carry an identifier, gathered while a journey runs. */
export type Trace = { urls: string[]; console: string[] };

export const trace = (...pages: Page[]): Trace => {
  const gathered: Trace = { urls: [], console: [] };
  for (const page of pages) {
    page.on('request', (request: Request) => gathered.urls.push(request.url()));
    page.on('framenavigated', (frame) => gathered.urls.push(frame.url()));
    page.on('console', (message) => gathered.console.push(message.text()));
  }
  return gathered;
};

const storageOf = (page: Page): Promise<string> =>
  page.evaluate(() =>
    JSON.stringify({
      local: { ...window.localStorage },
      session: { ...window.sessionStorage },
    }),
  );

/**
 * No person id or content hash in any URL (path, query or hash), console line or storage value.
 * A review, vocabulary or pattern id is the route's own path parameter and is allowed there; it is not a person id.
 */
export const expectNothingIdentifying = async (
  gathered: Trace,
  pages: readonly Page[],
  forbidden: readonly string[],
): Promise<void> => {
  const stored = (await Promise.all(pages.map(storageOf))).join('\n');
  const where: Record<string, string> = {
    urls: gathered.urls.join('\n'),
    console: gathered.console.join('\n'),
    storage: stored,
  };
  for (const [name, haystack] of Object.entries(where))
    for (const value of forbidden) {
      expect(
        haystack,
        `${name} must not hold ${value.slice(0, 12)}…`,
      ).not.toContain(value);
      expect(haystack, `${name} must not hold the encoded value`).not.toContain(
        encodeURIComponent(value),
      );
    }
};
