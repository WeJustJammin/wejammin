import {
  hash,
  hash2,
  instant,
  laterInstant,
  resourceMeta,
  uid,
} from './composition-fixtures.test-support';

export const decision = {
  id: uid(60),
  decision: 'approve',
  capability: 'cms.reviewer',
  decidedAt: instant,
  mine: true,
  reason: 'Looks right.',
} as const;
export const assignmentSummary = {
  assignmentId: uid(61),
  version: '1',
  state: 'active',
  startsAt: instant,
  endsAt: laterInstant,
  reviewerLabel: 'Reviewer A',
} as const;
export const detail = {
  ...resourceMeta,
  state: 'open',
  subjectKind: 'template_version',
  subjectId: uid(20),
  lineageId: uid(21),
  subjectKey: 'profile-header',
  subjectVersion: 2,
  subjectHash: hash,
  riskClass: 'ordinary',
  requiredDecisionCount: 2,
  recordedDecisionCount: 1,
  requiredCapabilities: ['cms.reviewer'],
  policyBasisHash: hash2,
  submittedAt: instant,
  decidedAt: null,
  activatedAt: null,
  invalidatedReason: null,
  blockRegistryDigest: hash,
  policyBasis: [
    {
      contentTypeLabel: 'Profile',
      policyKey: 'editorial.default',
      policyVersion: '1',
    },
  ],
  distinctApprovalCount: 1,
  decisions: [decision],
  assignments: [],
  myAssignment: null,
  subjectState: 'review',
  permittedNextActions: ['record_decision'],
  activationSchedule: null,
} as const;
