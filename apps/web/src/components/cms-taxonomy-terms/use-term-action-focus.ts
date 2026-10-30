import * as React from 'react';

/**
 * Focus of the on-demand term action form. The form loads as a chunk of its own, so the hook's focus effect ran
 * before the heading existed: the form takes focus itself when it mounts, and says that it is ready instead when
 * the person has moved elsewhere (it never takes their place).
 */
export const useTermActionFocus = (
  shouldTakeFocus: (() => boolean) | undefined,
) => {
  const heading = React.useRef<HTMLHeadingElement>(null);
  const takeFocus = React.useRef(shouldTakeFocus);
  const [arrivedElsewhere, setArrivedElsewhere] = React.useState(false);
  React.useEffect(() => {
    // On mount only: the arrival of the chunk, not a later render.
    if (takeFocus.current === undefined || takeFocus.current())
      heading.current?.focus();
    else setArrivedElsewhere(true);
  }, []);
  return { heading, arrivedElsewhere };
};
