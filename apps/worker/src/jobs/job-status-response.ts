import { ApiErrorSchema } from '@wejammin/contracts';

import type { WorkerContext } from '../index';
import { type JobError, type JobReadResult } from './job-status-support';

const setErrorHeaders = (context: WorkerContext, error: JobError): void => {
  context.set('errorCode', error.code);
  context.header('cache-control', 'no-store');
  context.header('x-request-id', context.get('requestId'));
  if (error.retryAfterSeconds !== undefined) {
    context.header('retry-after', String(error.retryAfterSeconds));
  }
  if (error.rate !== undefined) {
    context.header('ratelimit-limit', String(error.rate.limit));
    context.header('ratelimit-remaining', String(error.rate.remaining));
    context.header('ratelimit-reset', String(error.rate.resetAt));
  }
};

export const responseForError = (
  context: WorkerContext,
  error: JobError,
): Response => {
  setErrorHeaders(context, error);
  const payload = ApiErrorSchema.parse({
    code: error.code,
    details: error.details,
    message: error.message,
    requestId: context.get('requestId'),
  });
  switch (error.status) {
    case 400:
      return context.json(payload, 400);
    case 401:
      return context.json(payload, 401);
    case 403:
      return context.json(payload, 403);
    case 404:
      return context.json(payload, 404);
    case 429:
      return context.json(payload, 429);
    case 500:
      return context.json(payload, 500);
    case 503:
      return context.json(payload, 503);
  }
};

export const responseForRead = (
  context: WorkerContext,
  result: JobReadResult,
): Response => {
  if (result.kind === 'error') return responseForError(context, result.error);
  context.header('cache-control', 'no-store');
  context.header('etag', result.record.etag);
  context.header('x-request-id', context.get('requestId'));
  if (result.notModified) return context.body(null, 304);
  return context.json(result.record.data, 200);
};
