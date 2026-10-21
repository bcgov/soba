'use client';
import type { Dictionary } from '@/src/types/dictionary';
import { UserSearchPicker } from '@/src/features/user-search/ui/UserSearchPicker';
import { useUserSearchAllowed } from '@/src/features/user-search/data/useUserSearch';

interface FormTeamTabProps {
  dict: Dictionary;
  formId: string;
}

export default function FormTeamTab({ dict, formId }: Readonly<FormTeamTabProps>) {
  const searchAllowed = useUserSearchAllowed();
  const comingSoon = (
    <p className="text-muted mb-0" data-testid="team-coming-soon">
      {dict.general.comingSoon}
    </p>
  );
  return (
    <div className="p-3 border rounded-bottom bg-white border-top-0">
      {searchAllowed && <UserSearchPicker scope={{ kind: 'form', id: formId }} />}
      {searchAllowed === false && comingSoon}
    </div>
  );
}
