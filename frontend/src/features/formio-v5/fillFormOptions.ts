export const fillFormOptions = ({
  canWrite,
  fileOption,
  submissionId,
}: {
  canWrite: boolean;
  fileOption: Record<string, unknown>;
  submissionId: string;
}) => ({
  // We own all submit messaging (success toast + redirect, inline error), so suppress Form.io's
  // built-in green "Submission Complete" alert.
  noAlerts: true,
  readOnly: !canWrite,
  ...fileOption,
  bcgovFile: {
    ...(fileOption.bcgovFile as Record<string, unknown> | undefined),
    // Files kept in the browser until they upload are restored only into this submission's form.
    offlineScope: submissionId,
  },
});
