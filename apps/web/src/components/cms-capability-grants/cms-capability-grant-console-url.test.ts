import * as validators from '@wejammin/contracts/cms-editorial/validators';
import { describe, expect, it } from 'vitest';

import {
  CMS_CAPABILITY_GRANT_DEFAULT_QUERY,
  cmsCapabilityGrantConsoleUrl,
  parseCmsCapabilityGrantPageQueryWith,
} from './cms-capability-grant-console-url';
import { parseCmsCapabilityGrantPageQuery } from './cms-capability-grant-url';

const ADDRESSES = [
  '/app/cms-content-modeling/capability-grants',
  '/app/cms-content-modeling/capability-grants?state=active&capability=cms.author',
  '/app/cms-content-modeling/capability-grants?limit=50&sort=validThrough&direction=asc',
  '/app/cms-content-modeling/capability-grants?limit=0&state=nope',
  '/app/cms-content-modeling/capability-grants?subjectPersonId=f08a3c62-91d4-7b5e-a620-4c7e1d9b08f3',
];

describe('console address rules shared by the server and the lazy browser path', () => {
  it.each(ADDRESSES)(
    'parses %s identically with the static and the lazily loaded schema',
    (address) => {
      const url = new URL(address, 'https://app.test');
      expect(
        parseCmsCapabilityGrantPageQueryWith(validators, url),
      ).toStrictEqual(parseCmsCapabilityGrantPageQuery(url));
    },
  );

  it('normalizes an invalid address to the defaults and never carries the person filter', () => {
    const invalid = new URL(ADDRESSES[3] ?? '', 'https://app.test');
    expect(
      parseCmsCapabilityGrantPageQueryWith(validators, invalid),
    ).toStrictEqual(CMS_CAPABILITY_GRANT_DEFAULT_QUERY);
    const withPerson = new URL(ADDRESSES[4] ?? '', 'https://app.test');
    expect(
      cmsCapabilityGrantConsoleUrl(
        parseCmsCapabilityGrantPageQueryWith(validators, withPerson),
      ),
    ).not.toContain('subjectPersonId');
  });
});
