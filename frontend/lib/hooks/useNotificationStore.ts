'use client'

import { useAppDispatch, useAppSelector } from '../store';
import { addNotification, removeNotification, clearNotifications } from '../slices/notificationSlice';
import type { NotificationType } from '../slices/notificationSlice';

export interface AddNotificationPayload {
  text: string;
  type?: NotificationType;
  consoleError?: unknown;
}

export function useNotificationStore() {
  const dispatch = useAppDispatch();
  const notifications = useAppSelector((state) => state.notification.notifications);

  return {
    notifications,
    addNotification: (payload: AddNotificationPayload) => dispatch(addNotification(payload)),
    removeNotification: (id: string) => dispatch(removeNotification(id)),
    clearNotifications: () => dispatch(clearNotifications()),
  };
}
