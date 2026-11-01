import { vi } from 'vitest';

import {
  type AuthoringContextField,
  type AuthoringContextResource,
  type AuthoringContextType,
} from '@wejammin/contracts';

import { createCmsEditorialApp, type CmsEditorialDependencies } from './index';

/**
 * Shared fixtures, harness and `get` helper for the CMS-03B-14 protected
 * authoring-context route tests.
 */

const origin = 'https://cms-console.example.test';
const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const userId = '10000000-0000-4000-8000-000000000001';
export const partyId = '20000000-0000-4000-8000-000000000002';
export const entryId = '30000000-0000-4000-8000-000000000003';
export const versionId = '71000000-0000-4000-8000-000000000007';
export const hash = 'a'.repeat(64);
export const instant = '2026-09-26T12:00:00.000Z';
const path = '/api/v1/cms/entries/authoring-context';

const evidence = {
  key: 'editorial.standard',
  version: '1',
  policyHash: hash,
  riskClass: 'ordinary' as const,
  requiredDecisionCount: 1,
  requiredCapabilities: [],
  approvalEvidenceHash: hash,
};

export const selectedType: AuthoringContextType = {
  contentTypeId: '70000000-0000-4000-8000-000000000007',
  contentTypeVersionId: versionId,
  typeKey: 'article',
  label: 'Article',
  sourceLocale: 'en-US',
  defaultLocale: 'en-US',
  supportedLocales: ['en-US'],
  schemaArtifact: {
    id: '72000000-0000-4000-8000-000000000007',
    contentTypeVersionId: versionId,
    artifactHash: hash,
    compilerVersion: '1.0.0',
    zodContractRef: '03a.content-type-version.v1',
  },
  validatorRefs: [],
  workflowPolicy: evidence,
  activationEvidence: evidence,
};

const field: AuthoringContextField = {
  stableFieldId: '73000000-0000-4000-8000-000000000007',
  key: 'title',
  kind: 'short_text',
  constraints: {},
  required: true,
  defaultMode: 'none',
  localizationMode: 'localized',
  editorConfig: { label: 'Title', order: 0 },
  relationDefinition: null,
};

export const unselected: AuthoringContextResource = {
  creatableTypes: [selectedType],
  selectedType: null,
  fields: [],
};

export const selected: AuthoringContextResource = {
  creatableTypes: [selectedType],
  selectedType,
  fields: [field],
};

const unavailable = async () => ({
  ok: false as const,
  status: 503 as const,
  code: 'DEPENDENCY_UNAVAILABLE',
  message: 'Unavailable.',
});

type PortOutcome = (input: unknown, signal: AbortSignal) => Promise<unknown>;

type HarnessOptions = Readonly<{
  port?: PortOutcome;
  omitPort?: boolean;
  resolveSession?: CmsEditorialDependencies['resolveSession'];
  rateLimit?: CmsEditorialDependencies['rateLimit'];
  telemetry?: NonNullable<CmsEditorialDependencies['telemetry']>;
  deadlineMs?: number;
}>;

export const harness = (options: HarnessOptions = {}) => {
  const getAuthoringContext = vi.fn(
    options.port ?? (async () => ({ ok: true as const, value: unselected })),
  );
  const getEntryDraft = vi.fn(async () => ({
    ok: true as const,
    value: { leaked: true },
  }));
  const telemetry = vi.fn(options.telemetry ?? ((): void => undefined));
  const ports =
    options.omitPort === true
      ? { appendRevision: unavailable }
      : { appendRevision: unavailable, getAuthoringContext, getEntryDraft };
  const dependencies = {
    ports,
    resolveSession:
      options.resolveSession ??
      (async () => ({
        ok: true as const,
        value: {
          userId,
          actingPartyId: partyId,
          capabilities: ['cms.author'],
          mfaFresh: true,
        },
      })),
    rateLimit:
      options.rateLimit ??
      (async () => ({
        ok: true as const,
        value: { allowed: true, limit: 300, remaining: 299, resetAt: 60_000 },
      })),
    humanOrigins: [origin],
    now: () => 0,
    ...(options.deadlineMs === undefined
      ? {}
      : { deadlineMs: options.deadlineMs }),
    telemetry,
  } as unknown as CmsEditorialDependencies;
  return {
    app: createCmsEditorialApp(dependencies),
    getAuthoringContext,
    getEntryDraft,
    telemetry,
  };
};

export const get = (
  app: ReturnType<typeof createCmsEditorialApp>,
  suffix = '',
  headers: Record<string, string> = {},
): Promise<Response> =>
  Promise.resolve(
    app.request(`${path}${suffix}`, {
      method: 'GET',
      headers: { origin, 'x-request-id': requestId, ...headers },
    }),
  );
