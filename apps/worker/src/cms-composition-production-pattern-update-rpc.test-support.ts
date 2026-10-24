import { vi } from 'vitest';

import type {
  CmsEditorialProductionConfiguration,
  CmsEditorialServerSessionContext,
} from './cms-editorial-production-types';
import {
  puId,
  PU_PARTY_ID,
  PU_USER_ID,
} from './cms-composition/pattern-update.test-support';

export const URL_ = 'https://api.example.test/api/v1/cms/patterns/selector';
export const context = (
  overrides: Partial<CmsEditorialServerSessionContext> = {},
): CmsEditorialServerSessionContext => ({
  authUserId: PU_USER_ID,
  sessionId: puId(7),
  actorPersonId: puId(8),
  actingPartyId: PU_PARTY_ID,
  stepUpAt: null,
  ...overrides,
});
export const configuration = (
  fetchImpl: typeof fetch = vi.fn(),
  maxResponseBytes = 524_288,
): CmsEditorialProductionConfiguration => ({
  baseUrl: 'https://supabase.example.test',
  secret: 'sb_secret_test_only',
  fetchImpl,
  maxResponseBytes,
  now: () => Date.parse('2026-10-15T08:00:00Z'),
});
