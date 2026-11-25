import { readdir, readlink } from 'node:fs/promises';

/**
 * Files under `dir` this process still holds open, removed ones included. Read from /proc, so it
 * finds them on Linux, where the tests run in the dev container and CI, and finds none elsewhere.
 */
export const openFilesUnder = async (dir: string): Promise<string[]> => {
  if (process.platform !== 'linux') return [];
  const descriptors = await readdir('/proc/self/fd');
  const targets = await Promise.all(
    descriptors.map((fd) => readlink(`/proc/self/fd/${fd}`).catch(() => '')),
  );
  return targets.filter((target) => target.startsWith(dir));
};
