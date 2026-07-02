'use client';

import type { Dictionary } from '@/src/types/plugins';

interface FormSettingsTabProps {
  dict: Dictionary;
}

export default function FormSettingsTab({ dict }: FormSettingsTabProps) {
  return (
    <div className="p-3 border rounded-bottom bg-white border-top-0">
      <p className="text-muted mb-0" data-testid="settings-coming-soon">
        {dict.general.comingSoon}
      </p>
    </div>
  );
}
