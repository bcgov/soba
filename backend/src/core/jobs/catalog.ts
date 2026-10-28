import { postSubmissionActionJobs } from '../../features/post-submission/actionJob';
import { fanOutSubmitted } from '../../features/post-submission/fanOut';
import { JobRegistry } from './registry';
import { submissionSubmittedJob } from './submissionSubmitted';

let registry: JobRegistry | undefined;

/**
 * Every job type this backend runs: the submitted fan-out and one type per installed action plugin.
 * Built on first use, so plugins load when jobs start rather than when a module imports this.
 */
export const getJobRegistry = (): JobRegistry => {
  if (!registry) {
    const built = new JobRegistry().register({ ...submissionSubmittedJob, run: fanOutSubmitted });
    for (const job of postSubmissionActionJobs()) built.register(job);
    registry = built;
  }
  return registry;
};
