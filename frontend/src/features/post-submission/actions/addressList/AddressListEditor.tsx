'use client';

import {
  useImperativeHandle,
  useRef,
  useState,
  type ClipboardEvent,
  type ComponentProps,
} from 'react';
import { Checkbox, TagGroup, TagList, TextField } from '@bcgov/design-system-react-components';

import type { ActionEditorProps } from '@/src/features/post-submission/actions/types';
import {
  POST_SUBMISSION_EMAIL_MAX_ADDRESSES,
  type PostSubmissionActionValues,
} from '@/src/types/postSubmission';
import type { Dictionary } from '@/src/types/dictionary';
import styles from '../fields.module.css';
import {
  addAddresses,
  addressesOf,
  needsAddress,
  splitAddresses,
  withAddresses,
  type AddedAddresses,
} from './addresses';

/** An address-list action's own words for its fields. */
export interface AddressListCopy {
  /** The checkbox that turns the action on. */
  enabled: string;
  /** What each address gets, under the checkbox. */
  help: string;
  /** Why the action cannot be saved on with no addresses. */
  required: string;
}

type ListCopy = Dictionary['postSubmission']['addressList'];
type FieldKeyDown = NonNullable<ComponentProps<typeof TextField>['onKeyDown']>;

/** Keys that turn what is typed into chips instead of typing themselves. */
const COMMIT_KEYS = new Set(['Enter', ',', ';', ' ']);
const MAX = String(POST_SUBMISSION_EMAIL_MAX_ADDRESSES);

const fieldErrorOf = (result: AddedAddresses, t: ListCopy): string | null => {
  if (result.invalid.length > 0) return t.invalid;
  if (result.overflow.length > 0) return t.tooMany.replace('{max}', MAX);
  return null;
};

/**
 * An address-list action's fields: whether it runs, and its recipients as chips. What is typed
 * becomes chips on Enter, a comma, a semicolon or a space, and Save adds what is still in the field;
 * a paste adds every address in it. Text that is not a valid address stays in the field with a
 * message, and keeps the drawer from saving until it is fixed or removed.
 */
export default function AddressListEditor({
  ref,
  dict,
  values,
  onChange,
  isDisabled,
  onFieldStateChange,
  problem,
  copy,
  testIdPrefix,
}: ActionEditorProps & Readonly<{ copy: AddressListCopy; testIdPrefix: string }>) {
  const t = dict.postSubmission.addressList;
  const addresses = addressesOf(values);
  const [text, setText] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const fieldRef = useRef<HTMLDivElement>(null);

  const announce = (...messages: (string | null)[]) =>
    setAnnouncement(messages.filter(Boolean).join(' '));

  /** Passes changed values up, and says so when they leave the action on with nobody to send to. */
  const change = (next: PostSubmissionActionValues, message: string | null) => {
    onChange(next);
    announce(message, needsAddress(next) ? copy.required : null);
  };

  /** Adds the text's addresses; the values after, or null when some text stays in the field. */
  const commit = (raw: string): PostSubmissionActionValues | null => {
    const candidates = splitAddresses(raw);
    if (candidates.length === 0) {
      setText('');
      onFieldStateChange('clear');
      return values;
    }
    const result = addAddresses(addresses, candidates);
    const next = result.added.length > 0 ? withAddresses(values, result.list) : values;
    const left = [...result.invalid, ...result.overflow];
    const error = fieldErrorOf(result, t);
    const repeated =
      result.duplicates.length > 0
        ? t.duplicate.replace('{addresses}', result.duplicates.join(', '))
        : null;
    if (next !== values) onChange(next);
    setText(left.join('; '));
    setFieldError(error);
    setDuplicates(repeated);
    announce(
      result.added.length > 0 ? t.added.replace('{addresses}', result.added.join(', ')) : null,
      error,
      repeated,
    );
    onFieldStateChange(left.length > 0 ? 'invalid' : 'clear');
    return left.length > 0 ? null : next;
  };

  // Save adds what is still in the field. Leaving the field adds nothing, so the drawer does not
  // change under a press of Save.
  useImperativeHandle(ref, () => ({ commitText: () => commit(text) }));

  const onTextChange = (next: string) => {
    setText(next);
    setFieldError(null);
    onFieldStateChange(next.trim() ? 'pending' : 'clear');
  };

  const onKeyDown: FieldKeyDown = (event) => {
    if (!COMMIT_KEYS.has(event.key)) {
      event.continuePropagation();
      return;
    }
    // Enter would otherwise submit the drawer.
    event.preventDefault();
    commit(text);
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    commit(`${text}\n${event.clipboardData.getData('text/plain')}`);
  };

  const remove = (keys: Iterable<unknown>) => {
    const removed = [...keys].map(String);
    const list = addresses.filter((address) => !removed.includes(address));
    change(withAddresses(values, list), t.removed.replace('{address}', removed.join(', ')));
    if (list.length === 0) fieldRef.current?.querySelector('input')?.focus();
  };

  return (
    <div className={styles.fields}>
      <Checkbox
        isSelected={values.enabled}
        onChange={(enabled) => change({ ...values, enabled }, null)}
        isDisabled={isDisabled}
        data-testid={`${testIdPrefix}-enabled`}
      >
        {copy.enabled}
      </Checkbox>
      <p data-testid={`${testIdPrefix}-help`}>{copy.help}</p>
      <div ref={fieldRef}>
        <TextField
          label={t.recipients}
          description={t.recipientsHelp}
          value={text}
          onChange={onTextChange}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          inputMode="email"
          autoComplete="off"
          isDisabled={isDisabled}
          isInvalid={fieldError !== null}
          errorMessage={fieldError ?? undefined}
          // An invalid field must not block the drawer's form natively; Save checks it instead.
          validationBehavior="aria"
          data-testid={`${testIdPrefix}-input`}
        />
      </div>
      <TagGroup
        label={t.count.replace('{count}', String(addresses.length)).replace('{max}', MAX)}
        onRemove={isDisabled ? undefined : remove}
        errorMessage={problem ?? undefined}
        data-testid={`${testIdPrefix}-list`}
      >
        <TagList
          items={addresses.map((address) => ({
            id: address,
            textValue: address,
            'data-testid': `${testIdPrefix}-chip`,
          }))}
          renderEmptyState={() => t.none}
        />
      </TagGroup>
      {duplicates && <p data-testid={`${testIdPrefix}-duplicates`}>{duplicates}</p>}
      <p
        role="status"
        aria-live="polite"
        className="visually-hidden"
        data-testid={`${testIdPrefix}-status`}
      >
        {announcement}
      </p>
    </div>
  );
}
