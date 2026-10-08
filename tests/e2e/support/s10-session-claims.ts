/**
 * The signed claim names a Slice 10 real-route session carries beyond the
 * standard subject and session id. Shared by the Node-side world (which signs
 * them) and the API Worker (which verifies them), so it imports nothing.
 */
export const S10_PARTY_CLAIM = 'wj_party';
export const S10_CAPABILITIES_CLAIM = 'wj_caps';
