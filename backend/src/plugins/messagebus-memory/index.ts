import type {
  MessageBusAdapter,
  MessageBusPluginDefinition,
} from '../../core/integrations/messagebus/MessageBusAdapter';
import type { PluginConfigReader } from '../../core/config/pluginConfig';

function createInMemoryMessageBusAdapter(config: PluginConfigReader): MessageBusAdapter {
  void config; // Required by interface; this plugin does not use config
  const handlers = new Map<string, Array<(payload: Record<string, unknown>) => Promise<void>>>();

  return {
    async publish(topic: string, payload: Record<string, unknown>): Promise<void> {
      void topic;
      void payload;
      // No-op for in-memory default; worker keeps polling outbox.
    },

    subscribe(
      topic: string | string[],
      handler: (payload: Record<string, unknown>) => Promise<void>,
    ): () => void {
      const topics = Array.isArray(topic) ? topic : [topic];
      for (const t of topics) {
        const list = handlers.get(t) ?? [];
        list.push(handler);
        handlers.set(t, list);
      }
      return () => {
        for (const t of topics) {
          const list = handlers.get(t) ?? [];
          const idx = list.indexOf(handler);
          if (idx !== -1) list.splice(idx, 1);
          if (list.length === 0) handlers.delete(t);
          else handlers.set(t, list);
        }
      };
    },
  };
}

export const messagebusPluginDefinition: MessageBusPluginDefinition = {
  code: 'messagebus-memory',
  createAdapter: createInMemoryMessageBusAdapter,
};
