import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

/*
 * The static import closure of a browser entry, for the zod-free guards (FE03
 * "Performance budgets and loading strategy", AC261). Dynamic `import()` edges are
 * the lazy chunks and are not followed; `import type` is erased and not counted.
 * `cms-island-static-closure.test.ts` and the governed-review closure test carry
 * older copies of this walk; they can adopt this module when next edited.
 */
const STATIC_IMPORT =
  /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^;'"]*?\s+from\s+)?['"]([^'"]+)['"]/gu;

const resolveLocal = (from: string, specifier: string): string | null => {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(from), specifier);
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ])
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  return null;
};

/** Every package specifier statically reachable from `entry`, as `specifier <- file`. */
export const staticPackages = (
  entry: string,
  srcRoot: string,
): readonly string[] => {
  const seen = new Set<string>();
  const packages = new Set<string>();
  const pending = [entry];
  while (pending.length > 0) {
    const file = pending.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const match of readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) {
      if (match[1] !== undefined) continue;
      const specifier = match[2] as string;
      const local = resolveLocal(file, specifier);
      if (local !== null) pending.push(local);
      else if (!specifier.startsWith('.'))
        packages.add(`${specifier} <- ${relative(srcRoot, file)}`);
    }
  }
  return [...packages].sort();
};
