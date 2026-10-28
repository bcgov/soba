'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@bcgov/design-system-react-components';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import { useDictionary } from '@/app/[lang]/Providers';
import { usePageHeading } from '@/src/components/PageHeader';
import { SecondaryText } from '@/src/components/SecondaryText';
import { LoadErrorAlert } from '@/src/shared/ui/LoadErrorAlert';
import { useAuthErrorDefaults } from '@/src/shared/api/useDataErrorNotice';
import { useDownload } from '@/src/shared/api/useDownload';
import type { DownloadedFile } from '@/src/shared/api/sobaHelpers';
import { fillTemplate } from '@/src/shared/util/stringUtils';
import { saveBlob } from '@/src/shared/util/saveBlob';

type FileDownloadProps = {
  load: (token: string) => Promise<DownloadedFile>;
};

/** Saves the loaded file once it arrives, with a button to save it again. */
export function FileDownload({ load }: Readonly<FileDownloadProps>) {
  const dict = useDictionary();
  const text = dict.fileDownload;
  const authDefaults = useAuthErrorDefaults();
  const { data, error } = useDownload(load);
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
        testIds={{ failed: 'file-download-loaderror' }}
      />
    );
  }
  if (!data) return <CenteredProgress label={text.loading} />;
  return (
    <div className="mt-3 d-flex flex-column gap-2 align-items-start">
      <SecondaryText elementType="p" data-testid="file-download-saved">
        {fillTemplate(text.saved, { name: data.filename })}
      </SecondaryText>
      <Button
        variant="secondary"
        onPress={() => saveBlob(data.blob, data.filename)}
        data-testid="file-download-again"
      >
        {text.again}
      </Button>
    </div>
  );
}
