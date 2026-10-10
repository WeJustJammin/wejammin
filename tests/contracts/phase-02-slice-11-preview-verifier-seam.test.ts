import { readFileSync } from 'node:fs';

import {
  CMS_EDITORIAL_INTERNAL_OPERATIONS,
  CMS_PREVIEW_VERIFIER_CIRCUIT_OPEN_SECONDS,
  CMS_PREVIEW_VERIFIER_RETRY_DELAYS_MS,
  CMS_PREVIEW_VERIFIER_TIMEOUT_MS,
  PreviewVerificationRequestSchema,
  PreviewVerificationResultSchema,
  previewVerificationDenial,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { versionSet } from '../../apps/worker/src/cms-editorial/workflow-fixtures.test-support';

/*
 * P2-S11-AC-073: CMS-03B-19 is exactly one database RPC whose request and result
 * shape equals the BE04c `Shard 03 preview-token verifier` seam. The seam row is
 * parsed from the specification itself, so a change to either side that is not
 * mirrored on the other fails here: member names, member types, both result
 * branches, the 500 ms timeout, the 75 ms / 150 ms retries, read safety and the
 * 30 s circuit.
 */

const BE04C = readFileSync(
  new URL(
    '../../.memory/wiki/specs/be/04c-public-delivery-cache.md',
    import.meta.url,
  ),
  'utf8',
);

type Member = Readonly<{ name: string; type: string }>;

/** Split on `separator` outside any (), {} or [] nesting. */
const splitTopLevel = (text: string, separator: string): readonly string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if ('({['.includes(char)) depth += 1;
    if (')}]'.includes(char)) depth -= 1;
    if (depth === 0 && text.startsWith(separator, index)) {
      parts.push(current.trim());
      current = '';
      index += separator.length - 1;
    } else current += char;
  }
  parts.push(current.trim());
  return parts;
};

/** `{ a: x, b: y (z) }` as its members. */
const membersOf = (objectText: string): readonly Member[] => {
  const trimmed = objectText.trim();
  expect(trimmed.startsWith('{') && trimmed.endsWith('}')).toBe(true);
  return splitTopLevel(trimmed.slice(1, -1), ',').map((member) => {
    const colon = member.indexOf(':');
    return {
      name: member.slice(0, colon).trim(),
      type: member.slice(colon + 1).trim(),
    };
  });
};

const seamRow = (): readonly string[] => {
  const line = BE04C.split('\n').find((candidate) =>
    candidate.startsWith('| Shard 03 preview-token verifier'),
  );
  expect(line, 'BE04c seam row').toBeDefined();
  return (line as string)
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim().replace(/^`|`$/gu, ''));
};

const [, requestCell, responseCell, timeoutCell, retryCell, circuitCell] =
  seamRow() as readonly [string, string, string, string, string, string];

const requestMembers = membersOf(requestCell);
const [validBranch, deniedBranch] = splitTopLevel(responseCell, ' or ').map(
  membersOf,
) as [readonly Member[], readonly Member[]];

const UUID = '123e4567-e89b-42d3-a456-426614174000';
const HEX = 'c'.repeat(64);
const INSTANT = '2026-10-08T12:15:00Z';

/** A value of the type family a seam member declares; unknown families fail loudly. */
const sampleFor = (member: Member): unknown => {
  const { name, type } = member;
  if (type === 'true') return true;
  if (type === 'false') return false;
  if (type === 'null') return null;
  if (type === 'boolean') return true;
  if (type.startsWith('uuid')) return UUID;
  if (type.startsWith('object')) return versionSet;
  if (type.startsWith('RFC3339')) return INSTANT;
  if (/SHA-256 hex|64 lowercase hex/u.test(type)) return HEX;
  if (type.includes('^[a-z0-9_-]{1,48}$')) return 'members';
  if (type === 'string' && name === 'locale') return 'en-US';
  if (type === 'string' && name === 'route') return '/music/artist/spring';
  throw new Error(`BE04c seam member ${name} has an unmodelled type: ${type}`);
};

const build = (members: readonly Member[]): Record<string, unknown> =>
  Object.fromEntries(members.map((member) => [member.name, sampleFor(member)]));

