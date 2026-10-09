import { createHash } from 'node:crypto';
import { expect } from 'vitest';
import {
  PreviewTokenResourceSchema,
  PreviewVerificationResultSchema,
} from '@wejammin/contracts';
import { parseInstant } from '@wejammin/contracts/time-authority';

import { createPreviewTokenVerifier } from '../../../apps/worker/src/cms-editorial-production-preview-verifier';
import {
  EFFECT_TABLES,
  expectSafeEqual,
  expectStatus,
  type EffectSnapshot,
} from './phase-02-slice-11-assert';
import type { ReviewedDraft } from './phase-02-slice-11-flow';
import {
  canonicalHash,
  expectOnlyAppends,
} from './phase-02-slice-11-publish-support';
import type { S11Actor, S11Response } from './phase-02-slice-11-stack';
import { API_URL, psql, workerServiceCredential } from './stack';

export const previewBody = (
  draft: ReviewedDraft,
  over: Readonly<Record<string, unknown>> = {},
) => ({
  entryId: draft.entryId,
  revisionId: draft.revisionId,
  locale: 'en-US',
  audience: 'public',
  route: '/preview/article',
  versionSet: draft.versionSet,
  ...over,
});

export const entryVersion = (draft: ReviewedDraft): string =>
  psql(
    `select version from platform_private.cms_content_entries where id = '${draft.entryId}'`,
  );

export const parsePreview = (response: S11Response) => {
  expectStatus(response, 201);
  const parsed = PreviewTokenResourceSchema.safeParse(response.body);
  if (!parsed.success) throw new Error('invalid strict preview resource');
  return parsed.data;
};

export const previewHash = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export const verificationBinding = (
  preview: ReturnType<typeof parsePreview>,
  actor: S11Actor,
) => ({
  token: preview.token,
  actorPersonId: actor.personId,
  actingContextVersion:
    psql(`select platform_private.cms_acting_context_version(
    '${actor.personId}', '${actor.organizationId}')`),
  route: preview.route,
  locale: preview.locale,
  audience: preview.audience,
});

export const createRealVerifier = (fetchImpl?: typeof fetch) =>
  createPreviewTokenVerifier({
    environment: {
      SUPABASE_URL: API_URL,
      SUPABASE_SECRET_KEY: workerServiceCredential(),
    },
    ...(fetchImpl === undefined ? {} : { fetchImpl }),
  });

export const strictVerification = (value: unknown) => {
  const parsed = PreviewVerificationResultSchema.safeParse(value);
  if (!parsed.success)
    throw new Error('invalid strict preview verification resource');
  return parsed.data;
};

/** Independent literal denial: every detail is present and exactly null. */
export const expectDeniedPreview = (value: unknown, revoked = false): void => {
  expectSafeEqual(
    strictVerification(value),
    {
      valid: false,
      userId: null,
      entryId: null,
      revisionId: null,
      exactVersionSet: null,
      expiresAt: null,
      revoked,
    },
    'complete non-disclosing preview denial',
  );
};

export const expectPreviewStored = (
  preview: ReturnType<typeof parsePreview>,
  actor: S11Actor,
): string => {
  const hash = previewHash(preview.token);
  // Only timestamps, token row identity and booleans leave SQL. No secret key or
  // plaintext token is selected; the stored hash is compared with the adapter's hash.
  const row = JSON.parse(
    psql(`select jsonb_build_object(
    'id', t.id, 'createdAt', platform_private.auth_iso_time(t.created_at),
    'expiresAt', platform_private.auth_iso_time(t.expires_at),
    'exactLifetime', extract(epoch from (t.expires_at - t.created_at)) = 900,
    'binding', t.user_id = '${actor.authUserId}' and t.person_id = '${actor.personId}'
      and t.acting_party_id = '${actor.organizationId}' and t.entry_id = '${preview.entryId}'
      and t.revision_id = '${preview.revisionId}' and t.state = 'active'
      and t.revoked_at is null and t.version = 1
      and platform_private.cms_jcs_sha256(t.version_set) = '${canonicalHash(preview.versionSet)}'
      and encode(sha256(convert_to(t.route, 'utf8')), 'hex') = '${previewHash(preview.route)}'
      and encode(sha256(convert_to(t.locale, 'utf8')), 'hex') = '${previewHash(preview.locale)}'
      and encode(sha256(convert_to(t.audience, 'utf8')), 'hex') = '${previewHash(preview.audience)}'
      and t.capability_snapshot_hash = platform_private.cms_acting_context_version(
        '${actor.personId}', '${actor.organizationId}'),
    'hashOnly', not (to_jsonb(t) ? 'token'))
    from platform_private.cms_preview_tokens t where t.token_hash = '${hash}'`),
  ) as {
    id: string;
    createdAt: string;
    expiresAt: string;
    binding: boolean;
    hashOnly: boolean;
    exactLifetime: boolean;
  };
  expect(row.binding, 'stored person/user/acting/revision binding').toBe(true);
  expect(row.hashOnly, 'preview row has no plaintext token column').toBe(true);
  expect(
    row.exactLifetime,
    'stored lifetime is exactly 900 seconds without timestamp truncation',
  ).toBe(true);
  expect(
    /^[A-Za-z0-9_-]{43}$/u.test(preview.token),
    'derived token grammar',
  ).toBe(true);
  const created = parseInstant(row.createdAt);
  const expires = parseInstant(row.expiresAt);
  if (created === null || expires === null)
    throw new Error('invalid persisted preview instant');
  expect(expires.seconds - created.seconds).toBe(900);
  expect(expires.nanos).toBe(created.nanos);
  expectSafeEqual(
    preview.expiresAt,
    row.expiresAt,
    'resource carries stored expiry',
  );
  // Inspect every nested JSON string in every effect row by its hash. Neither
  // plaintext nor a reversible encoding of the bearer enters SQL diagnostics.
  const plaintextAbsent = psql(
    `select ${EFFECT_TABLES.map(
      (table) =>
        `not exists (select 1 from ${table} t,
      lateral jsonb_path_query(to_jsonb(t), '$.** ? (@.type() == "string")') s(value)
      where encode(sha256(convert_to(s.value #>> '{}', 'utf8')), 'hex') = '${hash}')`,
    ).join(' and ')}`,
  );
  expect(
    plaintextAbsent === 't',
    'plaintext absent from all fourteen persisted effect groups',
  ).toBe(true);
  return row.id;
};

export const expectPreviewAppend = (
  before: EffectSnapshot,
  tokenId: string,
  requestId: string,
): void =>
  expectOnlyAppends(before, {
    'platform_private.cms_preview_tokens': {
      predicate: `t.id = '${tokenId}'`,
      count: 1,
    },
    'platform_private.idempotency_records': {
      predicate: `t.operation = 'CMS-03B-08' and t.response_ref->>'resourceRef' = '${tokenId}'`,
      count: 1,
    },
    'audit_private.audit_events': {
      predicate: `t.target_id = '${tokenId}' and t.action = 'cms.preview.mint' and t.correlation_id = '${requestId}'`,
      count: 1,
    },
  });
