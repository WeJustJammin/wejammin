// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/client-binding', () => ({
  addClientBindingIdHeader: async (_input: unknown, init?: RequestInit) => init,
}));

import { GRANTABLE_CMS_CAPABILITIES } from '@wejammin/contracts';

import {
  GRANT_ID,
  grantListPage,
  grantResource,
} from '../../server/cms-capability-grant.test-support';
import {
  LAPSED_ID,
  apiError,
  consoleProps,
  jsonResponse,
  renderConsoleDocument,
  sampleItems,
} from './cms-capability-grant-console.test-support';
import {
  GRANT_UUID,
  click,
  fillGrantForm,
  mountConsole,
  query,
  scriptFetch,
  submit,
  textOf,
  typeInto,
  type Mounted,
} from './cms-capability-grant-dom.test-support';
import { validateGrantFields } from './cms-capability-grant-validation';

/**
 * Slice 09 IA03 owner-grant edge cases (AC-1133, AC-1134, AC-1137, AC-1138) at
 * the web layer: how the owner grant console behaves around the rules the
 * Worker and database enforce.
 */

let mounted: Mounted | null = null;
const mount = (overrides = {}) => {
  mounted = mountConsole(consoleProps(overrides));
  return mounted.container;
};
const listResponse = () => jsonResponse(200, grantListPage(sampleItems()));

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.sessionStorage.clear();
});
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.unstubAllGlobals();
});

describe('AC-1133 owner grants lapse', () => {
  it('[P2-S09-AC-1133] a lapsed grant is renewed in place through the owner renew form, with no bootstrap control anywhere', async () => {
    const { calls } = scriptFetch(
      () => jsonResponse(200, grantResource({ id: LAPSED_ID, version: '4' })),
      () => listResponse(),
    );
    const root = mount();
    const renew = query<HTMLButtonElement>(
      root,
      `tr[data-grant-id="${LAPSED_ID}"] button[data-action="renew"]`,
    );
    expect(renew.disabled).toBe(false);
    click(renew);
    const form = query<HTMLFormElement>(
      root,
      'form[data-operation-id="CMS-03A-16"]',
    );
    typeInto(query(form, 'input[name="validThrough"]'), '2026-12-01');
    await submit(form);
    expect(calls[0]).toMatchObject({
      url: `/api/v1/cms/capability-grants/${LAPSED_ID}/renewals`,
      method: 'POST',
    });
    expect(calls[0]?.body?.get('expectedVersion')).toBe('2');
    // Only the three grant commands exist; nothing creates or bootstraps a party.
    const operations = new Set(
      [...root.querySelectorAll('form[data-operation-id]')].map((form) =>
        form.getAttribute('data-operation-id'),
      ),
    );
    for (const operation of operations)
      expect(['CMS-03A-15', 'CMS-03A-16', 'CMS-03A-17']).toContain(operation);
    expect(root.textContent).not.toMatch(
      /bootstrap|initiali[sz]e|re-?create/iu,
    );
  });

  it('[P2-S09-AC-1133] when the owner has no verified step-up the renew controls explain the recovery instead of being hidden', () => {
    const doc = renderConsoleDocument(
      consoleProps({ contextEvidence: { stepUpState: 'required' } }),
    );
    expect(doc.querySelector('[data-step-up-recovery]')).not.toBeNull();
    const renew = doc.querySelector<HTMLButtonElement>(
      `tr[data-grant-id="${LAPSED_ID}"] button[data-action="renew"]`,
    )!;
    expect(renew.disabled).toBe(true);
    expect(renew.getAttribute('aria-describedby')).toContain(
      'cms-grants-step-up-reason',
    );
  });
});

