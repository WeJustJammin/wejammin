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

/**
 * The id of the acting-context binding the person selected (`identity_context_bind`), as the
 * authentication session projection names it (`actingContextId`). The registry's owner reads
 * (the capability-grant list, CMS-03A-18) are binding-bound: the database refuses a session that
 * names no active binding of the acting person and party.
 */
export const S12_ACTING_CONTEXT_CLAIM = 'wj_acting_context';
