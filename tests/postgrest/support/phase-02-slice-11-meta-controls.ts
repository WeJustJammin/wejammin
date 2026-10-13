/**
 * Safe meta-controls for the Slice 11 foundation controls (lane S11-4R same-wave
 * corrective scope, quarantine finding 3). A control that feeds a caught message
 * into `not.toContain(marker)` can itself leak the marker on failure, and only
 * `Error.message` misses the assertion `actual`/`expected` fields Vitest also
 * prints. This helper runs the control, inspects EVERY relevant failure surface
 * (message, stack, own string leaves, stringified assertion actual/expected),
 * and reports only booleans and a fixed digest -- never the marker or the raw
 * surface. A separate toy logger/hasher is not proof; the surfaces here are the
 * real ones a Vitest failure would print.
 */
import { createHash } from 'node:crypto';

import { expect } from 'vitest';

export type MetaControl = Readonly<{
  /** The run threw (the helper/decoder actually refused the input). */
  caught: boolean;
  /** True when any secret marker appears in any inspected failure surface. */
  leaked: boolean;
  /** A digest of the safe serialization of the surfaces, safe to print. */
  digest: string;
}>;

/**
 * Every string leaf reachable in a value, cycle-safe. Object keys AND own
 * NON-ENUMERABLE data properties are visited (Vitest attaches `actual`/`expected`
 * non-enumerably), read via their descriptors so a getter is never invoked and a
 * thrown value is never printed.
 */
const stringLeaves = (value: unknown, seen: WeakSet<object>): string[] => {
  if (typeof value === 'string') return [value];
  if (value === null || typeof value !== 'object') return [];
  if (seen.has(value)) return [];
  seen.add(value);
  const out: string[] = [];
  for (const key of Object.getOwnPropertyNames(value)) {
    out.push(key);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && 'value' in descriptor) {
      out.push(...stringLeaves(descriptor.value, seen));
    }
  }
  return out;
};

/**
 * Run `control`, capture the failure it throws, and inspect EVERY relevant
 * surface for any of `secrets`: the thrown value itself (own enumerable AND
 * non-enumerable data properties, including `message`, `stack`, `cause`,
 * `actual` and `expected`), its stringified `actual`/`expected`, and the thrown
 * value stringified. Returns only safe metadata. `caught` is false when the
 * control did not throw at all (a non-vacuous caught-failure proof).
 */
export const runMetaControl = (
  control: () => void,
  secrets: readonly string[],
): MetaControl => {
  let caught = false;
  const surfaces: unknown[] = [];
  try {
    control();
  } catch (error) {
    caught = true;
    surfaces.push(error);
    if (error instanceof Error) {
      surfaces.push(error.message, error.stack ?? '');
      // Vitest attaches the diff operands to the thrown assertion error.
      const withOperands = error as unknown as Record<string, unknown>;
      surfaces.push(
        stringify(withOperands.actual),
        stringify(withOperands.expected),
      );
    } else {
      surfaces.push(stringify(error));
    }
  }
  const leaves: string[] = [];
  for (const surface of surfaces) {
    leaves.push(...stringLeaves(surface, new WeakSet<object>()));
  }
  const text = leaves.join('\u0000');
  const leaked = secrets.some((secret) => text.includes(secret));
  const digest = createHash('sha256')
    .update(`${caught ? 1 : 0}:${text}`)
    .digest('hex')
    .slice(0, 16);
  return { caught, leaked, digest };
};

/** A total, cycle-safe stringification that never throws. */
const stringify = (value: unknown): string => {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return '[unserializable]';
  }
};

/**
 * Assert a meta-control actually caught a failure and leaked no secret, with a
 * boolean-only message (never the marker or a raw surface).
 */
export const expectSafeControl = (
  control: MetaControl,
  label: string,
): void => {
  expect(control.caught, `${label} (caught=${control.caught})`).toBe(true);
  expect(
    control.leaked,
    `${label} (leaked=${control.leaked} digest=${control.digest})`,
  ).toBe(false);
};

/** The safe-metadata token checks a captured logger call must satisfy. */
export type MetadataExpectation = Readonly<{
  /** True when at least one target call was selected (missing target fails). */
  matched: boolean;
  /** True when no secret marker appears in any argument of the selected calls. */
  leaked: boolean;
  /** Every required safe-metadata token is present (booleans only). */
  metadataPresent: boolean;
  /** A digest of the safe serialization of the selected calls. */
  digest: string;
}>;

/** The full string form of the selected calls' arguments, cycle-safe. */
const callsText = (calls: readonly unknown[][]): string => {
  const leaves: string[] = [];
  for (const call of calls) {
    for (const argument of call) {
      leaves.push(...stringLeaves(argument, new WeakSet<object>()));
    }
  }
  return leaves.join('\u0000');
};

/**
 * Inspect the SELECTED target calls of one logger namespace: prove the target was
 * logged (`matched`), no secret marker appears anywhere in ANY argument
 * (`leaked`), and every required safe-metadata token is present
 * (`metadataPresent`). Only booleans and a digest are returned, so no raw log line
 * is ever printed.
 */
export const inspectTargetCalls = (
  calls: readonly unknown[][],
  secrets: readonly string[],
  metadataTokens: readonly RegExp[],
): MetadataExpectation => {
  const text = callsText(calls);
  const leaked = secrets.some((secret) => text.includes(secret));
  const metadataPresent = metadataTokens.every((token) => token.test(text));
  const digest = createHash('sha256')
    .update(`${calls.length}:${text}`)
    .digest('hex')
    .slice(0, 16);
  return { matched: calls.length > 0, leaked, metadataPresent, digest };
};

/** Assert one metadata expectation with boolean-only messages. */
export const expectMetadata = (
  expectation: MetadataExpectation,
  label: string,
): void => {
  expect(expectation.matched, `${label} (matched=${expectation.matched})`).toBe(
    true,
  );
  expect(
    expectation.leaked,
    `${label} (leaked=${expectation.leaked} digest=${expectation.digest})`,
  ).toBe(false);
  expect(
    expectation.metadataPresent,
    `${label} (metadataPresent=${expectation.metadataPresent} digest=${expectation.digest})`,
  ).toBe(true);
};
