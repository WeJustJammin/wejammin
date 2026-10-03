// @vitest-environment jsdom

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SchemaActivationResourceSchema } from '@wejammin/contracts';

import { approvedReviewPreparation } from './content-schema-registry-activation-preparation.test-support';
import { installContentSchemaRegistryCommandEnhancement } from './content-schema-registry-runtime-dom-mutations';
import {
  approvedProtectedReview,
  draftDetail,
} from './content-schema-review-dec108.test-support';
import {
  WorkbenchUnderTest,
  reviewSuccess,
  successDetail,
  versionPageProps,
} from './content-schema-review-dec108-render.test-support';
import {
  altFor,
  getPath,
  hash,
  leafPaths,
  uuid,
  withPaths,
} from './content-schema-registry-s09-r4-mapping.test-support';

/**
 * FE03 CMS-03A-04: the confirmation renders the authoritative
 * `SchemaActivationResource` (202 job or synchronous) after strict validation.
 * The real activation form, the real enhancement runtime and a scripted
 * answer: every member of the resource reaches the result region.
 */

const instant = (n: number) => `2026-0${n}-0${n}T0${n}:0${n}:0${n}.00${n}Z`;

const resource = (overrides: Record<string, unknown> = {}) =>
  SchemaActivationResourceSchema.parse({
    id: uuid(400),
    version: '401',
    contentHash: hash(402),
    createdAt: instant(3),
    updatedAt: instant(4),
    state: 'active',
    contentTypeVersionId: uuid(403),
    activatedAt: instant(5),
    migrationPlanId: uuid(404),
    localeConfigHash: hash(405),
    activationEvidence: {
      key: 'cms.sentinel.policy',
      version: '406',
      policyHash: hash(407),
      riskClass: 'protected',
      requiredDecisionCount: 2,
      requiredCapabilities: ['cms.reviewer.legal'],
      approvalEvidenceHash: hash(408),
    },
    jobId: uuid(409),
    eventType: 'cms.schema.activated.v1',
    ...overrides,
  });

const base = resource();
const LOCATION = '/app/cms-content-modeling/t/versions/v';

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

const mountActivation = (): HTMLFormElement => {
  window.history.replaceState({}, '', LOCATION);
  document.body.innerHTML = renderToStaticMarkup(
    React.createElement(
      WorkbenchUnderTest,
      versionPageProps({
        initialDetail: successDetail(draftDetail(approvedReviewPreparation)),
        initialReview: reviewSuccess(approvedProtectedReview()),
      }),
    ),
  );
  const form = document.querySelector<HTMLFormElement>(
    'form[data-operation-id="CMS-03A-04"]',
  );
  if (form === null) throw new Error('activation form was not rendered');
  const confirm = form.querySelector<HTMLInputElement>('[name="confirmed"]');
  if (confirm !== null) confirm.checked = true;
  return form;
};

/** Submit the real form; the platform answers with `answer`. */
const activate = async (
  answer: Response,
): Promise<{
  form: HTMLFormElement;
  navigate: ReturnType<typeof vi.fn>;
  calls: [RequestInfo | URL, RequestInit | undefined][];
}> => {
  const form = mountActivation();
  const calls: [RequestInfo | URL, RequestInit | undefined][] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push([input, init]);
      return answer;
    }),
  );
  const navigate = vi.fn();
  const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
    navigate,
  });
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() =>
    expect(form.querySelector('[data-cms-command-status]')).not.toBeNull(),
  );
  cleanup();
  return { form, navigate, calls };
};

const answerFor = (body: unknown, status = 202): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', location: LOCATION },
  });

const resultHtml = async (body: unknown, status = 202): Promise<string> => {
  const { form } = await activate(answerFor(body, status));
  return form.querySelector('[data-cms-activation-result]')?.outerHTML ?? '';
};

const NOT_VARIED: Readonly<Record<string, string>> = {
  state: 'single-valued enumeration (active)',
  eventType: 'single-valued enumeration (cms.schema.activated.v1)',
};

const leaves = leafPaths(base).filter((path) => !(path in NOT_VARIED));

