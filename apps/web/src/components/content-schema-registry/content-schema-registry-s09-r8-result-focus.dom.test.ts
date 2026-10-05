// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMemoryLockManager } from '../../lib/test-support/memory-lock-manager';
import { MemoryStorage } from '../../lib/test-support/memory-storage';
import { consumeRouteHeadingFocusMark } from '../../lib/route-heading-focus';
import { installContentSchemaRegistryCommandEnhancement } from './content-schema-registry-runtime-dom-mutations';

/**
 * FE03 locale "Committed" row (AC1232): a successful create commits and moves
 * to the created version address, whose route heading takes focus. The
 * browser leaves the one-shot mark before it navigates.
 */

const locks = createMemoryLockManager();
const CREATED = '/app/cms-content-modeling/t1/versions/v1';

const formMarkup = (operationId: string): void => {
  window.history.replaceState({}, '', '/app/cms-content-modeling');
  document.body.innerHTML = `
    <main>
      <section data-workbench="content-schema-registry" data-canonical-refetch-url="/app/cms-content-modeling">
        <form id="schema-form" data-cms-command-form="true" data-operation-id="${operationId}" action="/app/cms-content-modeling" method="post">
          <input type="hidden" name="idempotency-key" value="stable-key-123" />
          <input id="field-key" name="typeKey" value="release_note" />
          <fieldset><button type="submit">Save</button></fieldset>
        </form>
      </section>
    </main>`;
};

const respond = (
  status: number,
  headers: Record<string, string> = {},
): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status, headers })),
  );
};

const submitAndWait = async (until: () => boolean): Promise<void> => {
  document
    .querySelector('form')
    ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(until()).toBe(true));
};

beforeEach(() => {
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: new MemoryStorage(),
  });
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: locks.manager,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  locks.releaseAll();
  document.body.replaceChildren();
});

describe('[P2-S09-AC-1232] committed create hands focus to the result heading', () => {
  it('[P2-S09-AC-1232] marks the heading for focus and navigates to the created version on a 201', async () => {
    formMarkup('CMS-03A-01');
    respond(201, { 'content-type': 'application/json', location: CREATED });
    const navigate = vi.fn();
    const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
      navigate,
    });
    await submitAndWait(() => navigate.mock.calls.length > 0);
    expect(navigate).toHaveBeenCalledExactlyOnceWith(CREATED);
    expect(consumeRouteHeadingFocusMark(window.sessionStorage)).toBe(true);
    cleanup();
  });

  it('[P2-S09-AC-1232] leaves no mark when the create is refused', async () => {
    formMarkup('CMS-03A-01');
    respond(422, { 'content-type': 'application/json' });
    const cleanup = installContentSchemaRegistryCommandEnhancement(document);
    await submitAndWait(
      () => document.querySelector('[data-cms-validation-summary]') !== null,
    );
    expect(consumeRouteHeadingFocusMark(window.sessionStorage)).toBe(false);
    cleanup();
  });
});
