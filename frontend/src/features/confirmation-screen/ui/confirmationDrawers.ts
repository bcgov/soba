import type { ReactNode } from 'react';
import { CONFIRMATION_DRAWER_ID } from '../constants';
import {
  hasConfirmationSettings,
  type ConfirmationScreenAvailability,
} from '../data/useConfirmationScreenAvailable';

/** The Confirmation Screen card for the After Submission tab, or none when it has nothing to show. */
export const confirmationDrawers = (
  availability: ConfirmationScreenAvailability,
  drawer: ReactNode,
): { id: string; node: ReactNode }[] =>
  hasConfirmationSettings(availability) ? [{ id: CONFIRMATION_DRAWER_ID, node: drawer }] : [];
