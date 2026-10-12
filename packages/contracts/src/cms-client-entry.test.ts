import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as barrel from './index.ts';
import {
  CMS_PREFLIGHT_CATEGORIES,
  CMS_REVIEW_ASSIGNMENT_MAX_ACTIVE,
  CMS_REVIEW_ASSIGNMENT_MAX_SECONDS,
  CMS_TZDB_VERSION,
  PUBLICATION_ACTIONS,
  RICH_TEXT_MARKS,
  cmsJsonEqual,
  cmsReviewAssignmentExpiryCeiling,
  fieldIdOfPointer,
  isCmsUuid,
  isWellFormedAuthoredString,
  parseLocalDateTime,
  reviewAssignmentSuccessStatus,
} from './client.ts';
import * as validators from './cms-editorial/validators.ts';

/**
 * The CMS editorial islands hydrate without zod (FE03 "Performance budgets and
 * loading strategy", AC-106): `client.ts` carries the constants and pure rules
 * they need at hydration, and `cms-editorial/validators.ts` is the entry they
 * load lazily for everything that is a schema. Both are curated entries, never
 * the package barrel.
 */

const STATIC_IMPORT =
  /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^;'"]*?\s+from\s+)?['"]([^'"]+)['"]/gu;

const externalValueImports = (entry: string): string[] => {
  const seen = new Set<string>();
  const external = new Set<string>();
  const pending = [entry];
  while (pending.length > 0) {
    const file = pending.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const match of readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) {
      if (match[1] !== undefined) continue;
      const specifier = match[2] as string;
      if (!specifier.startsWith('.')) {
        external.add(specifier);
        continue;
      }
      const target = resolve(dirname(file), specifier);
      if (existsSync(target) && statSync(target).isFile()) pending.push(target);
    }
  }
  return [...external].sort();
};

describe('zod-free CMS editorial client entry', () => {
  it('re-exports exactly the barrel values, so no vocabulary or rule can drift', () => {
    expect(CMS_PREFLIGHT_CATEGORIES).toBe(barrel.CMS_PREFLIGHT_CATEGORIES);
    expect(CMS_REVIEW_ASSIGNMENT_MAX_ACTIVE).toBe(
      barrel.CMS_REVIEW_ASSIGNMENT_MAX_ACTIVE,
    );
    expect(CMS_REVIEW_ASSIGNMENT_MAX_SECONDS).toBe(
      barrel.CMS_REVIEW_ASSIGNMENT_MAX_SECONDS,
    );
    expect(CMS_TZDB_VERSION).toBe(barrel.CMS_TZDB_VERSION);
    expect(cmsJsonEqual).toBe(barrel.cmsJsonEqual);
    expect(cmsReviewAssignmentExpiryCeiling).toBe(
      barrel.cmsReviewAssignmentExpiryCeiling,
    );
    expect(isCmsUuid).toBe(barrel.isCmsUuid);
    expect(fieldIdOfPointer).toBe(barrel.fieldIdOfPointer);
    expect(RICH_TEXT_MARKS).toBe(barrel.RICH_TEXT_MARKS);
    expect(isWellFormedAuthoredString).toBe(barrel.isWellFormedAuthoredString);
    expect(reviewAssignmentSuccessStatus).toBe(
      barrel.reviewAssignmentSuccessStatus,
    );
  });

  it('builds each closed schema from the zod-free vocabulary the browser lists', () => {
    expect(PUBLICATION_ACTIONS).toEqual(barrel.PublicationActionSchema.options);
    expect(CMS_PREFLIGHT_CATEGORIES).toEqual(
      barrel.PreflightCategorySchema.options,
    );
  });

  it('reads a schedule local date and time exactly as the contract schema accepts it', () => {
    const corpus = [
      '2026-10-12T09:30',
      '2026-10-12T09:30:15',
      '2026-10-12T09:30:15.123456789',
      '2026-10-12T09:30:15.1234567890',
      '2024-02-29T00:00',
      '2025-02-29T00:00',
      '2100-02-29T00:00',
      '2000-02-29T00:00',
      '0000-01-01T00:00',
      '0001-01-01T00:00',
      '9999-12-31T23:59:59',
      '2026-13-01T00:00',
      '2026-00-10T00:00',
      '2026-04-31T00:00',
      '2026-10-12T24:00',
      '2026-10-12T23:60',
      '2026-10-12T23:59:60',
      '2026-10-12T09:30Z',
      '2026-10-12T09:30+02:00',
      '2026-10-12 09:30',
      '2026-10-12',
      '',
      '  2026-10-12T09:30',
    ];
    for (const value of corpus)
      expect(parseLocalDateTime(value) !== null, JSON.stringify(value)).toBe(
        barrel.CmsScheduleLocalDateTimeSchema.safeParse(value).success,
      );
    expect(parseLocalDateTime('2026-10-12T09:30')).not.toBeNull();
    expect(parseLocalDateTime('2025-02-29T00:00')).toBeNull();
  });

  it('imports no zod anywhere in its static closure', () => {
    expect(
      externalValueImports(resolve(import.meta.dirname, 'client.ts')),
    ).toEqual([]);
  });

  it('exposes the lazily loaded validators as the barrel objects, importing only zod', () => {
    const names = Object.keys(validators);
    expect(names.length).toBeGreaterThan(50);
    for (const name of names)
      expect((validators as Record<string, unknown>)[name], name).toBe(
        (barrel as Record<string, unknown>)[name],
      );
    expect(
      externalValueImports(
        resolve(import.meta.dirname, 'cms-editorial/validators.ts'),
      ),
    ).toEqual(['zod']);
  });
});
