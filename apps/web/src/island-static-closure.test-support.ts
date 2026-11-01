import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

/**
 * The static import closure of a browser entry, shared by the island closure guards. Dynamic
 * `import()` edges are the lazy chunks and are not followed; `import type` is erased and not
 * counted.
 */
export const SRC_ROOT = resolve(import.meta.dirname);

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
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
};

export interface Closure {
  readonly files: readonly string[];
  /** Non-relative value imports as `<package> <- <importer>`. */
  readonly packages: readonly string[];
}

export const staticClosure = (entry: string): Closure => {
  const seen = new Set<string>();
  const packages = new Set<string>();
  const pending = [entry];
  while (pending.length > 0) {
    const file = pending.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(STATIC_IMPORT)) {
      if (match[1] !== undefined) continue;
      const specifier = match[2] as string;
      const local = resolveLocal(file, specifier);
      if (local !== null) pending.push(local);
      else if (!specifier.startsWith('.'))
        packages.add(`${specifier} <- ${relative(SRC_ROOT, file)}`);
    }
  }
  return {
    files: [...seen].map((file) => relative(SRC_ROOT, file)).sort(),
    packages: [...packages].sort(),
  };
};
