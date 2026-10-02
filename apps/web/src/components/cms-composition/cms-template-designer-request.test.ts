import { describe, expect, it } from 'vitest';
import type { TemplateVersionDetail } from '@wejammin/contracts';

import {
  buildCmsTemplateDraftRequest,
  buildCmsTemplateSuccessorRequest,
  templateDetailToDraftFields,
  type CmsTemplateDraftFields,
} from './cms-template-designer-request';

const TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
const OTHER_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const context = {
  contentTypes: [
    {
      id: TYPE_ID,
      typeKey: 'release_note',
      activeVersionId: VERSION_ID,
      activeVersion: 2,
      sourceLocale: 'en-US',
    },
  ],
  registeredBlocks: [{ blockKey: 'hero.banner', blockVersion: 2 }],
};
const fields: CmsTemplateDraftFields = {
  templateKey: 'release-note',
  compatibleTypeIds: [TYPE_ID],
  locale: 'en-US',
  audience: 'public',
  extraRegions: 'sidebar',
  slots: [
    {
      key: 'lead',
      required: true,
      maxCount: '1',
      allowedBlockRefs: ['hero.banner@2'],
    },
  ],
  bindings: [{ key: 'lead', projection: 'title', required: true }],
};
const detail: TemplateVersionDetail = {
  id: OTHER_ID,
  version: '2',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-09-27T12:00:00.000Z',
  updatedAt: '2026-09-27T13:00:00.000Z',
  state: 'draft',
  templateKey: 'release-note',
  templateVersion: 2,
  compatibleTypeIds: [TYPE_ID],
  reservedRegions: [
    'header',
    'now',
    'record',
    'detail',
    'provenance',
    'sidebar',
  ],
  blockRegistryDigest: 'a'.repeat(64),
  slots: [
    {
      key: 'lead',
      required: true,
      maxCount: 1,
      allowedBlocks: [{ blockKey: 'hero.banner', blockVersion: 2 }],
    },
  ],
  bindings: { lead: { projection: 'title', required: true } },
  locale: 'en-US',
  audience: 'public',
};

describe('CMS-11 template draft request', () => {
  it('builds a complete schema-validated create body with the protected spine', () => {
    const result = buildCmsTemplateDraftRequest(fields, context);
    expect(result).toEqual({
      ok: true,
      value: {
        templateKey: 'release-note',
        compatibleTypeIds: [TYPE_ID],
        slots: [
          {
            key: 'lead',
            required: true,
            maxCount: 1,
            allowedBlocks: [{ blockKey: 'hero.banner', blockVersion: 2 }],
          },
        ],
        reservedRegions: [
          'header',
          'now',
          'record',
          'detail',
          'provenance',
          'sidebar',
        ],
        bindings: { lead: { projection: 'title', required: true } },
        locale: 'en-US',
        audience: 'public',
        expectedVersion: null,
      },
    });
  });

  it('refuses a content type or block absent from the protected projection', () => {
    expect(
      buildCmsTemplateDraftRequest(
        { ...fields, compatibleTypeIds: [OTHER_ID] },
        context,
      ),
    ).toMatchObject({ ok: false });
    expect(
      buildCmsTemplateDraftRequest(
        {
          ...fields,
          slots: [{ ...fields.slots[0]!, allowedBlockRefs: ['other@1'] }],
        },
        context,
      ),
    ).toMatchObject({ ok: false });
  });

  it('rejects duplicate binding names and invalid slot values before POST', () => {
    expect(
      buildCmsTemplateDraftRequest(
        {
          ...fields,
          bindings: [fields.bindings[0]!, fields.bindings[0]!],
        },
        context,
      ),
    ).toMatchObject({ ok: false });
    expect(
      buildCmsTemplateDraftRequest(
        { ...fields, slots: [{ ...fields.slots[0]!, maxCount: '0' }] },
        context,
      ),
    ).toMatchObject({ ok: false });
  });

  it('loads every editable field from canonical detail and builds a version-checked successor', () => {
    expect(templateDetailToDraftFields(detail)).toEqual(fields);
    const created = buildCmsTemplateDraftRequest(fields, context);
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('test draft should be valid');
    expect(buildCmsTemplateSuccessorRequest(fields, context, detail)).toEqual({
      ok: true,
      value: {
        ...created.value,
        expectedVersion: '2',
      },
    });
  });

  it('refuses an immutable-key mismatch or stale protected picker choice before successor POST', () => {
    expect(
      buildCmsTemplateSuccessorRequest(
        { ...fields, templateKey: 'different-key' },
        context,
        detail,
      ),
    ).toMatchObject({ ok: false });
    expect(
      buildCmsTemplateSuccessorRequest(
        fields,
        { ...context, registeredBlocks: [] },
        detail,
      ),
    ).toMatchObject({ ok: false });
  });
});
