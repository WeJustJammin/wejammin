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
import { openDetails } from './cms-workflow-focus.test-support';
import {
  REVISION_ID,
  apiError,
  approvedWorkflowFixture,
  jsonResponse,
  scheduleResourceFixture,
} from './cms-workflow-fixtures.test-support';
import { mountWorkflowIsland } from './cms-workflow-island-mount.test-support';

// The tz snapshot is 218 KB; waits are conditions, not budgets.
vi.setConfig({ testTimeout: 90_000 });

beforeAll(enableReactAct);
afterAll(disableReactAct);

const KEY = 'idem-key-schedule-002';
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
  publishPermitted: boolean,
  responses: readonly Response[] = [],
  storage = new MemoryStorage(),
) => {
  const queue = [...responses];
  const fetcher = vi.fn(async () => queue.shift() as Response);
  const navigate = vi.fn();
  const form = (permitted: boolean) => (
    <CmsEditorialScheduleForm
      revisionId={REVISION_ID}
      reviewVersion="5"
      disabledReason={null}
      refetch={async () => true}
      onDone={() => undefined}
      now={() => NOW}
      defaultTimezone=""
      loadAuthority={async () => authority}
      publishPermitted={permitted}
      environment={{
        transport: { fetcher, documentRef: { cookie: `wj_csrf=${CSRF}` } },
        newKey: () => KEY,
        storage: () => storage,
        navigate,
      }}
    />
  );
  const mounted = mountElement(form(publishPermitted));
  return {
    ...mounted,
    fetcher,
    navigate,
    storage,
    permit: (permitted: boolean) => mounted.rerender(form(permitted)),
  };
};

const action = (container: HTMLElement) =>
  byLabel<HTMLSelectElement>(container, 'Action');
const actions = (container: HTMLElement): string[] =>
  [...action(container).options].map((option) => option.value);

const fill = async (container: HTMLElement, local: string, zone: string) => {
  await typeInto(
    byLabel<HTMLInputElement>(container, 'Local date and time'),
    local,
  );
  await typeInto(byLabel<HTMLInputElement>(container, 'Time zone'), zone);
  await typeInto(byLabel<HTMLInputElement>(container, 'Audience'), 'members');
};

const sentBody = (fetcher: ReturnType<typeof vi.fn>) =>
  JSON.parse(
    (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1]
      .body as string,
  );

const AUTHOR_HINT =
  'Publish is not offered here: a second person with the publisher capability must publish this revision. You can still schedule the other actions.';

/*
 * BE03b:268-270: only the action `publish` is refused to the revision author
 * (403 separation_of_duties); unpublish, expire and archive stay schedulable.
 * The form takes the publish permission the server proved (the workflow read's
 * `permittedNextActions`), so an author is never offered, or defaulted to, the
 * one action the server will refuse, and never loses the three it will accept.
 */
