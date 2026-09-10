'use client';

import type { Dictionary } from '@/src/types/plugins';

interface FormDocumentGenerationTabProps {
  dict: Dictionary;
  formId: string;
}

/**
 * Form-level document-generation settings (template upload, print/export name, mapping). Only ever
 * mounted by FormForm when the `document-generation` feature is allowed — this component assumes
 * that gate has already been passed and does no gating of its own.
 */
export default function FormDocumentGenerationTab({ dict }: FormDocumentGenerationTabProps) {
  return (
    <div className="p-3 border rounded-bottom bg-white border-top-0">
      <p className="text-muted mb-0" data-testid="document-generation-coming-soon">
        {dict.general.comingSoon}
      </p>
    </div>
  );
}
