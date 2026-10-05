import * as React from 'react';

import {
  templateFieldId,
  type TemplateField,
} from './content-schema-registry-template-binding';
import type { TemplateChoiceController } from './use-template-choice';

/**
 * FE03 "Successor template choice (CMS-03A-09)". Keeping the template sends
 * both request members as null. Choosing one shows the default template and
 * the template list, each with its own message; the list is serialized into
 * the hidden `templateBindings` member so the posted body is exactly the
 * contract shape and no helper control carries a name.
 */

const TemplateErrors = ({
  controller,
  field,
}: {
  readonly controller: TemplateChoiceController;
  readonly field: TemplateField;
}): React.ReactElement | null => {
  const messages = controller.revealed
    ? controller.issues.filter((issue) => issue.field === field)
    : [];
  if (messages.length === 0) return null;
  const id = `${templateFieldId(controller.formId, field)}-error`;
  return (
    <ul id={id} className="content-schema-registry-field-errors" role="alert">
      {messages.map((issue) => (
        <li key={`${issue.line ?? 0}:${issue.message}`} data-template-error>
          {issue.message}
        </li>
      ))}
    </ul>
  );
};

const errorIdsFor = (
  controller: TemplateChoiceController,
  field: TemplateField,
): string =>
  [
    `${templateFieldId(controller.formId, field)}-help`,
    ...(controller.revealed &&
    controller.issues.some((issue) => issue.field === field)
      ? [`${templateFieldId(controller.formId, field)}-error`]
      : []),
  ].join(' ');

export default function ContentSchemaRegistryTemplateFields({
  controller,
}: {
  readonly controller: TemplateChoiceController;
}): React.ReactElement {
  const { formId, choice } = controller;
  const invalid = (field: TemplateField): boolean =>
    controller.revealed &&
    controller.issues.some((issue) => issue.field === field);
  return (
    <>
      <fieldset data-template-choice>
        <legend>Template for the new version</legend>
        <label>
          <input
            type="radio"
            name="templateChoice"
            value="keep"
            checked={choice === 'keep'}
            onChange={controller.keep}
          />{' '}
          Keep the current template and template list
        </label>
        <label>
          <input
            type="radio"
            name="templateChoice"
            value="change"
            checked={choice === 'change'}
            onChange={controller.change}
          />{' '}
          Choose the template and template list
        </label>
      </fieldset>
      {choice === 'change' ? (
        <div
          data-template-fields
          className="content-schema-registry-template-fields"
        >
          <p className="content-schema-registry-help">
            The server checks that each template names this content type when it
            creates the draft; a template that does not is refused.
          </p>
          <div className="content-schema-registry-field">
            <label
              htmlFor={templateFieldId(formId, 'defaultTemplateVersionId')}
            >
              Default template version ID
            </label>
            <input
              id={templateFieldId(formId, 'defaultTemplateVersionId')}
              name="defaultTemplateVersionId"
              type="text"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              data-template-field="defaultTemplateVersionId"
              value={controller.draft.defaultTemplateVersionId}
              aria-invalid={
                invalid('defaultTemplateVersionId') ? 'true' : undefined
              }
              aria-describedby={errorIdsFor(
                controller,
                'defaultTemplateVersionId',
              )}
              onChange={(event) =>
                controller.edit('defaultTemplateVersionId', event.target.value)
              }
              onBlur={controller.reveal}
            />
            <p
              id={`${templateFieldId(formId, 'defaultTemplateVersionId')}-help`}
              className="content-schema-registry-help"
            >
              The template new entries start from.
            </p>
            <TemplateErrors
              controller={controller}
              field="defaultTemplateVersionId"
            />
          </div>
          <div className="content-schema-registry-field">
            <label htmlFor={templateFieldId(formId, 'templateBindings')}>
              Template version IDs, one per line
            </label>
            <textarea
              id={templateFieldId(formId, 'templateBindings')}
              rows={4}
              autoComplete="off"
              spellCheck={false}
              data-template-field="templateBindings"
              value={controller.draft.bindingsText}
              aria-invalid={invalid('templateBindings') ? 'true' : undefined}
              aria-describedby={errorIdsFor(controller, 'templateBindings')}
              onChange={(event) =>
                controller.edit('templateBindings', event.target.value)
              }
              onBlur={controller.reveal}
            />
            <p
              id={`${templateFieldId(formId, 'templateBindings')}-help`}
              className="content-schema-registry-help"
            >
              The templates bound to the new version, at most 32; leave blank to
              bind none.
            </p>
            <TemplateErrors controller={controller} field="templateBindings" />
          </div>
          <input
            type="hidden"
            name="templateBindings"
            value={JSON.stringify(controller.payload.templateBindings)}
          />
        </div>
      ) : (
        <>
          <input type="hidden" name="defaultTemplateVersionId" value="" />
          <input type="hidden" name="templateBindings" value="null" />
        </>
      )}
    </>
  );
}