describe('schedule actions follow the server-proven publish permission', () => {
  it('[P2-S11-AC-040] offers all four actions and defaults to Publish when the caller may publish', async () => {
    const { container } = mount(true);
    expect(actions(container)).toEqual([
      'publish',
      'unpublish',
      'expire',
      'archive',
    ]);
    expect(action(container).value).toBe('publish');
    expect(container.textContent).not.toContain(AUTHOR_HINT);
  });

  it('[P2-S11-AC-040] withholds Publish from an author, keeps the other three and defaults to the first of them', async () => {
    const { container } = mount(false);
    expect(actions(container)).toEqual(['unpublish', 'expire', 'archive']);
    expect(action(container).value).toBe('unpublish');
    expect(container.querySelector('#schedule-action-hint')?.textContent).toBe(
      AUTHOR_HINT,
    );
    expect(action(container).getAttribute('aria-describedby')).toContain(
      'schedule-action-hint',
    );
  });

  it('[P2-S11-AC-040] schedules the default non-publish action for an author without touching the select', async () => {
    const { container, fetcher } = mount(false, [
      accepted({
        action: 'unpublish',
        localDateTime: '2026-11-02T09:30',
        resolvedUtc: '2026-11-02T14:30:00Z',
      }),
    ]);
    await openDetails(container);
    await fill(container, '2026-11-02T09:30', 'America/New_York');
    await click(buttonNamed(container, 'Schedule'));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(sentBody(fetcher)).toMatchObject({
      action: 'unpublish',
      audience: 'members',
      resolvedUtc: '2026-11-02T14:30:00Z',
    });
  });

  it('[P2-S11-AC-040] schedules a chosen non-publish action for an author', async () => {
    const { container, fetcher } = mount(false, [
      accepted({
        action: 'archive',
        localDateTime: '2026-11-02T09:30',
        resolvedUtc: '2026-11-02T14:30:00Z',
      }),
    ]);
    await openDetails(container);
    await choose(action(container), 'archive');
    await fill(container, '2026-11-02T09:30', 'America/New_York');
    await click(buttonNamed(container, 'Schedule'));
    await flush();
    expect(sentBody(fetcher)).toMatchObject({ action: 'archive' });
  });

  it('[P2-S11-AC-040] leaves a Publish choice behind when a refetch withdraws the permission', async () => {
    const { container, permit, fetcher } = mount(true, [
      accepted({
        action: 'unpublish',
        localDateTime: '2026-11-02T09:30',
        resolvedUtc: '2026-11-02T14:30:00Z',
      }),
    ]);
    await openDetails(container);
    expect(action(container).value).toBe('publish');
    permit(false);
    expect(actions(container)).toEqual(['unpublish', 'expire', 'archive']);
    expect(action(container).value).toBe('unpublish');
    await fill(container, '2026-11-02T09:30', 'America/New_York');
    await click(buttonNamed(container, 'Schedule'));
    await flush();
    expect(sentBody(fetcher)).toMatchObject({ action: 'unpublish' });
  });

  it('[P2-S11-AC-040] does not restore a stored Publish choice for a caller who may not publish', async () => {
    const storage = new MemoryStorage();
    const first = mount(true, [stepUp()], storage);
    await openDetails(first.container);
    await fill(first.container, '2026-11-02T09:30', 'America/New_York');
    await click(buttonNamed(first.container, 'Schedule'));
    await vi.waitFor(() => expect(first.navigate).toHaveBeenCalledTimes(1));
    expect(
      JSON.parse(storage.getItem('wj-step-up-draft:cms:/:CMS-03B-07') as string)
        .values.action,
    ).toBe('publish');
    first.unmount();

    const returned = mount(
      false,
      [
        accepted({
          action: 'unpublish',
          localDateTime: '2026-11-02T09:30',
          resolvedUtc: '2026-11-02T14:30:00Z',
        }),
      ],
      storage,
    );
    await flush();
    expect(actions(returned.container)).not.toContain('publish');
    expect(action(returned.container).value).toBe('unpublish');
    await click(buttonNamed(returned.container, 'Schedule'));
    await flush();
    expect(sentBody(returned.fetcher)).toMatchObject({ action: 'unpublish' });
  });
});

describe('the workflow island passes the proven permission to the schedule form', () => {
  it('[P2-S11-AC-040] offers Publish when permittedNextActions includes publish', () => {
    const { container } = mountWorkflowIsland(approvedWorkflowFixture());
    expect(actions(container)).toContain('publish');
    expect(action(container).value).toBe('publish');
  });

  it('[P2-S11-AC-040] keeps the schedule form for an author whose permittedNextActions has schedule but not publish', () => {
    const { container } = mountWorkflowIsland(
      approvedWorkflowFixture({
        permittedNextActions: ['schedule', 'preview'],
      }),
    );
    expect(container.querySelector('#schedule-form-title')).not.toBeNull();
    expect(container.querySelector('#publish-form-title')).toBeNull();
    expect(actions(container)).toEqual(['unpublish', 'expire', 'archive']);
    expect(action(container).value).toBe('unpublish');
  });
});

describe('three-segment IANA zones', () => {
  it('[P2-S11-AC-106] resolves, shows and sends America/Argentina/Buenos_Aires', async () => {
    const { container, fetcher } = mount(true, [
      accepted({
        localDateTime: '2026-12-01T09:00',
        timezone: 'America/Argentina/Buenos_Aires',
        resolvedUtc: '2026-12-01T12:00:00Z',
      }),
    ]);
    await openDetails(container);
    await fill(container, '2026-12-01T09:00', 'America/Argentina/Buenos_Aires');
    const status = container.querySelector(
      '[data-cms-schedule-status]',
    ) as HTMLElement;
    expect(status.textContent).toContain('2026-12-01T12:00:00Z');
    expect(status.textContent).toContain('UTC-03:00');
    await click(buttonNamed(container, 'Schedule'));
    await flush();
    expect(sentBody(fetcher)).toMatchObject({
      localDateTime: '2026-12-01T09:00',
      timezone: 'America/Argentina/Buenos_Aires',
      resolvedUtc: '2026-12-01T12:00:00Z',
      tzdbVersion: '2026e',
      disambiguation: 'none',
    });
  });
});
