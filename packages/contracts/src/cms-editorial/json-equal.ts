/**
 * Zod-free structural equality of JSON-shaped values.
 *
 * The browser command table (preview binding) and the server version-set check
 * use the same comparison, so it lives outside the zod-carrying `version-set.ts`.
 */

/** Order-independent structural equality of two JSON-shaped values. */
export const cmsJsonEqual = (left: unknown, right: unknown): boolean => {
  if (left === right) return true;
  if (
    typeof left !== 'object' ||
    typeof right !== 'object' ||
    left === null ||
    right === null
  )
    return false;
  if (Array.isArray(left) || Array.isArray(right))
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => cmsJsonEqual(item, right[index]))
    );
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        cmsJsonEqual(
          (left as Record<string, unknown>)[key],
          (right as Record<string, unknown>)[key],
        ),
    )
  );
};
