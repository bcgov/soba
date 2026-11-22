/** Control characters and the characters file systems refuse in a name. */
// eslint-disable-next-line no-control-regex
const REFUSED = /[\u0000-\u001f\u007f/\\:*?"<>|]+/g;

/** `name` with refused characters as spaces, runs of spaces as one, and no space at either end. */
export const cleanFileName = (name: string): string =>
  name.replace(REFUSED, ' ').replace(/\s+/g, ' ').trim();
