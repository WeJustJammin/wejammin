import * as React from 'react';

export interface ContentSchemaRegistryDiagnosticReferenceProps {
  /** The BE00 `ApiError.requestId` of the failed read, when the state has one. */
  readonly requestId?: string | undefined;
  /** Page-level reference shown only when the failure carries no request ID. */
  readonly supportReference: string;
}

/**
 * FE03 error and degraded states show the typed ApiError's request ID so the
 * user can quote it to support. A failure without one (a local boundary)
 * falls back to the page's support reference.
 */
export default function ContentSchemaRegistryDiagnosticReference({
  requestId,
  supportReference,
}: ContentSchemaRegistryDiagnosticReferenceProps): React.ReactElement {
  return requestId === undefined ? (
    <p>
      Support reference: <code>{supportReference}</code>
    </p>
  ) : (
    <p>
      Request ID: <code>{requestId}</code>
    </p>
  );
}
