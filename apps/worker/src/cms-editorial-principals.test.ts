import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  CMS_EDITORIAL_INTERNAL_OPERATIONS,
  cmsEditorialRoutePolicies,
} from '@wejammin/contracts';

import {
  CMS_CLAIM_DUE_SCHEDULES_RPC,
  CMS_EXECUTE_SCHEDULE_RPC,
} from './cms-publication-schedule-rpc-names';
import { PREVIEW_VERIFIER_RPC } from './cms-editorial-production-preview-verifier';
import { workflowHarness } from './cms-editorial/workflow-harness.test-support';

/*
 * DEC-156: CMS-03B-19 and CMS-03B-20 are internal RPCs granted to the Worker
 * service credential. The Worker enforces the registered principals at the
 * module boundary (only the scheduled sweep reaches claim/execute, only the
 * delivery adapter reaches the verifier) and neither is ever a browser route.
 */

const workerRoot = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(workerRoot, '../../web/src');

/** The directory listing of `path`, or null when it is a file. */
const listing = (path: string): string[] | null => {
  try {
    return readdirSync(path);
  } catch {
    return null;
  }
};

const relativeTo = (root: string, file: string): string =>
  file.slice(root.length + 1);

const sourceFiles = (root: string): string[] =>
  (listing(root) ?? []).flatMap((name) => {
    const path = join(root, name);
    if (listing(path) !== null) return sourceFiles(path);
    return /\.(ts|tsx|astro|mjs)$/u.test(name) &&
      !/\.test(-support)?\.(ts|tsx)$/u.test(name)
      ? [path]
      : [];
  });

const importersOf = (root: string, moduleName: string): string[] => {
  const specifier = new RegExp(
    String.raw`from\s+['"][^'"]*/${moduleName}['"]|from\s+['"]\./${moduleName}['"]`,
    'u',
  );
  return sourceFiles(root)
    .filter((file) => specifier.test(readFileSync(file, 'utf8')))
    .map((file) => relativeTo(root, file))
    .sort();
};

const mentionsOf = (root: string, literal: string): string[] =>
  sourceFiles(root)
    .filter((file) => readFileSync(file, 'utf8').includes(literal))
    .map((file) => relativeTo(root, file))
    .sort();

describe('principal boundaries', () => {
  it('lets only the scheduled sweep import the claim/execute port', () => {
    expect(importersOf(workerRoot, 'cms-publication-schedule-rpc')).toEqual([
      'cms-publication-schedule-sweep.ts',
    ]);
  });

  it('lets no Worker module but the delivery adapter import the verifier', () => {
    // Slice 15 adds the delivery adapter to this list; until then there is none.
    expect(
      importersOf(workerRoot, 'cms-editorial-production-preview-verifier'),
    ).toEqual([]);
  });

  it('keeps the RPC names inside their own modules and the sweep transport', () => {
    expect(
      mentionsOf(workerRoot, "'cms_claim_due_publication_schedules'"),
    ).toEqual(['cms-publication-schedule-rpc-names.ts']);
    expect(
      mentionsOf(workerRoot, "'cms_execute_publication_schedule'"),
    ).toEqual(['cms-publication-schedule-rpc-names.ts']);
    expect(mentionsOf(workerRoot, "'cms_verify_preview_token'")).toEqual([
      'cms-editorial-production-preview-verifier.ts',
    ]);
  });

  it('never exposes an internal RPC to the browser app', () => {
    for (const literal of [
      'cms_claim_due_publication_schedules',
      'cms_execute_publication_schedule',
      'cms_verify_preview_token',
      'cms_load_quality_gate_input',
    ])
      expect(mentionsOf(webRoot, literal)).toEqual([]);
  });

  it('names exactly the RPCs the contract registers for the two internal operations', () => {
    const rpcs = (id: 'CMS-03B-19' | 'CMS-03B-20'): string[] =>
      [...CMS_EDITORIAL_INTERNAL_OPERATIONS[id].rpcs].map(
        (rpc) => rpc.split('.')[1] as string,
      );
    expect(rpcs('CMS-03B-19')).toEqual([PREVIEW_VERIFIER_RPC]);
    expect(rpcs('CMS-03B-20')).toEqual([
      CMS_CLAIM_DUE_SCHEDULES_RPC,
      CMS_EXECUTE_SCHEDULE_RPC,
    ]);
    expect(CMS_EDITORIAL_INTERNAL_OPERATIONS['CMS-03B-19'].principal).toBe(
      'shard04_delivery',
    );
    expect(CMS_EDITORIAL_INTERNAL_OPERATIONS['CMS-03B-20'].principal).toBe(
      'worker_scheduled_sweep',
    );
  });
});

describe('browser route inventory', () => {
  const hono = (path: string): string => path.replace(/\{(\w+)\}/gu, ':$1');

  it('mounts exactly the registry operations and no internal route', () => {
    const { app } = workflowHarness();
    const mounted = app.routes
      .filter((route) => route.method === 'GET' || route.method === 'POST')
      .map((route) => `${route.method} ${route.path}`)
      .sort();
    const registry = cmsEditorialRoutePolicies
      .map((policy) => `${policy.method} ${hono(policy.path)}`)
      .sort();
    expect(mounted).toEqual(registry);
    expect(mounted).toHaveLength(18);
    for (const route of mounted)
      expect(route).not.toMatch(/verify|claim|execute|internal|quality/u);
  });
});
