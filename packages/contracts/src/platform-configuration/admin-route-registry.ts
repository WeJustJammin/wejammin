import { z } from 'zod';

import { activeAdminWorkspaceRoutePolicies } from './admin-active-routes.ts';
import { deferredAdminWorkspaceRoutePolicies } from './admin-deferred-routes.ts';
import {
  AdminWorkspaceRoutePolicySchema,
  type AdminWorkspaceRoutePolicy,
} from './admin-route-policy.ts';

export const adminWorkspaceRoutePolicies = [
  activeAdminWorkspaceRoutePolicies[0],
  deferredAdminWorkspaceRoutePolicies[0],
  deferredAdminWorkspaceRoutePolicies[1],
  activeAdminWorkspaceRoutePolicies[1],
  activeAdminWorkspaceRoutePolicies[2],
  activeAdminWorkspaceRoutePolicies[3],
  activeAdminWorkspaceRoutePolicies[4],
] as const satisfies readonly AdminWorkspaceRoutePolicy[];

const activeOperationIds = new Set(
  activeAdminWorkspaceRoutePolicies.map(({ operationId }) => operationId),
);

const validateRegistry = (
  routes: readonly AdminWorkspaceRoutePolicy[],
  context: z.RefinementCtx,
): void => {
  const ids = new Set<string>();
  const paths = new Set<string>();
  routes.forEach((route, index) => {
    const routeKey = `${route.method} ${route.path}`;
    if (ids.has(route.operationId)) {
      context.addIssue({
        code: 'custom',
        path: [index, 'operationId'],
        message: 'duplicate_operation',
      });
    }
    if (paths.has(routeKey)) {
      context.addIssue({
        code: 'custom',
        path: [index, 'path'],
        message: 'duplicate_route',
      });
    }
    if (route.active !== activeOperationIds.has(route.operationId)) {
      context.addIssue({
        code: 'custom',
        path: [index, 'active'],
        message: 'active_state_mismatch',
      });
    }
    ids.add(route.operationId);
    paths.add(routeKey);
  });
};

export const AdminWorkspaceRouteRegistrySchema = z
  .array(AdminWorkspaceRoutePolicySchema)
  .length(adminWorkspaceRoutePolicies.length)
  .superRefine(validateRegistry)
  .readonly();

export const AdminWorkspaceActiveRouteRegistrySchema = z
  .array(AdminWorkspaceRoutePolicySchema)
  .length(activeAdminWorkspaceRoutePolicies.length)
  .superRefine((routes, context) => {
    const activeIds = new Set(
      activeAdminWorkspaceRoutePolicies.map(({ operationId }) => operationId),
    );
    routes.forEach((route, index) => {
      if (!activeIds.has(route.operationId)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'operationId'],
          message: 'inactive_route_mounted',
        });
      }
      if (!route.active) {
        context.addIssue({
          code: 'custom',
          path: [index, 'active'],
          message: 'active_registry_requires_active_route',
        });
      }
    });
  })
  .readonly();

export const adminWorkspaceRouteRegistry =
  AdminWorkspaceRouteRegistrySchema.parse(adminWorkspaceRoutePolicies);
export const activeAdminWorkspaceRouteRegistry =
  AdminWorkspaceActiveRouteRegistrySchema.parse(
    activeAdminWorkspaceRoutePolicies,
  );
export const deferredAdminWorkspaceRouteRegistry =
  deferredAdminWorkspaceRoutePolicies;
