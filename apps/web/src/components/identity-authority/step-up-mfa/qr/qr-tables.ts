/**
 * Error correction level M tables for QR versions 1 to 40 (ISO/IEC 18004).
 * Index 0 is unused so a version indexes its own entry.
 */
const ECC_CODEWORDS_PER_BLOCK = [
  0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26,
  26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
  28, 28,
] as const;

const ERROR_CORRECTION_BLOCKS = [
  0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17,
  18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49,
] as const;

export const MIN_VERSION = 1;
export const MAX_VERSION = 40;

const tableValue = (table: readonly number[], version: number): number =>
  table[version] ?? 0;

export const eccCodewordsPerBlock = (version: number): number =>
  tableValue(ECC_CODEWORDS_PER_BLOCK, version);

export const errorCorrectionBlocks = (version: number): number =>
  tableValue(ERROR_CORRECTION_BLOCKS, version);

export const alignmentPatternCount = (version: number): number =>
  version === 1 ? 0 : Math.floor(version / 7) + 2;

/** Data plus error correction modules, excluding every function pattern. */
export const rawDataModules = (version: number): number => {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const count = alignmentPatternCount(version);
    result -= (25 * count - 10) * count - 55;
    if (version >= 7) result -= 36;
  }
  return result;
};

export const rawCodewords = (version: number): number =>
  Math.floor(rawDataModules(version) / 8);

export const dataCodewords = (version: number): number =>
  rawCodewords(version) -
  eccCodewordsPerBlock(version) * errorCorrectionBlocks(version);

/** Ascending row and column centres of the alignment patterns. */
export const alignmentPositions = (version: number): readonly number[] => {
  if (version === 1) return [];
  const count = alignmentPatternCount(version);
  const size = version * 4 + 17;
  const step =
    version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const positions = [6];
  for (let position = size - 7; positions.length < count; position -= step)
    positions.splice(1, 0, position);
  return positions;
};

const multiply = (x: number, y: number): number => {
  let product = 0;
  for (let bit = 7; bit >= 0; bit -= 1) {
    product = (product << 1) ^ ((product >>> 7) * 0x11d);
    product ^= ((y >>> bit) & 1) * x;
  }
  return product;
};

const generator = (degree: number): readonly number[] => {
  const coefficients = new Array<number>(degree).fill(0);
  coefficients[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      coefficients[j] = multiply(coefficients[j] ?? 0, root);
      if (j + 1 < degree)
        coefficients[j] = (coefficients[j] ?? 0) ^ (coefficients[j + 1] ?? 0);
    }
    root = multiply(root, 0x02);
  }
  return coefficients;
};

/** Reed-Solomon remainder of `data` over GF(256) with the QR polynomial. */
export const reedSolomonRemainder = (
  data: readonly number[],
  degree: number,
): number[] => {
  const divisor = generator(degree);
  const result = new Array<number>(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ (result.shift() ?? 0);
    result.push(0);
    divisor.forEach((coefficient, index) => {
      result[index] = (result[index] ?? 0) ^ multiply(coefficient, factor);
    });
  }
  return result;
};
