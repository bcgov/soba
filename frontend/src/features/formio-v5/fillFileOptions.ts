export const fillFormOptions = ({
  canWrite,
  fileOption,
  submissionId,
}: {
  canWrite: boolean;
  fileOption: Record<string, unknown>;
  submissionId: string;
}) => ({
  noAlerts: true,
  readOnly: !canWrite,
  ...fileOption,
  bcgovFile: {
    ...(fileOption.bcgovFile as Record<string, unknown> | undefined),
    offlineScope: submissionId,
  },
});

type StoredFilesField = {
  component?: { type?: string };
  resetValue: () => void;
  refreshOfflineFiles: () => Promise<unknown>;
};

type Webform = { everyComponent: (visit: (component: unknown) => void) => void };

const isStoredFilesField = (component: unknown): component is StoredFilesField => {
  const field = component as Partial<StoredFilesField> | null;
  return (
    field?.component?.type === 'bcgov-file' &&
    typeof field.resetValue === 'function' &&
    typeof field.refreshOfflineFiles === 'function'
  );
};

/**
 * Deletes the files the browser holds for this form until it can upload them, with the answers they
 * belong to. Left there, the next form mounted for the submission would restore them.
 */
export async function discardStoredFiles(webform: Webform): Promise<void> {
  const fields: StoredFilesField[] = [];
  webform.everyComponent((component) => {
    if (isStoredFilesField(component)) fields.push(component);
  });
  // A reset deletes the field's stored files; the refresh after it waits for that.
  fields.forEach((field) => field.resetValue());
  await Promise.all(fields.map((field) => field.refreshOfflineFiles()));
}
