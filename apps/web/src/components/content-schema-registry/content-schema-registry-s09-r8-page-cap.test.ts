import { describe, expect, it } from 'vitest';

import { parseContentSchemaRegistryQuery } from '../../server/content-schema-registry-contracts';

/**
 * FE03 registry list scale: the list is server-paged with a hard cap of 100
 * rows, so a list of more than 100 is never rendered at once and needs no
 * client virtualization. The cap is enforced where the page size is parsed.
 */

const parse = (limit: string) =>
  parseContentSchemaRegistryQuery(
    new URL(`https://app.example.test/app/cms-content-modeling?limit=${limit}`),
  );

describe('[P2-S09-AC-261] registry page size cap', () => {
  it('[P2-S09-AC-261] accepts a page of exactly 100 rows', () => {
    expect(parse('100').limit).toBe(100);
  });

  it('[P2-S09-AC-261] refuses a page of 101 rows', () => {
    expect(() => parse('101')).toThrow();
  });
});
