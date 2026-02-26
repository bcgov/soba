'use client'

import { useEffect } from 'react'
import { useNotificationStore } from '@/lib/hooks/useNotificationStore'

const typeStyles: Record<string, string> = {
  info: 'bg-blue-600',
  success: 'bg-green-600',
  warning: 'bg-yellow-500',
  error: 'bg-red-600',
}

const AUTO_DISMISS_MS = 4000

interface NotificationItemProps {
  id: string
  text: string
  type?: string
  onRemove: (id: string) => void
}

function NotificationItem({ id, text, type, onRemove }: NotificationItemProps) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(id), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [id, onRemove])

  return (
    <div className={`flex items-center gap-3 rounded px-4 py-2 text-sm text-white shadow-lg ${typeStyles[type ?? ''] ?? 'bg-gray-800'}`}>
      <span>{text}</span>
      <button
        onClick={() => onRemove(id)}
        className="ml-2 opacity-70 hover:opacity-100"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}

function NotificationToast() {
  const { notifications, removeNotification } = useNotificationStore()

  if (notifications.length === 0) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      {notifications.map((n) => (
        <NotificationItem
          key={n.id}
          id={n.id}
          text={n.text}
          type={n.type}
          onRemove={removeNotification}
        />
      ))}
    </div>
  )
}

export default NotificationToast
export { NotificationToast }
