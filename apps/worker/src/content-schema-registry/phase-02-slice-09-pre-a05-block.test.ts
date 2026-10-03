import { beforeAll, describe, expect, it } from 'vitest';

import { canonicalJson, sha256Hex } from './migration-transform-jcs';
import {
  KEY_ID,
  makeSignedHarness,
  makeSigning,
  type SignedHarness,
  type Signing,
} from './phase-02-slice-09-pre-release-support';
import { digestHex } from './release-crypto';
import {
  HASH,
  SIGNATURE,
  block,
  ok,
  validBlock,
} from './phase-02-slice-09-test-values';

const A05 = 'CMS-03A-05' as const;
let signing: Signing;
beforeAll(async () => {
  signing = await makeSigning();
});

const blk = (patch: Record<string, unknown>) => ({ ...validBlock, ...patch });
const harnessFor = (): Promise<SignedHarness> => makeSignedHarness({ signing });

type Violation = { path?: string };
const refuse = async (body: unknown, pathPrefix?: string): Promise<void> => {
  const harness = await harnessFor();
  const response = await harness.send(A05, body);
  expect(response.status).toBe(422);
  const parsed = (await response.json()) as {
    code: string;
    details: { violations?: Violation[] };
  };
  expect(parsed.code).toBe('VALIDATION_FAILED');
  const paths = (parsed.details.violations ?? []).map((v) => v.path ?? '');
  expect(paths.length).toBeGreaterThan(0);
  if (pathPrefix !== undefined)
    expect(
      paths.some((p) => p === pathPrefix || p.startsWith(`${pathPrefix}/`)),
      paths.join(),
    ).toBe(true);
  expect(harness.registerBlock).not.toHaveBeenCalled();
};
const accept = async (body: unknown): Promise<Record<string, unknown>> => {
  const harness = await harnessFor();
  const response = await harness.send(A05, body);
  expect(response.status).toBe(201);
  expect(harness.registerBlock).toHaveBeenCalledTimes(1);
  return (
    harness.registerBlock.mock.calls[0]?.[0] as {
      body: Record<string, unknown>;
    }
  ).body;
};
const without = (member: string): Record<string, unknown> => {
  const rest: Record<string, unknown> = { ...validBlock };
  delete rest[member];
  return rest;
};
const field = { name: 'headline', kind: 'short_text', required: true };
const snapshotWith = (fields: unknown[]) => ({
  schemaVersion: '1',
  fields,
  additionalProperties: false,
});

