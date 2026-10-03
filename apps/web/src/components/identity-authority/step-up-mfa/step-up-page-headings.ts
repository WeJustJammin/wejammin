/**
 * Heading, eyebrow and document title of the two server-rendered auth pages
 * (FE01 Page and Route Definitions). The `<title>` carries the page purpose.
 */
export const STEP_UP_PAGE_HEADINGS = {
  'step-up': {
    eyebrow: 'Your account',
    heading: "Verify it's you",
    description:
      'This action needs a recent check with the authenticator on your account. Your work is not submitted until you confirm it again.',
    documentTitle: "Verify it's you | WeJammin",
  },
  mfa: {
    eyebrow: 'Account security',
    heading: 'Two-step verification',
    description:
      'Authenticators protect your account. Your own account is always the one changed here, whichever profile or role you are acting as.',
    documentTitle: 'Two-step verification | WeJammin',
  },
} as const;

export type StepUpPageKey = keyof typeof STEP_UP_PAGE_HEADINGS;
