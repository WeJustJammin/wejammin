-- Slice 10 adversarial remediation (findings 11, 12, 25): the protected
-- validator registry, the field kind<->validator pairing, and the shared
-- value-encoding gate.
--
-- BE03a: rich_text.v1 version 1 is the only member of the protected validator
-- registry; its grammar artifact reference and hash are code-owned constants,
-- and a member pair is valid only on a rich_text field.  BE03b: the 03a
-- minLength/maxLength bind the total NFC text across every span of every
-- block, itemKind is a list-only constraint with real calendar and
-- bounded-enum item semantics, and a literal defaultValue satisfies the same
-- field-kind value shape the draft gate enforces (rich_text.v1 documents and
-- DEC-133 structures included).
--
-- These probes exercise the pure predicates directly through the guarded
-- helper convention so an absent or regressed predicate yields a false/null
-- verdict that fails the assertion instead of aborting the run.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(15);

-- Guarded predicate call: an absent function yields null, which fails both the
-- true and the false assertions alike, so a missing implementation stays
-- evidence-backed rather than aborting the suite.
create or replace function pg_temp.s10reg_call(
  p_name text,
  p_args jsonb
)
returns boolean
language plpgsql
stable
as $body$
declare
  result boolean;
begin
  if pg_catalog.to_regprocedure(
       'platform_private.' || p_name
       || case p_args->>'arity'
            when 'ref' then '(text, bigint)'
            when 'length' then '(jsonb, jsonb)'
            when 'item_kind' then '(text)'
            when 'item_value' then '(text, jsonb, jsonb)'
            when 'shape' then '(text, jsonb, jsonb)'
            when 'field_input' then '(jsonb, boolean)'
            else ''
          end
     ) is null then
    return null;
  end if;
  execute 'select platform_private.' || p_name
    || case p_args->>'arity'
         when 'ref' then '($1::text, $2::bigint)'
         when 'length' then '($1::jsonb, $2::jsonb)'
         when 'item_kind' then '($1::text)'
         when 'item_value' then '($1::text, $2::jsonb, $3::jsonb)'
         when 'shape' then '($1::text, $2::jsonb, $3::jsonb)'
         when 'field_input' then '($1::jsonb, $2::boolean)'
       end
    into result
    using
      p_args->>'a1',
      case
        when p_args->>'arity' = 'ref' then p_args->>'a2'
        when p_args->>'arity' = 'field_input' then (p_args->'a2') #>> '{}'
        else p_args->'a2' #>> '{}'
      end,
      case
        when p_args->>'arity' in ('item_value', 'shape', 'length') then p_args->'a3'::text
        else null
      end;
  return result;
exception
  when others then
    return null;
end;
$body$;

-- Finding 11: the protected registry admits exactly the rich_text.v1 v1 member.
select is(
  pg_temp.s10reg_call('cms_protected_validator_ref', jsonb_build_object(
    'arity', 'ref', 'a1', 'rich_text.v1', 'a2', 1
  )),
  true,
  '[P2-S10-AC-085] rich_text.v1 v1 is the registered protected validator member'
);

select is(
  pg_temp.s10reg_call('cms_protected_validator_ref', jsonb_build_object(
    'arity', 'ref', 'a1', 'rich_text.v1', 'a2', 2
  )),
  false,
  '[P2-S10-AC-085] the member version is immutable: an unregistered version is refused'
);

select is(
  pg_temp.s10reg_call('cms_protected_validator_ref', jsonb_build_object(
    'arity', 'ref', 'a1', 'cms.slug', 'a2', 1
  )),
  false,
  '[P2-S10-AC-085] a free-form or legacy key is refused by the protected registry'
);

