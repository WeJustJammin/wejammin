/**
 * AC1182 for CMS-03A-09 through the real composition: the Worker cannot see the
 * inherited source and default locale, so a locale replacement is forwarded to
 * the database validator, whose ordered issue list reaches the wire intact. The
 * database stand-in evaluates the same exact-refusal table the SQL function
 * `cms_locale_config_violations` implements (refineLocaleConfig with a known
 * source and default), and answers with the PostgREST shape of a raised
 * exception.
 */
import { refineLocaleConfig } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  dbRefusal,
  idempotentDb,
  makeDbBackedHarness,
  type RpcCall,
} from './phase-02-slice-09-r8-db-harness';
import { opFor, requestFor } from './phase-02-slice-09-be03a-evidence-support';
import { json } from './production-test-support';
import { bodyOf } from './phase-02-slice-09-r2-support';

const op = opFor('CMS-03A-09');

/** The exact-refusal table evaluated with the inherited source and default. */
const databaseViolations = (
  call: RpcCall,
  source: string,
  inherited: string,
): readonly { pointer: string; message: string }[] => {
  const violations: { pointer: string; message: string }[] = [];
  const context = {
    addIssue: (issue: { path: (string | number)[]; message: string }) =>
      violations.push({
        pointer: `/${issue.path.map(String).join('/')}`,
        message: issue.message,
      }),
  };
  refineLocaleConfig(
    {
      sourceLocale: source,
      defaultLocale: inherited,
      supportedLocales: call.request.supportedLocales as string[],
      fallbackChains: call.request.fallbackChains as Record<string, string[]>,
    },
    context as never,
  );
  return violations;
};

const send = async (body: Record<string, unknown>) => {
  const database = idempotentDb((call) => {
    const violations = databaseViolations(call, 'en-US', 'en-US');
    return violations.length === 0
      ? json(op.output)
      : dbRefusal('VALIDATION_FAILED', { violations });
  });
  const harness = makeDbBackedHarness(op, database.behaviour);
  const response = await harness.app.request(
    requestFor(op, {
      body: { ...op.body, ...body },
      headers: { 'if-match': '"1"' },
    }),
  );
  return { response, calls: harness.calls() };
};

describe('CMS-03A-09 locale replacement is validated by the database (AC1182)', () => {
  it('[P2-S09-AC-1182] returns every locale-configuration issue of a request with several defects in table order, including the rules that need the inherited source and default', async () => {
    const { response, calls } = await send({
      supportedLocales: ['en-US', 'fr-fr', 'en-US'],
      fallbackChains: { 'es-ES': ['en-US'], 'en-US': ['fr-FR'] },
    });
    expect(response.status).toBe(422);
    const body = await bodyOf(response);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.details).toEqual({
      violations: [
        {
          path: '/supportedLocales/1',
          message: 'locale tag must be a canonical-case BCP 47 tag',
        },
        {
          path: '/supportedLocales/2',
          message: 'supportedLocales must be unique',
        },
        {
          path: '/fallbackChains/es-ES',
          message: 'fallbackChains key must be a supported locale',
        },
        {
          path: '/fallbackChains/en-US',
          message: 'defaultLocale must not have a fallback chain',
        },
        {
          path: '/fallbackChains',
          message:
            'every supported locale other than defaultLocale needs a fallback chain',
        },
      ],
    });
    expect(calls).toHaveLength(1);
  });

  it('[P2-S09-AC-1182] reports the Worker-owned pair issues of one request in table order when no inherited state is needed (locale pair, then workflow pair)', async () => {
    const { response, calls } = await send({
      supportedLocales: ['en-US', 'fr-FR'],
      fallbackChains: null,
      workflowKey: 'editorial.standard',
      workflowVersion: null,
    });
    expect(response.status).toBe(422);
    expect((await bodyOf(response)).details).toEqual({
      violations: [
        {
          path: '/fallbackChains',
          message:
            'supportedLocales and fallbackChains must be both null or both present',
        },
        {
          path: '/workflowVersion',
          message:
            'workflowKey and workflowVersion must be both null or both present',
        },
      ],
    });
    expect(calls).toHaveLength(0);
  });

  it('[P2-S09-AC-1182] forwards a locale replacement together with a Worker-detected workflow pair defect so the database can return all of them in order', async () => {
    const { calls } = await send({
      supportedLocales: ['en-US', 'fr-fr'],
      fallbackChains: { 'fr-fr': ['en-US'] },
      workflowKey: 'editorial.standard',
      workflowVersion: null,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.request.workflowKey).toBe('editorial.standard');
  });

  it('[P2-S09-AC-310] CMS-03A-09 reports the exact OD-4 locale message and pointer for a replacement with duplicated supported locales, as the database returns it', async () => {
    const { response } = await send({
      supportedLocales: ['en-US', 'en-US'],
      fallbackChains: { 'en-US': ['en-US'] },
    });
    expect(response.status).toBe(422);
    expect((await bodyOf(response)).details.violations).toContainEqual({
      path: '/supportedLocales/1',
      message: 'supportedLocales must be unique',
    });
  });
});
