// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  announceCmsEditorialStatus,
  cmsEditorialAutosaveStatusMessage,
  cmsEditorialOutcomeMessage,
  focusCmsEditorialWithoutScroll,
  renderCmsEditorialValidationSummary,
  setCmsEditorialFormBusy,
} from './cms-editorial-runtime-dom-feedback';

const FIELD_A = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';

/**
 * The public signature narrows details to strings, but the renderer defensively
 * tolerates server-supplied shapes. Cast locally so the runtime guard, not the
 * type annotation, is what the test exercises.
 */
const detail = (value: unknown): string => value as string;

const form = (inner: string): HTMLFormElement => {
  const element = document.createElement('form');
  element.innerHTML = inner;
  document.body.appendChild(element);
  return element;
};

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('cmsEditorialOutcomeMessage', () => {
  it('confirms a saved revision without claiming publication', () => {
    const message = cmsEditorialOutcomeMessage('success', null, null);
    expect(message).toBe('Revision saved. Editing continues.');
    expect(message.toLowerCase()).not.toContain('publish');
  });

  it('counts down a rate limit and keeps unsent edits', () => {
    expect(cmsEditorialOutcomeMessage('rate-limited', 'RATE_LIMITED', 7)).toBe(
      'Too many saves. Retry in 7 seconds. Your unsent edits are kept.',
    );
    expect(
      cmsEditorialOutcomeMessage('rate-limited', 'RATE_LIMITED', null),
    ).toBe('Too many saves. Try again shortly. Your unsent edits are kept.');
  });

  it('never reports an unknown outcome as success', () => {
    const message = cmsEditorialOutcomeMessage('unknown', null, null);
    expect(message).toContain('could not be confirmed');
    expect(message).toContain('unsent edits are kept');
  });

  it('keeps unsent edits on an authorization denial', () => {
    expect(cmsEditorialOutcomeMessage('forbidden', 'FORBIDDEN', null)).toBe(
      'You no longer have assignment to this entry. Your unsent edits are kept in this browser only.',
    );
  });

  it('falls back to the scrubbed internal copy for an unknown code', () => {
    expect(
      cmsEditorialOutcomeMessage('degraded', 'NOT_A_REAL_CODE', null),
    ).toBe(
      'Saving failed unexpectedly. Check the current version before retrying.',
    );
    expect(cmsEditorialOutcomeMessage('degraded', null, null)).toBe(
      'Saving failed unexpectedly. Check the current version before retrying.',
    );
  });
});

describe('cmsEditorialAutosaveStatusMessage', () => {
  it('reports each cadence state truthfully', () => {
    expect(
      cmsEditorialAutosaveStatusMessage({
        dirty: true,
        saving: true,
        outcome: null,
        retryable: false,
      }),
    ).toBe('Saving changes.');
    expect(
      cmsEditorialAutosaveStatusMessage({
        dirty: false,
        saving: false,
        outcome: 'success',
        retryable: false,
      }),
    ).toBe('All changes saved.');
    expect(
      cmsEditorialAutosaveStatusMessage({
        dirty: false,
        saving: false,
        outcome: 'unknown',
        retryable: false,
      }),
    ).toBe('Save status unknown. Your unsent edits are kept.');
    expect(
      cmsEditorialAutosaveStatusMessage({
        dirty: true,
        saving: false,
        outcome: null,
        retryable: false,
      }),
    ).toBe('Unsaved changes. Autosave runs shortly.');
    expect(
      cmsEditorialAutosaveStatusMessage({
        dirty: true,
        saving: false,
        outcome: 'degraded',
        retryable: true,
      }),
    ).toBe('Unsaved changes. Retrying shortly.');
    expect(
      cmsEditorialAutosaveStatusMessage({
        dirty: true,
        saving: false,
        outcome: 'validation',
        retryable: false,
      }),
    ).toBe('Unsaved changes. Review the highlighted fields.');
    expect(
      cmsEditorialAutosaveStatusMessage({
        dirty: false,
        saving: false,
        outcome: null,
        retryable: false,
      }),
    ).toBe('No unsaved changes.');
  });

  it('prefers the unknown copy over the dirty copy when status is lost', () => {
    expect(
      cmsEditorialAutosaveStatusMessage({
        dirty: true,
        saving: false,
        outcome: 'unknown',
        retryable: true,
      }),
    ).toBe('Save status unknown. Your unsent edits are kept.');
  });
});

describe('setCmsEditorialFormBusy', () => {
  it('marks the form busy and disables the fieldset and submit control', () => {
    const element = form(
      '<fieldset><input name="title" /></fieldset><button type="submit">Save</button>',
    );
    setCmsEditorialFormBusy(element, true);
    expect(element.getAttribute('aria-busy')).toBe('true');
    expect(
      element.querySelector<HTMLFieldSetElement>('fieldset')?.disabled,
    ).toBe(true);
    const submit = element.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    expect(submit?.disabled).toBe(true);
    expect(submit?.getAttribute('aria-busy')).toBe('true');
  });

  it('restores interactivity when the form settles', () => {
    const element = form(
      '<fieldset><input name="title" /></fieldset><button type="submit">Save</button>',
    );
    setCmsEditorialFormBusy(element, true);
    setCmsEditorialFormBusy(element, false);
    expect(element.getAttribute('aria-busy')).toBe('false');
    expect(
      element.querySelector<HTMLFieldSetElement>('fieldset')?.disabled,
    ).toBe(false);
    expect(
      element.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.disabled,
    ).toBe(false);
  });

  it('never disables a fieldset marked read-only by the server render', () => {
    const element = form(
      '<fieldset data-cms-editorial-readonly="true"><input name="locked" /></fieldset>',
    );
    setCmsEditorialFormBusy(element, true);
    expect(
      element.querySelector<HTMLFieldSetElement>('fieldset')?.disabled,
    ).toBe(false);
  });

  it('tolerates a form without a fieldset or submit control', () => {
    const element = form('<input name="title" />');
    expect(() => setCmsEditorialFormBusy(element, true)).not.toThrow();
    expect(element.getAttribute('aria-busy')).toBe('true');
  });
});

