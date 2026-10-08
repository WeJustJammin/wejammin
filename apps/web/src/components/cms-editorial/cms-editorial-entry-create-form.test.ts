import { describe, expect, it } from 'vitest';

// Runtime-computed specifier: the planned module is authored by the next slice.
const CREATE_FORM = String('./cms-editorial-entry-create-form');
type CreateFormModule = {
  CmsEditorialEntryCreateFormRequestSchema: {
    safeParse(value: unknown): { success: boolean };
  };
};
const formModule = async (): Promise<CreateFormModule | null> => {
  try {
    return (await import(CREATE_FORM)) as CreateFormModule;
  } catch {
    return null;
  }
};

describe('[P2-S10] CMS-03B-10 create form projection', () => {
  it('[P2-S10-AC-074][P2-S10-AC-105] validates the create form request with frozen members', async () => {
    const mod = await formModule();
    expect(mod).not.toBeNull();
    const request = {
      contentTypeId: '018f0c45-73fe-7dc2-9c09-68f7ecf132da',
      contentTypeVersionId: '018f0c45-73fe-7dc2-9c09-68f7ecf132db',
      locale: 'en-US',
      values: { '018f0c45-73fe-7dc2-9c09-68f7ecf132db': 'Hello' },
      changedPaths: ['/fields/018f0c45-73fe-7dc2-9c09-68f7ecf132db'],
      schemaArtifact: {
        id: '018f0c45-73fe-7dc2-9c09-68f7ecf132da',
        contentTypeVersionId: '018f0c45-73fe-7dc2-9c09-68f7ecf132db',
        artifactHash: 'a'.repeat(64),
        compilerVersion: '1.0.0',
        zodContractRef: '03a.content-type-version.v1',
      },
      validatorRefs: [{ key: 'sanitize.rich_text', version: '1' }],
      workflowPolicy: {
        key: 'editorial.standard',
        version: '1',
        policyHash: 'a'.repeat(64),
        riskClass: 'ordinary',
        requiredDecisionCount: 1,
        requiredCapabilities: [],
        approvalEvidenceHash: 'a'.repeat(64),
      },
      activationEvidence: {
        key: 'editorial.standard',
        version: '1',
        policyHash: 'a'.repeat(64),
        riskClass: 'ordinary',
        requiredDecisionCount: 1,
        requiredCapabilities: [],
        approvalEvidenceHash: 'a'.repeat(64),
      },
    };
    expect(
      mod!.CmsEditorialEntryCreateFormRequestSchema.safeParse(request).success,
    ).toBe(true);
    // The former /values/<id> pointer is not a valid changed path: SQL accepts
    // only /fields/{stableFieldId}, so the browser projection refuses it too.
    expect(
      mod!.CmsEditorialEntryCreateFormRequestSchema.safeParse({
        ...request,
        changedPaths: ['/values/018f0c45-73fe-7dc2-9c09-68f7ecf132db'],
      }).success,
    ).toBe(false);
  });
});
