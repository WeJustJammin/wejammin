import { ApiErrorSchema } from '@wejammin/contracts';

import type { createPatternUpdateHarness } from './pattern-update-routes.test-support';
import {
  acceptBody,
  PU_SELECTOR_PATH,
  PU_TYPE_ID,
  PU_UPDATE_PATH,
  puDiffPath,
} from './pattern-update.test-support';

/**
 * The BE00 admission every linked-update operation shares (BE03c 175-177, 1266-1268, 1294-1304, 1474-1476): origin,
 * verified human session, the route capability, the user then party quota, port failures mapped to the composition
 * catalog, the registry deadline and telemetry. Each operation is one probe over the same matrix.
 */
export type Harness = ReturnType<typeof createPatternUpdateHarness>;
export type Probe = Readonly<{
  id: 'CMS-03C-13' | 'CMS-03C-14' | 'CMS-03C-15';
  path: string;
  init: () => RequestInit;
  port: (harness: Harness) => { mock: { calls: unknown[][] } } & {
    mockResolvedValueOnce: (value: never) => unknown;
    mockImplementationOnce: (value: never) => unknown;
  };
  deadlineMs: number;
}>;

const readInit = (): RequestInit => ({ method: 'GET' });
const writeInit = (): RequestInit => ({
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'idempotency-key': 'pattern-update-0001',
    'if-match': '"7"',
  },
  body: JSON.stringify(acceptBody(1)),
});

export const PROBES: readonly Probe[] = [
  {
    id: 'CMS-03C-13',
    path: `${PU_SELECTOR_PATH}?contentTypeId=${PU_TYPE_ID}`,
    init: readInit,
    port: (h) => h.readSelector as never,
    deadlineMs: 8_000,
  },
  {
    id: 'CMS-03C-14',
    path: puDiffPath(),
    init: readInit,
    port: (h) => h.readUpdateDiff as never,
    deadlineMs: 8_000,
  },
  {
    id: 'CMS-03C-15',
    path: PU_UPDATE_PATH,
    init: writeInit,
    port: (h) => h.applyUpdate as never,
    deadlineMs: 15_000,
  },
];

export const body = async (response: Response) =>
  ApiErrorSchema.parse(await response.json());
