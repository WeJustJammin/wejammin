import * as React from 'react';

import { Fact, Instant } from './ContentSchemaRegistryDetailFacts';
import type { ContentSchemaRegistryDetail } from './content-schema-registry-types';

type Artifact = ContentSchemaRegistryDetail['schemaArtifact'];
type Evidence = NonNullable<
  ContentSchemaRegistryDetail['resource']['activationEvidence']
>;

/** FE03 detail: the compiled schema artifact identity of one version. */
export function ContentSchemaRegistryDetailArtifact({
  artifact,
}: {
  readonly artifact: Artifact;
}): React.ReactElement {
  return (
    <section aria-labelledby="content-schema-registry-artifact-heading">
      <h4 id="content-schema-registry-artifact-heading">
        Compiled schema artifact
      </h4>
      <p>
        <code>{artifact.zodContractRef}</code> · compiler{' '}
        {artifact.compilerVersion}
      </p>
      <dl className="content-schema-registry-block-meta">
        <Fact term="Artifact ID">
          <code>{artifact.id}</code>
        </Fact>
        <Fact term="Artifact version">{artifact.version}</Fact>
        <Fact term="Artifact state">{artifact.state}</Fact>
        <Fact term="Artifact hash">
          <code>{artifact.artifactHash}</code>
        </Fact>
        <Fact term="Compiled">
          <Instant value={artifact.compiledAt} />
        </Fact>
        <Fact term="Artifact created">
          <Instant value={artifact.createdAt} />
        </Fact>
        <Fact term="Artifact updated">
          <Instant value={artifact.updatedAt} />
        </Fact>
      </dl>
    </section>
  );
}

/** FE03 detail: the server-frozen activation evidence, read-only. */
export function ContentSchemaRegistryDetailEvidence({
  evidence,
}: {
  readonly evidence: Evidence;
}): React.ReactElement {
  return (
    <section aria-labelledby="content-schema-registry-activation-heading">
      <h4 id="content-schema-registry-activation-heading">
        Activation evidence
      </h4>
      <p>
        Policy <code>{evidence.key}</code> · {evidence.riskClass} ·{' '}
        {evidence.requiredDecisionCount} decision(s)
      </p>
      <dl className="content-schema-registry-block-meta">
        <Fact term="Policy version">{evidence.version}</Fact>
        <Fact term="Policy hash">
          <code>{evidence.policyHash}</code>
        </Fact>
        <Fact term="Required capabilities">
          {evidence.requiredCapabilities.length === 0
            ? 'None'
            : evidence.requiredCapabilities.join(', ')}
        </Fact>
        <Fact term="Approval evidence hash">
          <code>{evidence.approvalEvidenceHash}</code>
        </Fact>
      </dl>
    </section>
  );
}
