import { describe, expect, it } from 'vitest';

import { humanCase } from './phase-02-slice-09-pre-support';

describe('pre-amendment human case lookup', () => {
  it('returns the case for a declared human operation', () => {
    expect(humanCase('CMS-03A-04')).toMatchObject({
      operationId: 'CMS-03A-04',
      port: 'activateSchema',
    });
  });

  it('fails fast for an operation the table does not declare', () => {
    expect(() => humanCase('CMS-03A-99' as never)).toThrow(
      'unknown CMS-03A-99',
    );
  });
});
