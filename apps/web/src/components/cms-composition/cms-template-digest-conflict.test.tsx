import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as validators from '@wejammin/contracts/cms-editorial/validators';
import { describe, expect, it, vi } from 'vitest';

import { PATTERN_REFUSAL_COPY } from '../cms-pattern-designer/pattern-designer-reasons';
import CmsTemplateStatus from './CmsTemplateStatus';
import {
  submitCmsTemplateDraft,
  submitCmsTemplateSuccessorDraft,
  type CmsTemplateSubmitResult,
} from './cms-template-designer-submit';

/**
 * CMS-03C-01 `block_registry_digest_mismatch` in the template designer (BE03c 323-327, 1273; DEC-186 item 2). FE03 names
 * no template-designer copy for the token, so the fixed copy is the pattern designer's for the same token
 * (`PATTERN_REFUSAL_COPY.block_registry_digest_mismatch`, FE03 line 883 names the token on its sibling CMS-03C-12 row).
 * The designer still treats the 409 as a definite conflict (same state machine, same reconcile path); only the copy changes,
 * and only for the exact closed token on a 409.
 */
const TOKEN = 'block_registry_digest_mismatch';
const TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const body = {
  templateKey: 'release-note',
  compatibleTypeIds: [TYPE_ID],
  slots: [],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  bindings: {},
  locale: 'en-US',
  audience: 'public',
  expectedVersion: null,
};
const conflict = (details: Record<string, unknown>) =>
  Response.json(
    {
      code: 'TEMPLATE_VERSION_CONFLICT',
      message: 'Private provider detail must not reach the form.',
      requestId: '50000000-0000-4000-8000-000000000005',
      details,
    },
    { status: 409 },
  );
const submit = (response: Response) =>
  submitCmsTemplateDraft(
    validators,
    body,
    'csrf-token',
    'draft-attempt-001',
    vi.fn<typeof fetch>().mockResolvedValue(response),
  );

describe('template designer submit, digest mismatch', () => {
  it('names the closed token on a 409 and nothing else it sent', async () => {
    expect(
      await submit(
        conflict({ reasonCode: TOKEN, violations: [], secret: 'x' }),
      ),
    ).toEqual({ kind: 'conflict', status: 409, reasonCode: TOKEN });
  });

  it('names it for a successor as well', async () => {
    expect(
      await submitCmsTemplateSuccessorDraft(
        validators,
        { ...body, expectedVersion: '1' },
        'csrf-token',
        'draft-attempt-002',
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(conflict({ reasonCode: TOKEN })),
      ),
    ).toEqual({ kind: 'conflict', status: 409, reasonCode: TOKEN });
  });

  it.each([
    ['a plain conflict', {}],
    ['another operation token', { reasonCode: 'pattern_cycle' }],
    ['an unknown token', { reasonCode: 'totally_unknown' }],
    ['the upper-case spelling', { reasonCode: TOKEN.toUpperCase() }],
    ['a non-string', { reasonCode: 5 }],
  ])('keeps %s a plain conflict', async (_label, details) => {
    expect(await submit(conflict(details))).toEqual({
      kind: 'conflict',
      status: 409,
    });
  });
});

describe('template designer status copy, digest mismatch', () => {
  const render = (
    result: Exclude<CmsTemplateSubmitResult, { kind: 'created' }>,
    mode: 'create' | 'successor',
  ) =>
    renderToStaticMarkup(
      <CmsTemplateStatus
        status={{ kind: 'result', result }}
        summaryRef={null}
        mode={mode}
      />,
    );

  it.each(['create', 'successor'] as const)(
    'shows the fixed registry-changed copy in %s mode',
    (mode) => {
      const html = render(
        { kind: 'conflict', status: 409, reasonCode: TOKEN },
        mode,
      );
      expect(html).toContain(
        PATTERN_REFUSAL_COPY.block_registry_digest_mismatch.replace(
          /'/gu,
          '&#x27;',
        ),
      );
      expect(html).not.toContain('The server reported a conflict');
      expect(html).not.toContain(TOKEN);
    },
  );

  it.each(['create', 'successor'] as const)(
    'keeps the version-conflict copy for a plain conflict in %s mode',
    (mode) => {
      const html = render({ kind: 'conflict', status: 409 }, mode);
      expect(html).toContain('The server reported a conflict');
      expect(html).not.toContain('block registry');
    },
  );
});
