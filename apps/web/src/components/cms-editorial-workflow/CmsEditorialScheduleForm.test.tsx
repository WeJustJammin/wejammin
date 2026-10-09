// @vitest-environment jsdom
import { loadPinnedTimeAuthority } from '@wejammin/contracts/time-authority';
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { MemoryStorage } from '../../lib/test-support/memory-storage';
import {
  buttonNamed,
  byLabel,
  choose,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  COMMAND_CASES,
  CSRF,
} from '../../server/cms-workflow-platform-command.test-support';
import CmsEditorialScheduleForm from './CmsEditorialScheduleForm';
import {
  REVISION_ID,
  apiError,
  jsonResponse,
  scheduleResourceFixture,
} from './cms-workflow-fixtures.test-support';

// axe runs and the 218 KB tz snapshot are slow on a loaded host; waits are
// conditions, not budgets (the specs assert the real budgets elsewhere).
vi.setConfig({ testTimeout: 90_000 });

beforeAll(enableReactAct);
afterAll(disableReactAct);

const KEY = 'idem-key-schedule-001';
const NOW = Date.parse('2026-10-08T12:00:00Z');
const authority = await loadPinnedTimeAuthority();

const accepted = (overrides: Record<string, unknown> = {}) =>
  jsonResponse(202, scheduleResourceFixture(overrides), {
    etag: '"1"',
    location: COMMAND_CASES['CMS-03B-07'].location as string,
  });
const stepUp = () =>
  jsonResponse(
    401,
    apiError('STEP_UP_REQUIRED', {
      recoveryAction: 'step_up',
      allowedMethods: ['totp'],
    }),
  );

const mount = (
  responses: readonly Response[],
  extra: Partial<React.ComponentProps<typeof CmsEditorialScheduleForm>> = {},
  storage = new MemoryStorage(),
) => {
  const queue = [...responses];
  const fetcher = vi.fn(async () => queue.shift() as Response);
  const refetch = vi.fn(async () => true);
  const onDone = vi.fn();
  const navigate = vi.fn();
  const loadAuthority = vi.fn(async () => authority);
  const mounted = mountElement(
    <CmsEditorialScheduleForm
      revisionId={REVISION_ID}
      reviewVersion="5"
      disabledReason={null}
      refetch={refetch}
      onDone={onDone}
      now={() => NOW}
      defaultTimezone=""
      loadAuthority={loadAuthority}
      environment={{
        transport: { fetcher, documentRef: { cookie: `wj_csrf=${CSRF}` } },
        newKey: () => KEY,
        storage: () => storage,
        navigate,
      }}
      {...extra}
    />,
  );
  return {
    ...mounted,
    fetcher,
    refetch,
    onDone,
    navigate,
    storage,
    loadAuthority,
  };
};

const open = async (container: HTMLElement) => {
  const details = container.querySelector('details') as HTMLDetailsElement;
  details.open = true;
  await act(async () => {
    details.dispatchEvent(new Event('toggle'));
  });
  await flush();
};
const { act } = React;

const fill = async (
  container: HTMLElement,
  local: string,
  zone: string,
  audience = 'members',
) => {
  await typeInto(
    byLabel<HTMLInputElement>(container, 'Local date and time'),
    local,
  );
  await typeInto(byLabel<HTMLInputElement>(container, 'Time zone'), zone);
  await typeInto(byLabel<HTMLInputElement>(container, 'Audience'), audience);
};

