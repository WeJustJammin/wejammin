import type {
  AccessVariant,
  InfrastructureContractField,
} from '@wejammin/ui/infrastructure/presentation';

import CapabilityGate from './CapabilityGate';

export interface InfrastructureWorkbenchMetaProps {
  readonly access: AccessVariant;
  readonly capabilityReason: string;
  readonly requestId: string;
  readonly contractFieldNames: readonly InfrastructureContractField[];
}

export function InfrastructureWorkbenchMeta({
  access,
  capabilityReason,
  requestId,
  contractFieldNames,
}: InfrastructureWorkbenchMetaProps) {
  return (
    <>
      {access !== 'full' && (
        <CapabilityGate
          variant={access}
          disclosure={capabilityReason}
          recoveryHref="/app/infrastructure"
        />
      )}
      <p className="infra-request-id">
        Request ID: <code>{requestId}</code>
      </p>
      <div className="infra-contract-field-names" aria-hidden="true">
        {contractFieldNames.join(', ')}
      </div>
      <div
        className="infra-invalidation-contract"
        data-channel="wejammin:infrastructure-invalidation"
        aria-hidden="true"
      >
        Invalidation hints trigger canonical refetch only.
      </div>
    </>
  );
}

export default InfrastructureWorkbenchMeta;
