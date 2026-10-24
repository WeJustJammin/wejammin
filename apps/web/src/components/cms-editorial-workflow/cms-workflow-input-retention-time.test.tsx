// @vitest-environment jsdom
import { loadPinnedTimeAuthority } from '@wejammin/contracts/time-authority';
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { preloadWorkflowAnswerMachinery } from './cms-workflow-answer-machinery.test-support';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
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
import { COMMAND_CASES } from '../../server/cms-workflow-platform-command.test-support';
import CmsEditorialPublishConfirmation from './CmsEditorialPublishConfirmation';
import CmsEditorialScheduleForm from './CmsEditorialScheduleForm';
import {
  bodyAt,
  environmentFor,
  keyAt,
  lostAnswer,
  queueOf,
  refusalKind,
  staleCandidate,
} from './cms-workflow-input-retention.test-support';
import {
  ENTRY_ID,
  HASH_A,
  HASH_B,
  REVISION_ID,
  apiError,
  jsonResponse,
  publicationResourceFixture,
  scheduleResourceFixture,
  versionSetFixture,
} from './cms-workflow-fixtures.test-support';

beforeAll(preloadWorkflowAnswerMachinery);

/*
 * FE03 "retain input" (P2-S11-AC-040, AC-043) for the schedule form and the
 * publish confirmation: enter values, drive a real definite refusal (a stale
 * candidate, a 422 that names a field, a concurrent publication) and a real
 * unknown outcome (504), assert the controls STILL HOLD exactly what was
 * entered, then press the commit control again and assert the second request
 * carries the same entries (and, after an unknown outcome, the same
 * idempotency key). The decision, submit and preview forms are in
 * cms-workflow-input-retention.test.tsx.
 */

beforeAll(enableReactAct);
// The form checks run synchronously once the lazily loaded validators are in.
beforeAll(async () => {
  await loadCmsValidators();
});
afterAll(disableReactAct);
// The tz snapshot and jsdom work are slow on a loaded host; waits are
// conditions, not budgets.
vi.setConfig({ testTimeout: 90_000 });

const NOW = Date.parse('2026-10-08T12:00:00Z');
const authority = await loadPinnedTimeAuthority();

/* --------------------------------- schedule --------------------------------- */

const mountSchedule = (responses: readonly Response[]) => {
  const fetcher = queueOf(responses);
  const refetch = vi.fn(async () => true);
  const mounted = mountElement(
    <CmsEditorialScheduleForm
      revisionId={REVISION_ID}
      reviewVersion="5"
      publishPermitted
      disabledReason={null}
      refetch={refetch}
      onDone={vi.fn()}
      now={() => NOW}
      defaultTimezone=""
      loadAuthority={async () => authority}
      environment={environmentFor(fetcher, new MemoryStorage())}
    />,
  );
  return { ...mounted, fetcher, refetch };
};

const openSchedule = async (container: HTMLElement) => {
  const details = container.querySelector('details') as HTMLDetailsElement;
  details.open = true;
  await React.act(async () => {
    details.dispatchEvent(new Event('toggle'));
  });
  await flush();
};

const enterSchedule = async (container: HTMLElement) => {
  await choose(byLabel<HTMLSelectElement>(container, 'Action'), 'expire');
  await typeInto(
    byLabel<HTMLInputElement>(container, 'Local date and time'),
    '2026-11-02T09:30',
  );
  await typeInto(
    byLabel<HTMLInputElement>(container, 'Time zone'),
    'America/New_York',
  );
  await typeInto(byLabel<HTMLInputElement>(container, 'Audience'), 'staff');
};

const scheduleControls = (container: HTMLElement) => ({
  action: byLabel<HTMLSelectElement>(container, 'Action').value,
  local: byLabel<HTMLInputElement>(container, 'Local date and time').value,
  zone: byLabel<HTMLInputElement>(container, 'Time zone').value,
  audience: byLabel<HTMLInputElement>(container, 'Audience').value,
});
const ENTERED_SCHEDULE = {
  action: 'expire',
  local: '2026-11-02T09:30',
  zone: 'America/New_York',
  audience: 'staff',
};

const scheduled = () =>
  jsonResponse(
    202,
    scheduleResourceFixture({
      action: 'expire',
      localDateTime: '2026-11-02T09:30',
      resolvedUtc: '2026-11-02T14:30:00Z',
      audience: 'staff',
    }),
    {
      etag: '"1"',
      location: COMMAND_CASES['CMS-03B-07'].location as string,
    },
  );

