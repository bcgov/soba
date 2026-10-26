'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@bcgov/design-system-react-components';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import { useDictionary } from '@/app/[lang]/Providers';
import { usePageHeading } from '@/src/components/PageHeader';
import { SecondaryText } from '@/src/components/SecondaryText';
import { LoadErrorAlert } from '@/src/shared/ui/LoadErrorAlert';
import { useAuthErrorDefaults } from '@/src/shared/api/useDataErrorNotice';
import { fillTemplate } from '@/src/shared/util/stringUtils';
import { saveBlob } from '@/src/shared/util/saveBlob';
import { useSubmissionFile } from '@/src/features/designer/data/useSubmissionExport';

type SubmissionFileDownloadProps = {
  submissionId: string;
  fileId: string;
};

/** Saves an export's attachment once read. */
export function SubmissionFileDownload({
  submissionId,
  fileId,
}: Readonly<SubmissionFileDownloadProps>) {
  const dict = useDictionary();
  const text = dict.submission.export.file;
  const authDefaults = useAuthErrorDefaults();
  const { data, error } = useSubmissionFile(submissionId, fileId);
  const saved = useRef(false);

  usePageHeading({ heading: text.pageTitle });

  useEffect(() => {
    if (!data || saved.current) return;
    saved.current = true;
    saveBlob(data.blob, data.filename);
  }, [data]);

  if (error) {
    return (
      <LoadErrorAlert
        error={error}
        messages={{ ...authDefaults, failed: text.loadError }}
        testIds={{ failed: 'submission-file-loaderror' }}
      />
    );
  }
  if (!data) return <CenteredProgress label={text.loading} />;
  return (
    <div className="mt-3 d-flex flex-column gap-2 align-items-start">
      <SecondaryText elementType="p" data-testid="submission-file-saved">
        {fillTemplate(text.saved, { name: data.filename })}
      </SecondaryText>
      <Button
        variant="secondary"
        onPress={() => saveBlob(data.blob, data.filename)}
        data-testid="submission-file-again"
      >
        {text.again}
      </Button>
    </div>
  );
}
