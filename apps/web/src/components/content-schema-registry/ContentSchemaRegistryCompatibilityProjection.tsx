import * as React from 'react';

import type { SchemaActivationPreparation } from './content-schema-registry-types';

/** Template compatibility projection of the activation preparation. */
export default function ContentSchemaRegistryCompatibilityProjection({
  projection,
}: {
  readonly projection: NonNullable<
    SchemaActivationPreparation['templateCompatibility']
  >;
}): React.ReactElement {
  return (
    <section aria-labelledby="content-schema-registry-compatibility-heading">
      <h4 id="content-schema-registry-compatibility-heading">
        Template compatibility
      </h4>
      <dl>
        <dt>Template</dt>
        <dd>
          <code>{projection.templateKey}</code> version{' '}
          {projection.templateVersionNo} ({projection.state})
        </dd>
        <dt>Compatible with this version</dt>
        <dd>{projection.compatible ? 'yes' : 'no'}</dd>
        <dt>Template digest</dt>
        <dd>
          <code>{projection.templateDigest}</code>
        </dd>
        <dt>Template version ID</dt>
        <dd>
          <code>{projection.templateVersionId}</code>
        </dd>
        <dt>Checked against content type</dt>
        <dd>
          <code>{projection.contentTypeId}</code>
        </dd>
        <dt>Checked against content type version</dt>
        <dd>
          <code>{projection.contentTypeVersionId}</code>
        </dd>
      </dl>
    </section>
  );
}
