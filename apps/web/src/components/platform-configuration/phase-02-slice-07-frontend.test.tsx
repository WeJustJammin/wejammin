import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Cfg05a02EffectiveValueResponseSchema } from '@wejammin/contracts';

import DataTable from './DataTable';
import { ProposeChangeForm } from './platform-configuration-forms';
import { sanitizeConfigurationValue } from './platform-configuration-security';
import SettingsFlagsRuntimeWorkbench from './SettingsFlagsRuntimeWorkbench';
import {
  canonicalInstantFormValue,
  formDataToConfigurationCommand,
  parseConfigurationCommandResponse,
  parsePlatformConfigurationError,
} from './settings-flags-runtime-workbench-transport';

const ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132d8';
const VERSION = '7';
const HASH = 'a'.repeat(64);
const effective = {
  definitionId: ID,
  definitionVersionId: '018f0c45-73fe-7dc2-9c09-68f7ecf132d9',
  key: 'web.theme',
  valueKind: 'short_text',
  ownerCapability: 'settings.web.write',
  typedValue: 'jam',
  sourceScope: 'platform',
  sourceSubjectId: null,
  sourceValueVersionId: null,
  isDefault: true,
  effectiveFrom: null,
  effectiveTo: null,
  evaluatedAt: '2026-09-02T00:00:00.000Z',
  evaluatorVersion: VERSION,
  correlationId: '018f0c45-73fe-7dc2-9c09-68f7ecf132da',
  compatibility: 'exact',
} as const;

