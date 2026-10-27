import { submissionSubmittedJob } from './handlers/submissionSubmitted';
import { JobRegistry } from './registry';

/** Every job type this backend runs. Only the runner's setup imports this. */
export const jobRegistry = new JobRegistry().register(submissionSubmittedJob);
