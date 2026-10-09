// @vitest-environment jsdom
import * as React from 'react';

const { act } = React;
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { MemoryStorage } from '../../lib/test-support/memory-storage';
import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { CSRF } from '../../server/cms-workflow-platform-command.test-support';
import CmsEditorialPublishConfirmation from './CmsEditorialPublishConfirmation';
import {
  ENTRY_ID,
  HASH_A,
  HASH_B,
  REVISION_ID,
  apiError,
  jsonResponse,
  publicationResourceFixture,
  versionSetFixture,
} from './cms-workflow-fixtures.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const KEY = 'idem-key-publish-001';
const frozen = {
  frozenHash: HASH_A,
  dependencyHash: HASH_B,
  versionSet: versionSetFixture,
} as never;

const recorded = (overrides: Record<string, unknown> = {}) =>
  jsonResponse(202, publicationResourceFixture(overrides), {
    etag: '"1"',
    location: '/api/v1/cms/publications/123e4567-e89b-42d3-a456-42661417400b',
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
  extra: Partial<
    React.ComponentProps<typeof CmsEditorialPublishConfirmation>
  > = {},
  storage = new MemoryStorage(),
) => {
  const queue = [...responses];
  const fetcher = vi.fn(async () => queue.shift() as Response);
  const refetch = vi.fn(async () => true);
  const onDone = vi.fn();
  const navigate = vi.fn();
  const mounted = mountElement(
    <CmsEditorialPublishConfirmation
      entryId={ENTRY_ID}
      revisionId={REVISION_ID}
      reviewVersion="5"
      frozen={frozen}
      disabledReason={null}
      refetch={refetch}
      onDone={onDone}
      environment={{
        transport: { fetcher, documentRef: { cookie: `wj_csrf=${CSRF}` } },
        newKey: () => KEY,
        storage: () => storage,
        navigate,
      }}
      {...extra}
    />,
  );
  return { ...mounted, fetcher, refetch, onDone, navigate, storage };
};

const open = async (container: HTMLElement) => {
  const details = container.querySelector('details') as HTMLDetailsElement;
  details.open = true;
  await act(async () => {
    details.dispatchEvent(new Event('toggle'));
  });
};

describe('CmsEditorialPublishConfirmation (CMS-03B-09)', () => {
  it('opens an inline confirmation naming the replacement and the checks that will re-run', async () => {
    const { container } = mount([]);
    expect(container.querySelector('summary')?.textContent).toBe('Publish now');
    await open(container);
    const text = container.textContent ?? '';
    expect(text).toContain(
      'Publishing replaces the active publication for this audience and locale.',
    );
    expect(text).toContain('content type version');
    expect(text).toContain('settings version 1');
    expect(text).toContain('These checks run again');
    for (const label of [
      'Content contract',
      'Accessibility',
      'Authority and availability',
    ])
      expect(text).toContain(label);
    expect(text).not.toContain(HASH_A);
  });

  it('refuses a missing or invalid audience inline, sending nothing', async () => {
    const { container, fetcher } = mount([recorded()]);
    await open(container);
    await click(buttonNamed(container, 'Confirm publish'));
    expect(
      container.querySelector('[data-cms-workflow-local-errors]')?.textContent,
    ).toContain('Enter an audience.');
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Audience'),
      'Members!',
    );
    await click(buttonNamed(container, 'Confirm publish'));
    expect(
      container.querySelector('[data-cms-workflow-local-errors]')?.textContent,
    ).toContain(
      'Use lowercase letters, digits, hyphens and underscores, up to 48 characters.',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('echoes the approved candidate unmodified at the review version and then refetches', async () => {
    const { container, fetcher, refetch, onDone } = mount([recorded()]);
    await open(container);
    await typeInto(byLabel<HTMLInputElement>(container, 'Audience'), 'members');
    await click(buttonNamed(container, 'Confirm publish'));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    const [target, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(target).toBe('/api/v1/cms/publications');
    expect(JSON.parse(init.body as string)).toEqual({
      entryId: ENTRY_ID,
      revisionId: REVISION_ID,
      frozenHash: HASH_A,
      expectedVersionSet: JSON.parse(JSON.stringify(versionSetFixture)),
      audience: 'members',
      expectedVersion: '5',
    });
    expect(new Headers(init.headers).get('if-match')).toBe('"5"');
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('workflow-publications-title');
  });

  it('never claims public visibility for a pending projection', async () => {
    const { container, onDone } = mount([recorded()]);
    await open(container);
    await typeInto(byLabel<HTMLInputElement>(container, 'Audience'), 'members');
    await click(buttonNamed(container, 'Confirm publish'));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    const status =
      container.querySelector('[data-cms-workflow-status]')?.textContent ?? '';
    expect(status).toContain('Publication recorded as version 1.');
    expect(status).toContain(
      'Public delivery has not reported yet, so this is not confirmed visible to readers.',
    );
    expect(status).not.toMatch(
      /\bnow live\b|\bis public\b|\bpublished successfully\b/iu,
    );
  });

  it('refetches and names the changed candidate, a publication conflict or the second-person rule', async () => {
    const cases: readonly [Response, string][] = [
      [
        jsonResponse(
          409,
          apiError('CONFLICT', { reasonCode: 'version_set_stale' }),
        ),
        'The approved candidate changed. Review the updated checks.',
      ],
      [
        jsonResponse(
          409,
          apiError('CONFLICT', { reasonCode: 'publication_conflict' }),
        ),
        'Another publication was recorded for this audience and locale.',
      ],
      [
        jsonResponse(
          403,
          apiError('FORBIDDEN', { reasonCode: 'separation_of_duties' }),
        ),
        'A second person with the publisher capability must publish this revision.',
      ],
    ];
    for (const [response, text] of cases) {
      const { container, unmount } = mount([response]);
      await open(container);
      await typeInto(
        byLabel<HTMLInputElement>(container, 'Audience'),
        'members',
      );
      await click(buttonNamed(container, 'Confirm publish'));
      await vi.waitFor(() =>
        expect(container.querySelector('[role="alert"]')).not.toBeNull(),
      );
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        text,
      );
      unmount();
    }
  });

  it('lists the failed categories of a preflight refusal', async () => {
    const { container } = mount([
      jsonResponse(
        422,
        apiError('VALIDATION_FAILED', {
          reasonCode: 'preflight_failed',
          preflight: [
            {
              category: 'accessibility',
              outcome: 'failed',
              reasonCode: 'blocking_finding',
            },
          ],
        }),
      ),
    ]);
    await open(container);
    await typeInto(byLabel<HTMLInputElement>(container, 'Audience'), 'members');
    await click(buttonNamed(container, 'Confirm publish'));
    await vi.waitFor(() =>
      expect(container.querySelector('[role="alert"]')).not.toBeNull(),
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'The accessibility check found a blocking problem.',
    );
  });

  it('routes a step-up shortfall to verification and restores the audience open on return', async () => {
    const storage = new MemoryStorage();
    const first = mount([stepUp()], {}, storage);
    await open(first.container);
    await typeInto(
      byLabel<HTMLInputElement>(first.container, 'Audience'),
      'staff',
    );
    await click(buttonNamed(first.container, 'Confirm publish'));
    await vi.waitFor(() => expect(first.navigate).toHaveBeenCalledTimes(1));
    const stored = JSON.parse(
      storage.getItem('wj-step-up-draft:cms:/:CMS-03B-09') as string,
    );
    expect(stored.values).toEqual({ audience: 'staff' });
    expect(stored.idempotencyKey).toBe(KEY);
    expect(stored.expectedVersion).toBe('5');
    first.unmount();

    const returned = mount([recorded({ audience: 'staff' })], {}, storage);
    await flush();
    expect(returned.container.querySelector('details')?.open).toBe(true);
    expect(
      byLabel<HTMLInputElement>(returned.container, 'Audience').value,
    ).toBe('staff');
    expect(returned.fetcher).not.toHaveBeenCalled();
    await click(buttonNamed(returned.container, 'Confirm publish'));
    await vi.waitFor(() => expect(returned.onDone).toHaveBeenCalled());
    expect(returned.fetcher).toHaveBeenCalledTimes(1);
    expect(
      new Headers(
        (returned.fetcher.mock.calls[0] as unknown as [string, RequestInit])[1]
          .headers,
      ).get('idempotency-key'),
    ).toBe(KEY);
  });

  it('refuses to send while the read behind it is not verified', async () => {
    const { container, fetcher } = mount([recorded()], {
      disabledReason: 'Reload the page.',
    });
    await open(container);
    await typeInto(byLabel<HTMLInputElement>(container, 'Audience'), 'members');
    await click(buttonNamed(container, 'Confirm publish'));
    expect(fetcher).not.toHaveBeenCalled();
  });
});
