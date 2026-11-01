// @vitest-environment jsdom

import { ApiErrorSchema } from '@wejammin/contracts';
import * as React from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  byLabel,
  buttonNamed,
  choose,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
  selectBy,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { describeCmsAuthoringFields } from '../cms-editorial-fields/cms-field-descriptor-decode';
import {
  authoringField,
  fieldUuid,
  selectedType,
} from '../cms-editorial-fields/cms-field-fixtures.test-support';
import CmsEditorialEntryCreateIsland from './CmsEditorialEntryCreateIsland';
import { preloadCmsEditorialTransports } from './cms-editorial-lazy-transports.test-support';

beforeAll(enableReactAct);
beforeAll(preloadCmsEditorialTransports);
afterAll(disableReactAct);
beforeEach(() => {
  document.cookie = 'wj_csrf=csrf-token';
});
afterEach(() => {
  document.body.replaceChildren();
  document.cookie = 'wj_csrf=; max-age=0';
  window.sessionStorage.clear();
});

const PRIVATE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132ef';
const PRIVATE_MARKER = 'Untrusted template ' + PRIVATE_ID;
const TITLE = 'Preserve my work';
const FIELD = fieldUuid(1);
const cases = [
  {
    status: 404,
    code: 'NOT_FOUND',
    details: {},
    copy: 'This entry cannot be created with the selected setup.',
  },
  {
    status: 409,
    code: 'CONFLICT',
    details: {},
    copy: 'The entry setup changed. Review the available options and try again.',
  },
  {
    status: 422,
    code: 'VALIDATION_FAILED',
    details: {
      violations: [
        {
          path: '/contentTypeVersionId',
          code: 'invalid_value',
          message: PRIVATE_MARKER,
        },
      ],
    },
    copy: 'The entry setup could not be validated. Review the available options.',
  },
] as const;

const refusal = (status: number, code: string, details: unknown): Response =>
  new Response(
    JSON.stringify(
      ApiErrorSchema.parse({
        code,
        message: PRIVATE_MARKER,
        requestId: '018f0c45-73fe-7dc2-9c09-68f7ecf132e9',
        details,
      }),
    ),
    { status, headers: { 'content-type': 'application/json' } },
  );

const renderRefusal = async (
  status: number,
  code: string,
  details: unknown,
) => {
  const fields = [
    authoringField({
      n: 1,
      key: 'title',
      kind: 'short_text',
      label: 'Title',
      required: true,
      constraints: { minLength: 2, maxLength: 40 },
    }),
  ];
  const fetcher = vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >(async () => refusal(status, code, details));
  const navigate = vi.fn();
  const mounted = mountElement(
    <CmsEditorialEntryCreateIsland
      type={selectedType()}
      fields={fields}
      descriptors={describeCmsAuthoringFields(fields)}
      fetcher={fetcher}
      navigate={navigate}
    />,
  );
  const title = byLabel<HTMLInputElement>(
    mounted.container,
    'Title (required)',
  );
  const locale = selectBy(mounted.container, '#entry-locale');
  await typeInto(title, TITLE);
  await choose(locale, 'fr-FR');
  await click(buttonNamed(mounted.container, 'Create entry'));
  await flush();
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, init] = fetcher.mock.calls[0] ?? [];
  expect(url).toBe('/api/v1/cms/entries');
  expect(init?.method).toBe('POST');
  expect(new Headers(init?.headers).get('if-match')).toBeNull();
  expect(JSON.parse(String(init?.body))).toMatchObject({
    locale: 'fr-FR',
    values: { [FIELD]: TITLE },
  });
  expect(navigate).not.toHaveBeenCalled();
  return { ...mounted, fetcher, title, locale };
};

describe('DEC-202 entry-create setup refusals', () => {
  it.each(cases)(
    '$status announces exact neutral copy and retains typed work',
    async (example) => {
      const { container, title, locale, fetcher } = await renderRefusal(
        example.status,
        example.code,
        example.details,
      );
      const status = container.querySelector('[role="status"]');
      expect(status?.textContent).toBe(example.copy);
      expect(status?.getAttribute('aria-live')).toBe('polite');
      expect(status?.getAttribute('aria-atomic')).toBe('true');
      expect(title.value).toBe(TITLE);
      expect(locale.value).toBe('fr-FR');
      expect(container.textContent).not.toContain(PRIVATE_MARKER);
      expect(container.textContent).not.toContain(PRIVATE_ID);
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );

  it.each(cases)(
    '$status focuses the named form summary without inventing a field',
    async (example) => {
      const { container, title, locale } = await renderRefusal(
        example.status,
        example.code,
        example.details,
      );
      expect(title.value).toBe(TITLE);
      expect(locale.value).toBe('fr-FR');
      expect(title.getAttribute('aria-invalid')).not.toBe('true');
      const summary = container.querySelector<HTMLElement>(
        '[data-cms-editorial-validation-summary]',
      );
      expect(summary).not.toBeNull();
      expect(summary?.id).toBe('cms-editorial-create-summary');
      expect(summary?.getAttribute('aria-labelledby')).toBe(
        'cms-editorial-create-summary-heading',
      );
      expect(summary?.querySelectorAll('a')).toHaveLength(0);
      expect(
        container.querySelector(
          '[name="templateVersionId"], [name="contentTypeVersionId"]',
        ),
      ).toBeNull();
      expect(container.textContent).not.toContain(PRIVATE_ID);
      expect(document.activeElement).toBe(summary);
    },
  );

  it('keeps an ordinary field 422 linked with its existing generic field copy', async () => {
    const { container, title, locale } = await renderRefusal(
      422,
      'VALIDATION_FAILED',
      {
        violations: [
          {
            path: `/fields/${FIELD}`,
            code: 'invalid_value',
            message: PRIVATE_MARKER,
          },
        ],
      },
    );
    const summary = container.querySelector<HTMLElement>(
      '[data-cms-editorial-validation-summary]',
    );
    expect(summary?.textContent).toContain('Check the highlighted fields.');
    expect(summary?.textContent).not.toContain(
      'The entry setup could not be validated.',
    );
    expect(summary?.querySelector('a')?.getAttribute('href')).toBe(
      `#field-${FIELD}`,
    );
    expect(title.getAttribute('aria-invalid')).toBe('true');
    expect(title.value).toBe(TITLE);
    expect(locale.value).toBe('fr-FR');
    expect(document.activeElement).toBe(summary);
    expect(container.textContent).not.toContain(PRIVATE_MARKER);
    expect(container.textContent).not.toContain(PRIVATE_ID);
  });
});
