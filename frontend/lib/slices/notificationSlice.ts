import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  text: string;
  type?: NotificationType;
  consoleError?: unknown;
}

export type NotificationState = {
  notifications: Notification[];
};

const initialState: NotificationState = {
  notifications: [],
};

let nextId = 0;

const slice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    addNotification(state, action: PayloadAction<Omit<Notification, 'id'>>) {
      const id = String(++nextId);
      state.notifications.push({ id, ...action.payload });
      if (action.payload.consoleError) {
        console.error(action.payload.text, action.payload.consoleError);
      }
    },
    removeNotification(state, action: PayloadAction<string>) {
      state.notifications = state.notifications.filter((n) => n.id !== action.payload);
    },
    clearNotifications(state) {
      state.notifications = [];
    },
  },
});

export const { addNotification, removeNotification, clearNotifications } = slice.actions;

export default slice.reducer;
