import { describe, expect, it } from 'vitest';

import { publicStartHeaders } from './auth-public-start';

const browserHeaders = (): Headers =>
  new Headers({
    accept: 'text/html',
    'content-type': 'application/x-www-form-urlencoded',
    cookie: 'wj_session_ref=stale; wj_access=old; wj_csrf=x.y',
    origin: 'https://web.example.test',
    'x-csrf-token': 'x.y',
    'x-request-id': '018f0c45-73fe-7dc2-9c09-68f7ecf132d4',
  });

describe('public sign-in start headers', () => {
  it('drops the browser session credentials for a sign_in intent so a stale cookie cannot make the public start a cookie-authenticated mutation', () => {
    const headers = publicStartHeaders(browserHeaders(), 'sign_in');
    expect(headers.get('cookie')).toBeNull();
    expect(headers.get('x-csrf-token')).toBeNull();
    expect(headers.get('origin')).toBe('https://web.example.test');
    expect(headers.get('x-request-id')).toBe(
      '018f0c45-73fe-7dc2-9c09-68f7ecf132d4',
    );
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('keeps the credentials for every other intent so the Worker gates them', () => {
    for (const intent of ['link', 'prove_merge', undefined, null]) {
      const headers = publicStartHeaders(browserHeaders(), intent);
      expect(headers.get('cookie')).toContain('wj_session_ref=stale');
      expect(headers.get('x-csrf-token')).toBe('x.y');
      expect(headers.get('content-type')).toBe('application/json');
    }
  });

  it('does not mutate the caller headers', () => {
    const source = browserHeaders();
    publicStartHeaders(source, 'sign_in');
    expect(source.get('cookie')).toContain('wj_session_ref=stale');
  });
});
