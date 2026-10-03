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

describe('[P2-S09-AC-025] BE03a middleware order defers to the BE00 canonical order exactly', () => {
  it('names BE00 §Hono Middleware Order as the governing order', () => {
    expect(middlewareLine()).toMatch(/BE00 §Hono Middleware Order/u);
    expect(BE00).toMatch(/### Hono Middleware Order/u);
  });

  it('restates no order of its own: no arrow chain and no step list that could contradict BE00', () => {
    const line = middlewareLine();
    expect(line).not.toMatch(/→|->/u);
    for (const step of [
      'request-id',
      'Zod validation',
      'session/JWT',
      'acting-context',
      'rate limiter',
      'handler/RPC',
    ])
      expect(line, step).not.toContain(step);
    expect(line).toMatch(/restates no order/u);
  });

  it('keeps the BE00 order itself as the contract: security/transport (CORS, session-bound CSRF) before authentication, validation before authorization (step-up inside it), then idempotency', () => {
    const body = BE00.slice(BE00.indexOf('### Hono Middleware Order'));
    const steps = [
      '**Route inventory and request context:**',
      '**Security/transport:**',
      '**Webhook raw branch:**',
      '**Authentication:**',
      '**Acting-context resolution:**',
      '**Boundary validation:**',
      '**Authorization:**',
      '**Concurrency and idempotency:**',
    ];
    const at = steps.map((step) => body.indexOf(step));
    expect(at.every((index) => index > -1)).toBe(true);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
    const transport = body.slice(at[1], at[2]);
    expect(transport).toContain('CORS allowlist');
    expect(transport).toContain('session-bound CSRF');
    expect(body.slice(at[6], at[7])).toContain('step-up freshness');
  });

  it('records the 2026-10-03 correction in the BE03a changelog', () => {
    expect(BE03A_FLAT).toMatch(
      /\| 2026-10-03 \| [^|]*middleware order bullet no longer restates an order[^|]*BE00 §Hono Middleware Order/u,
    );
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
