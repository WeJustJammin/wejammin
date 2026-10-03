// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMemoryLockManager } from '../../lib/test-support/memory-lock-manager';
import { MemoryStorage } from '../../lib/test-support/memory-storage';
import { startDryRunPreparation } from './content-schema-registry-activation-preparation.test-support';
import { installContentSchemaRegistryCommandEnhancement } from './content-schema-registry-runtime-dom-mutations';
import {
  JOB_ID,
  REQUEST_ID,
  dryRunResource,
  draftDetail,
} from './content-schema-review-dec108.test-support';
import {
  activationPreparation,
  queuedDryRunPreparation,
} from './content-schema-registry-activation-preparation.test-support';
import {
  definitionValue,
  renderDocument,
  requireForm,
  requireRegion,
  successDetail,
  versionPageProps,
} from './content-schema-review-dec108-render.test-support';

/**
 * FE03 CMS-03A-10 start dry-run form, composed as the browser composes it: the
 * REAL server-rendered native form markup, the REAL progressive-enhancement
 * runtime, only the network scripted. The transform pair is filled so every
 * outcome is the outcome of a transform-pair submission.
 */

const locks = createMemoryLockManager();
const PATH = '/app/cms-content-modeling/type/versions/version';
const UPSTREAM_TEXT = 'UPSTREAM-DETAIL-MUST-NEVER-RENDER';

const page = (preparation: Parameters<typeof draftDetail>[0]) =>
  versionPageProps({ initialDetail: successDetail(draftDetail(preparation)) });

const mountForm = (): HTMLFormElement => {
  window.history.replaceState({}, '', `${PATH}?limit=25`);
  document.body.innerHTML = renderDocument(
    page(startDryRunPreparation),
  ).body.innerHTML;
  const form = requireForm(document, 'CMS-03A-10');
  form.setAttribute('action', PATH);
  return form;
};

const fill = (form: HTMLFormElement, key: string, version: string): void => {
  const set = (name: string, value: string) => {
    const input = form.querySelector<HTMLInputElement>(`[name="${name}"]`);
    if (input === null) throw new Error(`no ${name} input`);
    input.value = value;
  };
  set('transformKey', key);
  set('transformVersion', version);
};

const json = (status: number, payload: unknown, headers = {}): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const envelope = (code: string, details: unknown) => ({
  code,
  details,
  message: UPSTREAM_TEXT,
  requestId: REQUEST_ID,
});

const submit = async (
  form: HTMLFormElement,
  response: Response,
  done: (navigate: ReturnType<typeof vi.fn>) => boolean,
) => {
  const navigate = vi.fn();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response),
  );
  const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
    navigate,
  });
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(done(navigate)).toBe(true));
  cleanup();
  return navigate;
};

beforeEach(() => {
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: new MemoryStorage(),
  });
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: locks.manager,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  locks.releaseAll();
  document.body.replaceChildren();
});

describe('[P2-S09-AC-980] 202 SchemaDryRunResource is pending, never a transformation result', () => {
  it('[P2-S09-AC-980] a 202 with the transform pair announces acceptance and refresh, not a result', async () => {
    const form = mountForm();
    fill(form, 'article.title_to_headline', '1');
    const resource = dryRunResource({
      transformKey: 'article.title_to_headline',
      transformVersion: '1',
    });
    await submit(
      form,
      json(202, resource, { location: `${PATH}?limit=25` }),
      () =>
        document.querySelector('[data-cms-command-status]')?.textContent !==
        undefined,
    );
    expect(
      document.querySelector('[data-cms-command-status]')?.textContent,
    ).toBe('Schema change accepted. Refreshing current data.');
  });

  it('[P2-S09-AC-980] a 202 never renders a pass/fail result, counts or hashes in the form', async () => {
    const form = mountForm();
    fill(form, 'article.title_to_headline', '1');
    await submit(
      form,
      json(202, dryRunResource(), { location: `${PATH}?limit=25` }),
      () => document.querySelector('[data-cms-command-status]') !== null,
    );
    expect(form.textContent).not.toMatch(
      /passed|failed|source row|row error|[a-f0-9]{64}|transform(ed|ation) result/iu,
    );
  });

  it('[P2-S09-AC-980] a 202 refreshes to the canonical page rather than rendering the resource', async () => {
    const form = mountForm();
    fill(form, 'article.title_to_headline', '1');
    const navigate = await submit(
      form,
      json(202, dryRunResource(), { location: `${PATH}?limit=25` }),
      (go) => go.mock.calls.length > 0,
    );
    expect(navigate).toHaveBeenCalledWith(`${PATH}?limit=25`);
  });

  it('[P2-S09-AC-980] the refreshed canonical page shows the queued dry run with the 202 resource job reference and no result', () => {
    const resource = dryRunResource();
    const region = requireRegion(
      renderDocument(
        page(
          activationPreparation({
            dryRunRef: {
              id: resource.id,
              state: 'queued',
              result: null,
              jobId: resource.jobId,
            },
            jobRef: { id: resource.jobId, state: 'queued' },
          }),
        ),
      ),
      /activation preparation/iu,
    );
    expect(region.querySelector('[data-cms-dry-run-status]')?.textContent).toBe(
      'The dry run is queued.',
    );
    expect(definitionValue(region, /job reference/iu)).toBe(JOB_ID);
    expect(definitionValue(region, /^result$/iu)).toBeNull();
    expect(region.textContent).not.toMatch(/passed|failed|[a-f0-9]{64}/iu);
  });

  it('[P2-S09-AC-980] a queued dry run without a job reference renders no job reference row', () => {
    const region = requireRegion(
      renderDocument(
        page(
          activationPreparation({
            dryRunRef: {
              id: dryRunResource().id,
              state: 'queued',
              result: null,
              jobId: JOB_ID,
            },
            jobRef: null,
          }),
        ),
      ),
      /activation preparation/iu,
    );
    expect(definitionValue(region, /job reference/iu)).toBeNull();
  });

  it('[P2-S09-AC-980] the queued preparation fixture and the 202 resource name the same job', () => {
    expect(queuedDryRunPreparation.jobRef?.id).toBe(dryRunResource().jobId);
  });
});

