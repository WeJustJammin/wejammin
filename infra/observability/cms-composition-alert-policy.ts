/**
 * Public barrel for the provider-free Slice 12 (BE03c Observability) alert
 * policy, beside the Slice 09 `content-schema-registry-alert-policy`.
 */

export {
  CMS_COMPOSITION_ALERT_CODES,
  CMS_COMPOSITION_ALERT_THRESHOLDS,
  evaluateCmsCompositionAlerts,
} from '@wejammin/observability/cms-composition-alerts';
export type {
  CmsCompositionAlert,
  CmsCompositionAlertCode,
  CmsCompositionOperationalSnapshot,
} from '@wejammin/observability/cms-composition-alerts';
