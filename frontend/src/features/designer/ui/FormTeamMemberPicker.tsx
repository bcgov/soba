'use client';

import { useContext, useEffect, useState, useRef } from 'react';
import {
  ComboBox,
  ComboBoxStateContext,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
} from 'react-aria-components';
import type { Dictionary } from '@/src/types/dictionary';
import type { TeamCandidate } from '@/src/types/formTeam';
import { useFormTeamCandidates } from '../data/useFormTeam';
import styles from './FormTeamMemberPicker.module.css';

function OpenOnResults({ members }: Readonly<{ members: TeamCandidate[] }>) {
  const state = useContext(ComboBoxStateContext);
  const openedFor = useRef<TeamCandidate[] | null>(null);
  useEffect(() => {
    if (!state || members === openedFor.current) return;
    openedFor.current = members;
    if (members.length && state.isFocused && !state.isOpen) state.open(null, 'manual');
  }, [members, state]);
  return null;
}

export function FormTeamMemberPicker({
  dict,
  formId,
  onSelect,
}: Readonly<{
  dict: Dictionary;
  formId: string;
  onSelect: (member: TeamCandidate | null) => void;
}>) {
  const t = dict.team;
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<TeamCandidate | null>(null);
  const result = useFormTeamCandidates(formId, term);
  let status = '';
  if (selected) status = t.workspaceMemberSelected.replace('{name}', selected.name);
  else if (result.isLoading) status = dict.general.loading;
  else if (result.truncated) status = t.workspaceMembersTruncated;
  else if (!result.error && !result.members.length) status = t.workspaceMembersEmpty;

  return (
    <div data-testid="workspace-member-picker">
      <ComboBox
        className={styles.picker}
        items={result.members}
        selectedKey={selected?.id ?? null}
        inputValue={term}
        menuTrigger="focus"
        allowsCustomValue
        onInputChange={(value) => {
          setTerm(value);
          if (selected && value !== selected.name) {
            setSelected(null);
            onSelect(null);
          }
        }}
        onSelectionChange={(key) => {
          const member = result.members.find((candidate) => candidate.id === key);
          if (!member) return;
          setSelected(member);
          setTerm(member.name);
          onSelect(member);
        }}
      >
        <OpenOnResults members={result.members} />
        <Label>{t.workspaceMemberSearch}</Label>
        <Input className={styles.input} maxLength={254} data-testid="workspace-member-search" />
        <Popover className={styles.popover}>
          <ListBox<TeamCandidate> className={styles.list}>
            {(member) => (
              <ListBoxItem id={member.id} textValue={member.name} className={styles.option}>
                <span>{member.name}</span>
                {member.email && <span className={styles.email}>{member.email}</span>}
              </ListBoxItem>
            )}
          </ListBox>
        </Popover>
      </ComboBox>
      {result.error && <p role="alert">{t.workspaceMembersError}</p>}
      <output className="d-block mt-2">{status}</output>
    </div>
  );
}
