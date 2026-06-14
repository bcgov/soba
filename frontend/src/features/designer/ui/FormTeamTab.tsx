import React from 'react';
import type { Dictionary } from '@/src/types/plugins';

interface FormTeamTabProps {
  dict: Dictionary;
}

export default function FormTeamTab({ dict }: FormTeamTabProps) {
  return (
    <div className="p-3 border rounded-bottom bg-white border-top-0">
      <h3 className="h5 mb-3">{dict.form.teamManagement || 'Team Management'}</h3>
      <p className="text-muted">
        {dict.form.teamPlaceholder || 'Team management tools will be available here.'}
      </p>
    </div>
  );
}
