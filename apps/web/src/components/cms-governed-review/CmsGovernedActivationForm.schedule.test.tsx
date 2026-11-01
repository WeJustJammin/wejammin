// @vitest-environment jsdom
import { CMS_TZDB_VERSION } from '@wejammin/contracts/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';

import { MemoryStorage } from '../../lib/test-support/memory-storage';
import { loadCmsValidators } from '../../lib/cms-contract-validators';
import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { governedScheduledFixture } from '../../server/cms-governed-review-fixtures.test-support';
import {
  accepted,
  apiFailure,
  choosing,
  continueButton,
  mountActivation,
  radio,
  statusLine,
  stepUp,
} from './governed-activation-form.test-support';
import {
  bodyOf,
  flushUntil,
  headersOf,
} from './governed-review-form-test-support';

beforeAll(preloadWorkflowAnswerMachinery);

// The 218 KB tz snapshot is slow on a loaded host; waits are conditions, not budgets.
vi.setConfig({ testTimeout: 90_000 });

beforeAll(enableReactAct);
beforeAll(async () => {
  await loadCmsValidators();
});
afterAll(disableReactAct);

const local = (container: HTMLElement) =>
  byLabel<HTMLInputElement>(container, 'Local date and time');
const zone = (container: HTMLElement) =>
  byLabel<HTMLInputElement>(container, 'Time zone');

const fill = async (container: HTMLElement, when: string, where: string) => {
  await typeInto(local(container), when);
  await typeInto(zone(container), where);
};

const scheduling = async (
  responses: Parameters<typeof mountActivation>[0],
  extra: Parameters<typeof mountActivation>[1] = {},
  storage?: MemoryStorage,
) => {
  const mounted = mountActivation(responses, extra, storage);
  await choosing(mounted.container, 'Schedule activation');
  await flush();
  return mounted;
};

