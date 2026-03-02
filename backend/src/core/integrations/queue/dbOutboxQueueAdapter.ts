import { enqueueOutboxEvent } from '../../db/repos/outboxRepo';
import type { MessageBusAdapter } from '../messagebus/MessageBusAdapter';
import { QueueAdapter, QueueEvent } from './QueueAdapter';

const OUTBOX_WORK_AVAILABLE_TOPIC = 'outbox.work_available';

export class DbOutboxQueueAdapter implements QueueAdapter {
  constructor(private readonly messageBus?: MessageBusAdapter) {}

  async enqueue(event: QueueEvent): Promise<void> {
    await enqueueOutboxEvent(event);
    await this.messageBus?.publish(OUTBOX_WORK_AVAILABLE_TOPIC, {});
  }
}