describe('lazy Time authority', () => {
  it('does not load the tz snapshot until the form is opened, then loads it once', async () => {
    const { container, loadAuthority } = mount([]);
    expect(loadAuthority).not.toHaveBeenCalled();
    await open(container);
    expect(loadAuthority).toHaveBeenCalledTimes(1);
    await open(container);
    expect(loadAuthority).toHaveBeenCalledTimes(1);
    expect(
      container.querySelectorAll('datalist option').length,
    ).toBeGreaterThan(300);
  });

  it('says so and blocks sending when the snapshot cannot be loaded', async () => {
    const { container, fetcher } = mount([], {
      loadAuthority: async () => {
        throw new Error('integrity');
      },
    });
    await open(container);
    expect(container.textContent).toContain(
      'The time zone data could not be loaded.',
    );
    await click(buttonNamed(container, 'Schedule'));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('suggests the browser zone when the snapshot knows it', async () => {
    const known = mount([], { defaultTimezone: 'Europe/Paris' });
    await open(known.container);
    expect(byLabel<HTMLInputElement>(known.container, 'Time zone').value).toBe(
      'Europe/Paris',
    );
    // Element ids repeat across mounts, so each case owns the document alone.
    known.unmount();
    const unknown = mount([], { defaultTimezone: 'Nowhere/Land' });
    await open(unknown.container);
    expect(
      byLabel<HTMLInputElement>(unknown.container, 'Time zone').value,
    ).toBe('');
  });
});

describe('resolution shown beside the inputs', () => {
  it('shows the resolved instant and offset in a polite region', async () => {
    const { container } = mount([]);
    await open(container);
    await fill(container, '2026-11-02T09:30', 'America/New_York');
    const status = container.querySelector(
      '[data-cms-schedule-status]',
    ) as HTMLElement;
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toContain('2026-11-02T14:30:00Z');
    expect(status.textContent).toContain('UTC-05:00');
    expect(status.textContent).toContain('time zone data 2026e');
  });

  it('offers the two alternatives of a nonexistent time and applies the chosen one', async () => {
    const { container } = mount([]);
    await open(container);
    await fill(container, '2027-03-14T02:30', 'America/New_York');
    const radios = container.querySelectorAll<HTMLInputElement>(
      '[data-cms-schedule-resolution] input[type="radio"]',
    );
    expect(radios).toHaveLength(2);
    expect(container.textContent).toContain(
      'That local time does not exist in this time zone.',
    );
    await click(radios[1] as HTMLElement);
    expect(
      byLabel<HTMLInputElement>(container, 'Local date and time').value,
    ).toBe('2027-03-14T03:30');
    expect(
      container.querySelector('[data-cms-schedule-resolution]')?.textContent,
    ).toContain('2027-03-14T07:30:00Z');
  });

  it('offers earlier and later for an ambiguous time with both instants', async () => {
    const { container } = mount([]);
    await open(container);
    await fill(container, '2026-11-01T01:30', 'America/New_York');
    expect(container.textContent).toContain('That local time happens twice.');
    expect(container.textContent).toContain('2026-11-01T05:30:00Z');
    expect(container.textContent).toContain('2026-11-01T06:30:00Z');
    const later = container.querySelector<HTMLInputElement>(
      '[data-cms-schedule-resolution] input[value="later"]',
    );
    await click(later as HTMLElement);
    expect(
      container.querySelector('[data-cms-schedule-resolution]')?.textContent,
    ).toContain('2026-11-01T06:30:00Z');
  });

  it('refuses an unknown zone and a time outside the window with the stated bounds', async () => {
    const { container } = mount([]);
    await open(container);
    await fill(container, '2026-11-02T09:30', 'Mars/Olympus');
    expect(container.textContent).toContain(
      'That time zone is not recognised.',
    );
    await typeInto(byLabel<HTMLInputElement>(container, 'Time zone'), 'UTC');
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Local date and time'),
      '2026-10-08T12:00',
    );
    expect(container.textContent).toContain(
      'Choose a time between 2026-10-08T12:01:00.000Z and 2027-10-09T12:00:00.000Z.',
    );
  });
});

describe('schedule (CMS-03B-07)', () => {
  it('refuses incomplete input without sending and focuses the summary', async () => {
    const { container, fetcher } = mount([accepted()]);
    await open(container);
    await click(buttonNamed(container, 'Schedule'));
    const alert = container.querySelector(
      '[data-cms-workflow-local-errors]',
    ) as HTMLElement;
    expect(alert.textContent).toContain('Choose a local date and time.');
    expect(alert.textContent).toContain('Choose a time zone.');
    expect(alert.textContent).toContain('Enter an audience.');
    await fill(container, '2026-11-02T09:30', 'UTC', 'Not Valid');
    await click(buttonNamed(container, 'Schedule'));
    expect(
      container.querySelector('[data-cms-workflow-local-errors]')?.textContent,
    ).toContain(
      'Use lowercase letters, digits, hyphens and underscores, up to 48 characters.',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('sends the resolved request and states Scheduled, not published', async () => {
    const { container, fetcher, refetch, onDone } = mount([
      accepted({
        action: 'expire',
        localDateTime: '2026-11-02T09:30',
        resolvedUtc: '2026-11-02T14:30:00Z',
      }),
    ]);
    await open(container);
    await choose(byLabel<HTMLSelectElement>(container, 'Action'), 'expire');
    await fill(container, '2026-11-02T09:30', 'America/New_York');
    await click(buttonNamed(container, 'Schedule'));
    await flush();
    const [target, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(target).toBe('/api/v1/cms/publication-schedules');
    expect(JSON.parse(init.body as string)).toEqual({
      revisionId: REVISION_ID,
      action: 'expire',
      localDateTime: '2026-11-02T09:30',
      timezone: 'America/New_York',
      resolvedUtc: '2026-11-02T14:30:00Z',
      tzdbVersion: '2026e',
      disambiguation: 'none',
      audience: 'members',
      expectedVersion: '5',
    });
    expect(new Headers(init.headers).get('if-match')).toBe('"5"');
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('workflow-schedules-title');
    const status =
      container.querySelector('[data-cms-workflow-status]')?.textContent ?? '';
    expect(status).toContain('Scheduled, not published');
    expect(status).not.toMatch(/\bpublished\.$/u);
  });

  it('sends the chosen earlier/later disambiguation for an ambiguous time', async () => {
    const { container, fetcher } = mount([
      accepted({
        disambiguation: 'earlier',
        localDateTime: '2026-11-01T01:30',
        timezone: 'America/New_York',
        resolvedUtc: '2026-11-01T05:30:00Z',
      }),
    ]);
    await open(container);
    await fill(container, '2026-11-01T01:30', 'America/New_York');
    await click(buttonNamed(container, 'Schedule'));
    expect(
      container.querySelector('[data-cms-workflow-local-errors]')?.textContent,
    ).toContain('Choose the earlier or later time.');
    await click(
      container.querySelector('input[value="earlier"]') as HTMLElement,
    );
    await click(buttonNamed(container, 'Schedule'));
    await flush();
    const body = JSON.parse(
      (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1]
        .body as string,
    );
    expect(body).toMatchObject({
      disambiguation: 'earlier',
      resolvedUtc: '2026-11-01T05:30:00Z',
    });
  });

  it('refuses to send a nonexistent time or one outside the window', async () => {
    const { container, fetcher } = mount([accepted()]);
    await open(container);
    await fill(container, '2027-03-14T02:30', 'America/New_York');
    await click(buttonNamed(container, 'Schedule'));
    expect(
      container.querySelector('[data-cms-workflow-local-errors]')?.textContent,
    ).toContain('That local time does not exist in this time zone.');
    await fill(container, '2026-10-08T12:00', 'UTC');
    await click(buttonNamed(container, 'Schedule'));
    expect(
      container.querySelector('[data-cms-workflow-local-errors]')?.textContent,
    ).toContain('Choose a time between');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('names the server time refusals at the field', async () => {
    const { container } = mount([
      jsonResponse(
        422,
        apiError('VALIDATION_FAILED', {
          reasonCode: 'authority_ends_before_schedule',
        }),
      ),
    ]);
    await open(container);
    await fill(container, '2026-11-02T09:30', 'UTC');
    await click(buttonNamed(container, 'Schedule'));
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Your publisher access ends before this time.',
    );
    expect(
      byLabel<HTMLInputElement>(container, 'Local date and time').getAttribute(
        'aria-invalid',
      ),
    ).toBe('true');
  });

  it('refetches for a changed approved candidate and renders the separation gate for a second-person rule', async () => {
    const stale = mount([
      jsonResponse(
        409,
        apiError('CONFLICT', { reasonCode: 'version_set_stale' }),
      ),
    ]);
    await open(stale.container);
    await fill(stale.container, '2026-11-02T09:30', 'UTC');
    await click(buttonNamed(stale.container, 'Schedule'));
    await flush();
    expect(
      stale.container.querySelector('[role="alert"]')?.textContent,
    ).toContain('The approved candidate changed. Review the updated checks.');
    expect(stale.refetch).toHaveBeenCalledTimes(1);
    stale.unmount();
    const gate = mount([
      jsonResponse(
        403,
        apiError('FORBIDDEN', { reasonCode: 'separation_of_duties' }),
      ),
    ]);
    await open(gate.container);
    await fill(gate.container, '2026-11-02T09:30', 'UTC');
    await click(buttonNamed(gate.container, 'Schedule'));
    await flush();
    expect(
      gate.container.querySelector('[data-cms-editorial-capability-gate]')
        ?.textContent,
    ).toContain(
      'A second person with the publisher capability must publish this revision.',
    );
  });

  it('stores the scoped draft for step-up, restores it open and re-confirms under the original key', async () => {
    const storage = new MemoryStorage();
    const first = mount([stepUp()], {}, storage);
    await open(first.container);
    await choose(
      byLabel<HTMLSelectElement>(first.container, 'Action'),
      'archive',
    );
    await fill(first.container, '2026-11-02T09:30', 'UTC', 'staff');
    await click(buttonNamed(first.container, 'Schedule'));
    await vi.waitFor(() => expect(first.navigate).toHaveBeenCalledTimes(1));
    const stored = JSON.parse(
      storage.getItem('wj-step-up-draft:cms:/:CMS-03B-07') as string,
    );
    expect(stored.values).toEqual({
      action: 'archive',
      localDateTime: '2026-11-02T09:30',
      timezone: 'UTC',
      audience: 'staff',
      disambiguation: 'none',
    });
    expect(stored.idempotencyKey).toBe(KEY);
    expect(stored.expectedVersion).toBe('5');
    first.unmount();

    const returned = mount(
      [
        accepted({
          action: 'archive',
          localDateTime: '2026-11-02T09:30',
          timezone: 'UTC',
          resolvedUtc: '2026-11-02T09:30:00Z',
          audience: 'staff',
        }),
      ],
      {},
      storage,
    );
    await flush();
    const details = returned.container.querySelector(
      'details',
    ) as HTMLDetailsElement;
    expect(details.open).toBe(true);
    expect(
      byLabel<HTMLInputElement>(returned.container, 'Audience').value,
    ).toBe('staff');
    expect(
      byLabel<HTMLInputElement>(returned.container, 'Time zone').value,
    ).toBe('UTC');
    expect(returned.fetcher).not.toHaveBeenCalled();
    await click(buttonNamed(returned.container, 'Schedule'));
    await flush();
    expect(returned.fetcher).toHaveBeenCalledTimes(1);
    expect(
      new Headers(
        (returned.fetcher.mock.calls[0] as unknown as [string, RequestInit])[1]
          .headers,
      ).get('idempotency-key'),
    ).toBe(KEY);
  });

  it('refuses to send while the read behind it is not verified', async () => {
    const { container, fetcher } = mount([accepted()], {
      disabledReason: 'Reload the page.',
    });
    await open(container);
    await fill(container, '2026-11-02T09:30', 'UTC');
    await click(buttonNamed(container, 'Schedule'));
    expect(fetcher).not.toHaveBeenCalled();
  });
});
