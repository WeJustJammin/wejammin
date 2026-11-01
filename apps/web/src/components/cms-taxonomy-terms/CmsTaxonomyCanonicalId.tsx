import * as React from 'react';

interface Props {
  readonly canonicalId: string;
}

/** The canonical record to reference instead, as copyable text (FE03 :887). */
export default function CmsTaxonomyCanonicalId({
  canonicalId,
}: Props): React.ReactElement {
  const [note, setNote] = React.useState('');
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(canonicalId);
      setNote('Copied the canonical id.');
    } catch {
      setNote('Copying is not available here. Select the id and copy it.');
    }
  };
  return (
    <p className="cms-term-canonical">
      Canonical id: <code>{canonicalId}</code>{' '}
      <button type="button" onClick={() => void copy()}>
        Copy canonical id
      </button>
      <span role="status" aria-live="polite">
        {note}
      </span>
    </p>
  );
}
