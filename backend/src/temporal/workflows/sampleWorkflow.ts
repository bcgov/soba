import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';

const { sample } = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 seconds',
});

export async function sampleWorkflow(name: string): Promise<string> {
  return await sample(name);
}