describe('CMS-03A-05 block registration request through the real signed route', () => {
  it('[P2-S09-AC-103] is a strict object of exactly the fifteen registration members', async () => {
    const body = await accept(validBlock);
    expect(Object.keys(body).sort()).toEqual([
      'accessibility',
      'allowedChildren',
      'blockKey',
      'blockVersion',
      'compatibility',
      'dataSourcePermissions',
      'lifecycle',
      'propsSchemaHash',
      'propsSchemaRef',
      'propsSchemaSnapshot',
      'propsSnapshotAttestation',
      'propsSnapshotHash',
      'releaseDigest',
      'rendererRef',
      'slotRules',
    ]);
    for (const member of Object.keys(validBlock))
      await refuse(without(member), `/${member}`);
    await refuse(blk({ ownerId: HASH }), '/ownerId');
    await refuse(blk({ releaseKeyId: KEY_ID }), '/releaseKeyId');
  });

  it('[P2-S09-AC-104] matches the block key grammar, requires a positive safe-integer version and relays a reused pair as a conflict', async () => {
    for (const blockKey of ['a', 'hero.banner-2_x', `a${'b'.repeat(95)}`])
      await accept(blk({ blockKey }));
    for (const blockKey of [
      '',
      'Hero',
      '1hero',
      '_hero',
      'hero banner',
      'hero/banner',
      `a${'b'.repeat(96)}`,
      7,
    ])
      await refuse(blk({ blockKey }), '/blockKey');
    for (const blockVersion of [1, 2, 2_147_483_647])
      await accept(blk({ blockVersion }));
    for (const blockVersion of [
      0,
      -1,
      1.5,
      '1',
      null,
      2_147_483_648,
      Number.MAX_SAFE_INTEGER + 2,
    ])
      await refuse(blk({ blockVersion }), '/blockVersion');
    const harness = await harnessFor();
    harness.registerBlock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      code: 'CONFLICT',
      message: 'pair reused',
      details: { conflict: 'INVALID_TRANSITION' },
    });
    const response = await harness.send(A05, validBlock);
    expect(response.status).toBe(409);
    expect(response.headers.get('etag')).toBeNull();
    expect(harness.registerBlock).toHaveBeenCalledTimes(1);
  });

  it('[P2-S09-AC-105] accepts only the supported lifecycle at registration', async () => {
    expect((await accept(validBlock)).lifecycle).toBe('supported');
    for (const lifecycle of ['deprecated', 'withdrawn', 'Supported', '', null])
      await refuse(blk({ lifecycle }), '/lifecycle');
    await refuse(without('lifecycle'), '/lifecycle');
  });

  it('[P2-S09-AC-106] accepts propsSchemaRef only as a protected artifact reference without traversal or URL semantics', async () => {
    for (const propsSchemaRef of ['schemas/hero-banner.json', 'a', 'a.b_c-d/e'])
      await accept(blk({ propsSchemaRef }));
    for (const propsSchemaRef of [
      '../schemas/x',
      'schemas/../x',
      'https://x.test/s.json',
      'file:///etc/passwd',
      '//host/s',
      'a//b',
      '/abs/path',
      'Schemas/x',
      '',
      `a${'b'.repeat(256)}`,
      'javascript:alert(1)',
      'a b',
    ])
      await refuse(blk({ propsSchemaRef }), '/propsSchemaRef');
  });

  it('[P2-S09-AC-107] keeps propsSchemaHash a lowercase 64-hex identity beside the reference and refuses an inline body in its place', async () => {
    const body = await accept(blk({ propsSchemaHash: 'ab'.repeat(32) }));
    expect(body.propsSchemaHash).toBe('ab'.repeat(32));
    expect(body.propsSchemaRef).toBe(validBlock.propsSchemaRef);
    for (const propsSchemaHash of [
      'A'.repeat(64),
      'a'.repeat(63),
      'a'.repeat(65),
      'g'.repeat(64),
      '',
      null,
    ])
      await refuse(blk({ propsSchemaHash }), '/propsSchemaHash');
    await refuse(blk({ propsSchema: { type: 'object' } }), '/propsSchema');
    await refuse(without('propsSchemaRef'), '/propsSchemaRef');
    const resource = (await (
      await (await harnessFor()).send(A05, validBlock)
    ).json()) as Record<string, unknown>;
    expect(resource.propsSchemaRef).toBe(block.propsSchemaRef);
    expect(resource.propsSchemaHash).toBe(block.propsSchemaHash);
  });

  it('[P2-S09-AC-108] refuses a props snapshot that is not the strict normalized object', async () => {
    await accept(blk({ propsSchemaSnapshot: snapshotWith([field]) }));
    await refuse(
      blk({
        propsSchemaSnapshot: {
          ...snapshotWith([field]),
          additionalProperties: true,
        },
      }),
      '/propsSchemaSnapshot/additionalProperties',
    );
    await refuse(
      blk({ propsSchemaSnapshot: { fields: [], additionalProperties: false } }),
      '/propsSchemaSnapshot/schemaVersion',
    );
    await refuse(
      blk({ propsSchemaSnapshot: { ...snapshotWith([]), extra: 1 } }),
      '/propsSchemaSnapshot',
    );
    await refuse(
      blk({ propsSchemaSnapshot: snapshotWith([{ ...field, extra: 1 }]) }),
      '/propsSchemaSnapshot/fields/0',
    );
    for (const member of ['name', 'kind', 'required']) {
      const rest: Record<string, unknown> = { ...field };
      delete rest[member];
      await refuse(
        blk({ propsSchemaSnapshot: snapshotWith([rest]) }),
        `/propsSchemaSnapshot/fields/0/${member}`,
      );
    }
  });

  it('[P2-S09-AC-109] caps the snapshot at 128 fields of bounded nested JSON and refuses unknown runtime keywords', async () => {
    const many = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        ...field,
        name: `field_${i}`,
      }));
    await accept(blk({ propsSchemaSnapshot: snapshotWith(many(128)) }));
    await refuse(
      blk({ propsSchemaSnapshot: snapshotWith(many(129)) }),
      '/propsSchemaSnapshot/fields',
    );
    const nested = (depth: number): unknown =>
      depth === 0 ? 1 : { a: nested(depth - 1) };
    await refuse(
      blk({
        propsSchemaSnapshot: snapshotWith([
          { ...field, constraints: nested(10) as Record<string, unknown> },
        ]),
      }),
      '/propsSchemaSnapshot/fields/0/constraints',
    );
    await accept(
      blk({
        propsSchemaSnapshot: snapshotWith([
          { ...field, constraints: nested(4) as Record<string, unknown> },
        ]),
      }),
    );
    await refuse(
      blk({
        propsSchemaSnapshot: snapshotWith([
          { ...field, constraints: nested(5) as Record<string, unknown> },
        ]),
      }),
      '/propsSchemaSnapshot/fields/0/constraints',
    );
    await refuse(
      blk({
        propsSchemaSnapshot: snapshotWith([
          { ...field, constraints: { text: 'x'.repeat(8200) } },
        ]),
      }),
      '/propsSchemaSnapshot/fields/0/constraints',
    );
    await accept(
      blk({
        propsSchemaSnapshot: snapshotWith([
          {
            ...field,
            constraints: Object.fromEntries(
              Array.from({ length: 64 }, (_, i) => [`k${i}`, i]),
            ),
          },
        ]),
      }),
    );
    const wide = Object.fromEntries(
      Array.from({ length: 65 }, (_, i) => [`k${i}`, i]),
    );
    await refuse(
      blk({
        propsSchemaSnapshot: snapshotWith([{ ...field, constraints: wide }]),
      }),
      '/propsSchemaSnapshot/fields/0/constraints',
    );
    await refuse(
      blk({
        propsSchemaSnapshot: snapshotWith([
          {
            ...field,
            constraints: { list: Array.from({ length: 129 }, () => 0) },
          },
        ]),
      }),
      '/propsSchemaSnapshot/fields/0/constraints',
    );
    for (const keyword of [
      '$ref',
      'pattern',
      'script',
      'eval',
      'onRender',
      'function',
      'expression',
      'default',
      'properties',
    ]) {
      await refuse(
        blk({ propsSchemaSnapshot: { ...snapshotWith([]), [keyword]: 'x' } }),
        '/propsSchemaSnapshot',
      );
      await refuse(
        blk({
          propsSchemaSnapshot: snapshotWith([{ ...field, [keyword]: 'x' }]),
        }),
        '/propsSchemaSnapshot/fields/0',
      );
    }
  });

  it('[P2-S09-AC-110] hashes the exact RFC 8785 UTF-8 bytes of the normalized snapshot to the lowercase SHA-256 propsSnapshotHash', async () => {
    const snapshotA = {
      schemaVersion: '1',
      fields: [
        { name: 'title', kind: 'string', required: true, constraints: {} },
      ],
      additionalProperties: false,
    };
    const reordered = {
      additionalProperties: false,
      fields: [
        { constraints: {}, required: true, kind: 'string', name: 'title' },
      ],
      schemaVersion: '1',
    };
    expect(canonicalJson(snapshotA)).toBe(canonicalJson(reordered));
    expect(canonicalJson(snapshotA)).toBe(
      '{"additionalProperties":false,"fields":[{"constraints":{},"kind":"string","name":"title","required":true}],"schemaVersion":"1"}',
    );
    const expected = await sha256Hex(canonicalJson(snapshotA));
    expect(expected).toBe(
      await digestHex(new TextEncoder().encode(canonicalJson(snapshotA))),
    );
    expect(expected).toBe(
      'e3cf3f6d67138d16c3a540ea60e83b92364800b1ae26647385d0ff6aa4301cc5',
    );
    expect(expected).toMatch(/^[a-f0-9]{64}$/u);
    const withUnicode = { ...snapshotA, schemaVersion: 'é\u{1F600}' };
    expect(canonicalJson(withUnicode)).toContain('é\u{1F600}');
    expect(await sha256Hex(canonicalJson(withUnicode))).not.toBe(expected);
    const body = await accept(
      blk({ propsSchemaSnapshot: snapshotA, propsSnapshotHash: expected }),
    );
    expect(body.propsSnapshotHash).toBe(expected);
    for (const propsSnapshotHash of [
      expected.toUpperCase(),
      expected.slice(1),
      `${expected}0`,
      '',
    ])
      await refuse(
        blk({ propsSchemaSnapshot: snapshotA, propsSnapshotHash }),
        '/propsSnapshotHash',
      );
  });

  it('[P2-S09-AC-111] requires the Ed25519 algorithm, a trusted release key id and a canonical padded base64 64-byte signature', async () => {
    const attest = (patch: Record<string, unknown>) =>
      blk({
        propsSnapshotAttestation: {
          ...validBlock.propsSnapshotAttestation,
          ...patch,
        },
      });
    await accept(attest({}));
    for (const algorithm of ['ed25519', 'RSA', 'ES256', '', null])
      await refuse(
        attest({ algorithm }),
        '/propsSnapshotAttestation/algorithm',
      );
    for (const keyId of [
      '',
      'Release',
      '1key',
      'k',
      'a b',
      `a${'b'.repeat(96)}`,
      null,
    ])
      await refuse(attest({ keyId }), '/propsSnapshotAttestation/keyId');
    for (const signature of [
      SIGNATURE.slice(2),
      `${SIGNATURE}=`,
      'A'.repeat(86) + 'B=',
      'A'.repeat(88),
      `${'A'.repeat(85)}-==`,
      '',
      'A'.repeat(86) + '=A',
      null,
    ])
      await refuse(
        attest({ signature }),
        '/propsSnapshotAttestation/signature',
      );
    await refuse(attest({ extra: 'x' }), '/propsSnapshotAttestation');
    const missing = { ...validBlock.propsSnapshotAttestation } as Record<
      string,
      unknown
    >;
    delete missing.keyId;
    await refuse(
      blk({ propsSnapshotAttestation: missing }),
      '/propsSnapshotAttestation/keyId',
    );
    const harness = await harnessFor();
    harness.registerBlock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      code: 'VALIDATION_FAILED',
      message: 'untrusted',
      details: {
        violations: [
          {
            path: '/propsSnapshotAttestation/keyId',
            message: 'The attestation key is not trusted.',
          },
        ],
      },
    });
    expect((await harness.send(A05, validBlock)).status).toBe(422);
  });

  it('[P2-S09-AC-113] requires rendererRef as a 1-160 character code-manifest reference and refuses URLs, source text and modules', async () => {
    for (const rendererRef of [
      'renderer/hero-banner',
      'a',
      `a${'b'.repeat(159)}`,
    ])
      await accept(blk({ rendererRef }));
    for (const rendererRef of [
      '',
      `a${'b'.repeat(160)}`,
      'https://cdn.test/r.js',
      '//cdn/r',
      '../r',
      'a//b',
      'renderer.js?x=1',
      'export default () => {}',
      'function(){}',
      'data:text/javascript,alert(1)',
      'Renderer/Hero',
      'a b',
      5,
    ])
      await refuse(blk({ rendererRef }), '/rendererRef');
    await refuse(
      blk({ rendererSource: 'export default 1' }),
      '/rendererSource',
    );
    await refuse(blk({ rendererModule: 'AAAA' }), '/rendererModule');
  });

  it('[P2-S09-AC-114] caps allowedChildren at 32 block keys and bounds slotRules maxDepth to 1-16 and maxNodes to 1-512', async () => {
    const kids = (count: number) =>
      Array.from({ length: count }, (_, i) => `child.block_${i}`);
    expect(
      (
        (await accept(blk({ allowedChildren: kids(32) })))
          .allowedChildren as string[]
      ).length,
    ).toBe(32);
    await refuse(blk({ allowedChildren: kids(33) }), '/allowedChildren');
    await refuse(blk({ allowedChildren: ['Bad Key'] }), '/allowedChildren/0');
    await refuse(blk({ allowedChildren: [7] }), '/allowedChildren/0');
    for (const [maxDepth, maxNodes] of [
      [1, 1],
      [16, 512],
    ])
      await accept(blk({ slotRules: { maxDepth, maxNodes } }));
    for (const maxDepth of [0, 17, 1.5, '1', null])
      await refuse(
        blk({ slotRules: { maxDepth, maxNodes: 1 } }),
        '/slotRules/maxDepth',
      );
    for (const maxNodes of [0, 513, 2.5, '1', null])
      await refuse(
        blk({ slotRules: { maxDepth: 1, maxNodes } }),
        '/slotRules/maxNodes',
      );
    await refuse(
      blk({ slotRules: { maxDepth: 1, maxNodes: 1, extra: 1 } }),
      '/slotRules',
    );
    await refuse(blk({ slotRules: { maxDepth: 1 } }), '/slotRules/maxNodes');
  });

  it('[P2-S09-AC-115] caps dataSourcePermissions at 32 allowlisted keys and refuses arbitrary sources and projections', async () => {
    const keys = (count: number) =>
      Array.from({ length: count }, (_, i) => `cms.source_${i}`);
    expect(
      (
        (await accept(blk({ dataSourcePermissions: keys(32) })))
          .dataSourcePermissions as string[]
      ).length,
    ).toBe(32);
    await refuse(
      blk({ dataSourcePermissions: keys(33) }),
      '/dataSourcePermissions',
    );
    for (const source of [
      'select * from users',
      'https://api.test/x',
      'Cms.Source',
      '1src',
      'a b',
      'a;b',
      '',
      3,
    ])
      await refuse(
        blk({ dataSourcePermissions: [source] }),
        '/dataSourcePermissions/0',
      );
    const harness = await harnessFor();
    harness.registerBlock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      code: 'VALIDATION_FAILED',
      message: 'unlisted',
      details: {
        violations: [
          {
            path: '/dataSourcePermissions/0',
            message: 'The data source is not allowlisted.',
          },
        ],
      },
    });
    expect(
      (
        await harness.send(
          A05,
          blk({ dataSourcePermissions: ['cms.unlisted_source'] }),
        )
      ).status,
    ).toBe(422);
  });

  it('[P2-S09-AC-116] keeps accessibility strict: nameRequired boolean, keyboard true, focusOrder document or managed, statusAnnouncement boolean', async () => {
    const access = (patch: Record<string, unknown>) =>
      blk({ accessibility: { ...validBlock.accessibility, ...patch } });
    await accept(access({}));
    await accept(
      access({
        focusOrder: 'managed',
        nameRequired: false,
        statusAnnouncement: false,
      }),
    );
    await refuse(access({ keyboard: false }), '/accessibility/keyboard');
    for (const focusOrder of ['auto', 'Document', '', null])
      await refuse(access({ focusOrder }), '/accessibility/focusOrder');
    for (const nameRequired of ['yes', 1, null])
      await refuse(access({ nameRequired }), '/accessibility/nameRequired');
    for (const statusAnnouncement of ['yes', 0, null])
      await refuse(
        access({ statusAnnouncement }),
        '/accessibility/statusAnnouncement',
      );
    await refuse(access({ html: '<b>x</b>' }), '/accessibility');
    await refuse(
      blk({
        accessibility: {
          nameRequired: true,
          keyboard: true,
          focusOrder: 'document',
        },
      }),
      '/accessibility/statusAnnouncement',
    );
  });

  it('[P2-S09-AC-117] keeps compatibility strict with bounded minSchemaCompiler and maxSchemaCompiler', async () => {
    const compat = (patch: Record<string, unknown>) =>
      blk({ compatibility: { ...validBlock.compatibility, ...patch } });
    await accept(compat({}));
    await accept(
      compat({ minSchemaCompiler: 'a', maxSchemaCompiler: 'b'.repeat(32) }),
    );
    for (const member of ['minSchemaCompiler', 'maxSchemaCompiler']) {
      for (const value of ['', 'x'.repeat(33), 3, null])
        await refuse(compat({ [member]: value }), `/compatibility/${member}`);
    }
    await refuse(compat({ extra: '1' }), '/compatibility');
    await refuse(
      blk({ compatibility: { minSchemaCompiler: '1' } }),
      '/compatibility/maxSchemaCompiler',
    );
  });

  it('[P2-S09-AC-118] requires releaseDigest as lowercase 64-hex', async () => {
    expect(
      (await accept(blk({ releaseDigest: 'cd'.repeat(32) }))).releaseDigest,
    ).toBe('cd'.repeat(32));
    for (const releaseDigest of [
      'A'.repeat(64),
      'a'.repeat(63),
      'a'.repeat(65),
      'z'.repeat(64),
      '',
      null,
    ])
      await refuse(blk({ releaseDigest }), '/releaseDigest');
    await refuse(without('releaseDigest'), '/releaseDigest');
    const harness = await harnessFor();
    harness.registerBlock.mockResolvedValueOnce(
      ok({ ...block, releaseDigest: 'F'.repeat(64) }),
    );
    expect((await harness.send(A05, validBlock)).status).toBe(502);
  });

  it('[P2-S09-AC-112] binds the nested attestation to block key and version, props ref and hash, snapshot hash and release digest in the locked domain-separated order (pinned SQL-accepted vector)', async () => {
    const publicKey = await crypto.subtle.importKey(
      'raw',
      Uint8Array.from(
        atob('A6EHv/POEL4dcN0Y50vAmWfk1jCbpQ1fHdyGZBJVMbg='),
        (c) => c.charCodeAt(0),
      ),
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    const signature = Uint8Array.from(
      atob(
        '5N+OSsWz7zP39DneO5APJrbdeADbQLUmDsrt1aqw902tDqDU+2PxOFP67FHNV+NuuGvQlDWxkyghXcfKL4G3Cw==',
      ),
      (c) => c.charCodeAt(0),
    );
    const fields = [
      'hero',
      '2',
      'cms/blocks/hero/1',
      'a'.repeat(64),
      'e3cf3f6d67138d16c3a540ea60e83b92364800b1ae26647385d0ff6aa4301cc5',
      'e'.repeat(64),
    ];
    const verifies = (lines: readonly string[]) =>
      crypto.subtle.verify(
        { name: 'Ed25519' },
        publicKey,
        signature,
        new TextEncoder().encode(lines.join('\n')),
      );
    expect(await verifies(['WEJAMMIN-CMS-03A-05-PROPS-V1', ...fields])).toBe(
      true,
    );
    expect(await verifies(['WEJAMMIN-CMS-03A-05-RELEASE-V1', ...fields])).toBe(
      false,
    );
    expect(
      await verifies([
        'WEJAMMIN-CMS-03A-05-PROPS-V1',
        ...fields.slice().reverse(),
      ]),
    ).toBe(false);
    for (let index = 0; index < fields.length; index += 1) {
      const changed = fields.map((value, at) =>
        at === index ? `${value}x` : value,
      );
      expect(
        await verifies(['WEJAMMIN-CMS-03A-05-PROPS-V1', ...changed]),
        `member ${index}`,
      ).toBe(false);
    }
    const swapped = fields.slice();
    [swapped[0], swapped[2]] = [swapped[2] as string, swapped[0] as string];
    expect(await verifies(['WEJAMMIN-CMS-03A-05-PROPS-V1', ...swapped])).toBe(
      false,
    );
  });
});