describe('[P2-S09-AC-980] transform-pair errors map to inline copy', () => {
  it('[P2-S09-AC-980] 422 on the pair links to and marks exactly the named transform field, keeping both inputs', async () => {
    const form = mountForm();
    fill(form, 'article.title_to_headline', '');
    await submit(
      form,
      json(
        422,
        envelope('VALIDATION_FAILED', {
          violations: [
            {
              pointer: '/transformVersion',
              code: 'invalid_value',
              message: 'transform key and version must be both present',
            },
          ],
        }),
      ),
      () => document.querySelector('[data-cms-validation-summary]') !== null,
    );
    const summary = form.querySelector('[data-cms-validation-summary]');
    const version = form.querySelector<HTMLInputElement>(
      '[name="transformVersion"]',
    );
    const key = form.querySelector<HTMLInputElement>('[name="transformKey"]');
    expect(
      [...(summary?.querySelectorAll('li') ?? [])].map(
        (item) => item.textContent,
      ),
    ).toStrictEqual(['Review transformVersion']);
    expect(summary?.querySelector('a')?.getAttribute('href')).toBe(
      `#${version?.id}`,
    );
    expect(version?.getAttribute('aria-invalid')).toBe('true');
    expect(key?.getAttribute('aria-invalid')).toBeNull();
    expect(key?.value).toBe('article.title_to_headline');
  });

  it('[P2-S09-AC-980] 422 naming both pair fields marks both and lists them in order', async () => {
    const form = mountForm();
    fill(form, 'unregistered.transform', '9');
    await submit(
      form,
      json(
        422,
        envelope('VALIDATION_FAILED', {
          violations: [
            { pointer: '/transformKey', code: 'invalid_value', message: 'x' },
            {
              pointer: '/transformVersion',
              code: 'invalid_value',
              message: 'x',
            },
          ],
        }),
      ),
      () => document.querySelector('[data-cms-validation-summary]') !== null,
    );
    const items = [
      ...form.querySelectorAll('[data-cms-validation-summary] li'),
    ].map((item) => item.textContent);
    expect(items).toStrictEqual([
      'Review transformKey',
      'Review transformVersion',
    ]);
    expect(
      form.querySelector('[name="transformKey"]')?.getAttribute('aria-invalid'),
    ).toBe('true');
    expect(
      form
        .querySelector('[name="transformVersion"]')
        ?.getAttribute('aria-invalid'),
    ).toBe('true');
    expect(form.textContent).not.toContain(UPSTREAM_TEXT);
  });

  it('[P2-S09-AC-980] 409 after a transform-pair submission opens the sync conflict with both versions and keeps the pair for reapplying', async () => {
    const form = mountForm();
    fill(form, 'article.title_to_headline', '1');
    await submit(
      form,
      json(
        409,
        envelope('CONFLICT', { expectedVersion: '4', currentVersion: '5' }),
      ),
      () => document.querySelector('[data-cms-sync-conflict]') !== null,
    );
    const conflict = form.querySelector('[data-cms-sync-conflict]');
    expect(conflict?.textContent).toContain('Server version: 5');
    expect(conflict?.textContent).toContain('Local version: 4');
    expect(
      form.querySelector<HTMLInputElement>('[name="transformKey"]')?.value,
    ).toBe('article.title_to_headline');
    expect(
      form.querySelector<HTMLInputElement>('[name="transformVersion"]')?.value,
    ).toBe('1');
    expect(form.textContent).not.toContain(UPSTREAM_TEXT);
  });
});
