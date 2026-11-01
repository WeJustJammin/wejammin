import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/*
 * The source files statically reachable from a browser entry. Dynamic `import()` edges are lazy chunks and are not
 * followed; `import type` is erased and not counted. The package walk of the zod-free guards
 * (`cms-pattern-designer/static-closure.test-support.ts`) reports packages; this one reports the local files, for the
 * guards that a module stays out of a cold load.
 */
const STATIC_IMPORT =
  /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^;'"]*?\s+from\s+)?['"]([^'"]+)['"]/gu;

const resolveLocal = (from: string, specifier: string): string | null => {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(from), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`])
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  return null;
};

export const staticLocalFiles = (entry: string): ReadonlySet<string> => {
  const seen = new Set<string>();
  const pending = [entry];
  while (pending.length > 0) {
    const file = pending.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const match of readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) {
      if (match[1] !== undefined) continue;
      const local = resolveLocal(file, match[2] as string);
      if (local !== null) pending.push(local);
    }
  }
  return seen;
};
