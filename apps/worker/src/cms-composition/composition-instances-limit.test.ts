import { describe, expect, it } from 'vitest';

import {
  CI_CURSOR,
  CI_ENTRY_ID,
  ciPage,
  ciPath,
} from './composition-instances.test-support';
import { createPatternUpdateHarness } from './pattern-update-routes.test-support';

/*
 * cmsCompositionInstancesRead page size (DEC-206 as aligned to BE00; BE03c validation row `entryId/cursor/limit`):
 * `limit` 1-50 reaches the port with the default of 25 applied at the edge, and a dependency answer must honour the
 * limit that was asked for (never more rows, a cursor only after exactly that many). The query grammar's refusals
 * (zero, above 50, fractions, padding, exponents, repeats) are in composition-instances-routes.test.ts.
 */
describe('cmsCompositionInstancesRead limit', () => {
  it.each([
    ['1', 1],
    ['25', 25],
    ['50', 50],
  ])('passes limit=%s through with the cursor', async (text, limit) => {
    const harness = createPatternUpdateHarness();
    harness.readInstances.mockImplementation(async () => ({
      ok: true,
      value: ciPage(limit),
    }));
    const response = await harness.request(
      ciPath(CI_ENTRY_ID, `?limit=${text}&cursor=${CI_CURSOR}`),
    );
    expect(response.status).toBe(200);
    expect(harness.readInstances.mock.calls[0]?.[0]).toMatchObject({
      entryId: CI_ENTRY_ID,
      cursor: CI_CURSOR,
      limit,
    });
  });

  it('applies the default of 25 when no limit is given, so the database and the answer check see one page size', async () => {
    const harness = createPatternUpdateHarness();
    await harness.request(ciPath());
    expect(harness.readInstances.mock.calls[0]?.[0]).toMatchObject({
      limit: 25,
    });
  });

  it.each([
    [
      'limit=5 with a cursor on three rows',
      '?limit=5',
      ciPage(3, { nextCursor: CI_CURSOR }),
      502,
    ],
    ['limit=3 with four rows', '?limit=3', ciPage(4), 502],
    [
      'limit=3 with a cursor on four rows',
      '?limit=3',
      ciPage(4, { nextCursor: CI_CURSOR }),
      502,
    ],
    [
      'limit=3 with a cursor on exactly three rows',
      '?limit=3',
      ciPage(3, { nextCursor: CI_CURSOR }),
      200,
    ],
    ['limit=50 with 26 rows and no cursor', '?limit=50', ciPage(26), 200],
    ['the default limit with 26 rows', '', ciPage(26), 502],
  ])(
    'an answer must honour the limit asked for: %s is %i',
    async (_name, search, value, status) => {
      const harness = createPatternUpdateHarness({
        readInstances: async () => ({ ok: true, value }),
      });
      expect((await harness.request(ciPath(CI_ENTRY_ID, search))).status).toBe(
        status,
      );
    },
  );
});
