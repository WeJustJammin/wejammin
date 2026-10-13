import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const fromHere = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

/*
 * Reachability guard (Slice 10 WP-S10-2c / gap (e)). FE03 line 765 requires a
 * nav entry from the content-modeling registry to the entry list, so the
 * editorial authoring surfaces are reachable by normal navigation rather than
 * only by deep link. Read as text; expected to be RED until the nav lands.
 */
const registryIndex = readFileSync(fromHere('./index.astro'), 'utf8');

describe('content-modeling registry navigates to the entries list', () => {
  it('exposes a primary-navigation link to /app/cms-content-modeling/entries', () => {
    expect(registryIndex).toContain('href="/app/cms-content-modeling/entries"');
  });

  it('places the link inside the primary navigation landmark', () => {
    const primary = registryIndex.match(
      /<nav aria-label="Primary navigation">[\s\S]*?<\/nav>/u,
    );
    expect(primary, 'no primary navigation landmark').not.toBeNull();
    expect(primary?.[0]).toContain('/app/cms-content-modeling/entries');
  });
});

describe('content-modeling registry navigates to the reviewer queue', () => {
  it('exposes a primary-navigation link to /app/cms-content-modeling/reviews', () => {
    const primary = registryIndex.match(
      /<nav aria-label="Primary navigation">[\s\S]*?<\/nav>/u,
    );
    expect(primary?.[0]).toContain('href="/app/cms-content-modeling/reviews"');
  });
});
