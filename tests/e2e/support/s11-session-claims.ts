/**
 * The signed claim names a Slice 11 real-route session carries beyond the
 * Slice 10 party and capability claims. Shared by the Node-side world (which
 * signs them) and the API Worker (which verifies them), so it imports nothing.
 */

/** The acting person (the production authentication session names it). */
export const S11_PERSON_CLAIM = 'wj_person';

/**
 * The instant of the last completed MFA ceremony, as the authentication
 * session projection would state it. Absent for every Slice 10 session.
 */
export const S11_STEP_UP_CLAIM = 'wj_step_up_at';