describe('schedule fields and the shared Time authority', () => {
  it('loads the tz snapshot only when scheduling is chosen, then once', async () => {
    const { container, loadAuthority } = mountActivation([]);
    expect(loadAuthority).not.toHaveBeenCalled();
    await choosing(container, 'Activate now');
    expect(loadAuthority).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('Local date and time');
    await choosing(container, 'Schedule activation');
    await flush();
    expect(loadAuthority).toHaveBeenCalledTimes(1);
    await choosing(container, 'Activate now');
    await choosing(container, 'Schedule activation');
    expect(loadAuthority).toHaveBeenCalledTimes(1);
    expect(
      container.querySelectorAll('datalist option').length,
    ).toBeGreaterThan(300);
  });

  it('shows the resolved instant beside the inputs', async () => {
    const { container } = await scheduling([]);
    await fill(container, '2026-12-01T09:00', 'America/New_York');
    expect(
      container.querySelector('[data-cms-schedule-status]')?.textContent,
    ).toBe(
      `Resolved to 2026-12-01T14:00:00Z (UTC-05:00, time zone data ${CMS_TZDB_VERSION}).`,
    );
  });

  it('says so and blocks sending when the snapshot cannot be loaded', async () => {
    const { container, fetcher } = mountActivation([], {
      loadAuthority: async () => {
        throw new Error('integrity');
      },
    });
    await choosing(container, 'Schedule activation');
    await flush();
    expect(container.textContent).toContain(
      'The time zone data could not be loaded.',
    );
    await fill(container, '2026-12-01T09:00', 'America/New_York');
    await click(continueButton(container));
    expect(
      container.querySelector('[data-cms-workflow-local-errors]')?.textContent,
    ).toContain('The time zone data is not loaded yet.');
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('local checks before anything is sent', () => {
  it('refuses a missing time and zone', async () => {
    const { container, fetcher } = await scheduling([]);
    await click(continueButton(container));
    const text =
      container.querySelector('[data-cms-workflow-local-errors]')
        ?.textContent ?? '';
    expect(text).toContain('Choose a local date and time.');
    expect(text).toContain('Choose a time zone.');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('refuses a time that does not exist, an unknown zone and a time outside the horizon', async () => {
    const { container, fetcher } = await scheduling([]);
    await fill(container, '2027-03-14T02:30', 'America/New_York');
    await click(continueButton(container));
    expect(
      container.querySelector('[data-cms-workflow-local-errors]')?.textContent,
    ).toContain('That local time does not exist in this time zone.');
    await typeInto(zone(container), 'Mars/Olympus');
    await click(continueButton(container));
    expect(
      container.querySelector('[data-cms-workflow-local-errors]')?.textContent,
    ).toContain('That time zone is not recognised.');
    await fill(container, '2026-10-14T12:00', 'America/New_York');
    await click(continueButton(container));
    expect(
      container.querySelector('[data-cms-workflow-local-errors]')?.textContent,
    ).toContain('Choose a time between');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('names a local value the resolver cannot parse and opens no confirmation (a five-digit year)', async () => {
    const { container, fetcher } = await scheduling([]);
    await fill(container, '12345-10-20T10:00', 'America/New_York');
    await click(continueButton(container));
    const alert = container.querySelector(
      '[data-cms-workflow-local-errors]',
    ) as HTMLElement;
    expect(alert.textContent).toContain('Enter a valid local date and time.');
    expect(
      container.querySelector('#governed-activation-confirm-title'),
    ).toBeNull();
    expect(container.textContent).not.toContain('Activate Template');
    expect(document.activeElement).toBe(alert);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('asks for earlier or later when the local time happens twice', async () => {
    const { container, fetcher } = await scheduling([]);
    await fill(container, '2026-11-01T01:30', 'America/New_York');
    await click(continueButton(container));
    expect(
      container.querySelector('[data-cms-workflow-local-errors]')?.textContent,
    ).toContain('Choose the earlier or later time.');
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('an earlier or later choice belongs to one instant', () => {
  it('is forgotten when the local time changes', async () => {
    const { container, fetcher } = await scheduling([]);
    await fill(container, '2026-11-01T01:30', 'America/New_York');
    await click(
      container.querySelector<HTMLInputElement>(
        'input[name="schedule-fold"][value="earlier"]',
      ) as HTMLInputElement,
    );
    await typeInto(local(container), '2026-11-01T01:45');
    await click(continueButton(container));
    expect(
      container.querySelector('[data-cms-workflow-local-errors]')?.textContent,
    ).toContain('Choose the earlier or later time.');
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('schedule commit', () => {
  const scheduledOk = () => accepted(202, governedScheduledFixture(), '"2"');

  it('confirms the instant, sends activateAt at the review version and reads "Scheduled, not active"', async () => {
    const { container, fetcher, refetch, onDone } = await scheduling([
      scheduledOk(),
    ]);
    await fill(container, '2026-12-01T09:00', 'America/New_York');
    await click(continueButton(container));
    expect(
      container.querySelector('#governed-activation-confirm-title')
        ?.textContent,
    ).toBe('Confirm scheduled activation');
    expect(container.textContent).toContain(
      'Schedule activation of Template profile-header, version 2 for 2026-12-01T09:00 in America/New_York (2026-12-01T14:00:00Z).',
    );
    expect(fetcher).not.toHaveBeenCalled();
    await click(buttonNamed(container, 'Schedule activation'));
    await flush();
    expect(bodyOf(fetcher)).toEqual({
      action: 'schedule',
      expectedVersion: '2',
      activateAt: {
        localDateTime: '2026-12-01T09:00',
        timezone: 'America/New_York',
        resolvedUtc: '2026-12-01T14:00:00Z',
        tzdbVersion: CMS_TZDB_VERSION,
        disambiguation: 'none',
      },
    });
    expect(headersOf(fetcher).get('if-match')).toBe('"2"');
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('governed-summary-title');
    expect(statusLine(container)).toBe(
      'Scheduled, not active: Template profile-header, version 2 will activate at 2026-12-01T14:00:00Z. Nothing changes before then.',
    );
  });

  it('sends the chosen earlier instant of a repeated local time', async () => {
    const { container, fetcher } = await scheduling([
      accepted(
        202,
        governedScheduledFixture({ scheduledForUtc: '2026-11-01T05:30:00Z' }),
        '"2"',
      ),
    ]);
    await fill(container, '2026-11-01T01:30', 'America/New_York');
    await click(
      container.querySelector<HTMLInputElement>(
        'input[name="schedule-fold"][value="earlier"]',
      ) as HTMLInputElement,
    );
    await click(continueButton(container));
    await click(buttonNamed(container, 'Schedule activation'));
    await flush();
    expect(
      (bodyOf(fetcher).activateAt as Record<string, unknown>).disambiguation,
    ).toBe('earlier');
  });

  it('refuses a server time token at its control with fixed copy and refetches nothing', async () => {
    const { container, refetch } = await scheduling([
      apiFailure(422, 'GOVERNED_REVIEW_VALIDATION_FAILED', {
        reasonCode: 'resolved_utc_mismatch',
      }),
    ]);
    await fill(container, '2026-12-01T09:00', 'America/New_York');
    await click(continueButton(container));
    await click(buttonNamed(container, 'Schedule activation'));
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'The resolved time did not match. Choose the time again.',
    );
    expect(local(container).getAttribute('aria-invalid')).toBe('true');
    expect(refetch).not.toHaveBeenCalled();
  });

  it('keeps the schedule entries across the step-up detour', async () => {
    const storage = new MemoryStorage();
    const first = await scheduling([stepUp()], {}, storage);
    await fill(first.container, '2026-12-01T09:00', 'America/New_York');
    await click(continueButton(first.container));
    await click(buttonNamed(first.container, 'Schedule activation'));
    await flushUntil(
      () => storage.getItem('wj-step-up-draft:cms:/:CMS-03C-09') !== null,
    );
    const stored = JSON.parse(
      storage.getItem('wj-step-up-draft:cms:/:CMS-03C-09') as string,
    ) as { values: Record<string, string> };
    expect(stored.values).toMatchObject({
      action: 'schedule',
      localDateTime: '2026-12-01T09:00',
      timezone: 'America/New_York',
    });
    expect(Object.keys(stored.values)).not.toContain('resolvedUtc');
    first.unmount();

    const returned = mountActivation([scheduledOk()], {}, storage);
    await flush();
    expect(radio(returned.container, 'Schedule activation').checked).toBe(true);
    expect(local(returned.container).value).toBe('2026-12-01T09:00');
    expect(zone(returned.container).value).toBe('America/New_York');
    await click(continueButton(returned.container));
    await click(buttonNamed(returned.container, 'Schedule activation'));
    await flush();
    expect(returned.fetcher).toHaveBeenCalledTimes(1);
  });
});
