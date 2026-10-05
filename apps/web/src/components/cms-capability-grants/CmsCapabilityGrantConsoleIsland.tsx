import * as React from 'react';

import CmsCapabilityGrantConsole from './CmsCapabilityGrantConsole';
import type {
  CmsCapabilityGrantConsoleProps,
  CmsCapabilityGrantPage,
} from './cms-capability-grant-types';

/**
 * Serializable Astro island boundary. The server renders the exact console
 * HTML from the page projection; the browser owns list refresh and command
 * presentation. No server function, authority state or private identifier
 * (actor, party, grantor, binding) is serialized; the person IDs inside the
 * list are the owner-only projection this surface exists to manage.
 */
export default function CmsCapabilityGrantConsoleIsland(
  page: CmsCapabilityGrantPage,
): React.ReactElement {
  const props: CmsCapabilityGrantConsoleProps = {
    contractFields: page.contractFields,
    variant: page.variant,
    access: page.access,
    initialList: page.initialList,
    contextEvidence: {
      stepUpState: page.stepUpState,
      ...(page.actingContextLabel === undefined
        ? {}
        : { actingContextLabel: page.actingContextLabel }),
      ...(page.stepUpFreshUntil === undefined
        ? {}
        : { stepUpFreshUntil: page.stepUpFreshUntil }),
    },
    query: page.query,
    termWindow: page.termWindow,
    cursor: page.cursor,
    requestId: page.requestId,
    canonicalUrl: page.canonicalUrl,
    retryUrl: page.retryUrl,
    csrfToken: page.csrfToken,
  };
  return <CmsCapabilityGrantConsole {...props} />;
}
