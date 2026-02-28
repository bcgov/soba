export interface QueueEvent {
  topic: string;
  aggregateType: string;
  aggregateId: string;
  workspaceId: string;
  payload: Record<string, unknown>;
  actorId?: string;
}

export interface QueueAdapter {
  enqueue(event: QueueEvent): Promise<void>;
}
