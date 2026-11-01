import { GOVERNED_ACTIVATION_SPEC } from './governed-activation-command-spec';
import { sendGovernedCommand } from './governed-review-command-transport';
import { jsonResponse } from '../../server/cms-governed-review-fixtures.test-support';
import {
  REVIEW_LOCATION,
  environment,
  fetcherFor,
} from './governed-review-transport.test-support';

export const send = (input: unknown, ...queue: (Response | Error)[]) => {
  const fetcher = fetcherFor(...queue);
  return {
    fetcher,
    result: sendGovernedCommand(
      GOVERNED_ACTIVATION_SPEC,
      input as never,
      environment(fetcher),
    ),
  };
};

export const ok = (status: number, resource: unknown, etag: string) =>
  jsonResponse(status, resource, { etag, location: REVIEW_LOCATION });
