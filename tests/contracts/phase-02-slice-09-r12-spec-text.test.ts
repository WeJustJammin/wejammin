import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SchemaArtifactResourceSchema } from '../../packages/contracts/src/content-schema-registry/resources-artifacts.ts';

const BE03A = readFileSync(
  resolve('.memory/wiki/specs/be/03a-content-schema-registry.md'),
  'utf8',
);
const BE03A_FLAT = BE03A.replace(/\s+/gu, ' ');
const BE00 = readFileSync(
  resolve('.memory/wiki/specs/be/00-infrastructure.md'),
  'utf8',
);

const middlewareLine = (): string =>
  BE03A.split('\n').find((line) =>
    /^- The BE00 Hono middleware order/u.test(line),
  ) ?? '';

const positions = (line: string, steps: readonly string[]): readonly number[] =>
  steps.map((step) => line.indexOf(step));

describe('[P2-S09-AC-025] BE03a middleware order cites and matches the BE00 canonical order', () => {
  it('names BE00 as the governing order', () => {
    expect(middlewareLine()).toMatch(/BE00/u);
    expect(BE00).toMatch(/### Hono Middleware Order/u);
  });

  it('places the CORS origin allowlist before session verification, as BE00 does', () => {
    const [cors, session] = positions(middlewareLine(), [
      'CORS',
      'session/JWT',
    ]);
    expect(cors).toBeGreaterThan(-1);
    expect(session).toBeGreaterThan(-1);
    expect(cors).toBeLessThan(session ?? -1);
  });

  it('keeps the session-bound CSRF check after the session, capability and step-up and before the rate limiter, as implemented', () => {
    const order = positions(middlewareLine(), [
      'session/JWT',
      'acting-context/capability',
      'step-up',
      'CSRF',
      'rate limiter',
      'handler/RPC',
    ]);
    expect(order.every((index) => index > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('keeps the raw-size/media guard and Zod parse before CORS, session and CSRF (strict parse precedes authorization)', () => {
    const order = positions(middlewareLine(), [
      'request-id',
      'raw-size/media guard',
      'Zod validation',
      'CORS',
    ]);
    expect(order.every((index) => index > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('BE00 places the CORS allowlist in the security/transport step before authentication', () => {
    const cors = BE00.indexOf('CORS allowlist');
    const auth = BE00.indexOf('**Authentication:**');
    expect(cors).toBeGreaterThan(-1);
    expect(cors).toBeLessThan(auth);
  });
});

describe('[P2-S09-AC-007] BE03a defines the compiled artifact exactly as the compiler persists it', () => {
  const paragraph = (): string => {
    const start = BE03A.indexOf(
      'The artifact compiler uses the actual versioned',
    );
    return start < 0 ? '' : BE03A.slice(start, start + 2600);
  };

  it('states the compiled artifact set once, as the versioned contract reference, editor manifest, renderer manifest and hash', () => {
    const text = BE03A.slice(
      BE03A.indexOf('Compiled artifact set (AC007)'),
      BE03A.indexOf('Compiled artifact set (AC007)') + 1800,
    );
    expect(text).toMatch(/Compiled artifact set \(AC007\)/u);
    for (const member of [
      'zodContractRef',
      'cms/content-type/{typeKey}/v{versionNo}',
      'editor_manifest',
      'renderer_manifest',
      'artifact_hash',
    ])
      expect(text).toContain(member);
  });

  it('states that no separate OpenAPI or database artifact is persisted', () => {
    const start = BE03A_FLAT.indexOf('Compiled artifact set (AC007)');
    const text = BE03A_FLAT.slice(start, start + 1800);
    expect(text).toMatch(/no separately persisted OpenAPI document/u);
    expect(text).toMatch(/database/u);
  });

  it('the strict artifact resource carries exactly the documented members and no manifest body', () => {
    expect(
      Object.keys(SchemaArtifactResourceSchema.unwrap().shape).sort(),
    ).toEqual(
      [
        'artifactHash',
        'compiledAt',
        'compilerVersion',
        'contentTypeVersionId',
        'createdAt',
        'id',
        'resourceKind',
        'state',
        'updatedAt',
        'version',
        'zodContractRef',
      ].sort(),
    );
    expect(paragraph()).toMatch(/deterministic artifact hash/u);
  });

  it('the SQL artifact table lists exactly the documented persisted columns', () => {
    const row =
      BE03A.split('\n').find((line) =>
        line.startsWith('| SchemaArtifact / cms_schema_artifacts'),
      ) ?? '';
    for (const column of [
      'zod_contract_ref',
      'editor_manifest',
      'renderer_manifest',
      'artifact_hash',
    ])
      expect(row).toContain(column);
    expect(row).not.toMatch(/openapi|database_manifest|zod_manifest/iu);
  });
});
