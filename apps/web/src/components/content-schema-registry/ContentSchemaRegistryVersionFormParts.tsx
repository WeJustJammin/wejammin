import * as React from 'react';

/**
 * Shared props and path fields of the FE03 CMS-04a/b/c producers on the
 * version page. The browser supplies only the contract fields plus transport
 * (CSRF, Idempotency-Key, the exact source ETag).
 */

export interface ContentSchemaRegistryVersionFormProps {
  readonly action: string;
  readonly contentTypeId: string;
  readonly versionId: string;
  readonly csrfToken: string;
  readonly idempotencyKey: string;
  readonly ifMatch: string;
  readonly expectedVersion: string;
}

export const PathFields = ({
  contentTypeId,
  versionId,
  expectedVersion,
}: Pick<
  ContentSchemaRegistryVersionFormProps,
  'contentTypeId' | 'versionId' | 'expectedVersion'
>): React.ReactElement => (
  <>
    <input type="hidden" name="contentTypeId" value={contentTypeId} />
    <input type="hidden" name="versionId" value={versionId} />
    <input type="hidden" name="expectedVersion" value={expectedVersion} />
  </>
);
