// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import CmsTemplateDesigner from './CmsTemplateDesigner';
import { CMS_TEMPLATE_NO_AUTOSAVE } from './CmsTemplateLeaveGuard';
import {
  buttonNamed,
  clickPrevented,
  context,
  created,
  mount,
  press,
  refusal,
  submit,
  surfaces,
  unloadPrevented,
  unmount,
} from './cms-template-designer.test-support';

/**
 * [P2-S12-AC-042] FE03 927 "Unsaved changes": retain the scoped draft, show an inline leave
 * confirmation, arm `beforeunload` only while dirty, and clear only after success or explicit
 * discard. FE03 1109 (`CMS-11` row): "Retain unsent values". The same contract the term form
 * (AC-048) and the composition page already carry; the CMS-11 designers carried none.
 */
beforeAll(async () => {
  await loadCmsValidators();
});
afterEach(async () => {
  await unmount();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

/** The part of Node's `process.stderr` this file spies on (the web project carries no Node types). */
interface NodeStream {
  readonly stderr: { write: (chunk: string | Uint8Array) => boolean };
}

describe.each(surfaces)(
  'CMS-11 $name: leaving with an unsent draft (FE03 "Unsaved changes")',
  (surface) => {
    it('[P2-S12-AC-042] arms beforeunload only while the form holds unsent input', async () => {
      const container = await mount(surface.render(vi.fn()));
      expect(unloadPrevented()).toBe(false);
      await surface.dirty(container);
      expect(unloadPrevented()).toBe(true);
      await surface.clean(container);
      expect(unloadPrevented()).toBe(false);
    });

    it('[P2-S12-AC-042] shows an inline confirmation instead of leaving, keeps the draft and returns focus on Keep editing', async () => {
      const navigate = vi.fn();
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => refusal(401, 'UNAUTHENTICATED')),
      );
      const container = await mount(surface.render(navigate));
      await surface.dirty(container);
      await submit(container);
      const link = container.querySelector('a[href^="/auth/sign-in"]')!;
      const before = surface.value(container);
      const prevented = clickPrevented(link);
      await act(async () => {});
      expect(prevented).toBe(true);
      expect(navigate).not.toHaveBeenCalled();
      const confirm = container.querySelector('.cms-template-leave');
      expect(confirm?.getAttribute('role')).toBe('alert');
      expect(confirm?.textContent).toContain('discards them');
      expect(surface.value(container)).toBe(before);
      await press(buttonNamed(container, 'Keep editing'));
      expect(container.querySelector('.cms-template-leave')).toBeNull();
      expect(surface.value(container)).toBe(before);
      expect(document.activeElement).toBe(link);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('[P2-S12-AC-042] leaves only through the explicit discard, to the link the person chose', async () => {
      const navigate = vi.fn();
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => refusal(401, 'UNAUTHENTICATED')),
      );
      const container = await mount(surface.render(navigate));
      await surface.dirty(container);
      await submit(container);
      const link = container.querySelector('a[href^="/auth/sign-in"]')!;
      clickPrevented(link);
      await act(async () => {});
      await press(buttonNamed(container, 'Leave without saving'));
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(link.getAttribute('href'));
    });

    it('[P2-S12-AC-042] does not intercept a link while the form is clean', async () => {
      const navigate = vi.fn();
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => refusal(401, 'UNAUTHENTICATED')),
      );
      const container = await mount(surface.render(navigate));
      await surface.dirty(container);
      await submit(container);
      await surface.clean(container);
      const link = container.querySelector('a[href^="/auth/sign-in"]')!;
      expect(clickPrevented(link)).toBe(false);
      expect(container.querySelector('.cms-template-leave')).toBeNull();
    });

    it('[P2-S12-AC-042] keeps the draft armed after a refusal and clears it only after a verified success', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(refusal(422, 'TEMPLATE_VALIDATION_FAILED'))
          .mockResolvedValueOnce(surface.success()),
      );
      const container = await mount(surface.render(vi.fn()));
      await surface.dirty(container);
      await submit(container);
      expect(unloadPrevented()).toBe(true);
      await submit(container);
      expect(container.textContent).toMatch(/Draft (created|version saved)/u);
      expect(unloadPrevented()).toBe(false);
      const latest = container.querySelector('a[href*="/templates/"]')!;
      expect(clickPrevented(latest)).toBe(false);
    });
  },
);

describe('CMS-11 create designer: explicit discard', () => {
  it('[P2-S12-AC-042] Start another draft after success leaves a clean form with the guard disarmed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(created('1'), { status: 201, headers: { etag: '"1"' } }),
      ),
    );
    const container = await mount(surfaces[0]!.render(vi.fn()));
    await surfaces[0]!.dirty(container);
    await submit(container);
    await press(buttonNamed(container, 'Start another draft'));
    expect(unloadPrevented()).toBe(false);
    await surfaces[0]!.dirty(container);
    expect(unloadPrevented()).toBe(true);
  });
});

describe('CMS-11 designer: the default destination', () => {
  it('[P2-S12-AC-042] without a navigate prop the explicit discard assigns the location the person chose', async () => {
    // jsdom reports an attempted cross-document navigation on stderr as "Not implemented: navigation".
    const written: string[] = [];
    const stream = (globalThis as unknown as { process: NodeStream }).process
      .stderr;
    const stderr = vi.spyOn(stream, 'write').mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => refusal(401, 'UNAUTHENTICATED')),
    );
    const container = await mount(
      <CmsTemplateDesigner context={context} csrfToken="csrf-token" />,
    );
    await surfaces[0]!.dirty(container);
    await submit(container);
    clickPrevented(container.querySelector('a[href^="/auth/sign-in"]')!);
    await act(async () => {});
    expect(written.join('')).not.toContain('Not implemented: navigation');
    await press(buttonNamed(container, 'Leave without saving'));
    stderr.mockRestore();
    expect(written.join('')).toContain('Not implemented: navigation');
  });
});

describe('CMS-11 designer: no autosave', () => {
  it('[P2-S12-AC-042] the guard has nothing to save and always reports the draft as still unsent', async () => {
    await expect(CMS_TEMPLATE_NO_AUTOSAVE.save()).resolves.toBeUndefined();
    expect(CMS_TEMPLATE_NO_AUTOSAVE.stillUnsent()).toBe(true);
  });
});