-- Finding 12: kind<->validator pairing at the definition boundary.  A member
-- pair is valid only on a rich_text field; an unregistered pair is refused; a
-- rich_text field without a pair stays the intrinsic-grammar default.
select is(
  pg_temp.s10reg_call('cms_valid_field_input', jsonb_build_object(
    'arity', 'field_input',
    'a1', jsonb_build_object(
      'stableFieldId', 'a9100000-0000-4000-8000-000000000901',
      'key', 'body', 'kind', 'rich_text', 'constraints', jsonb_build_object(),
      'required', false, 'validatorKey', 'rich_text.v1', 'validatorVersion', 1,
      'defaultMode', 'none', 'localizationMode', 'none',
      'editorConfig', jsonb_build_object('label', 'Body', 'order', 0),
      'lifecycle', 'active'
    )
  )),
  true,
  '[P2-S10-AC-085] a rich_text field may carry the registered rich_text.v1 v1 pair'
);

select is(
  pg_temp.s10reg_call('cms_valid_field_input', jsonb_build_object(
    'arity', 'field_input',
    'a1', jsonb_build_object(
      'stableFieldId', 'a9100000-0000-4000-8000-000000000902',
      'key', 'slug', 'kind', 'short_text', 'constraints', jsonb_build_object(),
      'required', false, 'validatorKey', 'rich_text.v1', 'validatorVersion', 1,
      'defaultMode', 'none', 'localizationMode', 'none',
      'editorConfig', jsonb_build_object('label', 'Slug', 'order', 0),
      'lifecycle', 'active'
    )
  )),
  false,
  '[P2-S10-AC-085] the rich_text.v1 member pair is refused on a non-rich_text field'
);

select is(
  pg_temp.s10reg_call('cms_valid_field_input', jsonb_build_object(
    'arity', 'field_input',
    'a1', jsonb_build_object(
      'stableFieldId', 'a9100000-0000-4000-8000-000000000903',
      'key', 'body', 'kind', 'rich_text', 'constraints', jsonb_build_object(),
      'required', false, 'validatorKey', 'caller.regex', 'validatorVersion', 1,
      'defaultMode', 'none', 'localizationMode', 'none',
      'editorConfig', jsonb_build_object('label', 'Body', 'order', 0),
      'lifecycle', 'active'
    )
  )),
  false,
  '[P2-S10-AC-085] an unregistered validator pair is refused on a rich_text field'
);

select is(
  pg_temp.s10reg_call('cms_valid_field_input', jsonb_build_object(
    'arity', 'field_input',
    'a1', jsonb_build_object(
      'stableFieldId', 'a9100000-0000-4000-8000-000000000904',
      'key', 'tags', 'kind', 'short_text', 'constraints', jsonb_build_object('itemKind', 'short_text'),
      'required', false, 'validatorKey', null, 'validatorVersion', null,
      'defaultMode', 'none', 'localizationMode', 'none',
      'editorConfig', jsonb_build_object('label', 'Tags', 'order', 0),
      'lifecycle', 'active'
    )
  )),
  false,
  '[P2-S10-AC-085] itemKind is a list-only constraint and is refused on another kind'
);

-- Finding 25: the 03a minLength/maxLength bind the total NFC text across every
-- span of every block, not any single span.
select is(
  pg_temp.s10reg_call('cms_rich_text_length_in_bounds', jsonb_build_object(
    'arity', 'length',
    'a1', jsonb_build_object(
      'format', 'rich_text.v1',
      'blocks', jsonb_build_array(jsonb_build_object(
        'type', 'paragraph',
        'spans', jsonb_build_array(
          jsonb_build_object('text', 'Hello', 'marks', jsonb_build_array()),
          jsonb_build_object('text', 'World', 'marks', jsonb_build_array('bold'))
        )
      ))
    ),
    'a2', jsonb_build_object('minLength', 5, 'maxLength', 10)
  )),
  true,
  '[P2-S10-AC-084] the total NFC text across all spans is the bounded length'
);

