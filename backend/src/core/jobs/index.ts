import { getStorageAdapter } from '../integrations/plugins/PluginRegistry';
import { log } from '../logging';
import { getJobRegistry } from './catalog';
import { setNudgedRunner } from './nudge';
import { JobRunner } from './runner';
import { getJobSettings } from './settings';
import { JobSweeper } from './sweeper';

export { assertJobShutdownFits, getJobSettings } from './settings';

let runner: JobRunner | undefined;
let sweeper: JobSweeper | undefined;

/**
 * Start the runner and sweeper in this process. Call outside any request. Throws when the results
 * storage profile is not configured, rather than at the end of the first job that stores a file.
 */
export const startJobs = (): void => {
  if (runner) return;
  const settings = getJobSettings();
  getStorageAdapter(settings.resultsStorageProfile);
  runner = new JobRunner(getJobRegistry(), settings, log.child({ component: 'job-runner' }));
  sweeper = new JobSweeper(settings, log.child({ component: 'job-sweeper' }));
  setNudgedRunner(runner);
  runner.start();
  sweeper.start();
};

/** Stop claiming and sweeping. Resolves once running jobs end, are released or deferred, or are left. */
export const stopJobs = async (): Promise<void> => {
  await Promise.all([runner?.stop(), sweeper?.stop()]);
};
