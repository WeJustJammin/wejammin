import { describe, expect, it } from 'vitest';

import {
  NOW,
  build,
  jwt,
  reference,
} from './phase-02-slice-09-expired-session.test-support';
import {
  opFor,
  requestFor,
  type EvidenceOperationId,
} from './phase-02-slice-09-be03a-evidence-support';
import {
  API_ORIGIN,
  CMS_ORIGIN,
  REQUEST_ID,
  TYPE_ID,
  VERSION_ID,
  validActivation,
} from './phase-02-slice-09-test-values';

/**
 * STEP_UP_REQUIRED for a missing, stale, future-dated or aal1 proof on every
 * CMS command that demands a recent step-up, through the production session
 * resolver (production authentication -> CMS session resolver -> app). The
 * proof is read from the verified access token (`aal` and the MFA `amr`
 * entry) and the sealed session reference exactly as BE01a defines it; no stub
 * answers `mfaFresh`. A refused request reserves nothing: no CMS RPC and no
 * rate bucket is reached.
 */
const SECOND = Math.floor(NOW / 1000);
const CSRF = 'csrf-token';
const CAPABILITIES = [
  'cms.schema_designer',
  'cms.schema_review',
  'cms.schema_review.assign',
];

type Proof = Readonly<{
  label: string;
  claims: Readonly<Record<string, unknown>>;
  sealedAt: string;
}>;

const instant = (offsetSeconds: number): string =>
  new Date(NOW + offsetSeconds * 1000).toISOString();
const mfa = (offsetSeconds: number) => [
  { method: 'totp', timestamp: SECOND + offsetSeconds },
];

/** The four refusal variants of the criteria; offsets are proofAt - now. */
const REFUSED: readonly Proof[] = [
  {
    label: 'missing (aal2 with no MFA amr entry)',
    claims: {
      aal: 'aal2',
      amr: [{ method: 'password', timestamp: SECOND - 30 }],
    },
    sealedAt: instant(-30),
  },
  {
    label: 'stale (601 s old)',
    claims: { aal: 'aal2', amr: mfa(-601) },
    sealedAt: instant(-601),
  },
  {
    label: 'future-dated (31 s ahead)',
    claims: { aal: 'aal2', amr: mfa(31) },
    sealedAt: instant(31),
  },
  {
    label: 'aal1 (an MFA amr entry on an aal1 token)',
    claims: { aal: 'aal1', amr: mfa(-60) },
    sealedAt: instant(-60),
  },
];
const FRESH: Proof = {
  label: 'fresh',
  claims: { aal: 'aal2', amr: mfa(-60) },
  sealedAt: instant(-60),
};

const versionPath = `/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}`;

type Case = Readonly<{
  label: string;
  criterion: number;
  request: (cookie: string) => Request;
}>;

const cookies = (cookie: string) => ({
  cookie: `${cookie}; wj_csrf=${CSRF}`,
  'x-csrf-token': CSRF,
});

const evidence = (id: EvidenceOperationId, criterion: number): Case => {
  const op = opFor(id);
  return {
    label: id,
    criterion,
    request: (cookie) =>
      requestFor(op, { headers: { authorization: null, ...cookies(cookie) } }),
  };
};

const CASES: readonly Case[] = [
  {
    label: 'CMS-03A-04',
    criterion: 628,
    request: (cookie) =>
      new Request(`${API_ORIGIN}${versionPath}/activate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: CMS_ORIGIN,
          'idempotency-key': 'cms-test-key-001',
          'if-match': '"1"',
          'x-request-id': REQUEST_ID,
          ...cookies(cookie),
        },
        body: JSON.stringify(validActivation),
      }),
  },
  evidence('CMS-03A-12', 441),
  evidence('CMS-03A-14', 503),
  evidence('CMS-03A-15', 545),
  evidence('CMS-03A-16', 574),
  evidence('CMS-03A-17', 602),
];

const cookieFor = async (proof: Proof): Promise<string> =>
  `wj_access=${jwt(proof.claims)}; wj_session_ref=${await reference(proof.sealedAt)}`;

const cmsCalls = (fetchImpl: ReturnType<typeof build>['fetchImpl']) =>
  fetchImpl.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes('/rpc/cms_') || url.includes('rate'));

describe('STEP_UP_REQUIRED for every unproven step-up variant (production session resolver)', () => {
  for (const { label, criterion, request } of CASES) {
    const marker = `[P2-S09-AC-${criterion}]`;
    for (const proof of REFUSED) {
      it(`${marker} ${label} a ${proof.label} proof is 401 STEP_UP_REQUIRED with exactly { recoveryAction: step_up, allowedMethods: [totp] } and reserves nothing`, async () => {
        const { app, fetchImpl } = build('valid', CAPABILITIES);
        const response = await app.request(request(await cookieFor(proof)));
        expect(response.status).toBe(401);
        expect(response.headers.get('cache-control')).toBe('no-store');
        const body = (await response.json()) as Record<string, unknown>;
        expect(body.code).toBe('STEP_UP_REQUIRED');
        expect(body.details).toStrictEqual({
          recoveryAction: 'step_up',
          allowedMethods: ['totp'],
        });
        expect(cmsCalls(fetchImpl)).toStrictEqual([]);
      });
    }

    it(`${marker} ${label} control: a fresh proof passes the step-up gate, so the refusals above are the proof`, async () => {
      const { app } = build('valid', CAPABILITIES);
      const response = await app.request(request(await cookieFor(FRESH)));
      const body = (await response.json()) as { code: string };
      expect(body.code).not.toBe('STEP_UP_REQUIRED');
      expect(body.code).not.toBe('UNAUTHENTICATED');
    });
  }
});
