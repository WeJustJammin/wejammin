import { describe, expect, it } from 'vitest';

import {
  cmsEditorialDeclaresError,
  type CmsEditorialErrorDeclaration,
} from './route-policy-errors';

describe('cmsEditorialDeclaresError with a code mapped to nothing', () => {
  const errors = {
    NOT_FOUND: undefined,
    CONFLICT: 409,
  } as unknown as CmsEditorialErrorDeclaration;

  it('treats an own code with no declared status as undeclared', () => {
    expect(cmsEditorialDeclaresError(errors, 'NOT_FOUND', 404)).toBe(false);
  });

  it('still answers for the other codes of the same map', () => {
    expect(cmsEditorialDeclaresError(errors, 'CONFLICT', 409)).toBe(true);
    expect(cmsEditorialDeclaresError(errors, 'CONFLICT', 404)).toBe(false);
  });
});