describe('AC-1134 grant target absent, banned, unclaimed or outside the organization', () => {
  const refusalFor = async (body: unknown): Promise<string> => {
    const { calls } = scriptFetch(
      () => jsonResponse(404, body),
      () => listResponse(),
    );
    const root = mount();
    await submit(fillGrantForm(root));
    expect(calls[0]?.method).toBe('POST');
    // The refetch shows the same rows: no grant was created.
    expect(root.querySelectorAll('tr[data-grant-id]')).toHaveLength(
      sampleItems().length,
    );
    const text = textOf(query(root, '[data-command-error]'));
    mounted?.unmount();
    mounted = null;
    return text;
  };

  it('[P2-S09-AC-1134] every cause renders the one non-disclosing copy and the causes cannot be told apart', async () => {
    const causes = [
      apiError('NOT_FOUND', {}),
      apiError('NOT_FOUND', { reason: 'banned' }),
      apiError('NOT_FOUND', { reason: 'unclaimed' }),
      apiError('NOT_FOUND', { organization: 'other' }),
    ];
    const texts: string[] = [];
    for (const cause of causes) texts.push(await refusalFor(cause));
    expect(new Set(texts).size).toBe(1);
    expect(texts[0]).toContain(
      'That person could not be found as a member of your organization.',
    );
    for (const word of ['banned', 'unclaimed', 'other'])
      expect(texts[0]).not.toContain(word);
  });
});

describe('AC-1137 two grant commands race on one grant', () => {
  it('[P2-S09-AC-1137] the loser of a stale-version race gets the changed copy and the canonical list is re-read', async () => {
    const newer = grantResource({
      version: '3',
      validThrough: '2026-11-15',
      endsAt: '2026-11-16T00:00:00.000Z',
    });
    const { calls } = scriptFetch(
      () => jsonResponse(409, apiError('CONFLICT')),
      () => jsonResponse(200, grantListPage([newer])),
    );
    const root = mount();
    click(
      query(
        root,
        `tr[data-grant-id="${GRANT_ID}"] button[data-action="renew"]`,
      ),
    );
    const form = query<HTMLFormElement>(
      root,
      'form[data-operation-id="CMS-03A-16"]',
    );
    expect(new FormData(form).get('expectedVersion')).toBe('2');
    typeInto(query(form, 'input[name="validThrough"]'), '2026-12-01');
    await submit(form);
    expect(textOf(query(root, '[data-command-error]'))).toContain(
      'This grant changed. Review the current term and try again.',
    );
    // POST then a GET: the winner's term is read before any retry.
    expect(calls.map((call) => call.method)).toStrictEqual(['POST', 'GET']);
    expect(textOf(query(root, `tr[data-grant-id="${GRANT_ID}"]`))).toContain(
      '2026-11-15',
    );
  });
});

describe('AC-1138 owner targets itself', () => {
  it("[P2-S09-AC-1138] the grant form has no self-target rule: any person id, including the owner's own, is accepted locally", () => {
    const errors = validateGrantFields(
      {
        subjectPersonId: GRANT_UUID,
        capability: 'cms.schema_designer',
        validThrough: '2026-12-01',
        reason: '',
      },
      { minDate: '2026-10-02', maxDate: '2026-12-30' },
    );
    expect(errors).toStrictEqual({});
  });

  it('[P2-S09-AC-1138] every grantable capability is selectable, reviewer and specialist capabilities included', () => {
    const doc = renderConsoleDocument(consoleProps());
    const options = [
      ...doc.querySelectorAll<HTMLOptionElement>(
        'select[name="capability"] option',
      ),
    ]
      .map((option) => option.value)
      .filter((value) => value !== '');
    expect([...options].sort()).toStrictEqual(
      [...GRANTABLE_CMS_CAPABILITIES].sort(),
    );
    for (const capability of [
      'cms.reviewer',
      'cms.reviewer.legal',
      'cms.schema_designer',
      'cms.publisher',
    ])
      expect(options).toContain(capability);
  });

  it('[P2-S09-AC-1138] a self-grant of a reviewing capability is sent as an ordinary grant command; separation of duties is not decided in the browser', async () => {
    const { calls } = scriptFetch(
      () =>
        jsonResponse(201, grantResource({ capability: 'cms.reviewer.legal' })),
      () => listResponse(),
    );
    const root = mount();
    await submit(
      fillGrantForm(root, {
        person: GRANT_UUID,
        capability: 'cms.reviewer.legal',
      }),
    );
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.body?.get('capability')).toBe('cms.reviewer.legal');
    expect(textOf(query(root, '#cms-grants-result-heading'))).toBe(
      'Capability granted',
    );
  });
});
