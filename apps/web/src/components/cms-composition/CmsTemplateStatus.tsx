import * as React from 'react';
import type { TemplateVersionResource } from '@wejammin/contracts';

import type { CmsTemplateSubmitResult } from './cms-template-designer-submit';

export type CmsTemplateFormStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'validation'; readonly message: string }
  | { readonly kind: 'pending' }
  | { readonly kind: 'created'; readonly resource: TemplateVersionResource }
  | {
      readonly kind: 'result';
      readonly result: Exclude<CmsTemplateSubmitResult, { kind: 'created' }>;
    };

const statusCopy = (
  result: Exclude<CmsTemplateSubmitResult, { kind: 'created' }>,
  mode: 'create' | 'successor',
): string => {
  if (result.kind === 'uncertain')
    return mode === 'successor'
      ? 'The result is unknown. Check the latest version before retrying; these unchanged values will reuse the same idempotency key.'
      : 'The result is unknown. Check for an existing draft before retrying; a retry of these unchanged values will reuse the same idempotency key.';
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
    case 400:
    case 415:
    case 422:
      return 'The server rejected the draft values. Review the form and try again.';
    default:
      return 'The template service is unavailable. Your form values remain here for a later retry.';
  }
};

interface Props {
  readonly status: CmsTemplateFormStatus;
  readonly summaryRef: React.Ref<HTMLDivElement>;
  readonly mode?: 'create' | 'successor';
  readonly returnTo?: string;
}

export default function CmsTemplateStatus({
  status,
  summaryRef,
  mode = 'create',
  returnTo = '/app/cms-content-modeling/templates/new',
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
      {status.kind === 'result' ? statusCopy(status.result, mode) : null}
      {status.kind === 'created' ? (
        <>
          <strong>
            {mode === 'successor' ? 'Draft version saved.' : 'Draft created.'}
          </strong>{' '}
          Template ID {status.resource.id}, version {status.resource.version}.
          This is not a published template.{' '}
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
