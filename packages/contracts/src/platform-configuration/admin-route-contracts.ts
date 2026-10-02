import {
  Cfg05b01InboxQuerySchema,
  Cfg05b01InboxResponseSchema,
} from './admin-inbox.ts';
import {
  Cfg05b02SearchRequestSchema,
  Cfg05b02SearchResponseSchema,
} from './admin-search.ts';
import {
  Cfg05b03BulkActionRequestSchema,
  Cfg05b03BulkActionResponseSchema,
} from './admin-bulk.ts';
import {
  Cfg05b04CapabilityActionRequestSchema,
  Cfg05b04CapabilityActionResponseSchema,
} from './admin-capability.ts';
import {
  Cfg05b05AuditDiagnosticRequestSchema,
  Cfg05b05AuditDiagnosticResponseSchema,
} from './admin-diagnostic.ts';
import {
  Cfg05b06MfaFactorResetRequestSchema,
  Cfg05b06MfaFactorResetResponseSchema,
} from './admin-mfa-reset.ts';

export const ADMIN_WORKSPACE_ROUTE_CONTRACTS = [
  {
    operationId: 'CFG-05B-01',
    method: 'GET',
    path: '/api/v1/admin/inbox',
    request: Cfg05b01InboxQuerySchema,
    response: Cfg05b01InboxResponseSchema,
    successStatus: 200,
    active: true,
  },
  {
    operationId: 'CFG-05B-02',
    method: 'POST',
    path: '/api/v1/admin/search',
    request: Cfg05b02SearchRequestSchema,
    response: Cfg05b02SearchResponseSchema,
    successStatus: 200,
    active: false,
  },
  {
    operationId: 'CFG-05B-03',
    method: 'POST',
    path: '/api/v1/admin/bulk-operations',
    request: Cfg05b03BulkActionRequestSchema,
    response: Cfg05b03BulkActionResponseSchema,
    successStatus: 202,
    active: false,
  },
  {
    operationId: 'CFG-05B-04',
    method: 'POST',
    path: '/api/v1/admin/capability-grants/actions',
    request: Cfg05b04CapabilityActionRequestSchema,
    response: Cfg05b04CapabilityActionResponseSchema,
    successStatus: 201,
    active: true,
  },
  {
    operationId: 'CFG-05B-05',
    method: 'POST',
    path: '/api/v1/admin/audit-diagnostics/actions',
    request: Cfg05b05AuditDiagnosticRequestSchema,
    response: Cfg05b05AuditDiagnosticResponseSchema,
    successStatus: 202,
    active: true,
  },
  {
    operationId: 'CFG-05B-06',
    method: 'POST',
    path: '/api/v1/admin/identity/mfa-factor-resets',
    request: Cfg05b06MfaFactorResetRequestSchema,
    response: Cfg05b06MfaFactorResetResponseSchema,
    // 200 `completed`; the Worker answers 202 while the reset is `reconciling`.
    successStatus: 200,
    active: true,
  },
] as const;
