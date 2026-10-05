import { describe, expect, it } from 'vitest';
import { GRANTABLE_CMS_CAPABILITIES } from '@wejammin/contracts';

import {
  CMS_CAPABILITY_GRANT_CONSOLE_PATH,
  cmsCapabilityGrantConsoleUrl,
  grantTermWindow,
  parseCmsCapabilityGrantPageQuery,
} from './cms-capability-grant-contracts';
import { SUBJECT_ID } from './cms-capability-grant.test-support';

const url = (search = ''): URL =>
  new URL(
    `https://app.test/app/cms-content-modeling/capability-grants${search}`,
  );

describe('[DEC-119] grant console query', () => {
  it('defaults to the first page sorted by most recently updated', () => {
    expect(parseCmsCapabilityGrantPageQuery(url())).toStrictEqual({
      limit: 25,
      sort: 'updatedAt',
      direction: 'desc',
    });
  });

  it('keeps the bounded filters and the opaque cursor', () => {
    expect(
      parseCmsCapabilityGrantPageQuery(
        url(
          '?capability=cms.author&state=lapsed&limit=50&sort=validThrough&direction=asc&cursor=abc_DEF-123',
        ),
      ),
    ).toMatchObject({
      capability: 'cms.author',
      state: 'lapsed',
      limit: 50,
      sort: 'validThrough',
      direction: 'asc',
      cursor: 'abc_DEF-123',
    });
  });

  it('[P2-S09-AC-1025] never lets the person filter enter page state, even when supplied', () => {
    const query = parseCmsCapabilityGrantPageQuery(
      url(`?subjectPersonId=${SUBJECT_ID}`),
    );
    expect(query).not.toHaveProperty('subjectPersonId');
    expect(cmsCapabilityGrantConsoleUrl(query)).not.toContain(SUBJECT_ID);
  });

  it.each([
    '?capability=cms.schema_review',
    '?state=pending',
    '?limit=0',
    '?limit=101',
    '?sort=capability',
    '?direction=up',
    '?cursor=',
  ])('normalizes the invalid query %s to the defaults', (search) => {
    expect(parseCmsCapabilityGrantPageQuery(url(search))).toStrictEqual({
      limit: 25,
      sort: 'updatedAt',
      direction: 'desc',
    });
  });

  it('serializes only validated non-default state into the console URL', () => {
    expect(
      cmsCapabilityGrantConsoleUrl(parseCmsCapabilityGrantPageQuery(url())),
    ).toBe(CMS_CAPABILITY_GRANT_CONSOLE_PATH);
    expect(
      cmsCapabilityGrantConsoleUrl(
        parseCmsCapabilityGrantPageQuery(
          url('?capability=cms.editor&state=active'),
        ),
      ),
    ).toBe(
      `${CMS_CAPABILITY_GRANT_CONSOLE_PATH}?capability=cms.editor&state=active`,
    );
  });
});

describe('[DEC-120] grant term window', () => {
  const at = (iso: string) => Date.parse(iso);

  it('runs from the current UTC date through today plus 89 days', () => {
    expect(grantTermWindow(at('2026-10-02T23:59:59.999Z'))).toStrictEqual({
      minDate: '2026-10-02',
      maxDate: '2026-12-30',
    });
  });

  it('is a 90-day span including both ends', () => {
    const { minDate, maxDate } = grantTermWindow(
      at('2026-10-02T00:00:00.000Z'),
    );
    const days = (Date.parse(maxDate) - Date.parse(minDate)) / 86_400_000;
    expect(days).toBe(89);
  });

  it('crosses a year end and a leap day correctly', () => {
    expect(grantTermWindow(at('2026-11-01T12:00:00.000Z')).maxDate).toBe(
      '2027-01-29',
    );
    expect(grantTermWindow(at('2028-01-01T00:00:00.000Z')).maxDate).toBe(
      '2028-03-30',
    );
  });

  it('uses the UTC date, not the local one, at the day boundary', () => {
    expect(grantTermWindow(at('2026-10-03T00:00:00.000Z')).minDate).toBe(
      '2026-10-03',
    );
    expect(grantTermWindow(at('2026-10-02T23:59:59.999Z')).minDate).toBe(
      '2026-10-02',
    );
  });
});

describe('[DEC-119] generated grantable registry', () => {
  it('[P2-S09-AC-988] contains the DEC-108/B2 navigation and media capabilities and no assignment-only key', () => {
    expect(GRANTABLE_CMS_CAPABILITIES).toContain('cms.navigation_editor');
    expect(GRANTABLE_CMS_CAPABILITIES).toContain('cms.media_contributor');
    expect(GRANTABLE_CMS_CAPABILITIES).toContain('cms.media_curator');
    expect(GRANTABLE_CMS_CAPABILITIES).not.toContain('cms.schema_review');
  });
});
