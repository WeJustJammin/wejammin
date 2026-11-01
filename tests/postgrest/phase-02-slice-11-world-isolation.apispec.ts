/**
 * Slice 11 shared-world integrity (lane order). All Slice 11 suites commit into ONE database as
 * ONE operator-bootstrapped owner, and vitest orders the files by its result cache, so whatever a
 * suite commits is part of the world of every suite that runs after it. Two couplings broke the
 * real-API gate that way, and these tests pin both:
 *
 *   1. Every suite committed its own active content type for the shared owner. The CMS-03B-14
 *      authoring-context read serves at most 32 creatable types and refuses the 33rd as
 *      INTERNAL_ERROR (BE03b `AuthoringContextResource.creatableTypes.max(32)`, pgTAP EC-103), so
 *      the 33rd world of a run failed every create from then on. Worlds now share one type and
 *      only a suite that supersedes or compares types asks for its own.
 *   2. A suite granted the shared owner a standing cms.publisher grant, so a later suite's
 *      "the owner is not a publisher" negative control (CMS-03B-07) saw another world.
 *
 * Commits fixtures; run right after `pnpm db:reset`, and reset again afterwards.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { expectStatus } from './support/phase-02-slice-11-assert';
import {
  type S11Stack,
  createS11Stack,
} from './support/phase-02-slice-11-stack';
import {
  type S11World,
  prepareS11World,
} from './support/phase-02-slice-11-world';
import { psql } from './support/stack';

/** BE03b `AuthoringContextResource.creatableTypes.max(32)`: the 33rd is refused, never truncated. */
const CREATABLE_TYPE_BOUND = 32;
/** Room the committed world must leave under the bound for the suites still to run. */
const REQUIRED_HEADROOM = 8;

let world: S11World;
let stack: S11Stack;

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
});

/** The creatable types the shared owner is served, exactly as the product lists them. */
const creatableVersionIds = async (): Promise<readonly string[]> => {
  stack.as(world.owner);
  const response = await stack.get('/api/v1/cms/entries/authoring-context');
  expectStatus(response, 200);
  return (
    response.body.creatableTypes as readonly { contentTypeVersionId: string }[]
  ).map((type) => type.contentTypeVersionId);
};

describe('the committed Slice 11 world stays inside the product bounds', () => {
  it('[CMS-03B-14] preparing a world again reuses the shared content type, so the creatable types of the shared owner do not grow with the number of suites', async () => {
    const before = await creatableVersionIds();
    expect(before).toContain(world.editorial.contentTypeVersionId);

    const second = await prepareS11World();
    const third = await prepareS11World();

    for (const prepared of [second, third]) {
      expect(prepared.editorial).toEqual(world.editorial);
    }
    expect(await creatableVersionIds()).toEqual(before);
  });

  it('[CMS-03B-14] a world that asks for its own content type commits exactly one more creatable type and leaves the shared type creatable', async () => {
    const before = await creatableVersionIds();

    const own = await prepareS11World({ fresh: true });

    expect(own.editorial.contentTypeVersionId).not.toBe(
      world.editorial.contentTypeVersionId,
    );
    const after = await creatableVersionIds();
    expect(after).toHaveLength(before.length + 1);
    expect(after).toEqual(
      expect.arrayContaining([
        world.editorial.contentTypeVersionId,
        own.editorial.contentTypeVersionId,
      ]),
    );
  });

  it(`[CMS-03B-14] the shared owner is served its creatable types with at least ${REQUIRED_HEADROOM} to spare under the bound of ${CREATABLE_TYPE_BOUND}`, async () => {
    expect((await creatableVersionIds()).length).toBeLessThanOrEqual(
      CREATABLE_TYPE_BOUND - REQUIRED_HEADROOM,
    );
  });

  it('[CMS-03B-18] no suite leaves a standing reviewer or publisher grant on the shared owner', () => {
    expect(
      psql(`
        select coalesce(string_agg(capability_code, ',' order by capability_code), '')
          from identity_private.organization_actor_grant
         where organization_id = '${world.organizationId}'
           and person_id = '${world.owner.personId}'
           and active
           and capability_code in ('cms.publisher', 'cms.reviewer')`),
    ).toBe('');
  });
});
