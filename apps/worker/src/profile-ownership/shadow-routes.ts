import {
  InvitationRequestSchema,
  MatchRequestSchema,
  RemedyRequestSchema,
  ShadowPathSchema,
} from '@wejammin/contracts';

import type { WorkerApp } from '../index';
import { configureProfileRoute, parseProfilePath } from './route-support';
import type { ProfileRouteRuntime } from './route-runtime';

export const registerProfileShadowRoutes = (
  app: WorkerApp,
  runtime: ProfileRouteRuntime,
): void => {
  app.post('/api/v1/shadow-party-matches', async (context) => {
    configureProfileRoute(context, 'PRF-API-01');
    return runtime.command(
      context,
      'PRF-API-01',
      'matchShadowParty',
      MatchRequestSchema,
      'session',
      false,
    );
  });
  app.post('/api/v1/shadow-parties/:shadowId/invitations', async (context) => {
    configureProfileRoute(context, 'PRF-API-02');
    const path = parseProfilePath(ShadowPathSchema, {
      shadowId: context.req.param('shadowId'),
    });
    return runtime.command(
      context,
      'PRF-API-02',
      'dispatchInvitation',
      InvitationRequestSchema,
      'session',
      true,
      path,
    );
  });
  app.post('/api/v1/shadow-remedies', async (context) => {
    configureProfileRoute(context, 'PRF-API-03');
    return runtime.command(
      context,
      'PRF-API-03',
      'submitRemedy',
      RemedyRequestSchema,
      'public',
      false,
    );
  });
};