describe('activation result mapping (CMS-03A-04 202 or 200)', () => {
  it.each(leaves)(
    '[P2-S09-AC-225] [P2-S09-AC-259] [P2-S09-AC-264] %s changes the rendered activation result',
    async (path) => {
      const alt =
        path === 'jobId' || path === 'migrationPlanId' || path === 'activatedAt'
          ? null
          : path === 'activationEvidence.requiredCapabilities'
            ? ['cms.reviewer.security']
            : path === 'activationEvidence.riskClass'
              ? 'ordinary'
              : path === 'activationEvidence.requiredDecisionCount'
                ? 3
                : altFor(
                    path,
                    getPath(base, path),
                    leafPaths(base).indexOf(path) + 1,
                  );
      expect(await resultHtml(withPaths(base, { [path]: alt })), path).not.toBe(
        await resultHtml(base),
      );
    },
  );

  it('[P2-S09-AC-225] names the single-valued members and the whole resource in the region', async () => {
    const html = await resultHtml(base);
    expect(html).toContain('State</dt><dd>active');
    expect(html).toContain('cms.schema.activated.v1');
    for (const value of [
      base.id,
      base.contentTypeVersionId,
      base.migrationPlanId,
      base.jobId,
      base.localeConfigHash,
      base.contentHash,
      base.activationEvidence.policyHash,
      base.activationEvidence.approvalEvidenceHash,
    ])
      expect(html).toContain(value ?? 'missing');
  });

  it('[P2-S09-AC-225] a 202 with a job is rendered as accepted work, a synchronous 200 as an activated version', async () => {
    const job = await resultHtml(base, 202);
    expect(job).toContain('Schema activation accepted');
    expect(job).toContain('started a job');
    const sync = await resultHtml(
      resource({ jobId: null, migrationPlanId: null }),
      200,
    );
    expect(sync).toContain('Schema version activated');
    expect(sync).toContain('Job ID</dt><dd>None');
    expect(sync).not.toContain('started a job');
  });

  it('[P2-S09-AC-225] focuses the result heading, offers the refreshed version and does not navigate away on its own', async () => {
    const { form, navigate } = await activate(answerFor(base));
    const heading = form.querySelector('[data-cms-activation-result] h3');
    expect(document.activeElement).toBe(heading);
    expect(
      form
        .querySelector('[data-cms-activation-result] a')
        ?.getAttribute('href'),
    ).toBe(LOCATION);
    expect(navigate).not.toHaveBeenCalled();
    expect(
      form
        .querySelector('[data-cms-activation-result]')
        ?.getAttribute('aria-live'),
    ).toBe('polite');
  });

  it('[P2-S09-AC-225] sends the form once: POST with the expected version, the prefilled dry run and approvals and the idempotency key', async () => {
    const { calls } = await activate(answerFor(base));
    expect(calls).toHaveLength(1);
    const [, init] = calls[0] ?? [];
    expect(init?.method).toBe('POST');
    const body = init?.body as FormData;
    expect(body.get('operationId')).toBe('CMS-03A-04');
    expect(body.get('if-match')).toMatch(/^"\d+"$/u);
    expect(String(body.get('idempotency-key')).length).toBeGreaterThanOrEqual(
      8,
    );
    expect(JSON.parse(String(body.get('approvalIds'))).length).toBe(2);
    expect(body.get('dryRunId')).toBe(approvedReviewPreparation.dryRunRef?.id);
  });

  it.each([
    ['an unknown member', { ...base, ownerId: uuid(999) }],
    [
      'a missing member',
      (() => {
        const missing: Record<string, unknown> = { ...base };
        delete missing.jobId;
        return missing;
      })(),
    ],
    [
      'the wrong event type',
      { ...base, eventType: 'cms.schema.deactivated.v1' },
    ],
  ])(
    '[P2-S09-AC-225] %s is never shown as a success: an alert, no result region, no navigation',
    async (_name, body) => {
      const { form, navigate } = await activate(answerFor(body));
      expect(form.querySelector('[data-cms-activation-result]')).toBeNull();
      expect(
        form.querySelector('[data-cms-command-status]')?.textContent,
      ).toContain('The activation result could not be verified');
      expect(navigate).not.toHaveBeenCalled();
    },
  );
});

describe('activation answer that is not an object', () => {
  it('[P2-S09-AC-225] is not authoritative: it stays a pending reconciliation, never a result region and never a navigation', async () => {
    const { form, navigate } = await activate(answerFor('accepted'));
    expect(form.querySelector('[data-cms-activation-result]')).toBeNull();
    expect(
      form.querySelector('[data-cms-command-status]')?.textContent,
    ).toContain('The schema change is still being reconciled');
    expect(navigate).not.toHaveBeenCalled();
  });
});
