import { expect } from 'vitest';

import {
  type EditorialWorld,
  appendEntryBody,
  createEntryBody,
} from './cms-editorial-world';
import type { EditorialStack } from './cms-editorial-stack';

/**
 * Seeds one entry through the real chain: the CMS-03B-14 projection round-trips
 * into a create, then two appends advance the entry to version 3 (revision 3).
 * Suites that start from "an entry with history" call this instead of repeating
 * the create assertions of `cms-editorial-composition.apispec.ts`.
 */
export const seedEditorialEntry = async (
  stack: EditorialStack,
  world: EditorialWorld,
): Promise<
  Readonly<{
    entryId: string;
    firstRevisionId: string;
    type: Record<string, unknown>;
  }>
> => {
  const context = await stack.authoringContext();
  expect(context.status, context.text).toBe(200);
  const type = (
    context.body.creatableTypes as readonly Record<string, unknown>[]
  ).find(
    (candidate) =>
      candidate.contentTypeVersionId === world.contentTypeVersionId,
  ) as Record<string, unknown>;
  const created = await stack.create(createEntryBody(world, 'Seed one', type));
  expect(created.status, created.text).toBe(201);
  const entryId = (created.body.entry as { id: string }).id;
  const firstRevisionId = (created.body.revision as { id: string }).id;
  for (const [title, base, version] of [
    ['Seed two', '1', '1'],
    ['Seed three', '2', '2'],
  ] as const) {
    const appended = await stack.append(
      entryId,
      appendEntryBody(world, entryId, title, base, version),
      { ifMatch: version },
    );
    expect(appended.status, appended.text).toBe(201);
  }
  return { entryId, firstRevisionId, type };
};
