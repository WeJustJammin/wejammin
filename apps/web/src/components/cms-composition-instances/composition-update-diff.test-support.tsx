import {
  buttonNamed,
  click,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  UPDATE,
  diffPath,
  json,
  mountPage,
  settle,
} from './composition-page.test-support';
import {
  diffOf,
  id,
  plainPath,
  propsPath,
  removedPath,
  row,
  structurePath,
} from './composition.test-support';

/*
 * The fixtures and drivers shared by the CMS-03C-15 accept and detach suites of the update diff
 * (`CmsPatternUpdateDiff.states.test.tsx`): one pending instance, its diff, the answers and the scripted wire.
 */
export const pending = (n: number) =>
  row(n, { state: 'pending_diff', version: '3' });
export const diff = diffOf(1, [
  propsPath('/a'),
  removedPath('/b'),
  structurePath('/c'),
]);
export const withRoots = diffOf(1, [plainPath('/a')], {
  targetPatternVersion: 3,
  newRoots: [
    { rootPath: '/extra', blockKey: 'profile.header', blockVersion: 1 },
  ],
});
export const read = (value = diff) =>
  json(value, 200, `"${value.instance.version}"`);
export const updated = (version = '10', rowVersion = '4') =>
  json(
    {
      items: [
        row(1, {
          version: rowVersion,
          patternVersion: 2,
          linkMode: 'detached',
          state: 'active',
        }),
      ],
    },
    200,
    `"${version}"`,
  );
export const updatedLinked = (version: string) =>
  json(
    { items: [row(1, { version: '4', patternVersion: 2, state: 'active' })] },
    200,
    `"${version}"`,
  );
export const radio = (container: HTMLElement, path: string, value: string) =>
  container.querySelector<HTMLInputElement>(
    `input[name="choice-${path}"][value="${value}"]`,
  ) as HTMLInputElement;
export const accept = (container: HTMLElement) =>
  buttonNamed(container, 'Accept update');
export const detach = (container: HTMLElement) =>
  buttonNamed(container, 'Detach as a local copy');
export const open = async (page: ReturnType<typeof mountPage>) => {
  await click(buttonNamed(page.container, 'Review update for /main/row-1'));
  await settle();
};
export const answerAll = async (container: HTMLElement) => {
  await click(radio(container, '/a', 'yours'));
  await click(radio(container, '/b', 'theirs'));
  await click(radio(container, '/c', 'yours'));
};
export const accepting = async (page: ReturnType<typeof mountPage>) => {
  await open(page);
  await answerAll(page.container);
  await click(accept(page.container));
  await settle();
};
export const script = (
  update: Array<Response | (() => Response)>,
  more = {},
) => ({
  [diffPath(id(1))]: [read(), read(), read()],
  [UPDATE]: update,
  ...more,
});
export const mount = (update: Array<Response | (() => Response)>, more = {}) =>
  mountPage(script(update, more), { instances: [pending(1)] });
