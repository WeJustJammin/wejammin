import {
  CmsSchemaDryRunClaimRequestSchema,
  type CmsSchemaDryRunClaimRequest,
} from './schema-dry-run-claim-request';
import {
  CmsSchemaDryRunClaimResponseSchema,
  type CmsSchemaDryRunClaimResponse,
} from './schema-dry-run-claim-response';

/** Bind a complete parsed response to its caller; not live SQL authority. */
export function decodeCmsSchemaDryRunClaimResponse(
  request: CmsSchemaDryRunClaimRequest,
  value: unknown,
): CmsSchemaDryRunClaimResponse | null {
  const parsedRequest = CmsSchemaDryRunClaimRequestSchema.safeParse(request);
  if (!parsedRequest.success) return null;
  const parsedResponse = CmsSchemaDryRunClaimResponseSchema.safeParse(value);
  if (!parsedResponse.success) return null;

  const { claimedJob, requestedEvent: original } = parsedRequest.data;
  const { job, requestedEvent: returned } = parsedResponse.data;
  if (
    job.id !== claimedJob.jobId ||
    job.version !== claimedJob.version ||
    job.originatingEventId !== original.eventId ||
    returned.eventId !== original.eventId ||
    returned.eventType !== original.eventType ||
    returned.schemaVersion !== original.schemaVersion ||
    returned.aggregateType !== original.aggregateType ||
    returned.aggregateId !== original.aggregateId ||
    returned.aggregateVersion !== original.aggregateVersion ||
    returned.correlationId !== original.correlationId ||
    returned.causationId !== original.causationId
  )
    return null;

  return parsedResponse.data;
}
