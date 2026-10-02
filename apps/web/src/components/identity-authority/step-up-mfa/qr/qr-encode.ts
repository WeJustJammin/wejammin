import { QrGrid, type QrMatrix } from './qr-matrix';
import { maskPenalty } from './qr-penalty';
import {
  MAX_VERSION,
  MIN_VERSION,
  dataCodewords,
  eccCodewordsPerBlock,
  errorCorrectionBlocks,
  rawCodewords,
  reedSolomonRemainder,
} from './qr-tables';

export type { QrMatrix } from './qr-matrix';

const BYTE_MODE_INDICATOR = 0b0100;
const PAD_BYTES = [0xec, 0x11] as const;

const characterCountBits = (version: number): number =>
  version <= 9 ? 8 : 16;

const fitsVersion = (byteLength: number, version: number): boolean =>
  4 + characterCountBits(version) + 8 * byteLength <=
  dataCodewords(version) * 8;

const chooseVersion = (byteLength: number): number => {
  for (let version = MIN_VERSION; version <= MAX_VERSION; version += 1)
    if (fitsVersion(byteLength, version)) return version;
  throw new RangeError('qr_text_too_long');
};

const dataBits = (bytes: Uint8Array, version: number): number[] => {
  const bits: number[] = [];
  const push = (value: number, count: number): void => {
    for (let i = count - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };
  push(BYTE_MODE_INDICATOR, 4);
  push(bytes.length, characterCountBits(version));
  for (const byte of bytes) push(byte, 8);
  const capacity = dataCodewords(version) * 8;
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0; bits.length < capacity; pad += 1)
    push(PAD_BYTES[pad % 2] ?? 0xec, 8);
  return bits;
};

const toCodewords = (bits: readonly number[]): number[] =>
  Array.from({ length: bits.length / 8 }, (_unused, index) =>
    bits.slice(index * 8, index * 8 + 8).reduce((byte, bit) => (byte << 1) | bit, 0),
  );

/** Splits into blocks, appends Reed-Solomon codewords and interleaves them. */
const interleave = (data: readonly number[], version: number): number[] => {
  const blocks = errorCorrectionBlocks(version);
  const eccLength = eccCodewordsPerBlock(version);
  const raw = rawCodewords(version);
  const shortBlocks = blocks - (raw % blocks);
  const shortLength = Math.floor(raw / blocks) - eccLength;
  const split: { data: number[]; ecc: number[] }[] = [];
  for (let index = 0, offset = 0; index < blocks; index += 1) {
    const length = shortLength + (index < shortBlocks ? 0 : 1);
    const part = data.slice(offset, offset + length);
    offset += length;
    split.push({ data: part, ecc: reedSolomonRemainder(part, eccLength) });
  }
  const result: number[] = [];
  for (let i = 0; i <= shortLength; i += 1)
    split.forEach((block, index) => {
      if (i !== shortLength || index >= shortBlocks)
        result.push(block.data[i] ?? 0);
    });
  for (let i = 0; i < eccLength; i += 1)
    split.forEach((block) => result.push(block.ecc[i] ?? 0));
  return result;
};

/**
 * Encodes UTF-8 text in byte mode at error correction level M, choosing the
 * smallest version that fits and the lowest-penalty mask. Throws a RangeError
 * when the text exceeds the largest symbol.
 */
export const encodeQr = (text: string): QrMatrix => {
  const bytes = new TextEncoder().encode(text);
  const version = chooseVersion(bytes.length);
  const codewords = interleave(
    toCodewords(dataBits(bytes, version)),
    version,
  );
  const grid = new QrGrid(version);
  grid.drawCodewords(codewords);
  let best = { mask: 0, penalty: Number.POSITIVE_INFINITY };
  for (let mask = 0; mask < 8; mask += 1) {
    grid.applyMask(mask);
    grid.drawFormat(mask);
    const penalty = maskPenalty(grid.modules);
    if (penalty < best.penalty) best = { mask, penalty };
    grid.applyMask(mask);
  }
  grid.applyMask(best.mask);
  grid.drawFormat(best.mask);
  return { version, size: grid.size, modules: grid.modules };
};

const QUIET_ZONE_MODULES = 4;

/** One SVG path of unit squares for the dark modules, with a quiet zone. */
export const qrSvgPath = (
  matrix: QrMatrix,
): Readonly<{ viewBoxSize: number; d: string }> => {
  const parts: string[] = [];
  matrix.modules.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark)
        parts.push(`M${x + QUIET_ZONE_MODULES} ${y + QUIET_ZONE_MODULES}h1v1h-1z`);
    }),
  );
  return {
    viewBoxSize: matrix.size + 2 * QUIET_ZONE_MODULES,
    d: parts.join(''),
  };
};