describe('announceCmsEditorialStatus', () => {
  it('creates one polite atomic live region and fills it', () => {
    const region = announceCmsEditorialStatus({
      document,
      regionId: 'cms-editorial-status',
      message: 'Unsaved changes. Autosave runs shortly.',
    });
    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('aria-atomic')).toBe('true');
    expect(region.tabIndex).toBe(-1);
    expect(region.textContent).toBe('Unsaved changes. Autosave runs shortly.');
    expect(
      document.querySelectorAll('[data-cms-editorial-status]'),
    ).toHaveLength(1);
  });

  it('reuses the existing region instead of creating a second one', () => {
    const first = announceCmsEditorialStatus({
      document,
      regionId: 'cms-editorial-status',
      message: 'Saving changes.',
    });
    const second = announceCmsEditorialStatus({
      document,
      regionId: 'cms-editorial-status',
      message: 'All changes saved.',
    });
    expect(second).toBe(first);
    expect(second.textContent).toBe('All changes saved.');
    expect(
      document.querySelectorAll('[data-cms-editorial-status]'),
    ).toHaveLength(1);
  });

  it('escalates to an assertive alert only when asked', () => {
    const region = announceCmsEditorialStatus({
      document,
      regionId: 'cms-editorial-status',
      message: 'This entry changed elsewhere.',
      alert: true,
    });
    expect(region.getAttribute('role')).toBe('alert');
    expect(region.getAttribute('aria-live')).toBe('assertive');
  });
});

describe('focusCmsEditorialWithoutScroll', () => {
  it('moves focus without moving the viewport', () => {
    const element = document.createElement('input');
    document.body.appendChild(element);
    const focus = vi
      .spyOn(element, 'focus')
      .mockImplementation(() => undefined);
    focusCmsEditorialWithoutScroll(element);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });
});

describe('renderCmsEditorialValidationSummary', () => {
  const summaryId = 'cms-editorial-validation-summary';

  it('returns nothing when no field failure is carried', () => {
    const element = form('<fieldset></fieldset>');
    expect(
      renderCmsEditorialValidationSummary({
        document,
        form: element,
        details: [],
        summaryId,
      }),
    ).toBeNull();
    expect(
      element.querySelector('[data-cms-editorial-validation-summary]'),
    ).toBeNull();
  });

  it('links each carried path to its field so keyboard users can jump', () => {
    const element = form(
      '<fieldset><input id="field-a" name="body" data-cms-editorial-field="' +
        FIELD_A +
        '" /></fieldset>',
    );
    const summary = renderCmsEditorialValidationSummary({
      document,
      form: element,
      details: ['/values/' + FIELD_A],
      summaryId,
    });
    expect(summary).not.toBeNull();
    expect(element.firstElementChild).toBe(summary);
    expect(summary?.getAttribute('aria-labelledby')).toBe(
      summaryId + '-heading',
    );
    const heading = document.getElementById(summaryId + '-heading');
    expect(heading?.textContent).toBe('Check these fields before saving again');
    const link = summary?.querySelector('a');
    expect(link?.getAttribute('href')).toBe('#field-a');
    expect(link?.textContent).toBe(
      '/values/' + FIELD_A + ': Check this field.',
    );
  });

  it('renders a server message when one is supplied', () => {
    const element = form('<fieldset></fieldset>');
    const summary = renderCmsEditorialValidationSummary({
      document,
      form: element,
      details: [
        detail({ path: '/baseRevision', message: 'This revision is stale.' }),
      ],
      summaryId,
    });
    expect(summary?.querySelector('a')?.textContent).toBe(
      '/baseRevision: This revision is stale.',
    );
  });

  it('ignores detail shapes that carry no usable path', () => {
    const element = form('<fieldset></fieldset>');
    expect(
      renderCmsEditorialValidationSummary({
        document,
        form: element,
        details: [
          '',
          '   ',
          detail(null),
          detail({ message: 'no path' }),
          detail({ path: '' }),
        ],
        summaryId,
      }),
    ).toBeNull();
  });

  it('falls back to the summary anchor when the field is not rendered', () => {
    const element = form('<fieldset></fieldset>');
    const summary = renderCmsEditorialValidationSummary({
      document,
      form: element,
      details: ['/values/' + FIELD_A],
      summaryId,
    });
    expect(summary?.querySelector('a')?.getAttribute('href')).toBe(
      '#' + summaryId,
    );
  });

  it('replaces a previous summary instead of stacking duplicates', () => {
    const element = form('<fieldset></fieldset>');
    renderCmsEditorialValidationSummary({
      document,
      form: element,
      details: ['/values/' + FIELD_A],
      summaryId,
    });
    renderCmsEditorialValidationSummary({
      document,
      form: element,
      details: ['/baseRevision'],
      summaryId,
    });
    expect(
      element.querySelectorAll('[data-cms-editorial-validation-summary]'),
    ).toHaveLength(1);
    expect(element.querySelector('a')?.textContent).toContain('/baseRevision');
  });
});
