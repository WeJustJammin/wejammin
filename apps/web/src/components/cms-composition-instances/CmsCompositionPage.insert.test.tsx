// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buttonNamed,
  byLabel,
  choose,
  click,
  disableReactAct,
  enableReactAct,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  ENTRY,
  PLACE,
  SELECTOR,
  entryDetail,
  json,
  mountPage,
  noStrayRequests,
  refusal,
  settle,
} from './composition-page.test-support';
import {
  REVISION_ID,
  id,
  row,
  selectorItem,
  selectorPage,
} from './composition.test-support';

/*
 * FE03 1114; P2-S12-AC-045, AC-111: insert a pattern on the entry's current draft. The request is the exact
 * `PatternInstanceRequest`, the entry version is the `If-Match`, overrides are retained until a success, and every
 * refusal lands where it can be fixed.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const hero = selectorItem('hero-block', 2);
const fill = async (container: HTMLElement) => {
  await choose(
    byLabel<HTMLSelectElement>(container, 'Pattern'),
    hero.patternVersionId,
  );
  await click(byLabel<HTMLInputElement>(container, /^Linked/u));
  await typeInto(byLabel<HTMLInputElement>(container, 'Slot path'), '/main');
};
const placed = (n: number, version = '10') =>
  json(
    {
      items: [
        row(n, { path: `/main/hero${n}`, patternVersion: 2, state: 'draft' }),
      ],
    },
    201,
    `"${version}"`,
  );

describe('insert: the request', () => {
  it('sends the exact PatternInstanceRequest with the entry version as If-Match, a CSRF token and a key', async () => {
    const page = mountPage({ [PLACE]: [placed(1)] });
    await fill(page.container);
    await typeInto(
      byLabel<HTMLTextAreaElement>(
        page.container,
        'Overrides (JSON, optional)',
      ),
      '{"/hero": {"title": "mine"}}',
    );
    await click(buttonNamed(page.container, 'Place pattern'));
    await settle();
    const [call] = page.calls;
    expect(call?.path).toBe('/api/v1/cms/compositions/pattern-instances');
    expect(call?.body).toEqual({
      revisionId: REVISION_ID,
      patternId: hero.patternId,
      patternVersion: 2,
      linkMode: 'linked',
      slotPath: '/main',
      overrides: { '/hero': { title: 'mine' } },
      blockRegistryDigest: hero.blockRegistryDigest,
      expectedVersion: '9',
    });
    expect(call?.headers['if-match']).toBe('"9"');
    expect(call?.headers['x-csrf-token']).toBe('csrf-token');
    expect(call?.headers['idempotency-key']).toMatch(/^[0-9a-f-]{16,}$/u);
    noStrayRequests(page.unexpected);
  });

  it('names the result, lists the row and uses the committed entry version for the next command', async () => {
    const page = mountPage({ [PLACE]: [placed(1, '10'), placed(2, '11')] });
    await fill(page.container);
    await click(buttonNamed(page.container, 'Place pattern'));
    await settle();
    const status = page.container.querySelector(
      '[role="status"] h2, h2#cms-composition-result-heading',
    );
    expect(status?.textContent).toBe('Pattern placed');
    expect(page.container.textContent).toContain(
      'Placed 1 row pinned to hero-block version 2, linked.',
    );
    expect(
      page.container.querySelectorAll('ul.cms-instance-rows > li'),
    ).toHaveLength(1);
    expect(document.activeElement?.id).toBe('cms-composition-result-heading');
    await choose(
      byLabel<HTMLSelectElement>(page.container, 'Pattern'),
      hero.patternVersionId,
    );
    await click(buttonNamed(page.container, 'Place pattern'));
    await settle();
    expect(page.calls[1]?.headers['if-match']).toBe('"10"');
    expect(
      page.container.querySelectorAll('ul.cms-instance-rows > li'),
    ).toHaveLength(2);
  });

  it('clears the pattern and overrides after a success but keeps the slot path and link mode', async () => {
    const page = mountPage({ [PLACE]: [placed(1)] });
    await fill(page.container);
    await typeInto(
      byLabel<HTMLTextAreaElement>(
        page.container,
        'Overrides (JSON, optional)',
      ),
      '{}',
    );
    await click(buttonNamed(page.container, 'Place pattern'));
    await settle();
    expect(byLabel<HTMLSelectElement>(page.container, 'Pattern').value).toBe(
      '',
    );
    expect(
      byLabel<HTMLTextAreaElement>(page.container, 'Overrides (JSON, optional)')
        .value,
    ).toBe('');
    expect(byLabel<HTMLInputElement>(page.container, 'Slot path').value).toBe(
      '/main',
    );
    expect(byLabel<HTMLInputElement>(page.container, /^Linked/u).checked).toBe(
      true,
    );
  });
});

describe('insert: commands without a session', () => {
  it('names the missing sign-in and keeps the commands disabled', () => {
    const page = mountPage({}, { csrfToken: '' });
    expect(page.container.textContent).toContain('Sign in again to continue.');
    expect(buttonNamed(page.container, 'Place pattern').disabled).toBe(true);
  });
});

describe('insert: nothing is sent while a problem remains', () => {
  it('names every missing choice in an error summary and sends nothing', async () => {
    const page = mountPage({});
    await click(buttonNamed(page.container, 'Place pattern'));
    expect(page.calls).toHaveLength(0);
    const summary = page.container.querySelector('[role="alert"]');
    expect(summary?.textContent).toContain(
      '2 problems to fix; nothing was sent.',
    );
    expect(summary?.textContent).toContain('Choose a pattern to insert.');
    expect(summary?.textContent).toContain(
      'Choose whether the placement is linked or detached.',
    );
  });

  it('refuses overrides that are not a JSON object of node paths', async () => {
    const page = mountPage({});
    await fill(page.container);
    await typeInto(
      byLabel<HTMLTextAreaElement>(
        page.container,
        'Overrides (JSON, optional)',
      ),
      '{"hero": 1}',
    );
    await click(buttonNamed(page.container, 'Place pattern'));
    expect(page.calls).toHaveLength(0);
    expect(page.container.textContent).toContain(
      'Every override key must be a node path',
    );
  });
});

describe('insert: refusals', () => {
  it('maps a 422 at /slotPath to the slot field and keeps every input', async () => {
    const page = mountPage({
      [PLACE]: [
        refusal(422, 'COMPOSITION_VALIDATION_FAILED', {
          violations: [{ path: '/slotPath', code: 'invalid', message: 'x' }],
        }),
      ],
    });
    await fill(page.container);
    await typeInto(
      byLabel<HTMLTextAreaElement>(
        page.container,
        'Overrides (JSON, optional)',
      ),
      '{"/hero": 1}',
    );
    await click(buttonNamed(page.container, 'Place pattern'));
    await settle();
    const slot = byLabel<HTMLInputElement>(page.container, 'Slot path');
    expect(slot.getAttribute('aria-invalid')).toBe('true');
    expect(slot.value).toBe('/main');
    expect(
      byLabel<HTMLTextAreaElement>(page.container, 'Overrides (JSON, optional)')
        .value,
    ).toBe('{"/hero": 1}');
    expect(byLabel<HTMLSelectElement>(page.container, 'Pattern').value).toBe(
      hero.patternVersionId,
    );
    expect(page.container.textContent).toContain(
      'The server did not accept this slot path.',
    );
  });

  it.each([
    ['pattern_version_not_active', 'no longer active'],
    ['pattern_incompatible', 'not compatible with this entry'],
    ['block_registry_digest_mismatch', 'registry changed'],
  ])('says what a typed 422 %s means', async (reasonCode, text) => {
    const page = mountPage({
      [PLACE]: [refusal(422, 'COMPOSITION_VALIDATION_FAILED', { reasonCode })],
    });
    await fill(page.container);
    await click(buttonNamed(page.container, 'Place pattern'));
    await settle();
    expect(
      page.container.querySelector('[role="alert"]')?.textContent,
    ).toContain(text);
  });

  it('on a plain 409 reads the new entry version, keeps the input and uses the new version on the retry', async () => {
    const page = mountPage({
      [PLACE]: [
        refusal(409, 'COMPOSITION_VERSION_CONFLICT', { currentVersion: '12' }),
        placed(1, '13'),
      ],
      [ENTRY]: [entryDetail('12')],
    });
    await fill(page.container);
    await click(buttonNamed(page.container, 'Place pattern'));
    await settle();
    expect(page.container.textContent).toContain(
      'changed since this page loaded',
    );
    expect(byLabel<HTMLInputElement>(page.container, 'Slot path').value).toBe(
      '/main',
    );
    await click(buttonNamed(page.container, 'Place pattern'));
    await settle();
    expect(page.calls.at(-1)?.headers['if-match']).toBe('"12"');
    expect(page.calls.at(-1)?.headers['idempotency-key']).not.toBe(
      page.calls[0]?.headers['idempotency-key'],
    );
  });

  it('after revision_not_editable disables the commands once the draft is no longer editable', async () => {
    const page = mountPage({
      [PLACE]: [
        refusal(409, 'COMPOSITION_VERSION_CONFLICT', {
          reasonCode: 'revision_not_editable',
        }),
      ],
      [ENTRY]: [entryDetail('9', { state: 'submitted' })],
    });
    await fill(page.container);
    await click(buttonNamed(page.container, 'Place pattern'));
    await settle();
    expect(buttonNamed(page.container, 'Place pattern').disabled).toBe(true);
    expect(page.container.textContent).toContain('not an editable draft');
  });

  it('reuses the Idempotency-Key for the identical retry after an unknown outcome, and a new key after a decision', async () => {
    const page = mountPage({
      [PLACE]: [
        refusal(502, 'DEPENDENCY_UNAVAILABLE', { retryable: true }),
        refusal(422, 'COMPOSITION_VALIDATION_FAILED', {
          reasonCode: 'pattern_incompatible',
        }),
        placed(1),
      ],
    });
    await fill(page.container);
    await click(buttonNamed(page.container, 'Place pattern'));
    await settle();
    expect(page.container.textContent).toContain('The result is not known.');
    await click(buttonNamed(page.container, 'Place pattern'));
    await settle();
    await click(buttonNamed(page.container, 'Place pattern'));
    await settle();
    const keys = page.calls.map((call) => call.headers['idempotency-key']);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[1]);
  });

  it('blocks the next command for the stated wait of a 429 and keeps the input', async () => {
    const page = mountPage({
      [PLACE]: [
        refusal(
          429,
          'RATE_LIMITED',
          { retryAfterSeconds: 30 },
          { 'retry-after': '30' },
        ),
      ],
    });
    await fill(page.container);
    await click(buttonNamed(page.container, 'Place pattern'));
    await settle();
    expect(page.container.textContent).toContain('Try again in 30 seconds');
    expect(buttonNamed(page.container, 'Place pattern').disabled).toBe(true);
    expect(byLabel<HTMLInputElement>(page.container, 'Slot path').value).toBe(
      '/main',
    );
  });
});

describe('insert: the pattern selector', () => {
  it('loads the next page with the cursor, keeps the listed patterns and adds the new ones once', async () => {
    const next = selectorPage(
      [selectorItem('hero-block', 2), selectorItem('zebra', 1)],
      null,
    );
    const page = mountPage(
      { [SELECTOR]: [json(next, 200, '"7"')] },
      {
        selector: selectorPage(
          [hero, selectorItem('side-note', 1)],
          'cursor-1',
        ),
      },
    );
    await click(buttonNamed(page.container, 'Load more patterns'));
    await settle();
    expect(page.calls[0]?.search).toContain('cursor=cursor-1');
    expect(page.calls[0]?.search).toContain(`contentTypeId=`);
    const options = Array.from(
      byLabel<HTMLSelectElement>(page.container, 'Pattern').options,
    ).map((o) => o.textContent);
    expect(options).toEqual([
      'Choose a pattern',
      'hero-block version 2 (3 nodes)',
      'side-note version 1 (3 nodes)',
      'zebra version 1 (3 nodes)',
    ]);
    expect(() => buttonNamed(page.container, 'Load more patterns')).toThrow();
    expect(id(1)).toBeTruthy();
  });
});
