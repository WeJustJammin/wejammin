// @vitest-environment jsdom
import { loadPinnedTimeAuthority } from '@wejammin/contracts/time-authority';
import type { TimeAuthority } from '@wejammin/contracts/time-authority';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { CSRF } from '../../server/cms-workflow-platform-command.test-support';
import CmsEditorialScheduleForm from './CmsEditorialScheduleForm';
import {
  deferred,
  focusOn,
  openDetails,
  release,
  settle,
} from './cms-workflow-focus.test-support';
import { REVISION_ID } from './cms-workflow-fixtures.test-support';

// The tz snapshot is 218 KB; waits are conditions, not budgets.
vi.setConfig({ testTimeout: 90_000 });

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => vi.restoreAllMocks());

const NOW = Date.parse('2026-10-08T12:00:00Z');
const authority = await loadPinnedTimeAuthority();

/*
 * FE03 / P2-S11-AC-040: the schedule form rewrites text beside the inputs (the
 * lazily loaded zone list, the suggested zone, the resolved instant, the gap and
 * fold alternatives) while the person types. None of it may move focus.
 */
describe('CmsEditorialScheduleForm focus', () => {
  it('[P2-S11-AC-040] keeps focus on the control the person is in while the zone data loads and the resolution changes', async () => {
    const loaded = deferred<TimeAuthority>();
    const { container } = mountElement(
      <CmsEditorialScheduleForm
        revisionId={REVISION_ID}
        reviewVersion="5"
        publishPermitted
        disabledReason={null}
        refetch={async () => true}
        onDone={() => undefined}
        now={() => NOW}
        defaultTimezone="Europe/Paris"
        loadAuthority={() => loaded.promise}
        environment={{
          transport: {
            fetcher: vi.fn(),
            documentRef: { cookie: `wj_csrf=${CSRF}` },
          },
          newKey: () => 'idem-key-focus-000002',
          storage: () => null,
          navigate: () => undefined,
        }}
      />,
    );
    await openDetails(container);
    expect(container.textContent).not.toContain('The time zone data could not');
    const local = focusOn(
      byLabel<HTMLInputElement>(container, 'Local date and time'),
    );
    const focusCalls = vi.spyOn(HTMLElement.prototype, 'focus');

    // The snapshot arrives: the suggested zone fills in and the list appears.
    await release(loaded, authority);
    expect(byLabel<HTMLInputElement>(container, 'Time zone').value).toBe(
      'Europe/Paris',
    );
    expect(
      container.querySelectorAll('datalist option').length,
    ).toBeGreaterThan(300);
    expect(document.activeElement).toBe(local);

    // A resolved instant, then a fold, then a gap, are written in place.
    for (const [value, text] of [
      ['2026-11-02T09:30', 'UTC+01:00'],
      ['2026-10-25T02:30', 'That local time happens twice.'],
      ['2027-03-28T02:30', 'That local time does not exist in this time zone.'],
    ] as const) {
      await typeInto(local, value);
      expect(container.textContent).toContain(text);
      expect(document.activeElement).toBe(local);
    }

    // Changing the zone from its own control keeps focus there.
    const zone = focusOn(byLabel<HTMLInputElement>(container, 'Time zone'));
    focusCalls.mockClear();
    await typeInto(zone, 'America/Argentina/Buenos_Aires');
    await typeInto(local, '2026-12-01T09:00');
    await settle();
    expect(container.textContent).toContain('2026-12-01T12:00:00Z');
    expect(document.activeElement).toBe(zone);
    expect(focusCalls).not.toHaveBeenCalled();
  });

  it('[P2-S11-AC-040] moves focus to the local-error summary only on a refused submit, and typing afterwards does not pull it back', async () => {
    const { container } = mountElement(
      <CmsEditorialScheduleForm
        revisionId={REVISION_ID}
        reviewVersion="5"
        publishPermitted
        disabledReason={null}
        refetch={async () => true}
        onDone={() => undefined}
        now={() => NOW}
        defaultTimezone=""
        loadAuthority={async () => authority}
        environment={{
          transport: {
            fetcher: vi.fn(),
            documentRef: { cookie: `wj_csrf=${CSRF}` },
          },
          newKey: () => 'idem-key-focus-000003',
          storage: () => null,
          navigate: () => undefined,
        }}
      />,
    );
    await openDetails(container);
    const schedule = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Schedule',
    ) as HTMLButtonElement;
    focusOn(schedule);
    // Incomplete input: the summary takes focus (the one allowed move before a result).
    await click(schedule);
    const summary = container.querySelector(
      '[data-cms-workflow-local-errors]',
    ) as HTMLElement;
    expect(document.activeElement).toBe(summary);
    // Typing into a field afterwards does not pull focus back to the summary.
    const audience = focusOn(byLabel<HTMLInputElement>(container, 'Audience'));
    await typeInto(audience, 'members');
    expect(document.activeElement).toBe(audience);
  });
});
