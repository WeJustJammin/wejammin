/**
 * Assertions for the canonical-facts section and the one-shot result panel the
 * Slice 10 editor page shows (FE03 success state: "canonical facts, state,
 * version, provenance, allowed actions"; FE03 Completion: "focus result
 * heading, update URL/version ... expose exact next action"). They read only
 * what a person sees (roles, names, visible text), plus the whole document, to
 * prove that no owner, acting-party, person or session identifier and no field
 * value is leaked.
 */
import { expect, type Locator, type Page } from '@playwright/test';

import type { S10Principal, S10World } from './s10-real-world';

export const draftFacts = (page: Page): Locator =>
  page.locator('[data-cms-editorial-facts]');

export const resultPanel = (page: Page): Locator =>
  page.locator('[data-cms-editorial-result]');

export type ExpectedFacts = Readonly<{
  revision: string;
  entryVersion: string;
  /** "Label: words", in field order, e.g. `Title: Authored`. */
  provenance: readonly string[];
}>;

/** The canonical draft facts: revision, ENTRY version and per-field provenance. */
export const expectDraftFacts = async (
  page: Page,
  expected: ExpectedFacts,
): Promise<void> => {
  const facts = draftFacts(page);
  await expect(
    facts.getByRole('heading', { level: 2, name: 'Draft facts' }),
  ).toBeVisible();
  await expect(facts.locator('[data-fact="revision"]')).toHaveText(
    expected.revision,
  );
  await expect(facts.locator('[data-fact="entry-version"]')).toHaveText(
    expected.entryVersion,
  );
  await expect(
    facts.getByRole('heading', { level: 3, name: 'Field provenance' }),
  ).toBeVisible();
  await expect(
    facts.locator('[data-cms-editorial-provenance] > li'),
  ).toHaveText([...expected.provenance]);
};

export type ExpectedResult = Readonly<{
  heading: 'Entry created' | 'Conflict resolved' | 'Revision restored';
  /** The exact sentence naming the committed revision and entry version. */
  sentence: string;
  /** Parent revision labels and ids, in order (empty for a created entry). */
  parents: readonly (readonly [label: string, id: string])[];
  /** The migration chain a restore crossed. */
  migration: Readonly<{ chainId: string; edges: number }> | null;
  nextAction: string;
  /** The entry's revision-history link target. */
  historyHref: string;
}>;

/**
 * The one-shot result panel: a polite status named by its heading, the exact
 * committed facts, the lineage and the next action, with focus on the heading.
 */
export const expectResultPanel = async (
  page: Page,
  expected: ExpectedResult,
): Promise<void> => {
  const panel = resultPanel(page);
  await expect(panel).toHaveCount(1);
  await expect(panel).toHaveAttribute('role', 'status');
  const heading = panel.getByRole('heading', {
    level: 2,
    name: expected.heading,
  });
  await expect(heading).toBeVisible();
  // The status is named by its heading, so it is announced as that result.
  await expect(
    page.getByRole('status', { name: expected.heading }),
  ).toHaveCount(1);
  await expect(panel.locator('p').first()).toHaveText(expected.sentence);

  const parents = panel.locator('[data-fact="parent-revisions"] ol > li');
  if (expected.parents.length === 0) {
    await expect(panel.locator('[data-fact="parent-revisions"]')).toHaveCount(
      0,
    );
  } else {
    await expect(parents).toHaveText(
      expected.parents.map(([label, id]) => `${label}: ${id}`),
    );
  }
  const chain = panel.locator('[data-fact="migration-chain"]');
  if (expected.migration === null) {
    await expect(chain).toHaveCount(0);
  } else {
    await expect(chain).toHaveText(
      `Migration chain: ${expected.migration.chainId}, ${String(expected.migration.edges)} ${
        expected.migration.edges === 1 ? 'edge' : 'edges'
      }`,
    );
  }
  await expect(panel).toContainText(expected.nextAction);
  await expect(
    panel.getByRole('link', { name: 'Compare in the revision history' }),
  ).toHaveAttribute('href', expected.historyHref);
};

/**
 * Focus is on the result heading (FE03 Completion: "Focus result heading"), not
 * on the route heading or lost to the body. Soft: a failure is reported with the
 * test but does not hide the assertions after it.
 */
export const expectFocusOnResultHeading = async (page: Page): Promise<void> => {
  const where = await page.evaluate(
    () =>
      `${document.activeElement?.tagName ?? 'none'}#${document.activeElement?.id ?? ''}`,
  );
  await expect
    .soft(
      resultPanel(page).getByRole('heading', { level: 2 }),
      `FE03 Completion: focus belongs on the result heading; it is on ${where}`,
    )
    .toBeFocused();
};

/** The result is one-shot: it was consumed on read and leaves nothing behind. */
export const expectResultConsumed = async (page: Page): Promise<void> => {
  expect(
    await page.evaluate(() => {
      for (let index = 0; index < window.sessionStorage.length; index += 1)
        if (window.sessionStorage.key(index)?.includes('cms-editorial-result'))
          return true;
      return false;
    }),
    'the one-shot result record is gone after it was shown',
  ).toBe(false);
};

/**
 * No hidden identifier or value leaks: the whole document (visible text, every
 * attribute, island props) carries no owner or acting-party id, no person or
 * auth-user id of any principal, and none of the listed field values.
 */
export const expectNoLeak = async (
  page: Page,
  world: S10World,
  principals: readonly S10Principal[],
  values: readonly string[],
  scope: Locator | null = null,
): Promise<void> => {
  const document =
    scope === null ? await page.content() : await scope.innerHTML();
  const private_ = [
    world.owner.organizationId,
    world.owner.personId,
    world.owner.authUserId,
    ...principals.flatMap((principal) => [
      principal.authUserId,
      principal.personId,
    ]),
  ];
  for (const identifier of private_)
    expect(document, `leaks private identifier ${identifier}`).not.toContain(
      identifier,
    );
  for (const value of values)
    expect(
      document,
      `leaks field value ${JSON.stringify(value)}`,
    ).not.toContain(value);
};
