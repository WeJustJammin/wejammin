import type { WorkerApp, WorkerContext } from '../index';
import { policyFor } from './route-support';
import {
  configureRoute,
  missingDependencies,
  registerProviderAccessRoutes,
} from './routes-provider-access';
import { registerSessionRoutes } from './routes-session';
import { registerLoginMethodRoutes } from './routes-login-methods';
import { registerAccountMergeRoutes } from './routes-account-merges';
import { registerMfaFactorRoutes } from './routes-mfa';
import { registerStepUpRoutes } from './routes-step-up';
import type { AuthenticationDependencies } from './types';

export const registerAuthenticationRoutes = (
  app: WorkerApp,
  dependencies: AuthenticationDependencies | undefined,
): void => {
  if (dependencies === undefined) {
    for (const policy of authMissingRoutePolicies) {
      const handler = (context: WorkerContext) => {
        configureRoute(context, policy.operationId);
        return missingDependencies(context);
      };
      if (policy.method === 'GET') app.get(policy.path, handler);
      else if (policy.method === 'DELETE') app.delete(policy.path, handler);
      else app.post(policy.path, handler);
    }
    return;
  }
  registerProviderAccessRoutes(app, dependencies);
  registerSessionRoutes(app, dependencies);
  registerLoginMethodRoutes(app, dependencies);
  registerAccountMergeRoutes(app, dependencies);
  registerMfaFactorRoutes(app, dependencies);
  registerStepUpRoutes(app, dependencies);
};

const authMissingRoutePolicies = [
  policyFor('AUTH-API-01'),
  policyFor('AUTH-API-02'),
  policyFor('AUTH-API-03'),
  policyFor('AUTH-API-04'),
  policyFor('AUTH-API-05'),
  policyFor('AUTH-API-06'),
  policyFor('AUTH-API-07'),
  policyFor('AUTH-API-08'),
  policyFor('AUTH-API-09'),
  policyFor('AUTH-API-10'),
  policyFor('AUTH-API-11'),
  policyFor('AUTH-API-12'),
  policyFor('AUTH-API-13'),
  policyFor('AUTH-API-14'),
  policyFor('AUTH-API-15'),
  policyFor('AUTH-API-16'),
  policyFor('AUTH-API-17'),
  policyFor('AUTH-API-18'),
  policyFor('AUTH-API-19'),
  policyFor('AUTH-API-20'),
  policyFor('AUTH-API-21'),
] as const;
