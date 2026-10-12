// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsWorkflowStatusRegion from './CmsWorkflowStatusRegion';
import type { CommandPhase } from './cms-workflow-command-controller';
import {
  WorkflowAnnouncerContext,
  useCommittedAnnouncement,
  useIslandConfirmation,
} from './use-cms-workflow-status';

beforeAll(enableReactAct);
afterAll(disableReactAct);

interface Form {
  readonly id: string;
  readonly phase: CommandPhase;
  readonly text: string;
}

/** One command form's side of the line: it reports whether it handed its sentence over. */
function Probe({ id, phase, text }: Form): React.ReactElement {
  const handedOver = useCommittedAnnouncement(phase, text);
  return <output data-form={id}>{handedOver ? 'handed' : 'kept'}</output>;
}

/** An island: the confirmation line, and the forms (or none) it hosts. */
function Island({
  forms,
}: {
  readonly forms: readonly Form[];
}): React.ReactElement {
  const confirmation = useIslandConfirmation();
  return (
    <WorkflowAnnouncerContext.Provider value={confirmation.announcer}>
      <CmsWorkflowStatusRegion text={confirmation.text} />
      {forms.map((form) => (
        <Probe key={form.id} {...form} />
      ))}
    </WorkflowAnnouncerContext.Provider>
  );
}

const form = (id: string, phase: CommandPhase, text = ''): Form => ({
  id,
  phase,
  text,
});
const line = (root: HTMLElement): string =>
  root.querySelector('[data-cms-workflow-status="island"]')?.textContent ?? '';
const handed = (root: HTMLElement, id: string): string =>
  root.querySelector(`[data-form="${id}"]`)?.textContent ?? '';

describe('the island confirmation line', () => {
  it('takes the sentence of a committed form, which then stops saying it', () => {
    const { container, rerender } = mountElement(
      <Island forms={[form('a', 'idle')]} />,
    );
    expect(line(container)).toBe('');
    expect(handed(container, 'a')).toBe('kept');
    rerender(<Island forms={[form('a', 'committed', 'Done.')]} />);
    expect(line(container)).toBe('Done.');
    expect(handed(container, 'a')).toBe('handed');
  });

  it('keeps the sentence when the form that committed it is removed', () => {
    const { container, rerender } = mountElement(
      <Island forms={[form('a', 'committed', 'Done.')]} />,
    );
    rerender(<Island forms={[]} />);
    expect(line(container)).toBe('Done.');
  });

  it('withdraws the sentence when any form begins its next command', () => {
    const { container, rerender } = mountElement(
      <Island forms={[form('a', 'committed', 'Done.'), form('b', 'idle')]} />,
    );
    rerender(
      <Island
        forms={[form('a', 'committed', 'Done.'), form('b', 'pending')]}
      />,
    );
    expect(line(container)).toBe('');
    rerender(
      <Island
        forms={[
          form('a', 'committed', 'Done.'),
          form('b', 'committed', 'Also done.'),
        ]}
      />,
    );
    expect(line(container)).toBe('Also done.');
  });

  it('withdraws only its own sentence when a form starts over', () => {
    const { container, rerender } = mountElement(
      <Island forms={[form('a', 'committed', 'First.'), form('b', 'idle')]} />,
    );
    rerender(
      <Island
        forms={[form('a', 'committed', 'First.'), form('b', 'pending')]}
      />,
    );
    rerender(
      <Island
        forms={[
          form('a', 'committed', 'First.'),
          form('b', 'committed', 'Second.'),
        ]}
      />,
    );
    // The first form starts over after the second committed: the second stays.
    rerender(
      <Island forms={[form('a', 'idle'), form('b', 'committed', 'Second.')]} />,
    );
    expect(line(container)).toBe('Second.');
    rerender(<Island forms={[form('a', 'idle'), form('b', 'idle')]} />);
    expect(line(container)).toBe('');
  });

  it('writes the line once for one commit, however often the island re-renders', () => {
    const { container, rerender } = mountElement(
      <Island forms={[form('a', 'idle')]} />,
    );
    const target = container.querySelector(
      '[data-cms-workflow-status="island"]',
    ) as HTMLElement;
    const observer = new MutationObserver(() => undefined);
    observer.observe(target, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    rerender(<Island forms={[form('a', 'committed', 'Done.')]} />);
    for (let times = 0; times < 3; times += 1)
      rerender(<Island forms={[form('a', 'committed', 'Done.')]} />);
    // One write for the commit; the three identical re-renders wrote nothing.
    expect(observer.takeRecords()).toHaveLength(1);
    observer.disconnect();
    expect(line(container)).toBe('Done.');
    expect(container.querySelector('[data-cms-workflow-status="island"]')).toBe(
      target,
    );
  });

  it('hands nothing over when the form is mounted alone', () => {
    const { container } = mountElement(
      <Probe id="solo" phase="committed" text="Done." />,
    );
    expect(handed(container, 'solo')).toBe('kept');
  });
});
