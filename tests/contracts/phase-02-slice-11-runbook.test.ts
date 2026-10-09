import { readFileSync } from 'node:fs';

import { cmsEditorialRoutePolicies } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

/*
 * The publication runbook states the browser envelope per operation class. A
 * mutation operation takes strict JSON, an Idempotency-Key, an exact strong
 * If-Match and CSRF (BE03b Registry invariants); the three safe reads
 * CMS-03B-15/16/17 take none of them. The operation sets are DERIVED from the
 * route policy rows, so a runbook that applies a mutation guard to a read, or
 * leaves a mutation out, fails here.
 */

const runbook = readFileSync(
  'docs/runbooks/platform/cms-publication.md',
  'utf8',
);

const SLICE_11 = [
  'CMS-03B-05',
  'CMS-03B-06',
  'CMS-03B-07',
  'CMS-03B-08',
  'CMS-03B-09',
  'CMS-03B-15',
  'CMS-03B-16',
  'CMS-03B-17',
  'CMS-03B-18',
] as const;
const policies = SLICE_11.map((operationId) => {
  const found = cmsEditorialRoutePolicies.find(
    (row) => row.operationId === operationId,
  );
  if (found === undefined) throw new Error(`no policy ${operationId}`);
  return found;
});

/** The text of the `##` or `###` section `heading`, up to the next such heading. */
const section = (heading: string): string => {
  const start = runbook.search(new RegExp(`\\n#{2,3} ${heading}\\n`, 'u'));
  if (start === -1) throw new Error(`runbook has no "${heading}" section`);
  const body = runbook.slice(start + 1);
  const next = body.slice(4).search(/\n#{2,3} /u);
  // Markdown wraps prose at any space: compare on single-spaced text.
  return (next === -1 ? body : body.slice(0, next + 4)).replace(/\s+/gu, ' ');
};

const operationsIn = (text: string): string[] =>
  [...new Set(text.match(/CMS-03B-\d{2}/gu) ?? [])].sort();

describe('[P2-S11-AC-049] the runbook qualifies the browser guards per operation class', () => {
  const mutations = policies
    .filter((row) => row.csrf === 'required')
    .map((row) => row.operationId)
    .sort();
  const reads = policies
    .filter((row) => row.csrf === 'none')
    .map((row) => row.operationId)
    .sort();

  it('derives the two classes from the policy rows (six mutations, three safe reads)', () => {
    expect(mutations).toEqual([
      'CMS-03B-05',
      'CMS-03B-06',
      'CMS-03B-07',
      'CMS-03B-08',
      'CMS-03B-09',
      'CMS-03B-18',
    ]);
    expect(reads).toEqual(['CMS-03B-15', 'CMS-03B-16', 'CMS-03B-17']);
    for (const row of policies) {
      const isMutation = mutations.includes(row.operationId);
      expect(row.idempotency === 'required', row.operationId).toBe(isMutation);
      expect(row.ifMatch === 'required', row.operationId).toBe(isMutation);
      expect(row.method === 'POST', row.operationId).toBe(isMutation);
    }
  });

  it('does not put a mutation-only guard in the envelope that every operation shares', () => {
    const shared = runbook.slice(
      runbook.indexOf('## Operations'),
      runbook.indexOf('\n### ', runbook.indexOf('## Operations')),
    );
    expect(shared).toContain('BE00 envelope');
    for (const guard of ['Idempotency-Key', 'If-Match', 'CSRF', 'strict JSON'])
      expect(shared, guard).not.toContain(guard);
  });

  it('lists exactly the six mutations under the mutation guards, with the strong If-Match operand', () => {
    const text = section('Mutation operations');
    expect(operationsIn(text)).toEqual(mutations);
    for (const guard of [
      'strict JSON',
      '`Idempotency-Key`',
      'strong `If-Match`',
      'CSRF',
    ])
      expect(text, guard).toContain(guard);
    expect(text).toContain('`400 INVALID_REQUEST`');
    const stepUp = policies
      .filter((row) => row.stepUp === 'required')
      .map((row) => row.operationId)
      .sort();
    expect(stepUp).toEqual([
      'CMS-03B-06',
      'CMS-03B-07',
      'CMS-03B-09',
      'CMS-03B-18',
    ]);
    for (const operationId of stepUp)
      expect(text, operationId).toContain(operationId);
    expect(text).toContain('401 STEP_UP_REQUIRED');
  });

  it('lists exactly the three safe reads, which accept no mutation header, CSRF token or body', () => {
    const text = section('Safe reads');
    expect(operationsIn(text)).toEqual(reads);
    expect(text).toContain('neither `Idempotency-Key` nor `If-Match`');
    expect(text).toContain('no CSRF');
    expect(text).toContain('no request body');
    expect(text).toContain('no step-up');
    expect(text).toContain('strong `ETag`');
    for (const guard of ['strict JSON'])
      expect(text, guard).not.toContain(guard);
  });

  it('documents the Retry-After and RateLimit headers of a 429 and a retryable 503', () => {
    const refusals = section('Typed refusals');
    expect(refusals).toContain('`Retry-After`');
    expect(refusals).toContain('`RateLimit-Limit`');
  });

  it('keeps the route table and every operation in it', () => {
    const table = section('Routes');
    expect(operationsIn(table)).toEqual([...SLICE_11]);
  });
});
