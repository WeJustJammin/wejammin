import type { WorkerApp, WorkerContext } from '../index';
import {
  JOB_STATUS_TIMEOUT_MS,
  type JobStatusDependencies,
} from './job-status-types';
import { DEADLINE, readJobStatus, runWithDeadline } from './job-status-read';
import { dependencyError, JOBS_PATH } from './job-status-support';
import { responseForError, responseForRead } from './job-status-response';

export {
  JOB_STATUS_TIMEOUT_MS,
  PARTY_READ_LIMIT,
  USER_READ_LIMIT,
  JobStatusDependencyError,
  JobStatusInternalError,
  type JobOperatorAuditEvent,
  type JobRateLimitDecision,
  type JobRateLimitInput,
  type JobStatusDependencies,
  type JobStatusPrincipal,
  type JobStatusRecord,
} from './job-status-types';

export const registerJobStatusRoute = (
  app: WorkerApp,
  dependencies: JobStatusDependencies | undefined,
): void => {
  const handler = async (context: WorkerContext): Promise<Response> => {
    context.set('operation', 'jobs.status.read');
    const request = context.req.raw;
    if (dependencies === undefined || dependencies.rateLimit === undefined) {
      return responseForError(context, dependencyError());
    }

    const result = await runWithDeadline((signal) =>
      readJobStatus(
        request,
        context.get('requestId'),
        dependencies,
        dependencies.rateLimit,
        signal,
      ),
    );
    return result === DEADLINE
      ? responseForError(
          context,
          dependencyError({ deadlineMs: JOB_STATUS_TIMEOUT_MS }),
        )
      : responseForRead(context, result);
  };

  app.get(JOBS_PATH, handler);
  app.get(`${JOBS_PATH}/:jobId`, handler);
  app.get(`${JOBS_PATH}/*`, handler);
};
