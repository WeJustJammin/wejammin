import * as React from '../../apps/web/node_modules/react/index.js';
import { renderToStaticMarkup } from '../../apps/web/node_modules/react-dom/server.node.js';
import { describe, expect, it, vi } from 'vitest';

import ProviderEvidencePanel from '../../apps/web/src/components/infrastructure/provider-evidence/ProviderEvidencePanel';
import {
  createCanonicalEvidenceInvalidationHandler,
  createProviderEvidenceProjection,
  EVIDENCE_RETRY_DELAYS_MS,
  evidenceRetryDelayForAttempt,
  getProviderEvidenceErrorPresentation,
  isProductionProviderEnabled,
  PRODUCTION_PROVIDER_REGISTRY,
  providerEvidenceListHref,
  providerOperationHref,
  serializeProviderEvidenceState,
  type ProviderEvidenceFilters,
  type ProviderEvidenceProjection,
  type ProviderEvidenceState,
} from '../../apps/web/src/components/infrastructure/provider-evidence/provider-evidence-state';

const OPERATION_ID = '22222222-2222-4222-8222-222222222222';
const RECEIPT_ID = '33333333-3333-4333-8333-333333333333';
const TIMESTAMP = '2026-08-30T12:15:00.000Z';
const DIGEST = 'a'.repeat(64);
const filters: ProviderEvidenceFilters = {
  provider: 'local',
  state: 'pending',
};

const projectionInput = {
  operation: {
    id: OPERATION_ID,
    provider: 'local',
    operationType: 'email.send',
    state: 'pending',
    payloadDigest: DIGEST,
    version: '3',
  },
  receipt: {
    id: RECEIPT_ID,
    provider: 'local',
    state: 'accepted',
    payloadDigest: DIGEST,
    signatureVerifiedAt: TIMESTAMP,
    receivedAt: TIMESTAMP,
    operationId: OPERATION_ID,
    externalEventPresent: true,
  },
  provenance: {
    source: 'webhook-reconciliation',
    observedAt: TIMESTAMP,
    lastVerifiedAt: TIMESTAMP,
  },
  scope: {
    kind: 'case' as const,
    label: 'Case-scoped evidence',
  },
};

const projection = (
  scopeKind: 'case' | 'capability' = 'case',
): ProviderEvidenceProjection =>
  createProviderEvidenceProjection({
    ...projectionInput,
    scope: {
      ...projectionInput.scope,
      kind: scopeKind,
      label:
        scopeKind === 'case'
          ? 'Case-scoped evidence'
          : 'Capability-scoped evidence',
    },
  });

const successState = (
  scopeKind: 'case' | 'capability' = 'case',
): ProviderEvidenceState => ({
  status: 'success',
  filters,
  evidence: projection(scopeKind),
});

