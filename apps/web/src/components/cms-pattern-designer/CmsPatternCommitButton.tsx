import * as React from 'react';

export interface CmsPatternCommitButtonProps {
  readonly editing: boolean;
  readonly blocked: boolean;
  readonly pending: boolean;
}

/**
 * The form's one commit control (FE03 :1043, :898, :1257; DESIGN.md Buttons): it is the only
 * control disabled while a save is in flight and shows the stable pending label `Saving…`. The
 * pending label is shorter, so the width measured while idle is kept as a minimum until the answer
 * arrives and the label returns. The width is read in a layout effect, before paint, from the last
 * idle render, so the control never visibly shrinks.
 */
export default function CmsPatternCommitButton(
  props: CmsPatternCommitButtonProps,
): React.ReactElement {
  const { editing, blocked, pending } = props;
  const ref = React.useRef<HTMLButtonElement>(null);
  const idleWidth = React.useRef(0);
  React.useLayoutEffect(() => {
    const button = ref.current;
    if (button === null) return;
    if (pending) {
      if (idleWidth.current > 0)
        button.style.minInlineSize = `${idleWidth.current}px`;
      return;
    }
    button.style.minInlineSize = '';
    idleWidth.current = button.offsetWidth;
  });
  return (
    <button
      ref={ref}
      type="submit"
      disabled={blocked || pending}
      aria-busy={pending ? true : undefined}
    >
      {pending ? 'Saving…' : editing ? 'Save successor draft' : 'Create draft'}
    </button>
  );
}
