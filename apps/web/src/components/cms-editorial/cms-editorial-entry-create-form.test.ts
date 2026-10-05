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
  it('[P2-S10-AC-2233] validates the create form request with frozen members', async () => {
    const mod = await formModule();
    expect(mod).not.toBeNull();
    const request = {
      contentTypeId: 'ct-1',
      contentTypeVersionId: 'ctv-1',
      locale: 'en-US',
      values: {},
      changedPaths: [],
      schemaArtifact: { artifactHash: 'a'.repeat(64) },
      validatorRefs: [],
      workflowPolicy: { key: 'editorial.standard', version: '1' },
      activationEvidence: { present: true },
    };
    expect(
      mod!.CmsEditorialEntryCreateFormRequestSchema.safeParse(request).success,
    ).toBe(true);
  });
});
