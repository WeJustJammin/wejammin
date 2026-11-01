import { CMS_LINKED_SCAN_JOB_TYPE, type LinkedScanMessage } from './contract';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** True for a queue message that names the linked-update scan job. */
export const isLinkedScanJobMessage = (body: unknown): boolean =>
  isRecord(body) && body.jobType === CMS_LINKED_SCAN_JOB_TYPE;

/** The platform jobs queue, narrowed to what the linked-update scan sends. */
export type LinkedScanQueue = Readonly<{
  send: (message: LinkedScanMessage) => Promise<void>;
}>;
