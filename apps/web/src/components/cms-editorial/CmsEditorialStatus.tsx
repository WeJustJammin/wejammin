import type * as React from 'react';

export interface CmsEditorialStatusProps {
  readonly regionId: string;
  readonly message: string;
  readonly alert?: boolean;
}

/**
 * Non-intrusive status surface. Exactly one polite atomic live region is
 * rendered by the workbench (FE03:246-372); this element only fills it.
 */
const CmsEditorialStatus = ({
  regionId,
  message,
  alert = false,
}: CmsEditorialStatusProps): React.ReactElement => (
  <p
    id={regionId}
    className="cms-editorial-status"
    role={alert ? 'alert' : 'status'}
    aria-live={alert ? 'assertive' : 'polite'}
    aria-atomic="true"
    tabIndex={-1}
    data-cms-editorial-status="true"
  >
    {message}
  </p>
);

export default CmsEditorialStatus;
