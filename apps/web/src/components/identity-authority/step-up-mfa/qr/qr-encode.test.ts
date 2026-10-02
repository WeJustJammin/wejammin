import { describe, expect, it } from 'vitest';

import { encodeQr, qrSvgPath, type QrMatrix } from './qr-encode';

const OTPAUTH =
  'otpauth://totp/WeJammin:person?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=WeJammin&algorithm=SHA1&digits=6&period=30';

const finderAt = (matrix: QrMatrix, top: number, left: number): string =>
  Array.from({ length: 7 }, (_row, y) =>
    Array.from({ length: 7 }, (_col, x) =>
      matrix.modules[top + y]?.[left + x] === true ? '1' : '0',
    ).join(''),
  ).join('/');

const FINDER = '1111111/1000001/1011101/1011101/1011101/1000001/1111111';

const bits = (matrix: QrMatrix, cells: readonly [number, number][]): number =>
  cells.reduce(
    (value, [row, col]) =>
      (value << 1) | (matrix.modules[row]?.[col] === true ? 1 : 0),
    0,
  );

const VALID_FORMAT_CODES = (() => {
  const codes = new Set<number>();
  for (let data = 0; data < 32; data += 1) {
    let remainder = data;
    for (let i = 0; i < 10; i += 1)
      remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
    codes.add(((data << 10) | remainder) ^ 0x5412);
  }
  return codes;
})();

describe('QR encoder (byte mode, error correction level M)', () => {
  it.each([
    [1, 14],
    [2, 26],
    [3, 42],
    [4, 62],
    [5, 84],
    [7, 122],
    [10, 213],
    [20, 666],
    [40, 2331],
  ])('chooses version %i at its %i byte capacity and the next one above it', (version, capacity) => {
    expect(encodeQr('a'.repeat(capacity)).version).toBe(version);
    if (version < 40) expect(encodeQr('a'.repeat(capacity + 1)).version).toBe(version + 1);
  });

  it('refuses text beyond the largest symbol', () => {
    expect(() => encodeQr('a'.repeat(2332))).toThrow(RangeError);
  });

  it('counts UTF-8 bytes, not characters', () => {
    expect(encodeQr('é'.repeat(8)).version).toBe(2);
  });

  it('draws square symbols of 17 + 4 x version modules', () => {
    const matrix = encodeQr(OTPAUTH);
    expect(matrix.size).toBe(17 + 4 * matrix.version);
    expect(matrix.modules).toHaveLength(matrix.size);
    expect(matrix.modules.every((row) => row.length === matrix.size)).toBe(true);
  });

  it('places the three finder patterns, timing lines and the dark module', () => {
    const matrix = encodeQr(OTPAUTH);
    const last = matrix.size - 7;
    expect(finderAt(matrix, 0, 0)).toBe(FINDER);
    expect(finderAt(matrix, 0, last)).toBe(FINDER);
    expect(finderAt(matrix, last, 0)).toBe(FINDER);
    for (let i = 8; i < matrix.size - 8; i += 1) {
      expect(matrix.modules[6]?.[i]).toBe(i % 2 === 0);
      expect(matrix.modules[i]?.[6]).toBe(i % 2 === 0);
    }
    expect(matrix.modules[matrix.size - 8]?.[8]).toBe(true);
  });

  it('writes the same valid format word, level M, in both copies', () => {
    const matrix = encodeQr(OTPAUTH);
    const n = matrix.size;
    const first = bits(matrix, [
      [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
      [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
    ]);
    const second = bits(matrix, [
      [n - 1, 8], [n - 2, 8], [n - 3, 8], [n - 4, 8], [n - 5, 8], [n - 6, 8], [n - 7, 8],
      [8, n - 8], [8, n - 7], [8, n - 6], [8, n - 5], [8, n - 4], [8, n - 3], [8, n - 2], [8, n - 1],
    ]);
    expect(first).toBe(second);
    expect(VALID_FORMAT_CODES.has(first)).toBe(true);
    expect((first ^ 0x5412) >>> 13).toBe(0); // level M indicator 00
  });

  it('writes a version information block from version 7 upward', () => {
    const matrix = encodeQr('a'.repeat(300));
    expect(matrix.version).toBeGreaterThanOrEqual(7);
    const n = matrix.size;
    const lower: [number, number][] = [];
    const upper: [number, number][] = [];
    for (let i = 17; i >= 0; i -= 1) {
      lower.push([n - 11 + (i % 3), Math.floor(i / 3)]);
      upper.push([Math.floor(i / 3), n - 11 + (i % 3)]);
    }
    expect(bits(matrix, lower)).toBe(bits(matrix, upper));
    expect(bits(matrix, lower) >>> 12).toBe(matrix.version);
  });

  it('is deterministic', () => {
    expect(encodeQr(OTPAUTH).modules).toEqual(encodeQr(OTPAUTH).modules);
  });

  it('matches the golden matrix independently decoded with zbar', () => {
    const matrix = encodeQr(OTPAUTH);
    const flat = matrix.modules.map((row) => row.map((m) => (m ? '1' : '0')).join('')).join('');
    let hash = 5381;
    for (const character of flat) hash = ((hash * 33) ^ character.charCodeAt(0)) >>> 0;
    expect(matrix.version).toBe(7);
    expect(hash).toBe(GOLDEN_HASH);
  });
});

const GOLDEN_HASH = 2_366_809_557;

describe('QR SVG path', () => {
  it('draws only dark modules inside a four-module quiet zone', () => {
    const matrix = encodeQr('HELLO');
    const { viewBoxSize, d } = qrSvgPath(matrix);
    expect(viewBoxSize).toBe(matrix.size + 8);
    expect(d).toMatch(/^(?:M\d+ \d+h1v1h-1z)+$/u);
    const dark = matrix.modules.flat().filter(Boolean).length;
    expect(d.match(/M/gu)?.length).toBe(dark);
    expect(d.startsWith('M')).toBe(true);
  });
});
