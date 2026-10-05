/**
 * CMS-03A-07 detail `activationPreparation.dryRunRef` sealed report evidence:
 * the Worker parses the DB projection's counts and hashes through the strict
 * contract, passes them through unchanged for a sealed report, and refuses a
 * projection that carries final evidence on an unsealed dry run (the DB must
 * only project them from the immutable `cms_schema_dry_run_reports` row).
 */
import { describe, expect, it } from 'vitest';

import {
  CMS_ORIGIN,
  REQUEST_ID,
  TYPE_ID,
  VERSION_ID,
  detail,
  ok,
} from './phase-02-slice-09-test-values';
import {
  activationPreparation,
  detailWithPreparation,
} from './phase-02-slice-09-dec108-test-values';
import { makeDec108Harness } from './phase-02-slice-09-dec108-test-support';

const request = (): Request =>
  new Request(
    `https://api.example.test/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}`,
    {
      headers: {
        origin: CMS_ORIGIN,
        authorization: 'Bearer verified-session',
        'x-request-id': REQUEST_ID,
      },
    },
  );

const evidence = {
  sourceCount: 12,
  targetCount: 12,
  rowErrorCount: 0,
  sourceHash: 'a'.repeat(64),
  targetHash: 'b'.repeat(64),
  reportHash: 'c'.repeat(64),
};

const fetchWith = async (dryRunRef: Record<string, unknown>) => {
  const harness = makeDec108Harness({
    port: ok({
      ...detail,
      activationPreparation: { ...activationPreparation, dryRunRef },
    }),
  });
  return harness.app.request(request());
};

describe('CMS-03A-07 sealed dry-run report evidence parse', () => {
  it('[P2-S09-AC-963] [P2-S09-AC-1039] passes the sealed counts and hashes of a completed report through unchanged', async () => {
    const dryRunRef = { ...activationPreparation.dryRunRef, ...evidence };
    const response = await fetchWith(dryRunRef);
    expect(response.status).toBe(200);
    const body = (await response.json()) as typeof detailWithPreparation;
    expect(body.activationPreparation.dryRunRef).toEqual(dryRunRef);
  });

  it('[P2-S09-AC-963] still accepts a completed reference with no evidence members', async () => {
    expect((await fetchWith(activationPreparation.dryRunRef)).status).toBe(200);
  });

  it.each(['queued', 'running'] as const)(
    '[P2-S09-AC-963] refuses final evidence projected on a %s dry run as 502 DEPENDENCY_UNAVAILABLE',
    async (state) => {
      const response = await fetchWith({
        ...activationPreparation.dryRunRef,
        state,
        result: null,
        ...evidence,
      });
      expect(response.status).toBe(502);
      expect(((await response.json()) as { code: string }).code).toBe(
        'DEPENDENCY_UNAVAILABLE',
      );
    },
  );

  it('[P2-S09-AC-963] refuses a completed report projected with only some evidence members', async () => {
    const response = await fetchWith({
      ...activationPreparation.dryRunRef,
      ...evidence,
      reportHash: null,
    });
    expect(response.status).toBe(502);
  });
});
