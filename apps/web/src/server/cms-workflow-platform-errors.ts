import {
  CMS_SLICE_11_OPERATION_REASONS,
  CmsEditorialRefusalDetailsSchema,
  CmsPreflightUnavailableDetailsSchema,
  CmsStepUpRequiredDetailsSchema,
  cmsSlice11ReasonStatus,
} from '@wejammin/contracts';

import { isStepUpRequiredCode } from '../components/step-up-required';
import { projectCmsEditorialErrorDetails } from './cms-editorial-platform-error-details';

/**
 * The published `details` of a Slice 11 error (BE03b "Contract and error
 * matrix"). Every member is rebuilt from the generated closed vocabularies and
 * the operation's own reason set; nothing the upstream wrote is copied verbatim
 * and a detail that does not parse strictly is dropped, never repaired.
 */
export type CmsWorkflowOperationId =
  keyof typeof CMS_SLICE_11_OPERATION_REASONS;

type Details = Record<string, unknown>;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The generic bounded projection with no operation-specific reason. */
const generic = (status: number, upstream: unknown): Details =>
  projectCmsEditorialErrorDetails(status, upstream, {
    reasons422: new Set(),
    reasons409: new Set(),
  });

/**
 * A typed refusal: the upstream `reasonCode` must be one of the tokens this
 * operation publishes, of exactly this status, and the whole detail must parse
 * strictly against that token's schema.
 */
const typedRefusal = (
  operationId: CmsWorkflowOperationId,
  status: 403 | 409 | 422,
  upstream: unknown,
): Details | null => {
  if (!isRecord(upstream)) return null;
  const reason = upstream.reasonCode;
  if (
    typeof reason !== 'string' ||
    !(
      CMS_SLICE_11_OPERATION_REASONS[operationId] as readonly string[]
    ).includes(reason)
  )
    return null;
  const parsed = CmsEditorialRefusalDetailsSchema.safeParse(upstream);
  if (
    !parsed.success ||
    cmsSlice11ReasonStatus(parsed.data.reasonCode) !== status
  )
    return null;
  return { ...parsed.data };
};

const stepUp = (upstream: unknown): Details => {
  if (!isRecord(upstream)) return {};
  const parsed = CmsStepUpRequiredDetailsSchema.safeParse({
    recoveryAction: upstream.recoveryAction,
    allowedMethods: upstream.allowedMethods,
  });
  return parsed.success
    ? {
        recoveryAction: parsed.data.recoveryAction,
        allowedMethods: [...parsed.data.allowedMethods],
      }
    : {};
};

export const projectCmsWorkflowErrorDetails = (
  operationId: CmsWorkflowOperationId,
  status: number,
  code: string,
  upstream: unknown,
): Details => {
  if (status === 401)
    return isStepUpRequiredCode(code)
      ? stepUp(upstream)
      : generic(status, upstream);
  if (status === 403) {
    // A 403 publishes its gate token and nothing else (no violations).
    const refusal = typedRefusal(operationId, 403, upstream);
    return refusal === null ? {} : { reasonCode: refusal.reasonCode };
  }
  if (status === 409 || status === 422)
    return (
      typedRefusal(operationId, status, upstream) ?? generic(status, upstream)
    );
  if (status === 503) {
    const unavailable =
      CmsPreflightUnavailableDetailsSchema.safeParse(upstream);
    if (unavailable.success) return { ...unavailable.data };
  }
  return generic(status, upstream);
};