const without = (
  value: Record<string, unknown>,
  name: string,
): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([key]) => key !== name));

describe('[P2-S11-AC-073] the CMS-03B-19 request equals the BE04c seam request', () => {
  it('names exactly the six members of the seam row and no other', () => {
    expect(requestMembers.map((member) => member.name)).toEqual([
      'tokenHash',
      'actorPersonId',
      'actingContextVersion',
      'route',
      'locale',
      'audience',
    ]);
    const sample = build(requestMembers);
    expect(PreviewVerificationRequestSchema.safeParse(sample).success).toBe(
      true,
    );
    for (const member of requestMembers)
      expect(
        PreviewVerificationRequestSchema.safeParse(without(sample, member.name))
          .success,
        `${member.name} is required`,
      ).toBe(false);
    expect(
      PreviewVerificationRequestSchema.safeParse({
        ...sample,
        token: 'plaintext-token-never-sent',
      }).success,
    ).toBe(false);
  });

  it('types each member as the seam row does', () => {
    const sample = build(requestMembers);
    const accepts = (name: string, value: unknown) =>
      PreviewVerificationRequestSchema.safeParse({ ...sample, [name]: value })
        .success;
    // tokenHash: lowercase SHA-256 hex of the presented token, never plaintext.
    for (const bad of ['C'.repeat(64), 'c'.repeat(63), 'c'.repeat(65), 'tok'])
      expect(accepts('tokenHash', bad), `tokenHash ${bad}`).toBe(false);
    // actorPersonId: uuid.
    expect(accepts('actorPersonId', 'not-a-uuid')).toBe(false);
    // actingContextVersion: 64 lowercase hex.
    for (const bad of ['C'.repeat(64), 'c'.repeat(63), 'c'.repeat(65)])
      expect(accepts('actingContextVersion', bad)).toBe(false);
    // route and locale: strings.
    expect(accepts('route', 7)).toBe(false);
    expect(accepts('locale', 7)).toBe(false);
  });

  it('matches the seam audience grammar on every boundary', () => {
    const audienceType = requestMembers.find(
      (member) => member.name === 'audience',
    )!.type;
    const grammar = /\((\^\[a-z0-9_-\]\{1,48\}\$)\)/u.exec(audienceType);
    expect(grammar, 'audience grammar in the seam row').not.toBeNull();
    const pattern = new RegExp(grammar![1]!, 'u');
    const sample = build(requestMembers);
    for (const audience of [
      '',
      'a',
      'members',
      'a-b_c',
      'a'.repeat(48),
      'a'.repeat(49),
      'Members',
      'public ',
      'a.b',
      'é',
      '\u0000',
    ])
      expect(
        PreviewVerificationRequestSchema.safeParse({ ...sample, audience })
          .success,
        `audience ${JSON.stringify(audience)}`,
      ).toBe(pattern.test(audience));
  });

  it('bounds the route at 4,096 characters as the criterion states', () => {
    const sample = build(requestMembers);
    const parse = (route: string) =>
      PreviewVerificationRequestSchema.safeParse({ ...sample, route }).success;
    expect(parse('/'.repeat(4096))).toBe(true);
    expect(parse('/'.repeat(4097))).toBe(false);
  });
});

