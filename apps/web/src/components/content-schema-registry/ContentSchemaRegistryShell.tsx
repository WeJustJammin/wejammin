import * as React from 'react';

import ContentSchemaRegistrySidebar from './ContentSchemaRegistrySidebar';
import type { ContentSchemaRegistryDetailState } from './content-schema-registry-types';

export interface ContentSchemaRegistryShellProps {
  readonly listUrl: string;
  readonly reviewMode: boolean;
  readonly reviewOnly: boolean;
  readonly detail: ContentSchemaRegistryDetailState | null;
  readonly actingContextLabel?: string | undefined;
  readonly children: React.ReactNode;
}

/**
 * Sidebar plus main column. The sidebar sits beside the grid from 769 px and
 * is hidden on mobile, where the route's compact navigation serves instead.
 */
export default function ContentSchemaRegistryShell({
  listUrl,
  reviewMode,
  reviewOnly,
  detail,
  actingContextLabel,
  children,
}: ContentSchemaRegistryShellProps): React.ReactElement {
  const resource = detail?.status === 'success' ? detail.data.resource : null;
  return (
    <div className="content-schema-registry-shell">
      <ContentSchemaRegistrySidebar
        listUrl={listUrl}
        reviewMode={reviewMode}
        reviewOnly={reviewOnly}
        actingContextLabel={actingContextLabel}
        version={
          resource === null
            ? null
            : {
                label: resource.label,
                href: `/app/cms-content-modeling/${encodeURIComponent(resource.contentTypeId)}/versions/${encodeURIComponent(resource.id)}`,
              }
        }
      />
      <div className="content-schema-registry-shell-main">{children}</div>
    </div>
  );
}
