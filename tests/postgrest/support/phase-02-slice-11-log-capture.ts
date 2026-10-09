/**
 * Safe capture of `console.*` call arguments for the Slice 11 privacy controls
 * (lane S11-4R foundation corrections, finding3). `String(object)` renders
 * `[object Object]` and hides any sensitive marker nested inside an object/array
 * argument, so a real logger that keeps its safe metadata string but appends
 * `{ body: text }` would pass a naive `String` capture. This inspects every
 * argument (own enumerable keys, nested objects/arrays, cycles handled) and
 * reports only booleans and a digest -- never the raw argument, the marker or the
 * rendered log.
 */
import { createHash } from 'node:crypto';

/** Every string leaf reachable in one argument, cycles safe. */
const stringLeaves = (value: unknown, seen: WeakSet<object>): string[] => {
  if (typeof value === 'string') return [value];
  if (value === null || typeof value !== 'object') return [];
  if (seen.has(value)) return [];
  seen.add(value);
  if (Array.isArray(value)) {
    return value.flatMap((child) => stringLeaves(child, seen));
  }
  return Object.keys(value).flatMap((key) => [
    key,
    ...stringLeaves((value as Record<string, unknown>)[key], seen),
  ]);
};

export type LogCapture = Readonly<{
  /** True when any secret marker appears in any string leaf of any argument. */
  leaked: boolean;
  /** True when at least one argument was an object or array (not a bare string). */
  hasObjectArg: boolean;
  /** A digest of the full safe inspection, safe to print in a failure message. */
  digest: string;
  /** The concatenated string leaves (for the caller's own metadata assertions). */
  text: string;
}>;

/** True when a call's first argument is a string beginning with `prefix`. */
const isNamespaceCall = (call: readonly unknown[], prefix: string): boolean =>
  typeof call[0] === 'string' && call[0].startsWith(prefix);

/**
 * Capture only the console calls in one actual logger namespace (for example
 * `[s11-rpc]` or `[s11-http]`), preserving EVERY argument of each selected tuple.
 * Unrelated structured Worker telemetry shares `console.info`, so a namespace-wide
 * capture would otherwise mix foreign objects into the inspection.
 */
export const captureNamespace = (
  calls: readonly unknown[][],
  namespace: string,
): readonly unknown[][] =>
  calls.filter((call) => isNamespaceCall(call, namespace));

/**
 * Select the console calls of one logger namespace whose string form contains every
 * `includes` token and the `status` status token (` ${status} `). Every argument of
 * each matched tuple is preserved. A missing expected target yields an empty
 * selection, which the caller MUST assert is non-empty (a missing expected target
 * log must fail, never silently pass).
 */
export const selectTargetCalls = (
  calls: readonly unknown[][],
  namespace: string,
  includes: readonly string[],
  status: number,
): readonly unknown[][] =>
  captureNamespace(calls, namespace).filter((call) => {
    const text = call.map((argument) => stringForm(argument)).join(' ');
    return (
      includes.every((token) => text.includes(token)) &&
      text.includes(` ${status} `)
    );
  });

/** A cycle-safe string form of one argument (own enumerable leaves), never throwing. */
const stringForm = (value: unknown): string => {
  try {
    if (typeof value === 'string') return value;
    return JSON.stringify(value) ?? String(value);
  } catch {
    return '[unserializable]';
  }
};

/** Inspect captured `console.*` calls for sensitive markers, leaking nothing. */
export const captureLog = (
  calls: readonly unknown[][],
  secrets: readonly string[],
): LogCapture => {
  const leaves: string[] = [];
  let hasObjectArg = false;
  for (const call of calls) {
    for (const arg of call) {
      if (typeof arg === 'object' && arg !== null) hasObjectArg = true;
      leaves.push(...stringLeaves(arg, new WeakSet<object>()));
    }
  }
  const text = leaves.join('\n');
  const leaked = secrets.some((secret) => text.includes(secret));
  const digest = createHash('sha256')
    .update(`${calls.length}:${text}`)
    .digest('hex')
    .slice(0, 16);
  return { leaked, hasObjectArg, digest, text };
};
