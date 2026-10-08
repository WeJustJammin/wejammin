/**
 * Browser-side helpers shared by the Slice 10 real-route specs: signed-in
 * contexts for a principal, script/hydration error capture, and the axe gate.
 */
import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  type Browser,
  type BrowserContext,
  type Page,
  type Response,
} from '@playwright/test';

import { authenticateLocalSession } from './local-signed-session';
import { createClient, type S10Client } from './s10-real-api';
import { s10Session, type S10Principal, type S10World } from './s10-real-world';

export type SignedIn = Readonly<{
  context: BrowserContext;
  page: Page;
  client: S10Client;
  browserErrors: string[];
}>;

/** Loopback only: a non-loopback origin means a mis-targeted run, never evidence. */
export const requireLoopbackOrigin = (origin: string | undefined): void => {
  expect(origin, 'real-route baseURL must target loopback').toMatch(
    /^http:\/\/127\.0\.0\.1:\d+$/u,
  );
};

/** Script, hydration and console errors of a page (resource loads are noise). */
export const collectBrowserErrors = (page: Page, sink: string[]): void => {
  page.on('pageerror', (error) => sink.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    // A deliberately refused request (409, 403, 404) logs a resource line.
    if (
      text.startsWith('Failed to load resource:') ||
      text.includes('net::ERR_')
    )
      return;
    sink.push(text);
  });
};

/** A new browser context signed in as `principal` (session `sessionNumber`). */
export const signIn = async (
  browser: Browser,
  world: S10World,
  principal: S10Principal,
  sessionNumber = 1,
): Promise<SignedIn> => {
  const context = await browser.newContext();
  await authenticateLocalSession(
    context,
    s10Session(world, principal, sessionNumber),
  );
  const page = await context.newPage();
  const browserErrors: string[] = [];
  collectBrowserErrors(page, browserErrors);
  return {
    context,
    page,
    client: createClient(context, world, principal, sessionNumber),
    browserErrors,
  };
};

/**
 * Navigate and wait until every Astro island on the page has hydrated. An island
 * is server-rendered first; a value typed before React takes over is discarded,
 * so an interaction must never start on an un-hydrated page.
 */
export const gotoHydrated = async (
  page: Page,
  path: string,
): Promise<Response | null> => {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  await waitForIslands(page);
  return response;
};

export const waitForIslands = async (page: Page): Promise<void> => {
  await page.waitForFunction(
    () => document.querySelectorAll('astro-island[ssr]').length === 0,
  );
};

/** The WCAG gate every surface passes: no serious or critical axe finding. */
export const expectNoSeriousAxeFindings = async (
  page: Page,
  label: string,
): Promise<void> => {
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations
      .filter(({ impact }) => impact === 'serious' || impact === 'critical')
      .map(
        ({ id, impact, nodes }) =>
          `${label}: ${impact ?? ''} ${id} (${nodes
            .slice(0, 2)
            .map((node) => String(node.target[0]))
            .join(' | ')})`,
      ),
    `${label}: serious or critical axe findings`,
  ).toEqual([]);
};

/** The document never scrolls sideways at the current viewport. */
export const expectNoHorizontalScroll = async (
  page: Page,
  label: string,
): Promise<void> => {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    `${label}: horizontal scroll`,
  ).toBe(true);
};

/** What the focused element is, as a user would name it: `tag:accessible text`. */
export const focusedName = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (element === null || element === document.body) return '';
    const labelled =
      element.getAttribute('aria-label') ??
      (element.id !== ''
        ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)
            ?.textContent
        : null) ??
      element.closest('label')?.textContent ??
      element.textContent ??
      '';
    return `${element.tagName.toLowerCase()}:${labelled.replace(/\s+/gu, ' ').trim()}`;
  });

/**
 * Press Tab (or Shift+Tab) until the focused element's name matches; fail with
 * the visited path. Key presses only: no click and no programmatic focus.
 */
export const tabTo = async (
  page: Page,
  pattern: RegExp,
  budget = 40,
  direction: 'forward' | 'backward' = 'forward',
): Promise<void> => {
  const visited: string[] = [];
  for (let step = 0; step < budget; step += 1) {
    await page.keyboard.press(direction === 'forward' ? 'Tab' : 'Shift+Tab');
    const name = await focusedName(page);
    visited.push(name);
    if (pattern.test(name)) return;
  }
  throw new Error(
    `Keyboard focus never reached ${String(pattern)}; visited: ${visited.join(' > ')}`,
  );
};
