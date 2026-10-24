import type {
  RelatedContentResource,
  RelatedContentRuleRead,
} from '@wejammin/contracts';

import { REQUEST_ID } from '../cms-editorial-production.test-support';
import {
  ENTRY_ID,
  PATH,
  validResource,
} from './related-content-routes.test-support';

export { ENTRY_ID, PATH, REQUEST_ID };

/** A browser-origin GET of cmsRelatedContentRead: no body, no media type, no write precondition. */
export const readRequest = (
  headers: Record<string, string> = {},
  path: string = PATH,
  init: RequestInit = {},
) =>
  new Request(`https://api.example.test${path}`, {
    method: 'GET',
    headers: {
      origin: 'https://cms.example.test',
      'x-request-id': REQUEST_ID,
      ...headers,
    },
    ...init,
  });

/** The stored rule of ENTRY_ID: pins in position order, exclusions as stored (DEC-195). */
export const storedRule = (
  overrides: Partial<RelatedContentResource> = {},
): RelatedContentResource => validResource(overrides);

export const ruleRead = (
  rule: RelatedContentResource | null = storedRule(),
): RelatedContentRuleRead => ({ rule });