describe('Slice 06 provider and webhook evidence web surface', () => {
  it('P1-S06-AC-042..043 renders only server-selected staff/admin read-only capability variants', () => {
    const staff = renderToStaticMarkup(
      React.createElement(ProviderEvidencePanel, {
        access: 'staff-case-scoped',
        state: successState(),
      }),
    );
    const admin = renderToStaticMarkup(
      React.createElement(ProviderEvidencePanel, {
        access: 'admin-capability-scoped',
        state: successState('capability'),
      }),
    );
    const hidden = renderToStaticMarkup(
      React.createElement(ProviderEvidencePanel, {
        access: 'not-rendered',
        state: successState(),
      }),
    );
    const mismatched = renderToStaticMarkup(
      React.createElement(ProviderEvidencePanel, {
        access: 'admin-capability-scoped',
        state: successState(),
      }),
    );
    expect(staff).toContain('Staff case-scoped read-only evidence');
    expect(admin).toContain('Admin capability-scoped read-only evidence');
    expect(hidden).toBe('');
    expect(hidden).not.toContain(OPERATION_ID);
    expect(mismatched).toContain('Evidence scope could not be confirmed.');
    expect(mismatched).not.toContain(OPERATION_ID);
  });

  it('P1-S06-AC-044..045 keeps operation deep links canonical and Back replay-free', () => {
    const href = providerOperationHref(OPERATION_ID);
    const markup = renderToStaticMarkup(
      React.createElement(ProviderEvidencePanel, {
        access: 'staff-case-scoped',
        state: successState(),
      }),
    );
    expect(href).toBe(
      `/app/infrastructure/provider-operations/${OPERATION_ID}`,
    );
    expect(href).not.toContain('payload');
    expect(href).not.toContain(DIGEST);
    expect(markup).toContain(
      'href="/app/infrastructure/provider-operations?provider=local&amp;state=pending"',
    );
    expect(markup).toContain('Back to evidence list');
    expect(markup).not.toContain('replay');
    expect(markup).not.toContain('send');
  });

  it('P1-S06-AC-046 exposes canonical multi-tab invalidation without an effect callback', async () => {
    const refetch = vi.fn(async () => undefined);
    const invalidate = createCanonicalEvidenceInvalidationHandler(refetch);
    await invalidate('multi-tab');
    expect(refetch).toHaveBeenCalledWith('multi-tab');
  });

  it('P1-S06-AC-047..048 announces evidence states while preserving focus and raw provider secrecy', () => {
    const pending = renderToStaticMarkup(
      React.createElement(ProviderEvidencePanel, {
        access: 'staff-case-scoped',
        state: successState(),
      }),
    );
    const error: ProviderEvidenceState = {
      status: 'error',
      filters,
      code: 'WEBHOOK_REJECTED',
      requestId: '44444444-4444-4444-8444-444444444444',
      retryable: false,
      attempt: 0,
    };
    const refused = renderToStaticMarkup(
      React.createElement(ProviderEvidencePanel, {
        access: 'staff-case-scoped',
        state: error,
      }),
    );
    expect(pending).toContain('aria-live="polite"');
    expect(pending).not.toContain('autofocus');
    expect(refused).toContain('WEBHOOK_REJECTED');
    expect(refused).toContain('44444444-4444-4444-8444-444444444444');
    expect(refused).not.toContain('rawPayload');
    expect(refused).not.toContain('providerSecret');

    const unsafeError = renderToStaticMarkup(
      React.createElement(ProviderEvidencePanel, {
        access: 'staff-case-scoped',
        state: {
          ...error,
          code: 'provider-secret-detail',
          requestId: 'provider-request-secret',
        },
      }),
    );
    expect(unsafeError).toContain('INTERNAL_ERROR');
    expect(unsafeError).not.toContain('provider-secret-detail');
    expect(unsafeError).not.toContain('provider-request-secret');
  });

  it('P1-S06-AC-049..050 obeys Retry-After and bounds safe canonical retries', () => {
    expect(EVIDENCE_RETRY_DELAYS_MS).toEqual([250, 750]);
    expect(evidenceRetryDelayForAttempt(0)).toBe(250);
    expect(evidenceRetryDelayForAttempt(1)).toBe(750);
    expect(evidenceRetryDelayForAttempt(2)).toBeNull();
    const rateLimited: ProviderEvidenceState = {
      status: 'error',
      filters,
      code: 'RATE_LIMITED',
      requestId: '44444444-4444-4444-8444-444444444444',
      retryAfterSeconds: 12,
      retryable: true,
      attempt: 0,
    };
    const markup = renderToStaticMarkup(
      React.createElement(ProviderEvidencePanel, {
        access: 'staff-case-scoped',
        state: rateLimited,
      }),
    );
    expect(markup).toContain('Retry available in 12 seconds');
    expect(markup).not.toContain('provider effect');
  });

  it('P1-S06-AC-051 retains last verified evidence in degraded state', () => {
    const degraded: ProviderEvidenceState = {
      status: 'degraded',
      filters,
      evidence: projection(),
      requestId: '44444444-4444-4444-8444-444444444444',
      lastVerifiedAt: TIMESTAMP,
      scope: 'case-scoped provider evidence',
    };
    const markup = renderToStaticMarkup(
      React.createElement(ProviderEvidencePanel, {
        access: 'staff-case-scoped',
        state: degraded,
      }),
    );
    const mismatchedMarkup = renderToStaticMarkup(
      React.createElement(ProviderEvidencePanel, {
        access: 'admin-capability-scoped',
        state: degraded,
      }),
    );
    expect(markup).toContain('Degraded');
    expect(markup).toContain('Last verified');
    expect(markup).toContain(TIMESTAMP);
    expect(markup).toContain(OPERATION_ID);
    expect(mismatchedMarkup).toContain(
      'Last verified evidence scope could not be confirmed.',
    );
    expect(mismatchedMarkup).not.toContain(OPERATION_ID);
  });

  it('P1-S06-AC-052..055 maps loading/success fields and production providers truthfully', () => {
    const loading: ProviderEvidenceState = { status: 'loading', filters };
    const loadingMarkup = renderToStaticMarkup(
      React.createElement(ProviderEvidencePanel, {
        access: 'admin-capability-scoped',
        state: loading,
      }),
    );
    const successMarkup = renderToStaticMarkup(
      React.createElement(ProviderEvidencePanel, {
        access: 'admin-capability-scoped',
        state: successState('capability'),
      }),
    );
    const manualReviewMarkup = renderToStaticMarkup(
      React.createElement(ProviderEvidencePanel, {
        access: 'admin-capability-scoped',
        state: {
          status: 'success',
          filters,
          evidence: createProviderEvidenceProjection({
            ...projectionInput,
            receipt: { ...projectionInput.receipt, state: 'manual_review' },
            scope: { ...projectionInput.scope, kind: 'capability' },
          }),
        },
      }),
    );
    expect(loadingMarkup).toContain('Loading canonical provider evidence');
    expect(successMarkup).toContain('Payload digest');
    expect(successMarkup).toContain(DIGEST);
    expect(successMarkup).toContain('Webhook receipt');
    expect(manualReviewMarkup).toContain('Manual review required');
    expect(successMarkup).not.toContain('providerRef');
    expect(successMarkup).not.toContain('externalEventId');
    expect(PRODUCTION_PROVIDER_REGISTRY).toEqual([]);
    expect(isProductionProviderEnabled('local')).toBe(false);
    expect(successMarkup).toContain('Production provider effects are disabled');
  });

  it('P1-S06-AC-056 gives every known provider/webhook error a deterministic safe owner', () => {
    const codes = [
      'INVALID_REQUEST',
      'VALIDATION_FAILED',
      'UNAUTHENTICATED',
      'SESSION_EXPIRED',
      'FORBIDDEN',
      'CAPABILITY_REQUIRED',
      'STEP_UP_REQUIRED',
      'AUTHORITY_REQUIRED',
      'FOREIGN_AUTHORITY',
      'AUDIT_REASON_REQUIRED',
      'NOT_FOUND',
      'CONFLICT',
      'VERSION_MISMATCH',
      'IDEMPOTENCY_MISMATCH',
      'RATE_LIMITED',
      'PAYLOAD_TOO_LARGE',
      'UNSUPPORTED_MEDIA_TYPE',
      'WEBHOOK_REJECTED',
      'OBJECT_VERIFICATION_FAILED',
      'VERIFY_FAILED',
      'ORIGIN_CSRF_REQUIRED',
      'BROWSER_SECURITY_REJECTED',
      'DEPENDENCY_UNAVAILABLE',
      'HANDLER_UNAVAILABLE',
      'INTERNAL_ERROR',
      'UNKNOWN_CONTRACT_CODE',
    ];
    for (const code of codes) {
      const result = getProviderEvidenceErrorPresentation(code);
      expect([
        'inline',
        'capability',
        'step-up',
        'rate-wait',
        'degraded',
      ]).toContain(result.owner);
      expect(result.message).not.toContain(code);
    }
  });

  it('rejects raw payload/provider fields and persists only the safe evidence projection', () => {
    expect(() =>
      createProviderEvidenceProjection({
        ...projectionInput,
        operation: { ...projectionInput.operation, payload: 'never-copy' },
      }),
    ).toThrow('Invalid provider evidence fields');
    expect(() =>
      createProviderEvidenceProjection({
        ...projectionInput,
        receipt: {
          ...projectionInput.receipt,
          externalEventId: 'raw-provider-reference',
        },
      }),
    ).toThrow('Invalid provider evidence fields');
    const serialized = serializeProviderEvidenceState(successState());
    expect(serialized).toContain(DIGEST);
    expect(serialized).not.toContain('"payload":');
    expect(serialized).not.toContain('never-copy');
    expect(serialized).not.toContain('providerSecret');

    const unsafeEvidence = {
      ...projection(),
      operation: {
        ...projection().operation,
        actorId: 'actor-secret',
        payload: 'never-copy',
        providerRef: 'provider-secret',
      },
      receipt: {
        ...projection().receipt!,
        externalEventId: 'external-secret',
      },
    } as unknown as ProviderEvidenceProjection;
    const unsafeState = {
      status: 'success',
      filters,
      evidence: unsafeEvidence,
    } as unknown as ProviderEvidenceState;
    const sanitized = serializeProviderEvidenceState(unsafeState);
    expect(sanitized).not.toContain('actor-secret');
    expect(sanitized).not.toContain('never-copy');
    expect(sanitized).not.toContain('provider-secret');
    expect(sanitized).not.toContain('external-secret');
  });

  it('renders disabled capability access without protected operation evidence', () => {
    const state: ProviderEvidenceState = {
      status: 'disabled',
      filters,
      reason: 'An explicit case or operation capability is required.',
    };
    const markup = renderToStaticMarkup(
      React.createElement(ProviderEvidencePanel, {
        access: 'disabled',
        state,
      }),
    );
    expect(markup).toContain('Action unavailable');
    expect(markup).toContain('explicit case or operation capability');
    expect(markup).not.toContain(OPERATION_ID);
  });

  it('builds a bounded evidence-list URL from allowlisted filters only', () => {
    expect(providerEvidenceListHref(filters)).toBe(
      '/app/infrastructure/provider-operations?provider=local&state=pending',
    );
    expect(
      providerEvidenceListHref({ provider: 'raw/payload', state: null }),
    ).toBe('/app/infrastructure/provider-operations');
  });
});
