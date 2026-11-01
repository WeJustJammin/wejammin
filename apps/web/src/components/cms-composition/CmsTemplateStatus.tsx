import * as React from 'react';
import type { TemplateVersionResource } from '@wejammin/contracts';

import CmsEditorialCapabilityGate from '../cms-editorial/CmsEditorialCapabilityGate';
import { PATTERN_REFUSAL_COPY } from '../cms-pattern-designer/pattern-designer-reasons';
import {
  KEY_RESERVED_REASON,
  type CmsTemplateSubmitResult,
} from './cms-template-designer-submit';
import { CMS_TEMPLATE_RESULT_HEADING_ID } from './cms-template-result-focus';

export type CmsTemplateFormStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'validation'; readonly message: string }
  | { readonly kind: 'pending' }
  | { readonly kind: 'created'; readonly resource: TemplateVersionResource }
  | {
      readonly kind: 'result';
      readonly result: Exclude<CmsTemplateSubmitResult, { kind: 'created' }>;
    };

/** The fixed copy of the 422 `key_reserved` refusal: shown at the key field and in the summary. */
export const KEY_RESERVED_COPY =
  'This template key is reserved. Choose another key.';

/** The key field's own message, or null when the last answer did not refuse the key. */
export const templateKeyError = (
  status: CmsTemplateFormStatus,
): string | null =>
  status.kind === 'result' &&
  status.result.kind === 'rejected' &&
  status.result.reasonCode === KEY_RESERVED_REASON
    ? KEY_RESERVED_COPY
    : null;

const statusCopy = (
  result: Exclude<CmsTemplateSubmitResult, { kind: 'created' }>,
  mode: 'create' | 'successor',
): string => {
  if (result.kind === 'uncertain')
    return mode === 'successor'
      ? 'The result is unknown. Check the latest version before retrying; these unchanged values will reuse the same idempotency key.'
      : 'The result is unknown. Check for an existing draft before retrying; a retry of these unchanged values will reuse the same idempotency key.';
  // FE03 names no template-designer copy for the CMS-03C-01 token; the pattern designer's fixed copy for the same token
  // (FE03 line 883, CMS-03C-12 row) applies. Never taken from the response.
  if (result.kind === 'conflict' && result.reasonCode !== undefined)
    return PATTERN_REFUSAL_COPY[result.reasonCode];
  if (result.kind === 'conflict')
    return mode === 'successor'
      ? 'The server reported a conflict. Check the latest version and explicitly reconcile your unsent values before another submit.'
      : 'The server reported a conflict. Review the existing template and refresh before making a different change.';
  switch (result.status) {
    case 401:
      return 'Your session expired. Sign in again before submitting.';
    case 403:
      return 'Template designer access is required for this acting context.';
    case 404:
      return 'This template is unavailable to the current acting context.';
    case 429:
      return result.retryAfterSeconds === undefined
        ? 'The request was rate-limited. Wait before retrying.'
        : `The request was rate-limited. Wait at least ${result.retryAfterSeconds} seconds before retrying.`;
    case 422:
      return result.reasonCode === KEY_RESERVED_REASON
        ? KEY_RESERVED_COPY
        : 'The server rejected the draft values. Review the form and try again.';
    case 400:
    case 415:
      return 'The server rejected the draft values. Review the form and try again.';
    default:
      return 'The template service is unavailable. Your form values remain here for a later retry.';
  }
};

/**
 * FE03 1048: a 403 renders the CapabilityGate copy (never a step-up route). The gate's heading is not the named result
 * heading: a refusal keeps focus on the summary region (CMS-11 row, "focus summary/field").
 */
const isCapabilityDenial = (
  result: Exclude<CmsTemplateSubmitResult, { kind: 'created' }>,
): boolean => result.kind === 'rejected' && result.status === 403;

interface Props {
  readonly status: CmsTemplateFormStatus;
  readonly summaryRef: React.Ref<HTMLDivElement>;
  readonly mode?: 'create' | 'successor';
  readonly returnTo?: string;
  /** The version a successor was based on: the provenance of a verified success (FE03 CMS-11), else omitted. */
  readonly parentVersion?: string;
}

export default function CmsTemplateStatus({
  status,
  summaryRef,
  mode = 'create',
  returnTo = '/app/cms-content-modeling/templates/new',
  parentVersion,
}: Props): React.ReactElement {
  return (
    <div
      ref={summaryRef}
      className="cms-template-designer-status"
      role={
        status.kind === 'result' || status.kind === 'validation'
          ? 'alert'
          : 'status'
      }
      aria-live="polite"
      tabIndex={-1}
    >
      {status.kind === 'validation' ? status.message : null}
      {status.kind === 'pending'
        ? mode === 'successor'
          ? 'Saving successor draft…'
          : 'Creating the draft…'
        : null}
      {status.kind === 'result' && !isCapabilityDenial(status.result)
        ? statusCopy(status.result, mode)
        : null}
      {templateKeyError(status) === null ? null : (
        <>
          {' '}
          <a href="#cms-template-key">Template key</a>
        </>
      )}
      {status.kind === 'result' && isCapabilityDenial(status.result) ? (
        <CmsEditorialCapabilityGate
          headingId="cms-template-gate-heading"
          title="Not available to you"
          reason={statusCopy(status.result, mode)}
        />
      ) : null}
      {status.kind === 'created' ? (
        <>
          <h3 id={CMS_TEMPLATE_RESULT_HEADING_ID} tabIndex={-1}>
            {mode === 'successor' ? 'Draft version saved.' : 'Draft created.'}
          </h3>
          Template ID {status.resource.id}, version {status.resource.version}
          {parentVersion === undefined
            ? null
            : `, based on version ${parentVersion}`}
          . This is not a published template.{' '}
          <a
            href={`/app/cms-content-modeling/templates/${encodeURIComponent(status.resource.templateKey)}`}
          >
            Open latest draft
          </a>
        </>
      ) : null}
      {status.kind === 'result' &&
      status.result.kind === 'rejected' &&
      status.result.status === 401 ? (
        <a href={`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`}>
          Sign in
        </a>
      ) : null}
    </div>
  );
}
