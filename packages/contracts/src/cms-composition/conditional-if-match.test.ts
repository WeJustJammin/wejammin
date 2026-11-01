import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CMS_IF_MATCH_EXPECTED_VERSION_MISMATCH } from '../cms-editorial/if-match';
import {
  CMS_IF_MATCH_FORBIDDEN_ON_CREATE,
  CMS_IF_MATCH_REQUIRED_ON_EDIT,
  refineConditionalIfMatch,
} from './conditional-if-match';
import { issueMessages, issuePaths } from './composition-fixtures.test-support';

const schema = z
  .strictObject({
    headers: z.strictObject({ ifMatch: z.string().optional() }),
    body: z.strictObject({ expectedVersion: z.string().nullable() }),
  })
  .superRefine(refineConditionalIfMatch);

describe('conditional If-Match (CMS-03C-12 and CMS-03C-16 lineage create)', () => {
  it('[P2-S12-AC-103] accepts no If-Match on a first version and an equal one on a successor', () => {
    expect(
      schema.safeParse({ headers: {}, body: { expectedVersion: null } })
        .success,
    ).toBe(true);
    expect(
      schema.safeParse({
        headers: { ifMatch: '"4"' },
        body: { expectedVersion: '4' },
      }).success,
    ).toBe(true);
  });

  it('[P2-S12-AC-103] reports a missing, forbidden or different If-Match once at headers.ifMatch with its own reason', () => {
    const cases: [unknown, string][] = [
      [
        { headers: { ifMatch: '"4"' }, body: { expectedVersion: null } },
        CMS_IF_MATCH_FORBIDDEN_ON_CREATE,
      ],
      [
        { headers: {}, body: { expectedVersion: '4' } },
        CMS_IF_MATCH_REQUIRED_ON_EDIT,
      ],
      [
        { headers: { ifMatch: '"5"' }, body: { expectedVersion: '4' } },
        CMS_IF_MATCH_EXPECTED_VERSION_MISMATCH,
      ],
    ];
    for (const [candidate, message] of cases) {
      expect(issuePaths(schema, candidate)).toEqual(['headers.ifMatch']);
      expect(issueMessages(schema, candidate)).toEqual([message]);
    }
  });

  it('[P2-S12-AC-103] leaves a malformed If-Match to the header schema instead of calling it a mismatch', () => {
    expect(
      schema.safeParse({
        headers: { ifMatch: 'W/"4"' },
        body: { expectedVersion: '4' },
      }).success,
    ).toBe(true);
  });
});
