// @vitest-environment jsdom
import './term-action-preload.test-support';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { SURVIVOR_ID } from '../../server/cms-taxonomy-platform.test-support';
import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsTaxonomyTermForm from './CmsTaxonomyTermForm';
import type { TermActionResult } from './term-action-submit';
import {
  REVIEW_HREF,
  formProps,
  readTermsStub,
  readVersionsStub,
  submitStub,
  termsLoaded,
} from './term-form.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const BASE = formProps().basePath;

/** Submits a create form whose submit answers `result`, and returns the rendered result region. */
const refusedWith = async (result: TermActionResult) => {
  const { container } = mountElement(
    <CmsTaxonomyTermForm
      {...formProps({
        submit: submitStub(result),
        readTerms: readTermsStub(termsLoaded()),
        readVersions: readVersionsStub(),
      })}
    />,
  );
  await click(buttonNamed(container, 'Create a term'));
  await typeInto(byLabel<HTMLInputElement>(container, 'Term key'), 'cello');
  await typeInto(byLabel<HTMLInputElement>(container, 'Label 1'), 'Cello');
  await click(buttonNamed(container, 'Create term'));
  await flush();
  const region = container.querySelector('.cms-term-status') as HTMLElement;
  return {
    /** What the person typed, as the form still holds it. */
    typed: {
      termKey: byLabel<HTMLInputElement>(container, 'Term key').value,
      label: byLabel<HTMLInputElement>(container, 'Label 1').value,
    },
    container,
    region,
    heading: region.querySelector('h3')?.textContent,
    text: region.textContent ?? '',
    links: Array.from(region.querySelectorAll('a')).map((a) => [
      a.textContent,
      a.getAttribute('href'),
    ]),
  };
};

describe('CmsTaxonomyTermForm: a refused term action (FE03 :887)', () => {
  it('shows a canonical overlap with its domain and the canonical id as copyable text, never a link', async () => {
    const shown = await refusedWith({
      kind: 'refused',
      status: 422,
      reason: 'canonical_overlap',
      domain: 'instrument',
      canonicalId: SURVIVOR_ID,
    });
    expect(shown.heading).toBe('This matches a canonical record');
    expect(shown.text).toContain('canonical instrument record');
    expect(shown.text).toContain('Nothing was saved.');
    expect(shown.region.querySelector('code')?.textContent).toBe(SURVIVOR_ID);
    expect(shown.links).toEqual([]);
    expect(shown.region.getAttribute('role')).toBe('alert');
  });

  it('copies the canonical id, and says so when copying is unavailable', async () => {
    const shown = await refusedWith({
      kind: 'refused',
      status: 422,
      reason: 'canonical_overlap',
      domain: 'role',
      canonicalId: SURVIVOR_ID,
    });
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    await click(buttonNamed(shown.region, 'Copy canonical id'));
    expect(writeText).toHaveBeenCalledWith(SURVIVOR_ID);
    expect(shown.region.textContent).toContain('Copied the canonical id.');
    writeText.mockRejectedValueOnce(new Error('denied'));
    await click(buttonNamed(shown.region, 'Copy canonical id'));
    expect(shown.region.textContent).toContain('Copying is not available here');
  });

  it('names a canonical overlap without a canonical id and offers no copy control', async () => {
    const shown = await refusedWith({
      kind: 'refused',
      status: 422,
      reason: 'canonical_overlap',
      domain: 'gear',
    });
    expect(shown.text).toContain('canonical gear record');
    expect(shown.region.querySelector('code')).toBeNull();
    expect(() => buttonNamed(shown.region, 'Copy canonical id')).toThrow();
  });

  it('links a refusal for a vocabulary with no active version to the governed review', async () => {
    const shown = await refusedWith({
      kind: 'refused',
      status: 409,
      reason: 'taxonomy_not_active',
    });
    expect(shown.heading).toBe('The term was not saved');
    expect(shown.text).toContain('no active version');
    expect(shown.links).toEqual([
      ["Open the vocabulary's governed review", REVIEW_HREF],
    ]);
  });

  it('says a declared domain without a registered provider cannot be checked yet', async () => {
    const shown = await refusedWith({
      kind: 'refused',
      status: 422,
      reason: 'canonical_source_unavailable',
      domain: 'rights',
    });
    expect(shown.text).toContain('Checks against rights records');
    expect(shown.text).toContain('Nothing was saved.');
    expect(shown.links).toEqual([]);
  });

  it('says curator access is required for a missing capability', async () => {
    const shown = await refusedWith({
      kind: 'refused',
      status: 403,
      reason: 'capability_missing',
    });
    expect(shown.text).toContain('Taxonomy curator access is required');
  });
});

describe('CmsTaxonomyTermForm: the other term action outcomes', () => {
  it('reports a version conflict and that the list was refreshed', async () => {
    const shown = await refusedWith({ kind: 'conflict', currentVersion: '3' });
    expect(shown.heading).toBe('The vocabulary changed');
    expect(shown.text).toContain(
      'The list and the active version were refreshed',
    );
    expect(shown.text).toContain('Nothing was saved.');
  });

  it('reports an unknown result without claiming success or failure', async () => {
    const shown = await refusedWith({ kind: 'uncertain' });
    expect(shown.heading).toBe('The result is unknown');
    expect(shown.text).toContain('reuses the same idempotency key');
  });

  it('asks an expired session to sign in again, returning to the vocabulary page', async () => {
    const shown = await refusedWith({ kind: 'rejected', status: 401 });
    expect(shown.text).toContain('Your session expired.');
    expect(shown.links).toEqual([
      ['Sign in', `/auth/sign-in?returnTo=${encodeURIComponent(BASE)}`],
    ]);
  });

  it('states the Retry-After wait of a rate limit', async () => {
    const waited = await refusedWith({
      kind: 'rejected',
      status: 429,
      retryAfterSeconds: 12,
    });
    expect(waited.text).toContain('Wait at least 12 seconds before retrying.');
    expect(waited.typed).toEqual({ termKey: 'cello', label: 'Cello' });
  });

  it('asks for a wait without a count when the rate limit named none', async () => {
    const open = await refusedWith({ kind: 'rejected', status: 429 });
    expect(open.text).toContain(
      'The request was rate-limited. Wait before retrying.',
    );
    expect(open.typed).toEqual({ termKey: 'cello', label: 'Cello' });
  });

  it('keeps the entries and says the service is unavailable for a dependency failure', async () => {
    const shown = await refusedWith({ kind: 'rejected', status: 503 });
    expect(shown.text).toContain('The vocabulary service is unavailable.');
    expect(shown.typed).toEqual({ termKey: 'cello', label: 'Cello' });
    expect(shown.links).toEqual([]);
  });
});
