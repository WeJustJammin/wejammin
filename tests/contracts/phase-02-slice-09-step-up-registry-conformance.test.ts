import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { MFA_METHOD_REGISTRY } from '../../apps/worker/src/authentication/step-up';
import { CMS_STEP_UP_ALLOWED_METHODS } from '../../apps/worker/src/content-schema-registry/production-errors';

const WORKER_SRC = resolve(import.meta.dirname, '../../apps/worker/src');
const TEST_FILE =
  /(\.test|[.-]test-support|\.fixtures|\.coverage\.fixtures)\.tsx?$/u;

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') && !TEST_FILE.test(path) ? [path] : [];
  });

describe('STEP_UP_REQUIRED emitters share one allowlisted method registry (BE00)', () => {
  it('[P2-S09-AC-909] no Worker source file hard-codes a literal allowedMethods list', () => {
    const offenders = sourceFiles(WORKER_SRC)
      .filter((path) =>
        /allowedMethods\s*:\s*\[\s*['"`]/u.test(readFileSync(path, 'utf8')),
      )
      .map((path) => relative(WORKER_SRC, path));

    expect(offenders).toEqual([]);
  });

  it('[P2-S09-AC-909] the CMS allowlist is a copy of, never a divergence from, the registry', () => {
    expect([...CMS_STEP_UP_ALLOWED_METHODS]).toEqual([...MFA_METHOD_REGISTRY]);
  });
});
