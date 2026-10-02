import { alignmentPositions } from './qr-tables';

export type QrMatrix = Readonly<{
  version: number;
  size: number;
  modules: readonly (readonly boolean[])[];
}>;

const bitOf = (value: number, index: number): boolean =>
  ((value >>> index) & 1) !== 0;

const maskApplies = (mask: number, x: number, y: number): boolean => {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
};

/** A mutable symbol grid; only {@link buildQrMatrix} exposes the result. */
export class QrGrid {
  readonly size: number;
  readonly modules: boolean[][];
  private readonly reserved: boolean[][];

  constructor(readonly version: number) {
    this.size = version * 4 + 17;
    const blank = (): boolean[][] =>
      Array.from({ length: this.size }, () =>
        new Array<boolean>(this.size).fill(false),
      );
    this.modules = blank();
    this.reserved = blank();
    this.drawFunctionPatterns();
  }

  private setFunction(x: number, y: number, dark: boolean): void {
    const row = this.modules[y];
    const lock = this.reserved[y];
    if (row === undefined || lock === undefined) return;
    row[x] = dark;
    lock[x] = true;
  }

  private drawFinder(centerX: number, centerY: number): void {
    for (let dy = -4; dy <= 4; dy += 1)
      for (let dx = -4; dx <= 4; dx += 1) {
        const x = centerX + dx;
        const y = centerY + dy;
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < this.size && y >= 0 && y < this.size)
          this.setFunction(x, y, distance !== 2 && distance !== 4);
      }
  }

  private drawAlignment(centerX: number, centerY: number): void {
    for (let dy = -2; dy <= 2; dy += 1)
      for (let dx = -2; dx <= 2; dx += 1)
        this.setFunction(
          centerX + dx,
          centerY + dy,
          Math.max(Math.abs(dx), Math.abs(dy)) !== 1,
        );
  }

  private drawFunctionPatterns(): void {
    for (let i = 0; i < this.size; i += 1) {
      this.setFunction(6, i, i % 2 === 0);
      this.setFunction(i, 6, i % 2 === 0);
    }
    this.drawFinder(3, 3);
    this.drawFinder(this.size - 4, 3);
    this.drawFinder(3, this.size - 4);
    const positions = alignmentPositions(this.version);
    const last = positions.length - 1;
    positions.forEach((row, i) =>
      positions.forEach((column, j) => {
        const corner =
          (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0);
        if (!corner) this.drawAlignment(column, row);
      }),
    );
    this.drawFormat(0);
    this.drawVersion();
  }

  /** Level M has indicator bits 00; the format word carries the mask. */
  drawFormat(mask: number): void {
    let remainder = mask;
    for (let i = 0; i < 10; i += 1)
      remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
    const bits = ((mask << 10) | remainder) ^ 0x5412;
    for (let i = 0; i <= 5; i += 1) this.setFunction(8, i, bitOf(bits, i));
    this.setFunction(8, 7, bitOf(bits, 6));
    this.setFunction(8, 8, bitOf(bits, 7));
    this.setFunction(7, 8, bitOf(bits, 8));
    for (let i = 9; i < 15; i += 1) this.setFunction(14 - i, 8, bitOf(bits, i));
    for (let i = 0; i < 8; i += 1)
      this.setFunction(this.size - 1 - i, 8, bitOf(bits, i));
    for (let i = 8; i < 15; i += 1)
      this.setFunction(8, this.size - 15 + i, bitOf(bits, i));
    this.setFunction(8, this.size - 8, true);
  }

  private drawVersion(): void {
    if (this.version < 7) return;
    let remainder = this.version;
    for (let i = 0; i < 12; i += 1)
      remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
    const bits = (this.version << 12) | remainder;
    for (let i = 0; i < 18; i += 1) {
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.setFunction(a, b, bitOf(bits, i));
      this.setFunction(b, a, bitOf(bits, i));
    }
  }

  /** Places codeword bits in the standard two-column zigzag. */
  drawCodewords(data: readonly number[]): void {
    let index = 0;
    let right = this.size - 1;
    while (right >= 1) {
      if (right === 6) right = 5;
      const upward = ((right + 1) & 2) === 0;
      for (let vertical = 0; vertical < this.size; vertical += 1)
        for (let j = 0; j < 2; j += 1) {
          const x = right - j;
          const y = upward ? this.size - 1 - vertical : vertical;
          if (this.reserved[y]?.[x] !== true && index < data.length * 8) {
            const row = this.modules[y];
            if (row !== undefined)
              row[x] = bitOf(data[index >>> 3] ?? 0, 7 - (index & 7));
            index += 1;
          }
        }
      right -= 2;
    }
    if (index !== data.length * 8)
      throw new RangeError('qr_codeword_placement_mismatch');
  }

  /** XOR is its own inverse, so applying a mask twice restores the grid. */
  applyMask(mask: number): void {
    for (let y = 0; y < this.size; y += 1)
      for (let x = 0; x < this.size; x += 1)
        if (this.reserved[y]?.[x] !== true && maskApplies(mask, x, y)) {
          const row = this.modules[y];
          if (row !== undefined) row[x] = row[x] !== true;
        }
  }
}