const record = {
  id: ID,
  version: VERSION,
  state: 'effective',
  provenance: [
    {
      source: 'settings-flags-runtime',
      evidence:
        'canonical-effective-value:018f0c45-73fe-7dc2-9c09-68f7ecf132da',
      at: effective.evaluatedAt,
      visibility: 'disclosed',
    },
  ],
  projection: { key: effective.key, valueKind: effective.valueKind },
} as const;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Phase 2 Slice 07 frontend contracts', () => {
  it('serializes only the propose command fields and canonicalizes local instants', () => {
    const formData = new Map<string, string>([
      ['scopeType', 'environment'],
      ['scopeId', ID],
      ['environment', 'staging'],
      ['typedValue', '{"enabled":true}'],
      ['effectiveFrom', '2026-09-02T12:30'],
      ['effectiveTo', ''],
      ['impactManifest', '{"consumer":"web"}'],
      ['rollbackCandidate', 'null'],
      ['reason', 'Release preparation'],
      ['consumerKeys', 'web.theme, web.navigation'],
      ['expectedDefinitionVersion', VERSION],
      ['idempotency-key', 'should-not-cross-boundary'],
      ['csrf', 'should-not-cross-boundary'],
    ]);
    class FakeFormData {
      get(name: string): string | null {
        return formData.get(name) ?? null;
      }

      has(name: string): boolean {
        return formData.has(name);
      }
    }
    vi.stubGlobal('FormData', FakeFormData);

    const command = formDataToConfigurationCommand({} as HTMLFormElement);
    expect(command).toMatchObject({
      scopeType: 'environment',
      scopeId: ID,
      environment: 'staging',
      typedValue: { enabled: true },
      impactManifest: { consumer: 'web' },
      rollbackCandidate: null,
      expectedDefinitionVersion: VERSION,
      consumerKeys: ['web.theme', 'web.navigation'],
    });
    expect(command).not.toHaveProperty('idempotency-key');
    expect(command).not.toHaveProperty('csrf');
    expect(command).not.toHaveProperty('expectedReviewVersion');
    expect(command.interval).toEqual({
      effectiveFrom: '2026-09-02T16:30:00.000Z',
      effectiveTo: null,
    });
  });

  it('serializes the action command without leaking propose-only fields', () => {
    const formData = new Map<string, string>([
      ['action', 'schedule'],
      ['approvalReason', 'Approved for the maintenance window'],
      ['stepUpToken', 'step-up-token-with-at-least-20-chars'],
      ['scheduledFor', '2026-09-03T09:00'],
      ['expectedReviewVersion', VERSION],
      ['candidateHash', HASH],
      ['scopeType', 'must-not-cross-boundary'],
    ]);
    class FakeFormData {
      get(name: string): string | null {
        return formData.get(name) ?? null;
      }

      has(name: string): boolean {
        return formData.has(name);
      }
    }
    vi.stubGlobal('FormData', FakeFormData);

    const command = formDataToConfigurationCommand({} as HTMLFormElement);
    expect(command).toMatchObject({
      action: 'schedule',
      approvalReason: 'Approved for the maintenance window',
      stepUpToken: 'step-up-token-with-at-least-20-chars',
      expectedReviewVersion: VERSION,
      candidateHash: HASH,
      scheduledFor: '2026-09-03T13:00:00.000Z',
    });
    expect(command).not.toHaveProperty('scopeType');
    expect(command).not.toHaveProperty('typedValue');
    expect(command).not.toHaveProperty('expectedDefinitionVersion');
  });

  it('keeps malformed local time for authoritative validation and retains JSON null', () => {
    expect(canonicalInstantFormValue('not-a-time')).toBe('not-a-time');
    expect(canonicalInstantFormValue('')).toBeNull();
    expect(
      sanitizeConfigurationValue({ optional: null, secretToken: 'redact' }),
    ).toEqual({ optional: null });
  });

  it('[P2-S07-AC-161] accepts only the exact command response union', () => {
    const response = {
      reviewId: ID,
      candidateValueVersionId: '018f0c45-73fe-7dc2-9c09-68f7ecf132db',
      definitionId: ID,
      definitionVersion: VERSION,
      state: 'draft',
      valueHash: HASH,
      impactManifestHash: HASH,
      effectivePreview: true,
      rollbackAvailable: true,
      submittedAt: effective.evaluatedAt,
    };
    expect(parseConfigurationCommandResponse(response, 'CFG-05A-03')).toEqual(
      response,
    );
    expect(
      parseConfigurationCommandResponse(
        { ...response, unexpected: true },
        'CFG-05A-03',
      ),
    ).toBeNull();
    expect(
      Cfg05a02EffectiveValueResponseSchema.safeParse(effective).success,
    ).toBe(true);
  });

  it('renders a server-shaped workbench with semantic selection and action fields', () => {
    const markup = renderToStaticMarkup(
      React.createElement(SettingsFlagsRuntimeWorkbench, {
        contractFields: {
          source: '05a-settings-flags-runtime.md',
          fields: { Cfg05a02EffectiveValueResponse: ['key', 'typedValue'] },
        },
        variant: 'adminStepUp',
        initial: {
          status: 'success',
          data: [record],
          version: VERSION,
          stale: false,
        },
        actorId: ID,
        actingPartyId: ID,
        access: 'full',
        query: { key: 'web.theme' },
        selectedId: ID,
        expectedVersion: VERSION,
        csrfToken: 'csrf',
        requestId: 'request',
      }),
    );
    expect(markup).toContain('data-workbench="settings-flags-runtime"');
    expect(markup).toContain(
      '<caption>Settings and flags runtime records</caption>',
    );
    expect(markup).toContain('RecordHeader');
    expect(markup).toContain('ProvenanceFact');
    expect(markup).toContain('expectedDefinitionVersion');
  });

  it('does not render protected configuration labels for a hidden access variant', () => {
    const markup = renderToStaticMarkup(
      React.createElement(SettingsFlagsRuntimeWorkbench, {
        contractFields: { source: '05a-settings-flags-runtime.md', fields: {} },
        variant: 'forbiddenHidden',
        initial: { status: 'empty', reason: 'not-disclosed', data: [] },
        actorId: null,
        actingPartyId: null,
        access: 'not-rendered',
        query: {},
        selectedId: null,
        expectedVersion: null,
        csrfToken: '',
        requestId: 'request',
      }),
    );
    expect(markup).toContain('not disclosed');
    expect(markup).not.toContain('Settings and flags runtime');
  });

  it('keeps a bounded table usable when the server returns more than one window', () => {
    const markup = renderToStaticMarkup(
      React.createElement(DataTable, {
        columns: [{ key: 'key', label: 'Configuration key' }],
        rows: Array.from({ length: 101 }, (_, index) => ({
          id: String(index),
          key: `key-${index}`,
        })),
        selection: { selectedId: null },
      }),
    );
    expect(markup).toContain('Showing the first 100 records');
    expect(markup).toContain('Configuration records on narrow screens');
  });

  it('renders named labels and server metadata on the propose form', () => {
    const markup = renderToStaticMarkup(
      React.createElement(ProposeChangeForm, {
        definitionId: ID,
        expectedVersion: VERSION,
        csrfToken: 'csrf',
        idempotencyKey: 'configuration-operation',
      }),
    );
    expect(markup).toContain('id="platform-configuration-propose-change-form"');
    expect(markup).toContain('name="expectedDefinitionVersion"');
    expect(markup).toContain('for="typedValue"');
    expect(markup).toContain(
      'The browser converts this local time to an API instant.',
    );
  });

  it('[P2-S07-AC-136, P2-S07-AC-167, P2-S07-AC-171] retains bounded field violations while redacting diagnostics', async () => {
    const parsed = await parsePlatformConfigurationError(
      new Response(
        JSON.stringify({
          code: 'VALIDATION_FAILED',
          message: 'Check the highlighted fields.',
          requestId: ID,
          details: {
            violations: [
              {
                path: '/typedValue',
                code: 'invalid_json',
                message: 'Enter valid JSON.',
              },
            ],
            retryAfterSeconds: 30,
            privateToken: 'must-not-render',
          },
        }),
        {
          status: 422,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    expect(parsed).toEqual({
      code: 'VALIDATION_FAILED',
      message: 'Check the highlighted fields.',
      requestId: ID,
      details: {
        violations: [
          {
            path: '/typedValue',
            code: 'invalid_json',
            message: 'Enter valid JSON.',
          },
        ],
        retryAfterSeconds: 30,
      },
    });
    expect(JSON.stringify(parsed)).not.toContain('must-not-render');
  });
});
