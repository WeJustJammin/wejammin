import { assertContentSchemaRegistryRouteRegistry } from './route-policy.ts';
import { grantRoutePolicies } from './routes-grants.ts';
import { humanRoutePolicies } from './routes-human.ts';
import { readRoutePolicies } from './routes-read.ts';
import { releaseRoutePolicies } from './routes-release.ts';
import { reviewRoutePolicies } from './routes-review.ts';

const routePolicies = [
  ...humanRoutePolicies,
  releaseRoutePolicies[0],
  ...readRoutePolicies,
  releaseRoutePolicies[1],
  ...reviewRoutePolicies,
  ...grantRoutePolicies,
] as const;

export const contentSchemaRegistryRoutePolicies =
  assertContentSchemaRegistryRouteRegistry(routePolicies);
