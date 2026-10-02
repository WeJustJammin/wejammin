import * as React from 'react';

/** Browser-owned canonical refresh presentation shared by every workbench mode. */
export default function ContentSchemaRegistryWorkbenchBanners({
  loading,
  offline,
  message,
}: {
  readonly loading: boolean;
  readonly offline: boolean;
  readonly message: string | null;
}): React.ReactElement {
  return (
    <>
      {offline ? (
        <section
          className="content-schema-registry-offline-status"
          data-cms-offline-status="true"
          role="status"
          aria-live="polite"
        >
          <h3>Registry is offline</h3>
          <p>
            Canonical registry reads are unavailable. No registry intent was
            retained offline.
          </p>
        </section>
      ) : null}
      {loading ? (
        <div
          className="content-schema-registry-loading-skeleton"
          data-cms-loading-skeleton="true"
          aria-hidden="true"
        />
      ) : null}
      {message === null ? null : (
        <p
          className="visually-hidden"
          data-cms-canonical-status="true"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {message}
        </p>
      )}
    </>
  );
}
