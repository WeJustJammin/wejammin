import { describe, expect, it } from 'vitest';
import type { TemplateVersionDetail } from '@wejammin/contracts';

import { cmsTemplateLatestIdentityValid } from './cms-template-edit-reconcile-state';

const base = {
  id: '018f0c45-73fe-7dc2-9c09-68f7ecf132dc',
  version: '2',
  contentHash: 'a'.repeat(64),
} satisfies Pick<TemplateVersionDetail, 'id' | 'version' | 'contentHash'>;

describe('CMS-11 latest-version identity', () => {
  it('accepts the same immutable parent or a newer version', () => {
    expect(cmsTemplateLatestIdentityValid(base, base)).toBe(true);
    expect(
      cmsTemplateLatestIdentityValid(base, { ...base, version: '3' }),
    ).toBe(true);
  });

  it('rejects an older or same-number different immutable parent', () => {
    expect(
      cmsTemplateLatestIdentityValid(base, { ...base, version: '1' }),
    ).toBe(false);
    expect(
      cmsTemplateLatestIdentityValid(base, {
        ...base,
        id: '018f0c45-73fe-7dc2-9c09-68f7ecf132dd',
      }),
    ).toBe(false);
    expect(
      cmsTemplateLatestIdentityValid(base, {
        ...base,
        contentHash: 'b'.repeat(64),
      }),
    ).toBe(false);
  });
});
