// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { saveStepUpDraft } from '../identity-authority/step-up-mfa/step-up-draft';
import { installLazyCommandEnhancement } from './content-schema-registry-runtime-dom-lazy';
import { stepUpDraftScope } from './content-schema-registry-step-up-scope';

/**
 * AC261 (detail/editor modules split): the mutation transport, the outcome
 * renderers and the step-up restore load on first intent, never in the
 * route's initial JavaScript. These tests drive the real enhancement chunk
 * through the real loader, with a stubbed network only.
 */

const mount = (): HTMLFormElement => {
  document.body.innerHTML = `
    <form data-cms-command-form data-operation-id="CMS-03A-01"
      action="/app/cms-content-modeling" method="post">
      <input type="hidden" name="idempotency-key" value="key-fresh" />
      <input type="text" name="typeKey" value="" />
      <button type="submit">Create draft</button>
    </form>
    <form id="plain" action="/other" method="post">
      <button type="submit">Plain</button>
    </form>`;
  return document.querySelector<HTMLFormElement>('[data-cms-command-form]')!;
};

const fetchCalls: { url: string; body: FormData }[] = [];

beforeEach(() => {
  fetchCalls.length = 0;
  window.sessionStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({ url: String(input), body: init?.body as FormData });
      return new Response('{}', {
        status: 422,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
  window.sessionStorage.clear();
});

const submit = (form: HTMLFormElement): SubmitEvent => {
  const event = new SubmitEvent('submit', { bubbles: true, cancelable: true });
  form.dispatchEvent(event);
  return event;
};

describe('[P2-S09-AC-261] lazy command enhancement', () => {
  it('[P2-S09-AC-261] loads nothing and wires nothing until a person acts', async () => {
    const form = mount();
    const enhancement = installLazyCommandEnhancement(document);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(enhancement.loaded()).toBe(false);
    expect(form.getAttribute('aria-busy')).toBeNull();
    expect(fetchCalls).toHaveLength(0);
    enhancement.dispose();
  });

  it('[P2-S09-AC-261] holds a submit that arrives before the chunk is ready and replays it through the real handler', async () => {
    const form = mount();
    const enhancement = installLazyCommandEnhancement(document);
    const typeKey = form.elements.namedItem('typeKey') as HTMLInputElement;
    typeKey.value = 'release_note';
    const event = submit(form);
    // Held, never a native navigation: the browser default is prevented.
    expect(event.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(fetchCalls).toHaveLength(1));
    expect(enhancement.loaded()).toBe(true);
    expect(fetchCalls[0]?.url).toContain('/app/cms-content-modeling');
    expect(fetchCalls[0]?.body.get('typeKey')).toBe('release_note');
    expect(fetchCalls[0]?.body.get('idempotency-key')).toBe('key-fresh');
    enhancement.dispose();
  });

  it('[P2-S09-AC-261] replays a held button submit with its submitter', async () => {
    const form = mount();
    const enhancement = installLazyCommandEnhancement(document);
    (form.querySelector('[type="submit"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(fetchCalls).toHaveLength(1));
    expect(enhancement.loaded()).toBe(true);
    enhancement.dispose();
  });

  it('[P2-S09-AC-261] replays the submit once the enhancement owns the form, with no second hold', async () => {
    const form = mount();
    const enhancement = installLazyCommandEnhancement(document);
    form
      .querySelector('input')
      ?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await vi.waitFor(() => expect(enhancement.loaded()).toBe(true));
    const event = submit(form);
    expect(event.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(fetchCalls).toHaveLength(1));
    enhancement.dispose();
  });

  it('[P2-S09-AC-261] starts loading on a pointer press on a registry form', async () => {
    const form = mount();
    const enhancement = installLazyCommandEnhancement(document);
    form
      .querySelector('button')
      ?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await vi.waitFor(() => expect(enhancement.loaded()).toBe(true));
    enhancement.dispose();
  });

  it('[P2-S09-AC-261] ignores focus and submit on a form that is not a registry command form', async () => {
    mount();
    const enhancement = installLazyCommandEnhancement(document);
    const plain = document.getElementById('plain') as HTMLFormElement;
    plain
      .querySelector('button')
      ?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    let reached = false;
    plain.addEventListener('submit', (event) => {
      reached = true;
      event.preventDefault();
    });
    const event = submit(plain);
    expect(reached).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(enhancement.loaded()).toBe(false);
    expect(fetchCalls).toHaveLength(0);
    enhancement.dispose();
  });

  it('[P2-S09-AC-261] loads at once, with no intent, when a step-up draft for this page is waiting and restores it', async () => {
    const form = mount();
    const scope = stepUpDraftScope(window.location.pathname, 'CMS-03A-01');
    saveStepUpDraft(window.sessionStorage, scope, {
      values: { typeKey: 'draft_type' },
      idempotencyKey: 'key-original',
      expectedVersion: null,
    });
    const enhancement = installLazyCommandEnhancement(document);
    await vi.waitFor(() => expect(enhancement.loaded()).toBe(true));
    expect((form.elements.namedItem('typeKey') as HTMLInputElement).value).toBe(
      'draft_type',
    );
    expect(
      (form.elements.namedItem('idempotency-key') as HTMLInputElement).value,
    ).toBe('key-original');
    // Restored for explicit re-confirmation: nothing was submitted.
    expect(fetchCalls).toHaveLength(0);
    enhancement.dispose();
  });

  it('[P2-S09-AC-261] does not load for a draft that belongs to another page', async () => {
    mount();
    saveStepUpDraft(
      window.sessionStorage,
      stepUpDraftScope('/app/cms-content-modeling/other', 'CMS-03A-01'),
      { values: {}, idempotencyKey: 'key-other', expectedVersion: null },
    );
    const enhancement = installLazyCommandEnhancement(document);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(enhancement.loaded()).toBe(false);
    enhancement.dispose();
  });

  it('[P2-S09-AC-261] does not load for a waiting draft when the page has no registry form', async () => {
    document.body.innerHTML = '<p>No form here</p>';
    saveStepUpDraft(
      window.sessionStorage,
      stepUpDraftScope(window.location.pathname, 'CMS-03A-01'),
      { values: {}, idempotencyKey: 'key-x', expectedVersion: null },
    );
    const enhancement = installLazyCommandEnhancement(document);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(enhancement.loaded()).toBe(false);
    enhancement.dispose();
  });

  it('[P2-S09-AC-261] treats blocked storage as no waiting draft', async () => {
    mount();
    vi.spyOn(Storage.prototype, 'key').mockImplementation(() => {
      throw new Error('blocked');
    });
    const enhancement = installLazyCommandEnhancement(document);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(enhancement.loaded()).toBe(false);
    enhancement.dispose();
    vi.restoreAllMocks();
  });

  it('[P2-S09-AC-261] stops reacting after dispose and never installs a late enhancement', async () => {
    const form = mount();
    const enhancement = installLazyCommandEnhancement(document);
    form
      .querySelector('input')
      ?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    enhancement.dispose();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(enhancement.loaded()).toBe(false);
    form
      .querySelector('input')
      ?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    let seen: SubmitEvent | null = null;
    form.addEventListener('submit', (event) => {
      seen = event;
      event.preventDefault();
    });
    submit(form);
    expect(seen).not.toBeNull();
    expect(fetchCalls).toHaveLength(0);
  });
});
