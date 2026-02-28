import { enqueueOutboxEvent } from '../../db/repos/outboxRepo';
import { QueueAdapter, QueueEvent } from './QueueAdapter';

export class DbOutboxQueueAdapter implements QueueAdapter {
  async enqueue(event: QueueEvent): Promise<void> {
    await enqueueOutboxEvent(event);
  }
}
