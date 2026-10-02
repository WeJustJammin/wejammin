/** ISO/IEC 18004 mask penalty (rules N1 to N4) for a candidate symbol. */
const RUN_PENALTY = 3;
const BLOCK_PENALTY = 3;
const FINDER_PENALTY = 40;
const BALANCE_PENALTY = 10;

const FINDER_LIKE = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];

const lineBits = (line: readonly boolean[]): number[] =>
  line.map((module) => (module ? 1 : 0));

const matchesAt = (bits: readonly number[], start: number, forward: boolean): boolean =>
  FINDER_LIKE.every(
    (expected, offset) =>
      bits[start + offset] ===
      (forward ? expected : FINDER_LIKE[FINDER_LIKE.length - 1 - offset]),
  );

const linePenalty = (line: readonly boolean[]): number => {
  let penalty = 0;
  let run = 1;
  for (let i = 1; i <= line.length; i += 1) {
    if (i < line.length && line[i] === line[i - 1]) run += 1;
    else {
      if (run >= 5) penalty += RUN_PENALTY + (run - 5);
      run = 1;
    }
  }
  const bits = lineBits(line);
  for (let start = 0; start + FINDER_LIKE.length <= bits.length; start += 1) {
    if (matchesAt(bits, start, true)) penalty += FINDER_PENALTY;
    if (matchesAt(bits, start, false)) penalty += FINDER_PENALTY;
  }
  return penalty;
};

export const maskPenalty = (modules: readonly (readonly boolean[])[]): number => {
  const size = modules.length;
  let penalty = 0;
  for (let i = 0; i < size; i += 1) {
    penalty += linePenalty(modules[i] ?? []);
    penalty += linePenalty(modules.map((row) => row[i] === true));
  }
  for (let y = 0; y + 1 < size; y += 1)
    for (let x = 0; x + 1 < size; x += 1) {
      const value = modules[y]?.[x];
      if (
        value === modules[y]?.[x + 1] &&
        value === modules[y + 1]?.[x] &&
        value === modules[y + 1]?.[x + 1]
      )
        penalty += BLOCK_PENALTY;
    }
  const dark = modules.reduce(
    (count, row) => count + row.filter(Boolean).length,
    0,
  );
  const total = size * size;
  const steps = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  return penalty + Math.max(0, steps) * BALANCE_PENALTY;
};