select is(
  pg_temp.s10reg_call('cms_rich_text_length_in_bounds', jsonb_build_object(
    'arity', 'length',
    'a1', jsonb_build_object(
      'format', 'rich_text.v1',
      'blocks', jsonb_build_array(jsonb_build_object(
        'type', 'paragraph',
        'spans', jsonb_build_array(
          jsonb_build_object('text', 'Hello', 'marks', jsonb_build_array()),
          jsonb_build_object('text', 'World', 'marks', jsonb_build_array('bold'))
        )
      ))
    ),
    'a2', jsonb_build_object('maxLength', 9)
  )),
  false,
  '[P2-S10-AC-084] a document over the total-text maxLength is refused'
);

select is(
  pg_temp.s10reg_call('cms_rich_text_length_in_bounds', jsonb_build_object(
    'arity', 'length',
    'a1', jsonb_build_object(
      'format', 'rich_text.v1',
      'blocks', jsonb_build_array(jsonb_build_object(
        'type', 'paragraph',
        'spans', jsonb_build_array(
          jsonb_build_object('text', 'Hello', 'marks', jsonb_build_array()),
          jsonb_build_object('text', 'World', 'marks', jsonb_build_array('bold'))
        )
      ))
    ),
    'a2', jsonb_build_object('minLength', 11)
  )),
  false,
  '[P2-S10-AC-084] a document under the total-text minLength is refused'
);

-- Finding 25: list item semantics.  A date or datetime item must be a real
-- calendar value, an enum item must come from the declared choice set, and a
-- nested item kind is refused at the shape boundary.
select is(
  pg_temp.s10reg_call('cms_list_item_value_valid', jsonb_build_object(
    'arity', 'item_value',
    'a1', 'date', 'a2', jsonb_build_object(),
    'a3', to_jsonb('2026-02-30'::text)
  )),
  false,
  '[P2-S10-AC-083] a list date item with a non-existent calendar day is refused'
);

select is(
  pg_temp.s10reg_call('cms_list_item_value_valid', jsonb_build_object(
    'arity', 'item_value',
    'a1', 'date', 'a2', jsonb_build_object(),
    'a3', to_jsonb('2026-02-28'::text)
  )),
  true,
  '[P2-S10-AC-083] a list date item with a real calendar day is admitted'
);

select is(
  pg_temp.s10reg_call('cms_list_item_value_valid', jsonb_build_object(
    'arity', 'item_value',
    'a1', 'enum',
    'a2', jsonb_build_object('enumValues', jsonb_build_array('jazz', 'rock')),
    'a3', to_jsonb('metal'::text)
  )),
  false,
  '[P2-S10-AC-083] a list enum item outside the declared choice set is refused'
);

select is(
  pg_temp.s10reg_call('cms_list_item_kind_valid', jsonb_build_object(
    'arity', 'item_kind', 'a1', 'object'
  ))
  or pg_temp.s10reg_call('cms_list_item_kind_valid', jsonb_build_object(
    'arity', 'item_kind', 'a1', 'list'
  ))
  or pg_temp.s10reg_call('cms_list_item_kind_valid', jsonb_build_object(
    'arity', 'item_kind', 'a1', 'rich_text'
  )),
  false,
  '[P2-S10-AC-083] a nested list, object, or rich_text itemKind is refused'
);

-- Finding 25: a literal defaultValue satisfies the same field-kind value shape
-- the draft gate enforces, so a default can never be a looser encoding than
-- its field.
select is(
  pg_temp.s10reg_call('cms_field_kind_value_shape', jsonb_build_object(
    'arity', 'shape',
    'a1', 'list',
    'a2', jsonb_build_object('itemKind', 'date'),
    'a3', jsonb_build_array(to_jsonb('2026-02-28'::text))
  ))
  and not pg_temp.s10reg_call('cms_field_kind_value_shape', jsonb_build_object(
    'arity', 'shape',
    'a1', 'list',
    'a2', jsonb_build_object('itemKind', 'date'),
    'a3', jsonb_build_array(to_jsonb('2026-02-30'::text))
  )),
  true,
  '[P2-S10-AC-084] the shared kind-value shape enforces real list calendar semantics'
);

select finish();
rollback;
