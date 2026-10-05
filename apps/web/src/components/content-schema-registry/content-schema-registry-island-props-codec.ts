/**
 * Bounded devalue-tuple codec for the Astro island props attribute. Only the
 * plain values actually emitted by the current JSON-shaped props are supported
 * (tuples 0 and 1); every other special value, prototype key, depth, or node
 * overflow fails closed. No eval, getters, or prototype construction.
 */

export class IslandPropsCodecError extends Error {}

const MAX_DEPTH = 12;
const MAX_NODES = 40_000;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export interface CodecBudget {
  nodes: number;
}

const decodeObject = (
  value: unknown,
  budget: CodecBudget,
  depth: number,
): unknown => {
  budget.nodes += 1;
  if (budget.nodes > MAX_NODES) throw new IslandPropsCodecError('node budget');
  if (depth > MAX_DEPTH) throw new IslandPropsCodecError('depth budget');
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return value;
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key))
      throw new IslandPropsCodecError('prototype key');
    output[key] = decodeValue(entry, budget, depth + 1);
  }
  return output;
};

export const decodeValue = (
  value: unknown,
  budget: CodecBudget,
  depth = 0,
): unknown => {
  budget.nodes += 1;
  if (budget.nodes > MAX_NODES) throw new IslandPropsCodecError('node budget');
  if (depth > MAX_DEPTH) throw new IslandPropsCodecError('depth budget');
  if (Array.isArray(value)) {
    if (value.length !== 2 || !Number.isInteger(value[0]))
      throw new IslandPropsCodecError('non-tuple array');
    const code = value[0];
    if (code === 0) return decodeObject(value[1], budget, depth);
    if (code === 1) {
      if (!Array.isArray(value[1]))
        throw new IslandPropsCodecError('array payload');
      return value[1].map((entry) => decodeValue(entry, budget, depth + 1));
    }
    throw new IslandPropsCodecError('unsupported tuple');
  }
  if (value !== null && typeof value === 'object')
    return decodeObject(value, budget, depth);
  return value;
};

/** Decode a parsed island props object; throws IslandPropsCodecError on failure. */
export const decodeIslandProps = (parsed: unknown): unknown =>
  decodeValue(parsed, { nodes: 0 });
