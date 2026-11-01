// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  choose,
  click,
  disableReactAct,
  enableReactAct,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  WorkflowRadioGroup,
  WorkflowSelect,
  WorkflowTextArea,
  WorkflowTextField,
} from './CmsWorkflowFields';

beforeAll(enableReactAct);
afterAll(disableReactAct);

describe('workflow form fields', () => {
  it('labels a text field persistently and wires hint and error to it', async () => {
    const onChange = vi.fn();
    const { container } = mountElement(
      <WorkflowTextField
        id="audience"
        label="Audience"
        hint="Lowercase letters and digits."
        error="Enter an audience."
        value="members"
        onChange={onChange}
        autoComplete="off"
      />,
    );
    const input = container.querySelector('input') as HTMLInputElement;
    expect(container.querySelector('label')?.getAttribute('for')).toBe(
      'audience',
    );
    expect(input.id).toBe('audience');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(
      'audience-hint audience-error',
    );
    expect(container.querySelector('#audience-hint')?.textContent).toBe(
      'Lowercase letters and digits.',
    );
    expect(container.querySelector('#audience-error')?.textContent).toBe(
      'Enter an audience.',
    );
    await typeInto(input, 'staff');
    expect(onChange).toHaveBeenCalledWith('staff');
  });

  it('is not invalid and has no description without a hint or an error', () => {
    const { container } = mountElement(
      <WorkflowTextField
        id="route"
        label="Route"
        value=""
        onChange={() => undefined}
      />,
    );
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBeNull();
    expect(input.getAttribute('autocomplete')).toBeNull();
  });

  it('marks a field invalid from the server refusal without an inline message', () => {
    const { container } = mountElement(
      <WorkflowTextField
        id="route"
        label="Route"
        value=""
        invalid
        onChange={() => undefined}
      />,
    );
    expect(container.querySelector('input')?.getAttribute('aria-invalid')).toBe(
      'true',
    );
    expect(container.querySelector('#route-error')).toBeNull();
  });

  it('supports a datetime-local control and a datalist of suggestions', () => {
    const { container } = mountElement(
      <WorkflowTextField
        id="when"
        label="When"
        type="datetime-local"
        value="2026-11-01T09:30"
        onChange={() => undefined}
        listId="zones"
        suggestions={['UTC', 'Europe/Paris']}
      />,
    );
    expect(container.querySelector('input')?.getAttribute('type')).toBe(
      'datetime-local',
    );
    expect(container.querySelector('input')?.getAttribute('list')).toBe(
      'zones',
    );
    expect(container.querySelectorAll('datalist#zones option')).toHaveLength(2);
  });

  it('counts the characters of a text area politely and reports the value', async () => {
    const onChange = vi.fn();
    const { container } = mountElement(
      <WorkflowTextArea
        id="reason"
        label="Reason"
        value="ab"
        counter={{ used: 2, max: 2000 }}
        onChange={onChange}
      />,
    );
    const area = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(container.querySelector('#reason-counter')?.textContent).toBe(
      '2 of 2000 characters',
    );
    expect(area.getAttribute('aria-describedby')).toBe('reason-counter');
    await typeInto(area, 'abc');
    expect(onChange).toHaveBeenCalledWith('abc');
  });

  it('renders a select and reports the chosen value', async () => {
    const onChange = vi.fn();
    const { container } = mountElement(
      <WorkflowSelect
        id="action"
        label="Action"
        value="publish"
        options={[
          { value: 'publish', label: 'Publish' },
          { value: 'expire', label: 'Expire' },
        ]}
        onChange={onChange}
      />,
    );
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('publish');
    await choose(select, 'expire');
    expect(onChange).toHaveBeenCalledWith('expire');
    expect(container.querySelector('#action-error')).toBeNull();
  });

  it('groups radios in a fieldset with a legend and reports the choice', async () => {
    const onChange = vi.fn();
    const { container } = mountElement(
      <WorkflowRadioGroup
        id="decision"
        legend="Decision"
        name="decision"
        value="approve"
        error="Choose one."
        options={[
          { value: 'approve', label: 'Approve' },
          { value: 'reject', label: 'Reject' },
        ]}
        onChange={onChange}
      />,
    );
    expect(container.querySelector('fieldset legend')?.textContent).toBe(
      'Decision',
    );
    const radios = container.querySelectorAll<HTMLInputElement>(
      'input[type="radio"]',
    );
    expect(radios).toHaveLength(2);
    expect(radios[0]?.checked).toBe(true);
    expect(
      container.querySelector('fieldset')?.getAttribute('aria-describedby'),
    ).toBe('decision-error');
    await click(radios[1] as HTMLElement);
    expect(onChange).toHaveBeenCalledWith('reject');
  });
});