describe('CMS-03B-07 schedule form keeps its entries', () => {
  it('[P2-S11-AC-040] keeps the action, local time, zone and audience after a definite 409 refusal and re-sends them', async () => {
    const { container, fetcher, refetch } = mountSchedule([
      staleCandidate(),
      scheduled(),
    ]);
    await openSchedule(container);
    await enterSchedule(container);
    await click(buttonNamed(container, 'Schedule'));
    await flush();

    expect(refusalKind(container)).toBe('refetch');
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(scheduleControls(container)).toEqual(ENTERED_SCHEDULE);

    await click(buttonNamed(container, 'Schedule'));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(bodyAt(fetcher, 1)).toEqual(bodyAt(fetcher, 0));
    expect(bodyAt(fetcher, 1)).toMatchObject({
      action: 'expire',
      localDateTime: '2026-11-02T09:30',
      timezone: 'America/New_York',
      audience: 'staff',
      expectedVersion: '5',
    });
  });

  it('[P2-S11-AC-040] keeps every entry after a 422 that names a field, and the named field is marked', async () => {
    const { container, fetcher } = mountSchedule([
      jsonResponse(
        422,
        apiError('VALIDATION_FAILED', {
          reasonCode: 'schedule_out_of_horizon',
          minUtc: '2026-10-08T12:01:00Z',
          maxUtc: '2027-10-09T12:00:00Z',
        }),
      ),
      scheduled(),
    ]);
    await openSchedule(container);
    await enterSchedule(container);
    await click(buttonNamed(container, 'Schedule'));
    await flush();

    expect(refusalKind(container)).toBe('field');
    expect(
      byLabel<HTMLInputElement>(container, 'Local date and time').getAttribute(
        'aria-invalid',
      ),
    ).toBe('true');
    expect(scheduleControls(container)).toEqual(ENTERED_SCHEDULE);
    await click(buttonNamed(container, 'Schedule'));
    await flush();
    expect(bodyAt(fetcher, 1)).toEqual(bodyAt(fetcher, 0));
  });

  it('[P2-S11-AC-040] keeps every entry through an unknown outcome and re-sends them under the same key', async () => {
    const { container, fetcher } = mountSchedule([lostAnswer(), scheduled()]);
    await openSchedule(container);
    await enterSchedule(container);
    await click(buttonNamed(container, 'Schedule'));
    await flush();

    expect(
      container.querySelector('[data-cms-workflow-status]')?.textContent,
    ).toBe('The current state is loaded. You can retry the same request.');
    expect(scheduleControls(container)).toEqual(ENTERED_SCHEDULE);
    await click(buttonNamed(container, 'Retry the same request'));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(bodyAt(fetcher, 1)).toEqual(bodyAt(fetcher, 0));
    expect(keyAt(fetcher, 1)).toBe(keyAt(fetcher, 0));
  });
});

/* ---------------------------------- publish --------------------------------- */

describe('CMS-03B-09 publish confirmation keeps its entry', () => {
  const frozen = {
    frozenHash: HASH_A,
    dependencyHash: HASH_B,
    versionSet: versionSetFixture,
  } as never;
  const mountPublish = (responses: readonly Response[]) => {
    const fetcher = queueOf(responses);
    const refetch = vi.fn(async () => true);
    const mounted = mountElement(
      <CmsEditorialPublishConfirmation
        entryId={ENTRY_ID}
        revisionId={REVISION_ID}
        reviewVersion="5"
        frozen={frozen}
        disabledReason={null}
        refetch={refetch}
        onDone={vi.fn()}
        environment={environmentFor(fetcher, new MemoryStorage())}
      />,
    );
    return { ...mounted, fetcher, refetch };
  };
  const openPublish = async (container: HTMLElement) => {
    const details = container.querySelector('details') as HTMLDetailsElement;
    details.open = true;
    await React.act(async () => {
      details.dispatchEvent(new Event('toggle'));
    });
  };
  const recorded = () =>
    jsonResponse(202, publicationResourceFixture({}), {
      etag: '"1"',
      location: '/api/v1/cms/publications/123e4567-e89b-42d3-a456-42661417400b',
    });

  it('[P2-S11-AC-043] keeps the audience after a definite 409 refusal and re-sends it', async () => {
    const { container, fetcher, refetch } = mountPublish([
      jsonResponse(
        409,
        apiError('CONFLICT', { reasonCode: 'publication_conflict' }),
      ),
      recorded(),
    ]);
    await openPublish(container);
    await typeInto(byLabel<HTMLInputElement>(container, 'Audience'), 'members');
    await click(buttonNamed(container, 'Confirm publish'));
    await flush();

    expect(refusalKind(container)).toBe('refetch');
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(byLabel<HTMLInputElement>(container, 'Audience').value).toBe(
      'members',
    );
    await click(buttonNamed(container, 'Confirm publish'));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(bodyAt(fetcher, 1)).toEqual(bodyAt(fetcher, 0));
    expect(bodyAt(fetcher, 1)).toMatchObject({
      audience: 'members',
      expectedVersion: '5',
    });
  });

  it('[P2-S11-AC-043] keeps the audience through an unknown outcome and re-sends it under the same key', async () => {
    const { container, fetcher } = mountPublish([lostAnswer(), recorded()]);
    await openPublish(container);
    await typeInto(byLabel<HTMLInputElement>(container, 'Audience'), 'members');
    await click(buttonNamed(container, 'Confirm publish'));
    await flush();
    expect(byLabel<HTMLInputElement>(container, 'Audience').value).toBe(
      'members',
    );
    await click(buttonNamed(container, 'Retry the same request'));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(bodyAt(fetcher, 1)).toEqual(bodyAt(fetcher, 0));
    expect(keyAt(fetcher, 1)).toBe(keyAt(fetcher, 0));
  });
});
