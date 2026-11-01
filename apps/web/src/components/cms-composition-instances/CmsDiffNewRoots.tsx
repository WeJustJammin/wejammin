import * as React from 'react';

import type { UpdateDiff } from './composition-types';

export const NEW_ROOTS_HEADING_ID = 'cms-diff-new-roots-heading';

interface Props {
  readonly roots: UpdateDiff['newRoots'];
  readonly onPlace: (rootPaths: readonly string[]) => void;
  readonly disabled: boolean;
}

/**
 * The blocks a newer version adds (DEC-193). Accepting an update never adds them: each is placed only through the
 * Place command (CMS-03C-02 `roots`).
 */
export default function CmsDiffNewRoots({
  roots,
  onPlace,
  disabled,
}: Props): React.ReactElement {
  const [chosen, setChosen] = React.useState<ReadonlySet<string>>(new Set());
  const toggle = (path: string): void =>
    setChosen((current) => {
      const next = new Set(current);
      if (!next.delete(path)) next.add(path);
      return next;
    });
  const picked = roots
    .filter((root) => chosen.has(root.rootPath))
    .map((root) => root.rootPath);
  return (
    <section aria-labelledby={NEW_ROOTS_HEADING_ID} className="cms-diff-new">
      <h4 id={NEW_ROOTS_HEADING_ID}>New in this version</h4>
      <p>Accepting the update never adds these blocks.</p>
      <p role="status" aria-live="polite">
        {roots.length} new {roots.length === 1 ? 'block' : 'blocks'}
      </p>
      <ul>
        {roots.map((root, index) => (
          <li key={root.rootPath}>
            <label>
              <input
                type="checkbox"
                id={`cms-diff-new-root-${index}`}
                checked={chosen.has(root.rootPath)}
                disabled={disabled}
                onChange={() => toggle(root.rootPath)}
              />
              <span>
                <code>{root.rootPath}</code>: {root.blockKey} version{' '}
                {root.blockVersion}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={disabled || picked.length === 0}
        onClick={() => onPlace(picked)}
      >
        Place selected blocks
      </button>
    </section>
  );
}