describe('[P2-S11-AC-073] the CMS-03B-19 result equals the BE04c seam response', () => {
  it('carries the seven members of the valid branch and rejects any other shape', () => {
    expect(validBranch.map((member) => member.name)).toEqual([
      'valid',
      'userId',
      'entryId',
      'revisionId',
      'exactVersionSet',
      'expiresAt',
      'revoked',
    ]);
    const sample = build(validBranch);
    expect(PreviewVerificationResultSchema.safeParse(sample).success).toBe(
      true,
    );
    for (const member of validBranch)
      expect(
        PreviewVerificationResultSchema.safeParse(without(sample, member.name))
          .success,
        `${member.name} is required`,
      ).toBe(false);
    expect(
      PreviewVerificationResultSchema.safeParse({ ...sample, extra: 1 })
        .success,
    ).toBe(false);
    // `revoked: false` on a valid result, never true.
    expect(
      PreviewVerificationResultSchema.safeParse({ ...sample, revoked: true })
        .success,
    ).toBe(false);
  });

  it('carries the denied branch with five null members and a boolean revoked', () => {
    expect(deniedBranch.map((member) => member.name)).toEqual([
      'valid',
      'userId',
      'entryId',
      'revisionId',
      'exactVersionSet',
      'expiresAt',
      'revoked',
    ]);
    expect(
      deniedBranch.filter((member) => member.type === 'null'),
    ).toHaveLength(5);
    const sample = build(deniedBranch);
    expect(PreviewVerificationResultSchema.safeParse(sample).success).toBe(
      true,
    );
    expect(
      PreviewVerificationResultSchema.safeParse({ ...sample, revoked: false })
        .success,
    ).toBe(true);
    for (const member of deniedBranch)
      expect(
        PreviewVerificationResultSchema.safeParse(without(sample, member.name))
          .success,
        `${member.name} is required`,
      ).toBe(false);
    // A denial can disclose nothing: every null member refuses a value.
    const valueFor: Record<string, unknown> = {
      userId: UUID,
      entryId: UUID,
      revisionId: UUID,
      exactVersionSet: versionSet,
      expiresAt: INSTANT,
    };
    for (const member of deniedBranch.filter((item) => item.type === 'null'))
      expect(
        PreviewVerificationResultSchema.safeParse({
          ...sample,
          [member.name]: valueFor[member.name],
        }).success,
        `${member.name} stays null on a denial`,
      ).toBe(false);
    expect(
      PreviewVerificationResultSchema.safeParse({ ...sample, revoked: 'yes' })
        .success,
    ).toBe(false);
  });

  it('answers an unknown or failed verifier call with the seam denial and never guesses revoked', () => {
    const denial = previewVerificationDenial();
    expect(denial).toEqual({
      ...build(deniedBranch),
      revoked: false,
    });
    expect(PreviewVerificationResultSchema.safeParse(denial).success).toBe(
      true,
    );
    expect(previewVerificationDenial(true).revoked).toBe(true);
  });
});

describe('[P2-S11-AC-073] the CMS-03B-19 transport equals the BE04c seam timings', () => {
  it('declares the seam timeout, retries, read safety and circuit', () => {
    expect(timeoutCell).toBe(`${CMS_PREVIEW_VERIFIER_TIMEOUT_MS} ms`);
    const retries = /^(\d+) retries at ([\d ms,]+);\s*read-safe$/u.exec(
      retryCell,
    );
    expect(retries, `retry cell: ${retryCell}`).not.toBeNull();
    const delays = retries![2]!.split(',').map((part) => Number.parseInt(part));
    expect(delays).toEqual([...CMS_PREVIEW_VERIFIER_RETRY_DELAYS_MS]);
    expect(Number.parseInt(retries![1]!)).toBe(
      CMS_PREVIEW_VERIFIER_RETRY_DELAYS_MS.length,
    );
    expect(CMS_EDITORIAL_INTERNAL_OPERATIONS['CMS-03B-19'].readSafe).toBe(true);
    expect(
      circuitCell.startsWith(
        `Open ${CMS_PREVIEW_VERIFIER_CIRCUIT_OPEN_SECONDS} s;`,
      ),
    ).toBe(true);
    expect(circuitCell).toContain('denies preview');
  });

  it('is one RPC for the Shard 04 delivery principal, as the seam prose names it', () => {
    const operation = CMS_EDITORIAL_INTERNAL_OPERATIONS['CMS-03B-19'];
    expect(operation.rpcs).toEqual(['platform_api.cms_verify_preview_token']);
    expect(operation.requestSchema).toBe('PreviewVerificationRequestSchema');
    expect(operation.resultSchema).toBe('PreviewVerificationResultSchema');
    expect(BE04C).toContain(
      'Shard 03 internal RPC `platform_api.cms_verify_preview_token` (BE03b CMS-03B-19), granted only to the Shard 04 delivery principal',
    );
    expect(operation.principal).toBe('shard04_delivery');
  });
});
