import { describe, expect, it } from 'vitest';

import { canonicalHash } from '../../content-schema-registry/migration-transform-jcs';
import {
  blockNode,
  fieldNode,
  paragraph,
  richText,
  span,
} from './a11y-structural.test-support';
import { renderIdentityKey, renderIdentityOf } from './render-plan';

/**
 * The stable location identity of a render-plan node (BE05c "Document order").
 * PostgreSQL `cms_revision_render_plan` is the one derivation of the order and
 * emits exactly these identities; the Worker only names them. The two hash
 * vectors below were computed independently with `sha256sum` over the
 * hand-written RFC 8785 text, and `phase_02_slice_11_checker_render_plan.sql`
 * asserts that the database reproduces the first one for the same ids.
 */

const BODY = 'a9200000-0000-4000-8000-000000000c34';
const META = 'a9200000-0000-4000-8000-000000000c35';

/** {"nodes":[meta#note, meta#lead, body],"templateVersionId":null} */
const PLAN_HASH_NESTED_NO_TEMPLATE =
  'f3d272796d1aaf02f85371c23a5634981a561eb261768ed347270258d7728809';
/** field#lead, field, block, bound to template 1111...: the block member order is JCS order. */
const PLAN_HASH_WITH_TEMPLATE_AND_BLOCK =
  '329dde748d139003127dda91cd024e99690606b6844608280c868dfd48289614';

const planHash = (
  templateVersionId: string | null,
  nodes: Parameters<typeof renderIdentityOf>[0][],
): Promise<string> =>
  canonicalHash({ templateVersionId, nodes: nodes.map(renderIdentityOf) });

describe('renderIdentityOf', () => {
  it('names a whole rich_text value by its field id alone', () => {
    expect(renderIdentityOf(fieldNode(2, richText()))).toEqual({
      kind: 'field',
      fieldId: '00000000-0000-4000-8000-000000000002',
    });
  });

  it('names a rich_text property by its field id and property key, never by its value', () => {
    const node = fieldNode(1, richText(paragraph(span('Author text'))), 'lead');
    expect(renderIdentityOf(node)).toEqual({
      kind: 'field',
      fieldId: '00000000-0000-4000-8000-000000000001',
      propertyKey: 'lead',
    });
    expect(JSON.stringify(renderIdentityOf(node))).not.toContain('Author');
  });

  it('keeps a block pointer, key and version and drops the registry payload', () => {
    expect(
      renderIdentityOf(
        blockNode(4, { accessibleName: 'Main', nameRequired: true }),
      ),
    ).toEqual({
      kind: 'block',
      pointer: '/composition/4',
      blockKey: 'site.landmark',
      blockVersion: 1,
    });
  });
});

describe('renderIdentityKey', () => {
  it('is distinct for a field, each of its properties and a block', () => {
    const keys = [
      renderIdentityKey(renderIdentityOf(fieldNode(1, richText()))),
      renderIdentityKey(renderIdentityOf(fieldNode(1, richText(), 'lead'))),
      renderIdentityKey(renderIdentityOf(fieldNode(1, richText(), 'note'))),
      renderIdentityKey(renderIdentityOf(fieldNode(2, richText(), 'lead'))),
      renderIdentityKey(renderIdentityOf(blockNode(1))),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('is the same for the same location whatever its payload', () => {
    expect(
      renderIdentityKey(
        renderIdentityOf(fieldNode(1, richText(paragraph(span('a'))), 'lead')),
      ),
    ).toBe(renderIdentityKey(renderIdentityOf(fieldNode(1, null, 'lead'))));
  });
});

describe('render-plan hash vectors (parity with PostgreSQL)', () => {
  const nested = [
    { ...fieldNode(1, richText(), 'note'), fieldId: META },
    { ...fieldNode(1, richText(), 'lead'), fieldId: META },
    { ...fieldNode(1, richText()), fieldId: BODY },
  ];

  it('matches the vector of meta#note, meta#lead and body with no template', async () => {
    expect(await planHash(null, nested)).toBe(PLAN_HASH_NESTED_NO_TEMPLATE);
  });

  it('matches the vector with a template version and a block node', async () => {
    expect(
      await planHash('11111111-1111-4111-8111-111111111111', [
        fieldNode(1, richText(), 'lead'),
        fieldNode(2, richText()),
        blockNode(0, {
          pointer: '/composition/c1',
          blockKey: 'site.landmark',
          blockVersion: 1,
        }),
      ]),
    ).toBe(PLAN_HASH_WITH_TEMPLATE_AND_BLOCK);
  });

  it('depends on the order of the plan', async () => {
    const [note, lead, body] = nested as [
      (typeof nested)[number],
      (typeof nested)[number],
      (typeof nested)[number],
    ];
    expect(await planHash(null, [lead, note, body])).not.toBe(
      PLAN_HASH_NESTED_NO_TEMPLATE,
    );
  });

  it('depends on the property key', async () => {
    const [note, , body] = nested as [
      (typeof nested)[number],
      (typeof nested)[number],
      (typeof nested)[number],
    ];
    expect(
      await planHash(null, [
        note,
        { ...note, propertyKey: 'other' } as (typeof nested)[number],
        body,
      ]),
    ).not.toBe(PLAN_HASH_NESTED_NO_TEMPLATE);
  });
});
