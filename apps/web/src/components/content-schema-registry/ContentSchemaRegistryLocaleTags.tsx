import * as React from 'react';

import { LOCALE_CONFIG_LIMITS } from '@wejammin/contracts';

import {
  MAX_LANGUAGES_MESSAGE,
  localeControlId,
  type LocaleConfigDraft,
} from './content-schema-registry-locale-config';
import type { LocaleDraftController } from './use-locale-config-draft';

const TagIssue = ({
  id,
  messages,
}: {
  readonly id: string;
  readonly messages: readonly string[];
}): React.ReactElement | null =>
  messages.length === 0 ? null : (
    <div id={id} className="content-schema-registry-field-error" role="alert">
      {messages.map((message) => (
        <p key={message}>{message}</p>
      ))}
    </div>
  );

export interface LocaleTagsProps {
  readonly controller: LocaleDraftController;
  readonly pending: boolean;
  /** Tags that cannot be removed (the inherited source and default). */
  readonly fixed?: readonly string[];
}

/** FE03 "Supported languages (tag list)": a native input, Add, and a list. */
export default function ContentSchemaRegistryLocaleTags({
  controller,
  pending,
  fixed = [],
}: LocaleTagsProps): React.ReactElement {
  const { draft, tagText, tagError, formId } = controller;
  const id = localeControlId(formId, { control: 'tags' });
  const full =
    draft.supportedLocales.length >= LOCALE_CONFIG_LIMITS.maxSupportedLocales;
  const reviewMessages = controller.issues
    .filter((issue) => issue.path[0] === 'supportedLocales')
    .map((issue) => issue.message);
  const messages = [
    ...(tagError === null ? [] : [tagError.message]),
    ...reviewMessages,
  ];
  const invalid = messages.length > 0;
  const describedBy = [`${id}-help`, `${id}-count`]
    .concat(invalid ? [`${id}-error`] : [])
    .join(' ');
  return (
    <div className="content-schema-registry-field" data-locale-tags-field>
      <label htmlFor={id}>Add a language tag</label>
      <div className="content-schema-registry-locale-add">
        <input
          id={id}
          type="text"
          value={tagText}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          readOnly={pending}
          aria-invalid={invalid ? 'true' : undefined}
          aria-describedby={describedBy}
          onChange={(event) => controller.setTagText(event.target.value)}
          onBlur={controller.reveal}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (!full && !pending) controller.commitTag();
          }}
        />
        <button
          type="button"
          disabled={full || pending}
          onClick={controller.commitTag}
        >
          Add
        </button>
      </div>
      <p id={`${id}-help`} className="content-schema-registry-help">
        For example en, fr-CA, zh-Hans-CN
      </p>
      <p id={`${id}-count`} className="content-schema-registry-help">
        {draft.supportedLocales.length} of{' '}
        {LOCALE_CONFIG_LIMITS.maxSupportedLocales}
        {full ? ` · ${MAX_LANGUAGES_MESSAGE}` : ''}
      </p>
      <TagIssue id={`${id}-error`} messages={messages} />
      {tagError?.suggestion == null ? null : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            controller.applySuggestion(tagError.suggestion as string)
          }
        >
          {`Use ${tagError.suggestion}`}
        </button>
      )}
      <TagList
        draft={draft}
        id={id}
        pending={pending}
        fixed={fixed}
        controller={controller}
      />
    </div>
  );
}

const TagList = ({
  draft,
  id,
  pending,
  fixed,
  controller,
}: {
  readonly draft: LocaleConfigDraft;
  readonly id: string;
  readonly pending: boolean;
  readonly fixed: readonly string[];
  readonly controller: LocaleDraftController;
}): React.ReactElement =>
  draft.supportedLocales.length === 0 ? (
    <p className="content-schema-registry-help">Add at least one language</p>
  ) : (
    <ul data-locale-tags className="content-schema-registry-locale-tags">
      {draft.supportedLocales.map((tag, index) => (
        <li key={tag}>
          <span>{tag}</span>{' '}
          {fixed.includes(tag) ? (
            <span className="content-schema-registry-help">
              (inherited, cannot be removed)
            </span>
          ) : (
            <button
              id={`${id}-remove-${index}`}
              type="button"
              disabled={pending}
              onClick={() => controller.dropTag(tag)}
            >
              {`Remove ${tag} from supported languages`}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
