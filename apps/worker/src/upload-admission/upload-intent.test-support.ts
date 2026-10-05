import { CSRF } from '../authentication/phase-02-slice-02.test-fixtures';

/** Same-origin cookie-session headers every human upload-intent request carries (BE00 step 2). */
export const UPLOAD_INTENT_BROWSER_HEADERS = {
  cookie: `wj_session_ref=slice02-session-ref; wj_csrf=${CSRF}`,
  origin: 'https://api.example.test',
  'x-csrf-token': CSRF,
} as const;
