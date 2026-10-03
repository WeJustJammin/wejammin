import { loadedContractValidators } from './content-schema-registry-contract-validators';
import type { SchemaActivationResource } from './content-schema-registry-types';

/**
 * FE03 CMS-03A-04: render the authoritative `SchemaActivationResource` (202 job
 * or synchronous) exactly as the server returned it, after strict validation.
 * A body that does not parse is never shown as a success.
 */
export const parseActivationResult = (
  body: unknown,
): SchemaActivationResource | null => {
  // The mutation executor loads the validators before it hands a CMS-03A-04
  // success to this renderer; without them the body is unverified, and an
  // unverified body is never shown as a success.
  const validators = loadedContractValidators();
  if (validators === null) return null;
  const parsed = validators.SchemaActivationResourceSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
};

const row = (
  document: Document,
  list: HTMLElement,
  term: string,
  value: string | HTMLElement,
): void => {
  const dt = document.createElement('dt');
  dt.textContent = term;
  const dd = document.createElement('dd');
  if (typeof value === 'string') dd.textContent = value;
  else dd.appendChild(value);
  list.appendChild(dt);
  list.appendChild(dd);
};

const code = (
  document: Document,
  value: string | null,
): HTMLElement | string => {
  if (value === null) return 'None';
  const element = document.createElement('code');
  element.textContent = value;
  return element;
};

const time = (
  document: Document,
  value: string | null,
): HTMLElement | string => {
  if (value === null) return 'Not yet recorded';
  const element = document.createElement('time');
  element.dateTime = value;
  element.textContent = value;
  return element;
};

/** The result region inserted at the top of the activation form. */
export const renderActivationResult = (
  form: HTMLFormElement,
  resource: SchemaActivationResource,
  continueTo: string | null,
): HTMLElement => {
  const document = form.ownerDocument;
  const region = document.createElement('section');
  region.id = `${form.id}-activation-result`;
  region.dataset.cmsActivationResult = 'true';
  region.className = 'content-schema-registry-command-status';
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-labelledby', `${region.id}-heading`);
  const heading = document.createElement('h3');
  heading.id = `${region.id}-heading`;
  heading.tabIndex = -1;
  heading.textContent =
    resource.jobId === null
      ? 'Schema version activated'
      : 'Schema activation accepted';
  const summary = document.createElement('p');
  summary.textContent =
    resource.jobId === null
      ? 'The server activated this version.'
      : 'The server accepted the activation and started a job for it.';
  const list = document.createElement('dl');
  list.className = 'content-schema-registry-block-meta';
  const evidence = resource.activationEvidence;
  row(document, list, 'Activation ID', code(document, resource.id));
  row(document, list, 'Version', resource.version);
  row(document, list, 'State', resource.state);
  row(
    document,
    list,
    'Content type version ID',
    code(document, resource.contentTypeVersionId),
  );
  row(document, list, 'Activated', time(document, resource.activatedAt));
  row(
    document,
    list,
    'Migration plan ID',
    code(document, resource.migrationPlanId),
  );
  row(document, list, 'Job ID', code(document, resource.jobId));
  row(document, list, 'Event type', code(document, resource.eventType));
  row(
    document,
    list,
    'Locale configuration hash',
    code(document, resource.localeConfigHash),
  );
  row(document, list, 'Content hash', code(document, resource.contentHash));
  row(document, list, 'Created', time(document, resource.createdAt));
  row(document, list, 'Updated', time(document, resource.updatedAt));
  row(document, list, 'Policy', code(document, evidence.key));
  row(document, list, 'Policy version', evidence.version);
  row(document, list, 'Policy hash', code(document, evidence.policyHash));
  row(document, list, 'Risk class', evidence.riskClass);
  row(
    document,
    list,
    'Required decisions',
    String(evidence.requiredDecisionCount),
  );
  row(
    document,
    list,
    'Required capabilities',
    evidence.requiredCapabilities.length === 0
      ? 'None'
      : evidence.requiredCapabilities.join(', '),
  );
  row(
    document,
    list,
    'Approval evidence hash',
    code(document, evidence.approvalEvidenceHash),
  );
  region.appendChild(heading);
  region.appendChild(summary);
  region.appendChild(list);
  if (continueTo !== null) {
    const link = document.createElement('a');
    link.href = continueTo;
    link.textContent = 'Open the refreshed version';
    const paragraph = document.createElement('p');
    paragraph.appendChild(link);
    region.appendChild(paragraph);
  }
  form.insertBefore(region, form.firstChild);
  return region;
};
