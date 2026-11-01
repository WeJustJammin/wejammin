// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { installCmsEditorialPageActions } from './cms-editorial-page-actions-core';
import { restoreDraftImporters } from './cms-editorial-page-actions-dom';

/*
 * The restore draft store loads on a page that holds a restore form, and when its review closes
 * (AC-106). If its chunk cannot be fetched the page says so in its polite restore status line and
 * nothing rejects unhandled.
 */
const real = { ...restoreDraftImporters };
let lifetime = new AbortController();

afterEach(() => {
  lifetime.abort();
  lifetime = new AbortController();
  document.body.replaceChildren();
  Object.assign(restoreDraftImporters, real);
});

const mountReview = (): HTMLDetailsElement => {
  const details = document.createElement('details');
  details.setAttribute('data-cms-editorial-restore-review', '');
  details.innerHTML = `<summary>Restore</summary>
    <form data-cms-editorial-restore>
      <input type="hidden" name="entryId" value="e" />
      <input type="hidden" name="revisionId" value="r" />
      <input type="hidden" name="migrationChainId" value="c" />
      <input type="hidden" name="expectedVersion" value="7" />
      <button type="button" data-cms-editorial-restore-cancel>Cancel</button>
    </form>`;
  document.body.appendChild(details);
  return details;
};

const status = (): string | undefined =>
  document.querySelector('[data-cms-editorial-restore-status]')?.textContent ??
  undefined;

const settle = async (): Promise<void> => {
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('the restore draft store chunk fails to load', () => {
  it('says on the status line that a kept confirmation may not have been recovered', async () => {
    restoreDraftImporters.load = vi.fn(async () => {
      throw new TypeError('Failed to fetch dynamically imported module');
    });
    mountReview();
    installCmsEditorialPageActions(document, { signal: lifetime.signal });
    await settle();
    expect(status()).toContain('could not be loaded');
    expect(status()).toContain('Reload the page');
  });

  it('says on the status line that a closed confirmation may still be kept', async () => {
    const details = mountReview();
    installCmsEditorialPageActions(document, { signal: lifetime.signal });
    await settle();
    expect(status()).toBeUndefined();
    restoreDraftImporters.load = vi.fn(async () => {
      throw new TypeError('Failed to fetch dynamically imported module');
    });
    details.open = true;
    details
      .querySelector<HTMLElement>('[data-cms-editorial-restore-cancel]')!
      .click();
    await settle();
    expect(status()).toContain('may still be kept');
  });

  it('loads the store again on the next page load (nothing is remembered)', async () => {
    const load = vi
      .fn<typeof real.load>()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockImplementation(real.load);
    restoreDraftImporters.load = load;
    mountReview();
    installCmsEditorialPageActions(document, { signal: lifetime.signal });
    await settle();
    lifetime.abort();
    lifetime = new AbortController();
    document.querySelector('[data-cms-editorial-restore-status]')?.remove();
    installCmsEditorialPageActions(document, { signal: lifetime.signal });
    await settle();
    expect(load).toHaveBeenCalledTimes(2);
    expect(status()).toBeUndefined();
  });
});
