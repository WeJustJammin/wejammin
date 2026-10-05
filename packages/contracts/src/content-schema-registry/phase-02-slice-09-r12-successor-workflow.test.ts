import { describe, expect, it } from 'vitest';

import { SchemaSuccessorRequestSchema } from './requests-human.ts';

// R12 (AC390): CMS-03A-09 carries the optional workflow pair with the same
// both-null-or-absent (keep the source member) / both-present (replace it with a
// seeded registry member) semantics as the locale and template pairs. The
// registry membership itself is decided by the database; the Worker refuses only
// what it can see.
const clone = {
  expectedVersion: '3',
  supportedLocales: null,
  fallbackChains: null,
  defaultTemplateVersionId: null,
  templateBindings: null,
};

const issues = (
  value: unknown,
): ReadonlyArray<{ path: string; message: string }> => {
  const parsed = SchemaSuccessorRequestSchema.safeParse(value);
  return parsed.success
    ? []
    : parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
};

describe('CMS-03A-09 successor workflow member (AC390)', () => {
  it('[P2-S09-AC-390] accepts the request without the workflow pair (keep the source member)', () => {
    expect(SchemaSuccessorRequestSchema.parse(clone)).toEqual(clone);
  });

  it('[P2-S09-AC-390] accepts both workflow members null', () => {
    const request = { ...clone, workflowKey: null, workflowVersion: null };
    expect(SchemaSuccessorRequestSchema.parse(request)).toEqual(request);
  });

  it('[P2-S09-AC-390] accepts both workflow members present (replace the source member)', () => {
    const request = {
      ...clone,
      workflowKey: 'editorial',
      workflowVersion: '1',
    };
    expect(SchemaSuccessorRequestSchema.parse(request)).toEqual(request);
  });

  it('[P2-S09-AC-390] refuses one workflow member without the other', () => {
    const pair =
      'workflowKey and workflowVersion must be both null or both present';
    expect(issues({ ...clone, workflowKey: 'editorial' })).toContainEqual({
      path: 'workflowVersion',
      message: pair,
    });
    expect(issues({ ...clone, workflowVersion: '1' })).toContainEqual({
      path: 'workflowVersion',
      message: pair,
    });
    expect(
      issues({ ...clone, workflowKey: 'editorial', workflowVersion: null }),
    ).toContainEqual({ path: 'workflowVersion', message: pair });
  });

  it('[P2-S09-AC-390] refuses a malformed workflow key or version before the database', () => {
    expect(
      issues({ ...clone, workflowKey: 'Editorial', workflowVersion: '1' })
        .length,
    ).toBeGreaterThan(0);
    expect(
      issues({ ...clone, workflowKey: 'editorial', workflowVersion: '01' })
        .length,
    ).toBeGreaterThan(0);
    expect(
      issues({ ...clone, workflowKey: 7, workflowVersion: '1' }).length,
    ).toBeGreaterThan(0);
  });

  it('[P2-S09-AC-390] still refuses an unknown member', () => {
    expect(
      issues({ ...clone, workflowPolicyHash: 'a'.repeat(64) }).length,
    ).toBeGreaterThan(0);
  });
});
