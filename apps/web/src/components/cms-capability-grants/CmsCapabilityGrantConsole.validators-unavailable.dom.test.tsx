// @vitest-environment jsdom

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  loadCmsValidators,
  resetCmsValidatorsForTest,
} from '../../lib/cms-contract-validators';

vi.mock('../../lib/client-binding', () => ({
  addClientBindingIdHeader: async (_input: unknown, init?: RequestInit) => init,
}));

import {
  grantListPage,
  grantResource,
} from '../../server/cms-capability-grant.test-support';
import {
  apiError,
  consoleProps,
  jsonResponse,
  sampleItems,
} from './cms-capability-grant-console.test-support';
import {
  blur,
  click,
  fillGrantForm,
  mountConsole,
  query,
  scriptFetch,
  settle,
  submit,
  textOf,
  typeInto,
  type Mounted,
} from './cms-capability-grant-dom.test-support';
import { GRANT_CHECK_UNAVAILABLE_COPY } from './cms-capability-grant-validation';

/**
 * FE03 performance budgets (AC261): the console route ships no zod, so every
 * check loads the schemas lazily. When they cannot be fetched the form was not
 * checked: nothing is sent, the person is told, and a later submit works.
 */

const ROW_ID = '6d1e8b24-5c93-7a0f-8e47-b2d6c9f13a85';
const offline = () => Promise.reject(new Error('offline'));

let mounted: Mounted | null = null;
const mount = (overrides = {}) => {
  mounted = mountConsole(consoleProps(overrides));
  return mounted.container;
};
const grantListResponse = () => jsonResponse(200, grantListPage(sampleItems()));

beforeAll(async () => {
  await loadCmsValidators();
});

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.sessionStorage.clear();
  resetCmsValidatorsForTest(offline);
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.unstubAllGlobals();
  resetCmsValidatorsForTest();
});

describe('console checks when the validators cannot be loaded', () => {
  it('sends nothing from the grant form, says so, and sends after the connection returns', async () => {
    const { calls, fetchMock } = scriptFetch(
      () => jsonResponse(201, grantResource()),
      () => grantListResponse(),
    );
    const root = mount();
    const form = fillGrantForm(root);
    await submit(form);
    expect(fetchMock).not.toHaveBeenCalled();
    const alert = query(root, '#cms-grant-check-unavailable');
    expect(alert.getAttribute('role')).toBe('alert');
    expect(textOf(alert)).toBe(GRANT_CHECK_UNAVAILABLE_COPY);

    resetCmsValidatorsForTest();
    await submit(form);
    expect(calls[0]).toMatchObject({
      url: '/api/v1/cms/capability-grants',
      method: 'POST',
    });
    expect(root.querySelector('#cms-grant-check-unavailable')).toBeNull();
  });

  it('shows no field error from a blur check that could not run', async () => {
    const root = mount();
    const person = query<HTMLInputElement>(
      root,
      'input[name="subjectPersonId"]',
    );
    typeInto(person, 'abc');
    blur(person);
    await settle();
    expect(person.getAttribute('aria-invalid')).toBeNull();
    expect(
      root.querySelector('.content-schema-registry-field-error'),
    ).toBeNull();
  });

  it('sends nothing from the renew form and says so', async () => {
    const { fetchMock } = scriptFetch(() => grantListResponse());
    const root = mount();
    click(
      query(root, `tr[data-grant-id="${ROW_ID}"] button[data-action="renew"]`),
    );
    const form = query<HTMLFormElement>(
      root,
      'form[data-operation-id="CMS-03A-16"]',
    );
    typeInto(query(form, 'input[name="validThrough"]'), '2026-12-01');
    await submit(form);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(textOf(form)).toContain(GRANT_CHECK_UNAVAILABLE_COPY);
  });

  it('sends nothing from the revoke confirmation and says so', async () => {
    const { fetchMock } = scriptFetch(() => grantListResponse());
    const root = mount();
    click(
      query(root, `tr[data-grant-id="${ROW_ID}"] button[data-action="revoke"]`),
    );
    const form = query<HTMLFormElement>(
      root,
      'form[data-operation-id="CMS-03A-17"]',
    );
    click(query(form, 'input[name="confirmed"]'));
    await submit(form);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(textOf(form)).toContain(GRANT_CHECK_UNAVAILABLE_COPY);
  });

  it('keeps the last verified rows and offers a retry when Back cannot parse the address', async () => {
    const { fetchMock } = scriptFetch(() => grantListResponse());
    const root = mount();
    window.history.pushState(
      {},
      '',
      '/app/cms-content-modeling/capability-grants?state=active',
    );
    window.dispatchEvent(new PopStateEvent('popstate'));
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(textOf(root)).toContain('The grants could not be refreshed.');
    expect(root.querySelector(`tr[data-grant-id="${ROW_ID}"]`)).not.toBeNull();
  });

  it('says the list was not filtered when the capability filter cannot be checked', async () => {
    const { fetchMock } = scriptFetch(
      () =>
        jsonResponse(
          409,
          apiError('CONFLICT', {
            conflict: 'INVALID_TRANSITION',
            recoveryAction: 'renew',
          }),
        ),
      () => grantListResponse(),
    );
    resetCmsValidatorsForTest();
    await loadCmsValidators();
    const root = mount();
    await submit(fillGrantForm(root));
    resetCmsValidatorsForTest(offline);
    click(query(root, 'button[data-action="filter-capability"]'));
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(textOf(root)).toContain('The list could not be filtered');
  });
});

describe('Back with the validators loaded', () => {
  it('restores the list position from the address and re-reads the list', async () => {
    resetCmsValidatorsForTest();
    await loadCmsValidators();
    const { calls } = scriptFetch(() => grantListResponse());
    mount();
    window.history.pushState(
      {},
      '',
      '/app/cms-content-modeling/capability-grants?state=active',
    );
    window.dispatchEvent(new PopStateEvent('popstate'));
    await settle();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain('state=active');
  });
});
