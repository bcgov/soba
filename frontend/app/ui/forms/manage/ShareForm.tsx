"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useParams } from "next/navigation";
import {
  MdShare,
  MdWarning,
  MdLink,
  MdOpenInNew,
  MdDownload,
} from "react-icons/md";
import { useDictionary } from "../../../[lang]/Providers";
import { BaseCopyToClipboard } from "../../base/BaseCopyToClipboard";

// NOTE: isRTL comes from useFormStore() via storeToRefs in Vue.
// Passed as a prop here until a form store is added.
interface ShareFormProps {
  formId: string;
  warning?: boolean;
  isRTL?: boolean;
}

function ShareForm({ formId, warning = false, isRTL = false }: ShareFormProps) {
  const dict = useDictionary();
  const params = useParams();
  const lang = (params?.lang as string) ?? "en";

  const [dialog, setDialog] = useState(false);
  const qrRef = useRef<HTMLCanvasElement>(null);

  const [formLink, setFormLink] = useState("");

  useEffect(() => {
    const url = new URL(`/${lang}/submit`, window.location.origin);
    url.searchParams.set("f", formId);
    setFormLink(url.toString());
  }, [formId, lang]);

  const downloadQr = () => {
    if (!qrRef.current) return;
    const link = document.createElement("a");
    link.download = "qrcode.png";
    link.href = qrRef.current.toDataURL();
    link.click();
  };

  return (
    <span dir={isRTL ? "rtl" : undefined}>
      {/* Share button */}
      <button
        className="mx-1 rounded p-1 text-blue-600 hover:text-blue-800"
        title={dict.forms.manage.share.shareForm}
        data-cy="shareFormButton"
        onClick={() => setDialog(true)}
      >
        <MdShare className="h-5 w-5" />
      </button>

      {/* Dialog */}
      {dialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDialog(false);
          }}
        >
          <div
            className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
            data-cy="shareFormDialog"
          >
            {/* Title */}
            <h2
              className="pb-0 text-xl font-semibold"
              lang={lang}
              dir={isRTL ? "rtl" : undefined}
            >
              {dict.forms.manage.share.shareLink}
            </h2>

            <hr className="my-4" />

            {/* Description */}
            <p className="mb-5" lang={lang} dir={isRTL ? "rtl" : undefined}>
              {dict.forms.manage.share.copyQRCode}
            </p>

            {/* Warning */}
            {warning && (
              <div
                className="mb-4 flex items-start gap-2 rounded border border-yellow-400 bg-yellow-50 p-3 text-yellow-800"
                lang={lang}
                dir={isRTL ? "rtl" : undefined}
              >
                <MdWarning className="h-5 w-5 shrink-0" />
                <span>{dict.forms.manage.share.warningMessage}</span>
              </div>
            )}

            {/* URL field with copy + open buttons */}
            <div
              className="mb-4 flex items-center gap-2"
              dir={isRTL ? "rtl" : undefined}
            >
              <MdLink className="h-5 w-5 shrink-0 text-gray-400" />
              <input
                readOnly
                value={formLink}
                data-test="text-shareUrl"
                className="flex-1 rounded border px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
              />
              <BaseCopyToClipboard
                textToCopy={formLink}
                tooltipText={dict.forms.manage.share.copyURLToClipboard}
              />
              <span className="relative inline-flex group">
                <a
                  href={formLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={dict.forms.manage.share.openThisForm}
                  className="rounded border px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                  data-cy="shareFormLinkButton"
                >
                  <MdOpenInNew className="h-5 w-5" />
                </a>
                <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {dict.forms.manage.share.openThisForm}
                </span>
              </span>
            </div>

            {/* QR Code + download */}
            <div className="flex items-end justify-center gap-4">
              <div className="qrCodeContainer mt-12">
                <QRCodeCanvas
                  ref={qrRef}
                  value={formLink || " "}
                  size={900}
                  level="M"
                  style={{ maxWidth: "250px", maxHeight: "250px" }}
                />
              </div>
              <button
                title={dict.forms.manage.share.downloadQRCode}
                onClick={downloadQr}
                className="mb-1 rounded border p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <MdDownload className="h-5 w-5" />
              </button>
            </div>

            {/* Close */}
            <div className="mt-12 flex justify-center">
              <button
                className="close-dlg rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
                title={dict.forms.manage.share.close}
                dir={isRTL ? "rtl" : undefined}
                onClick={() => setDialog(false)}
              >
                <span lang={lang}>{dict.forms.manage.share.close}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}

export default ShareForm;
export { ShareForm };
