import type { Dictionary } from '@/src/types/plugins';

interface FormTeamTabProps {
  dict: Dictionary;
}

export default function FormTeamTab({ dict }: FormTeamTabProps) {
  return (
    <div className="p-3 border rounded-bottom bg-white border-top-0">
      <p className="text-muted mb-0" data-testid="team-coming-soon">
        {dict.general.comingSoon}
      </p>
    </div>
  );
}
