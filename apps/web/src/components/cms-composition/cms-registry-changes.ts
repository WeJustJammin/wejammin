/** A supported block selector as the designers list it: `blockKey@blockVersion`. */
export interface BlockSelector {
  readonly blockKey: string;
  readonly blockVersion: number;
}

export interface RegistryChanges {
  readonly added: readonly string[];
  readonly removed: readonly string[];
}

export const selectorLabel = (block: BlockSelector): string =>
  `${block.blockKey}@${block.blockVersion}`;

const bytewise = (left: string, right: string): number =>
  Number(left > right) - Number(left < right);

/** The selectors the registry gained and lost between two reads of the designer context, in a stable order. */
export const registryChanges = (
  before: readonly BlockSelector[],
  after: readonly BlockSelector[],
): RegistryChanges => {
  const was = new Set(before.map(selectorLabel));
  const is = new Set(after.map(selectorLabel));
  return {
    added: [...is].filter((label) => !was.has(label)).sort(bytewise),
    removed: [...was].filter((label) => !is.has(label)).sort(bytewise),
  };
};
