import { log } from '@temporalio/activity';

export async function sample(name: string): Promise<string> {
  log.info('Running sample activity', { name });
  return `Hello, ${name}! Temporal is working on OpenShift.`;
}
