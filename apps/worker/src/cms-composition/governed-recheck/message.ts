import {
  CMS_GOVERNED_RECHECK_JOB_TYPE,
  type GovernedRecheckMessage,
} from './contract';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** True for a queue message that names the governed recheck job. */
export const isGovernedRecheckJobMessage = (body: unknown): boolean =>
  isRecord(body) && body.jobType === CMS_GOVERNED_RECHECK_JOB_TYPE;

/** The platform jobs queue, narrowed to what the governed recheck sends. */
export type GovernedRecheckQueue = Readonly<{
  send: (message: GovernedRecheckMessage) => Promise<void>;
}>;
