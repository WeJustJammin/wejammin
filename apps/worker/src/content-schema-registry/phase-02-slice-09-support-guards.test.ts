/**
 * The Slice 09 evidence harness fails loudly on an unknown operation, an
 * unexpected RPC or a missing header value instead of silently proving
 * nothing. These tests pin those guards.
 */
import { describe, expect, it } from 'vitest';

import {
  EVIDENCE_OPS,
  opFor,
} from './phase-02-slice-09-be03a-evidence-support';
import {
  makeDec108Harness,
  requestFor as dec108RequestFor,
  sessionResult,
  specFor as dec108SpecFor,
} from './phase-02-slice-09-dec108-test-support';
import { grantSpecFor } from './phase-02-slice-09-grants-test-support';
import {
  authRateModel,
  composeProduction,
} from './phase-02-slice-09-r2-support';
import { CMS_SCHEMA_REGISTRY_RPC } from './production';
import { environment, options, rpcName } from './production-test-support';
import { rpcName as privateContextRpcName } from './production-private-context-test-support';

describe('operation lookup guards', () => {
  it('throws for an operation outside the evidence matrices', () => {
    expect(() => opFor('CMS-03A-99' as never)).toThrow(
      'Unknown operation CMS-03A-99',
    );
    expect(() => dec108SpecFor('CMS-03A-99' as never)).toThrow(
      'Unknown operation CMS-03A-99',
    );
    expect(() => grantSpecFor('CMS-03A-99' as never)).toThrow(
      'Unknown operation CMS-03A-99',
    );
  });

  it('resolves each declared operation to itself', () => {
    for (const op of EVIDENCE_OPS) {
      expect(opFor(op.operationId).operationId).toBe(op.operationId);
    }
  });
});

describe('DEC-108 request builder', () => {
  it('applies a non-null header override and drops a null one', () => {
    const spec = dec108SpecFor('CMS-03A-09');
    const request = dec108RequestFor(spec, {
      headers: { 'x-extra': 'present', authorization: null },
    });
    expect(request.headers.get('x-extra')).toBe('present');
    expect(request.headers.has('authorization')).toBe(false);
  });

  it('omits If-Match for a mutation that does not require it', () => {
    const spec = dec108SpecFor('CMS-03A-09');
    expect(dec108RequestFor(spec).headers.get('if-match')).toBe('"1"');
    expect(
      dec108RequestFor({ ...spec, ifMatch: false }).headers.has('if-match'),
    ).toBe(false);
  });

  it('builds a harness whose session resolves for the spec', async () => {
    const spec = dec108SpecFor('CMS-03A-09');
    const harness = makeDec108Harness({ session: sessionResult(spec) });
    const resolve = harness.resolveSession as unknown as () => Promise<{
      ok: boolean;
    }>;
    expect((await resolve()).ok).toBe(true);
  });
});

describe('R2 harness', () => {
  const op = EVIDENCE_OPS[0]!;
  const rpcUrl = (rpc: string) =>
    `https://supabase.example.test/rest/v1/rpc/${rpc}`;

  it('rejects an RPC other than the limiter on the rate model', () => {
    const model = authRateModel(() => 1_788_345_600);
    expect(() =>
      model.handler('cms_other', {}, new AbortController().signal),
    ).toThrow('unexpected rpc cms_other');
  });

  it('answers the operation RPC with its success output when called bare', async () => {
    const harness = composeProduction(op);
    const rpc =
      CMS_SCHEMA_REGISTRY_RPC[
        op.portName as keyof typeof CMS_SCHEMA_REGISTRY_RPC
      ];
    const response = await harness.fetchImpl(rpcUrl(rpc));
    expect(await response.json()).toEqual(op.output);
    expect(harness.rpcCalls.at(-1)).toEqual({ rpc, body: {} });
  });

  it('answers a bare limiter call through the rate model', async () => {
    const harness = composeProduction(op);
    const response = await harness.fetchImpl(rpcUrl('auth_rate_limit'));
    expect(response.status).toBe(200);
  });

  it('refuses an RPC the operation does not declare', async () => {
    const harness = composeProduction(op);
    await expect(harness.fetchImpl(rpcUrl('cms_unknown'))).rejects.toThrow(
      'unexpected rpc cms_unknown',
    );
  });
});

describe('production test support defaults', () => {
  it('names the RPC from the last path segment', () => {
    const url = 'https://supabase.example.test/rest/v1/rpc/cms_read';
    expect(rpcName(url)).toBe('cms_read');
    expect(privateContextRpcName(url)).toBe('cms_read');
    expect(rpcName(new URL(`${url}/`))).toBe('');
  });

  it('defaults release verification and rate limiting to an allowed decision', async () => {
    const defaults = options(fetch);
    expect(await defaults.verifyRelease()).toMatchObject({ ok: true });
    expect(await defaults.rateLimit()).toMatchObject({
      ok: true,
      value: { allowed: true },
    });
    expect(defaults.environment).toBe(environment);
  });
});
