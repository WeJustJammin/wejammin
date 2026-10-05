import type { ContentSchemaRegistryOperationId } from './route-policy-base.ts';
import type { GrantRouteContractByOperation } from './route-policy-grants.ts';
import type { HumanRouteContractByOperation } from './route-policy-human.ts';
import type { ReadReleaseRouteContractByOperation } from './route-policy-read-release.ts';
import type { ReviewRouteContractByOperation } from './route-policy-review.ts';

export type RouteContractByOperation = {
  [
    OperationId in ContentSchemaRegistryOperationId
  ]: OperationId extends keyof HumanRouteContractByOperation
    ? HumanRouteContractByOperation[OperationId]
    : OperationId extends keyof ReadReleaseRouteContractByOperation
      ? ReadReleaseRouteContractByOperation[OperationId]
      : OperationId extends keyof ReviewRouteContractByOperation
        ? ReviewRouteContractByOperation[OperationId]
        : OperationId extends keyof GrantRouteContractByOperation
          ? GrantRouteContractByOperation[OperationId]
          : never;
};
