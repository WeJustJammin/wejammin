import { z } from 'zod';

export const RegistryKeySchema = z.string().regex(/^[a-z][a-z0-9_.:-]{0,127}$/);
export const OwnerSchema = z.string().regex(/^[A-Z][A-Za-z0-9-]{1,63}$/);

const CANONICAL_RUNBOOK_PATHS = [
  'docs/runbooks/platform/cms-editorial.md',
  'docs/runbooks/platform/jobs-outbox-reconciliation.md',
  'docs/runbooks/platform/operational-endpoints.md',
  'docs/runbooks/platform/provider-webhook-reconciliation.md',
  'docs/runbooks/platform/release-recovery-gates.md',
  'docs/runbooks/platform/request-security-and-interaction.md',
  'docs/runbooks/platform/retention.md',
  'docs/runbooks/platform/slo.md',
  'docs/runbooks/platform/upload-admission-reconciliation.md',
] as const;

export const RunbookSchema = z.enum(CANONICAL_RUNBOOK_PATHS);
