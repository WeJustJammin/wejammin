/**
 * Deterministic 64-hex digest stand-in for the stateful browser lane. It is a
 * 256-bit FNV-style mix, not SHA-256: the lane only needs stable, distinct,
 * correctly shaped hashes that the page and the Worker API both report.
 */
export const fixtureHash = (text: string): string => {
  const lanes = [
    0x811c9dc5, 0x01000193, 0xc2b2ae35, 0x27d4eb2f, 0x165667b1, 0x9e3779b1,
    0x85ebca6b, 0xcc9e2d51,
  ];
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    for (let lane = 0; lane < lanes.length; lane += 1) {
      const previous = lanes[(lane + 7) % lanes.length] as number;
      lanes[lane] =
        Math.imul(
          (lanes[lane] as number) ^ code ^ previous,
          0x01000193 + lane * 2,
        ) >>> 0;
    }
  }
  return lanes.map((value) => value.toString(16).padStart(8, '0')).join('');
};
