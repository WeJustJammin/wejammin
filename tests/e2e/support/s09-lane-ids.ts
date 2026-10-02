/**
 * Identity model for the Slice 09 stateful browser lane (test-only).
 *
 * A lane session id is `80000000-0000-4000-8000-` + `<generation>` + `<role>`
 * + `<testId>`: generation is `e5` (rotated by one step-up each time), role is
 * a two-hex code and testId is eight hex characters chosen by the test. All
 * sessions of one test share the testId and therefore one world, so a designer,
 * an owner and a reviewer cooperate on the same records while parallel tests
 * stay isolated. Nothing here is a credential: the harness refuses every
 * identity outside the loopback fixture.
 */

export const LANE_ROLES = {
  designer: '01',
  reviewer: '02',
  owner: '03',
  reader: '04',
  outsider: '05',
  admin: '06',
  reviewer2: '07',
} as const;

export type LaneRole = keyof typeof LANE_ROLES;

const ROLE_BY_CODE = Object.fromEntries(
  Object.entries(LANE_ROLES).map(([role, code]) => [code, role]),
) as Record<string, LaneRole>;

/** Registry capabilities each lane role holds (BE03a authorization matrix). */
export const LANE_CAPABILITIES: Readonly<Record<LaneRole, readonly string[]>> =
  {
    designer: ['cms.schema_registry.read', 'cms.schema_designer'],
    owner: [
      'cms.schema_registry.read',
      'cms.schema_designer',
      'cms.schema_review.assign',
    ],
    // `cms.schema_review` is assignment-only; the port still requires an
    // active assignment for the reading or deciding person.
    reviewer: ['cms.schema_review'],
    reviewer2: ['cms.schema_review'],
    reader: ['cms.schema_registry.read'],
    outsider: [],
    admin: [],
  };

const SESSION_PREFIX = '80000000-0000-4000-8000-';
const SESSION_PATTERN = /^80000000-0000-4000-8000-([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{8})$/u;

export type LaneSessionParts = Readonly<{
  generation: number;
  role: LaneRole;
  testId: string;
}>;

export const laneSessionId = (
  role: LaneRole,
  testId: string,
  generation = 0,
): string =>
  `${SESSION_PREFIX}${(0xe5 + generation).toString(16)}${LANE_ROLES[role]}${testId}`;

export const parseLaneSessionId = (value: unknown): LaneSessionParts | null => {
  if (typeof value !== 'string') return null;
  const match = SESSION_PATTERN.exec(value);
  if (match === null) return null;
  const generation = Number.parseInt(match[1] as string, 16) - 0xe5;
  const role = ROLE_BY_CODE[match[2] as string];
  if (generation < 0 || role === undefined) return null;
  return { generation, role, testId: match[3] as string };
};

export const laneUserId = (role: LaneRole): string =>
  `10000000-0000-4000-8000-0000000000${LANE_ROLES[role]}`;

export const lanePersonId = (role: LaneRole): string =>
  `20000000-0000-4000-8000-0000000000${LANE_ROLES[role]}`;

const USER_ROLE = new Map(
  (Object.keys(LANE_ROLES) as LaneRole[]).map((role) => [laneUserId(role), role]),
);

export const laneRoleOfUser = (userId: unknown): LaneRole | null =>
  typeof userId === 'string' ? (USER_ROLE.get(userId) ?? null) : null;

export const isLaneUserId = (userId: unknown): boolean =>
  laneRoleOfUser(userId) !== null;

export const lanePersonRole = (personId: string): LaneRole | null =>
  (Object.keys(LANE_ROLES) as LaneRole[]).find(
    (role) => lanePersonId(role) === personId,
  ) ?? null;

export const LANE_ACTING_PARTY_ID = '30000000-0000-4000-8000-0000000000aa';
export const LANE_ACTING_LABEL = 'Northwind Collective';

/** A fresh eight-hex test id; collisions across tests are not meaningful. */
export const newTestId = (): string =>
  (Date.now() & 0xffff).toString(16).padStart(4, '0') +
  Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, '0');
