/**
 * The small DOM helpers the CMS editorial page actions share: the polite status
 * line they append to the document, and the session storage of the page. They
 * live apart so the core (loaded with every CMS page) and the restore submit
 * module (loaded on the first restore, AC-106) use one copy.
 */

export const announce = (
  documentRef: Document,
  attribute: string,
  message: string,
): void => {
  const selector = `p[${attribute}]`;
  const existing: HTMLParagraphElement | null =
    documentRef.querySelector(selector);
  if (existing !== null) {
    existing.textContent = message;
    return;
  }
  const created = documentRef.createElement('p') as HTMLParagraphElement;
  created.setAttribute('role', 'status');
  created.setAttribute(attribute, '');
  documentRef.body.appendChild(created);
  created.textContent = message;
};

export const focusStorage = (documentRef: Document): Storage | null => {
  try {
    return documentRef.defaultView?.sessionStorage ?? null;
  } catch {
    return null;
  }
};
