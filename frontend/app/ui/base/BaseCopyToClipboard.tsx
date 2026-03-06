'use client'

import { MdContentCopy } from 'react-icons/md'
import { useDictionary } from '../../[lang]/Providers'
import { useNotificationStore } from '@/lib/hooks/useNotificationStore'
import { NotificationTypes } from '@/lib/constants'

interface BaseCopyToClipboardProps {
  textToCopy?: string
  buttonText?: string
  tooltipText?: string
  snackBarText?: string
  disabled?: boolean
  onCopied?: () => void
}

function BaseCopyToClipboard({
  textToCopy,
  buttonText = '',
  tooltipText,
  snackBarText,
  disabled = false,
  onCopied,
}: BaseCopyToClipboardProps) {
  const dict = useDictionary()
  const { addNotification } = useNotificationStore()

  const resolvedTooltip = tooltipText ?? dict.base.copyToClipboard.copyToClipboard
  const resolvedSnackBar = snackBarText ?? dict.base.copyToClipboard.linkToClipboard

  async function handleClick() {
    if (!textToCopy) return
    try {
      await navigator.clipboard.writeText(textToCopy)
      onCopied?.()
      addNotification({ text: resolvedSnackBar, ...NotificationTypes.INFO })
    } catch (e) {
      addNotification({
        text: dict.base.copyToClipboard.errCopyToClipboard,
        consoleError: e,
      })
    }
  }

  return (
    <span className="relative inline-flex group">
      <button
        onClick={handleClick}
        disabled={disabled}
        title={buttonText || resolvedTooltip}
        className="rounded border p-2 text-blue-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-gray-700"
      >
        <MdContentCopy className="h-4 w-4" />
        {buttonText && <span className="ml-1 text-sm">{buttonText}</span>}
      </button>

      {/* Tooltip on hover */}
      <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
        {resolvedTooltip}
      </span>
    </span>
  )
}

export default BaseCopyToClipboard
export { BaseCopyToClipboard }
