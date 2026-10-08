import { expect } from 'vitest';

import { parseJsonBody } from '../../../apps/worker/src/cms-editorial/admission-body';

/**
 * Evidence lane EB (AC-038..AC-048): the shared Worker body boundary every editorial command route uses
 * (`parseJsonBody`) applied to a contract schema, and the 422 assertions built on it.
 */

export type Schema = Parameters<typeof parseJsonBody>[1];
type Violation = { path: string; code: string };

export const body = (value: unknown): Request =>
  new Request('https://api.example.test/api/v1/cms/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  });

export const refusal = async (schema: Schema, value: unknown) => {
  const result = await parseJsonBody<unknown>(body(value), schema);
  if (result.ok) return null;
  const details = result.details as { violations?: Violation[] } | undefined;
  return {
    status: result.status,
    code: result.code,
    violations: details?.violations ?? [],
  };
};

export const expect422 = async (
  schema: Schema,
  value: unknown,
  path: string,
  code?: string,
) => {
  const outcome = await refusal(schema, value);
  expect(outcome?.status).toBe(422);
  expect(outcome?.code).toBe('VALIDATION_FAILED');
  const hits = (outcome?.violations ?? []).filter(
    (violation) => violation.path === path,
  );
  expect(
    hits.length,
    `violations: ${JSON.stringify(outcome?.violations)}`,
  ).toBeGreaterThan(0);
  if (code !== undefined)
    expect(hits.map((violation) => violation.code)).toContain(code);
};

export const accepted = async (schema: Schema, value: unknown) => {
  const result = await parseJsonBody<unknown>(body(value), schema);
  expect(result.ok, JSON.stringify(result)).toBe(true);
};
