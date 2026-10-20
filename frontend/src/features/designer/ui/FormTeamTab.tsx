'use client';
import type { Dictionary } from '@/src/types/dictionary';
import { IdirUserPicker } from '@/src/features/identity-directory/ui/IdirUserPicker';

interface FormTeamTabProps {
  dict: Dictionary;
  workspaceId?: string | null;
  canSearch?: boolean;
}

export default function FormTeamTab({ workspaceId, canSearch }: Readonly<FormTeamTabProps>) {
  return (
    <div className="p-3 border rounded-bottom bg-white border-top-0">
      {workspaceId && canSearch ? (
        <IdirUserPicker key={workspaceId} workspaceId={workspaceId} />
      ) : (
        <p className="text-muted mb-0">
          A workspace owner or admin role is required to search IDIR users.
        </p>
      )}
    </div>
  );
}
