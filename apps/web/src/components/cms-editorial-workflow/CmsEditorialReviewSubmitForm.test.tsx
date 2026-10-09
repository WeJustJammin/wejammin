// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  COMMAND_CASES,
  CSRF,
} from '../../server/cms-workflow-platform-command.test-support';
import CmsEditorialReviewSubmitForm from './CmsEditorialReviewSubmitForm';
import {
  ENTRY_ID,
  REVISION_ID,
  apiError,
  jsonResponse,
  preflightReportFixture,
  workflowFixture,
} from './cms-workflow-fixtures.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const preparation = () => workflowFixture().preparation!;
const KEY = 'idem-key-submit-0001';

interface Mounted {
  readonly container: HTMLElement;
  readonly fetcher: ReturnType<typeof vi.fn>;
  readonly refetch: ReturnType<typeof vi.fn>;
  readonly onDone: ReturnType<typeof vi.fn>;
}

const mount = (
  responses: readonly Response[],
  extra: Partial<
    React.ComponentProps<typeof CmsEditorialReviewSubmitForm>
  > = {},
): Mounted => {
  const queue = [...responses];
  const fetcher = vi.fn(async () => queue.shift() as Response);
  const refetch = vi.fn(async () => true);
  const onDone = vi.fn();
  const { container } = mountElement(
    <CmsEditorialReviewSubmitForm
      entryId={ENTRY_ID}
      entryVersion="7"
      revisionId={REVISION_ID}
      preparation={preparation()}
      disabledReason={null}
      refetch={refetch}
      onDone={onDone}
      environment={{
        transport: { fetcher, documentRef: { cookie: `wj_csrf=${CSRF}` } },
        newKey: () => KEY,
        storage: () => null,
        navigate: () => undefined,
      }}
      {...extra}
    />,
  );
  return { container, fetcher, refetch, onDone };
};

const created = () => {
  const testCase = COMMAND_CASES['CMS-03B-05'];
  return jsonResponse(201, testCase.resource, {
    etag: testCase.etag as string,
    location: testCase.location as string,
  });
};

describe('CmsEditorialReviewSubmitForm (CMS-03B-05)', () => {
  it('names the risk class and the decisions required on one confirm action', () => {
    const { container } = mount([]);
    expect(container.querySelector('h3')?.textContent).toBe(
      'Submit for review',
    );
    expect(buttonNamed(container, /Submit for review/u).textContent).toBe(
      'Submit for review (ordinary risk, 1 decision required)',
    );
    expect(container.querySelectorAll('input, select, textarea')).toHaveLength(
      0,
    );
  });

  it('pluralises the protected policy', () => {
    const protectedPolicy = {
      ...preparation().workflowPolicy,
      key: 'cms.disclosure.legal',
      riskClass: 'protected' as const,
      requiredDecisionCount: 2,
      requiredCapabilities: ['cms.reviewer', 'cms.reviewer.legal'],
    };
    const { container } = mount([], {
      preparation: {
        ...preparation(),
        riskClass: 'protected',
        workflowPolicy: protectedPolicy,
      },
    });
    expect(buttonNamed(container, /Submit for review/u).textContent).toBe(
      'Submit for review (protected risk, 2 decisions required)',
    );
  });

  it('sends the served preparation unmodified at the entry version and then refetches', async () => {
    const { container, fetcher, refetch, onDone } = mount([created()]);
    await click(buttonNamed(container, /Submit for review/u));
    await flush();
    const [target, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(target).toBe(`/api/v1/cms/entries/${ENTRY_ID}/reviews`);
    const headers = new Headers(init.headers);
    expect(headers.get('if-match')).toBe('"7"');
    expect(headers.get('idempotency-key')).toBe(KEY);
    expect(JSON.parse(init.body as string)).toEqual({
      entryId: ENTRY_ID,
      revisionId: REVISION_ID,
      frozenHash: preparation().frozenHash,
      dependencyManifest: JSON.parse(
        JSON.stringify(preparation().dependencyManifest),
      ),
    });
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('workflow-review-title');
    expect(
      container.querySelector('[data-cms-workflow-status]')?.textContent,
    ).toBe('Review submitted. It is open for decisions.');
  });

  it('submits exactly once when the control is pressed twice', async () => {
    const { container, fetcher } = mount([created(), created()]);
    const button = buttonNamed(container, /Submit for review/u);
    await click(button);
    await click(button);
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('refetches and states why when the checks changed, keeping the form usable', async () => {
    const { container, refetch, onDone } = mount([
      jsonResponse(
        409,
        apiError('CONFLICT', {
          reasonCode: 'dependency_changed',
          dependencyHash: 'd'.repeat(64),
        }),
      ),
    ]);
    await click(buttonNamed(container, /Submit for review/u));
    await flush();
    const alert = container.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain(
      'The checks changed. Review the updated results.',
    );
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(alert);
  });

  it('lists the failed categories of a preflight refusal', async () => {
    const { container } = mount([
      jsonResponse(
        422,
        apiError('VALIDATION_FAILED', {
          reasonCode: 'preflight_failed',
          preflight: [
            {
              category: 'contract',
              outcome: 'failed',
              reasonCode: 'value_invalid',
            },
          ],
        }),
      ),
    ]);
    await click(buttonNamed(container, /Submit for review/u));
    await flush();
    const alert = container.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain(
      'Some checks did not pass. Nothing was submitted.',
    );
    expect(alert.textContent).toContain('Content contract');
    expect(alert.textContent).toContain('A field value is invalid.');
  });

  it('shows a retryable degraded state for an unavailable check and reuses the key', async () => {
    const { container, fetcher } = mount([
      jsonResponse(
        503,
        apiError('DEPENDENCY_UNAVAILABLE', {
          dependencyClass: 'preflight',
          retryable: true,
        }),
      ),
      created(),
    ]);
    await click(buttonNamed(container, /Submit for review/u));
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'A required check is unavailable right now.',
    );
    await click(buttonNamed(container, /Submit for review/u));
    await flush();
    const keys = fetcher.mock.calls.map((call) =>
      new Headers((call as unknown as [string, RequestInit])[1].headers).get(
        'idempotency-key',
      ),
    );
    expect(keys).toEqual([KEY, KEY]);
  });

  it('notes failing checks without blocking, since the server alone decides', () => {
    const failing = {
      ...preparation(),
      preflight: preflightReportFixture({
        contract: { outcome: 'failed', reasonCode: 'value_invalid' },
      }),
    };
    const { container } = mount([], { preparation: failing });
    expect(container.textContent).toContain(
      'Some checks did not pass. The server decides when you submit.',
    );
    expect(
      buttonNamed(container, /Submit for review/u).getAttribute(
        'aria-disabled',
      ),
    ).toBe('false');
  });

  it('refuses to send while the read behind it is not verified', async () => {
    const { container, fetcher } = mount([created()], {
      disabledReason: 'The last read could not be verified.',
    });
    expect(
      container.querySelector('[data-cms-workflow-disabled]')?.textContent,
    ).toBe('The last read could not be verified.');
    const button = buttonNamed(container, /Submit for review/u);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    await click(button);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
