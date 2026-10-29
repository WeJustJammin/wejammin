// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import CmsTemplateEditDesigner from './CmsTemplateEditDesigner';
import {
  buttonNamed,
  clickPrevented,
  context,
  created,
  detail,
  mount,
  press,
  refusal,
  setInput,
  submit,
  surfaces,
  unloadPrevented,
  unmount,
} from './cms-template-designer.test-support';

/**
 * [P2-S12-AC-042] FE03 927 "Unsaved changes" for the CMS-11 designers, the cases the in-island
 * 401 link of `CmsTemplateDesigner.unsaved.test.tsx` cannot see: the page's own navigation lies
 * OUTSIDE the island (templates/new.astro and [templateKey].astro render the header links beside
 * it), a value typed while the save is still pending, the keyboard path of the confirmation and
 * the parent a rebased successor is measured against.
 */
beforeAll(async () => {
  await loadCmsValidators();
});
afterEach(async () => {
  await unmount();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const withHeaderLink = (element: React.ReactElement): React.ReactElement => (
  <>
    <a id="page-header-link" href="/app/cms-content-modeling">
      Content modeling
    </a>
    {element}
  </>
);
const pending = () => {
  let answer: (response: Response) => void = () => undefined;
  const fetcher = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        answer = resolve;
      }),
  );
  return { fetcher, answer: (response: Response) => answer(response) };
};

describe.each(surfaces)(
  'CMS-11 $name: a link outside the island (page header)',
  (surface) => {
    it('[P2-S12-AC-042] a dirty form opens the inline confirmation for a page link outside the island, keeps the draft and moves focus to Keep editing', async () => {
      const navigate = vi.fn();
      const container = await mount(withHeaderLink(surface.render(navigate)));
      await surface.dirty(container);
      const before = surface.value(container);
      const link = container.querySelector('#page-header-link')!;
      expect(clickPrevented(link)).toBe(true);
      await act(async () => {});
      expect(navigate).not.toHaveBeenCalled();
      expect(
        container.querySelector('.cms-template-leave')?.getAttribute('role'),
      ).toBe('alert');
      // FE03 927 keyboard path: the confirmation takes focus on the safe choice.
      expect(document.activeElement).toBe(
        buttonNamed(container, 'Keep editing'),
      );
      expect(surface.value(container)).toBe(before);
      await press(buttonNamed(container, 'Keep editing'));
      expect(document.activeElement).toBe(link);
      clickPrevented(link);
      await act(async () => {});
      await press(buttonNamed(container, 'Leave without saving'));
      expect(navigate).toHaveBeenCalledWith('/app/cms-content-modeling');
    });

    it('[P2-S12-AC-042] a clean form lets a page link outside the island navigate', async () => {
      const container = await mount(withHeaderLink(surface.render(vi.fn())));
      expect(
        clickPrevented(container.querySelector('#page-header-link')!),
      ).toBe(false);
      expect(container.querySelector('.cms-template-leave')).toBeNull();
    });
  },
);

describe.each(surfaces)(
  'CMS-11 $name: an edit typed while the save is pending',
  (surface) => {
    it('[P2-S12-AC-042] stays unsent after the verified 201: the guard stays armed, the late value is kept and a notice says it was not saved', async () => {
      const wire = pending();
      vi.stubGlobal('fetch', wire.fetcher);
      const container = await mount(surface.render(vi.fn()));
      await surface.dirty(container);
      await submit(container);
      expect(wire.fetcher).toHaveBeenCalledTimes(1);
      await surface.late(container);
      await act(async () => {
        wire.answer(surface.success());
      });
      expect(container.textContent).toMatch(/Draft (created|version saved)/u);
      expect(container.textContent).toContain('while this was saving');
      expect(container.textContent).toContain('not part of the saved draft');
      expect(surface.audience(container)).toBe('LATE-EDIT');
      expect(unloadPrevented()).toBe(true);
    });

    it('[P2-S12-AC-042] carries no late-edit notice and disarms the guard when nothing was typed during the save', async () => {
      const wire = pending();
      vi.stubGlobal('fetch', wire.fetcher);
      const container = await mount(surface.render(vi.fn()));
      await surface.dirty(container);
      await submit(container);
      await act(async () => {
        wire.answer(surface.success());
      });
      expect(container.textContent).not.toContain('while this was saving');
      expect(unloadPrevented()).toBe(false);
    });
  },
);

describe('CMS-11 successor designer: the baseline is the parent the form was rebased onto', () => {
  it('[P2-S12-AC-042] after "Use version 3 as parent" a form equal to the new parent is clean and one that differs is dirty', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(refusal(409, 'TEMPLATE_VERSION_CONFLICT'))
        .mockResolvedValueOnce(
          Response.json(
            { ...detail, version: '3', templateVersion: 3, audience: 'newer' },
            { status: 200, headers: { etag: '"3"' } },
          ),
        ),
    );
    vi.stubGlobal('crypto', { randomUUID: () => 'rebase-attempt-001' });
    const container = await mount(
      <CmsTemplateEditDesigner
        context={context}
        detail={detail}
        csrfToken="csrf-token"
        navigate={vi.fn()}
      />,
    );
    const audience = () =>
      container.querySelector<HTMLInputElement>('#cms-template-audience')!;
    await act(async () => setInput(audience(), 'changed'));
    await submit(container);
    await press(buttonNamed(container, 'Check latest version'));
    await press(
      Array.from(container.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('Use version 3 as parent'),
      )!,
    );
    expect(created('3').version).toBe('3');
    // Typed to equal the new parent: nothing is unsent against it (against the first parent it would be).
    await act(async () => setInput(audience(), 'newer'));
    expect(unloadPrevented()).toBe(false);
    await act(async () => setInput(audience(), 'changed'));
    expect(unloadPrevented()).toBe(true);
    // Typed back to the FIRST parent's value, which differs from the rebased parent: dirty.
    await act(async () => setInput(audience(), 'public'));
    expect(unloadPrevented()).toBe(true);
  });
});
