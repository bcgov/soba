import type { Dictionary } from '@/src/types/dictionary';
import type { ActionEditorProps, ActionViewProps, PostSubmissionActionUi } from '../types';
import AddressListEditor, { type AddressListCopy } from './AddressListEditor';
import AddressListView from './AddressListView';
import { addressesOf, needsAddress, withAddresses } from './addresses';

/** What sets one address-list action apart from another. */
export interface AddressListActionConfig {
  /** The action's name, what it does, and its words for the fields. */
  copy: (dict: Dictionary) => AddressListCopy & { label: string; description: string };
  /** Starts each field's test id, so two such actions on one tab stay apart. */
  testIdPrefix: string;
  notices?: NonNullable<PostSubmissionActionUi['notices']>;
}

/**
 * How the tab shows an action whose options are a list of email addresses to send to, checked with
 * the email action's address rule and limit. Call it once, when the module loads: each call makes new
 * fields, and fields made again on a render would lose the text typed in them.
 */
export function addressListAction({
  copy,
  testIdPrefix,
  notices,
}: AddressListActionConfig): PostSubmissionActionUi {
  function Editor(props: ActionEditorProps) {
    return <AddressListEditor {...props} copy={copy(props.dict)} testIdPrefix={testIdPrefix} />;
  }
  function View(props: ActionViewProps) {
    return <AddressListView {...props} testIdPrefix={testIdPrefix} />;
  }
  return {
    label: (dict) => copy(dict).label,
    description: (dict) => copy(dict).description,
    notices,
    Editor,
    View,
    problem: (values, dict) => (needsAddress(values) ? copy(dict).required : null),
    saved: (values) => withAddresses(values, addressesOf(values)),
  };
}
