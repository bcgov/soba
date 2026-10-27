import { env, type JobSettings } from '../config/env';

let settings: JobSettings | undefined;

/** JOB_* settings, read once per process. Throws when a set value is not valid. */
export const getJobSettings = (): JobSettings => {
  settings ??= env.getJobSettings();
  return settings;
};
