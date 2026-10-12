import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * A throw-away build directory shaped like `apps/web/dist`: every asset lands
 * in `client/_astro/`. Call `removeBundleFixtures` from `afterEach`.
 */
const fixtureRoots: string[] = [];

export const createBundleFixture = (
  assets: Readonly<Record<string, string>>,
): string => {
  const root = mkdtempSync(join(tmpdir(), 'wejammin-bundle-fixture-'));
  fixtureRoots.push(root);
  const assetDirectory = join(root, 'client', '_astro');
  mkdirSync(assetDirectory, { recursive: true });
  for (const [name, content] of Object.entries(assets)) {
    writeFileSync(join(assetDirectory, name), content);
  }
  return root;
};

export const removeBundleFixtures = (): void => {
  for (const root of fixtureRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
};

/** Pseudo-random text that gzip cannot shrink, so a byte budget is meaningful. */
export const incompressiblePayload = (seed: number, length: number): string => {
  let state = seed;
  let payload = '';
  while (payload.length < length) {
    state = (state * 48271) % 2_147_483_647;
    payload += state.toString(36);
  }
  return payload.slice(0, length);
};
