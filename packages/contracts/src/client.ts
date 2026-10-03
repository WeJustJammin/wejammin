/**
 * Zod-free browser entry of the contracts.
 *
 * Protected islands hydrate on every route of their surface, so they must not
 * ship zod or the contracts barrel (FE03 Performance, AC261). They import the
 * exact constants and pure rules below through this curated entry; the zod
 * schemas the registry island needs only for an unseen payload are loaded
 * lazily through `content-schema-registry/validators.ts`. Everything here is
 * plain data or pure functions: add a symbol only when it is zod-free.
 */
export {
  CONTENT_SCHEMA_REGISTRY_OPERATION_IDS,
  type ContentSchemaRegistryOperationId,
} from './content-schema-registry/route-policy-base.ts';
export { CONTENT_SCHEMA_REGISTRY_RETRYABLE_HEADER } from './content-schema-registry/route-policy-base.ts';
export {
  LOCALE_CONFIG_LIMITS,
  LOCALE_CONFIG_MESSAGES,
  canonicalizeBcp47,
  isCanonicalLocale,
} from './content-schema-registry/locale-canonical.ts';
export {
  evaluateLocaleConfig,
  type LocaleConfigInput,
  type LocaleConfigIssue,
  type LocaleConfigIssuePath,
} from './content-schema-registry/locale-config-rules.ts';
export {
  CMS_CAPABILITY_KEY_PATTERN,
  CMS_FIELD_KEY_PATTERN,
  CMS_HASH_PATTERN,
  CMS_LABEL_MAX_CHARACTERS,
  CMS_LABEL_MIN_CHARACTERS,
  CMS_PROJECTION_KEY_PATTERN,
  CMS_TARGET_TYPE_PATTERN,
  CMS_TYPE_KEY_PATTERN,
  CMS_UUID_PATTERN,
  CMS_VALIDATOR_KEY_PATTERN,
  CMS_VERSION_PATTERN,
  CMS_WORKFLOW_KEY_PATTERN,
  isCmsLabel,
  isCmsVersion,
} from './content-schema-registry/field-rules.ts';
export { TEMPLATE_BINDING_MESSAGES } from './content-schema-registry/template-binding-messages.ts';
export {
  AUTH_RETURN_TARGET_MAX_LENGTH,
  isAuthReturnTarget,
  isRelativeFirstPartyPath,
} from './authentication/return-target.ts';
