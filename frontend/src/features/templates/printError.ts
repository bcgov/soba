import { classifyDataError, messageForDataError } from '@/src/shared/api/dataError';
import { ApiError } from '@/src/shared/api/sobaHelpers';

export type PrintErrorText = {
  failed: string;
  unprocessable: string;
  tooLarge: string;
  wrongType: string;
  sessionExpired: string;
  forbidden: string;
};

const PRINT_ERRORS: Partial<Record<number, keyof PrintErrorText>> = {
  413: 'tooLarge',
  415: 'wrongType',
  422: 'unprocessable',
};

/** The message for a failed template print: the refusal the user can act on, if there is one. */
export function printErrorText(cause: unknown, text: PrintErrorText): string {
  if (cause instanceof ApiError) {
    const key = PRINT_ERRORS[cause.status];
    if (key) return text[key];
  }
  return messageForDataError(classifyDataError(cause), text);
}
