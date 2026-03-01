/**
 * Pluggable message bus adapter for event distribution and async processing.
 * Implementations are provided by plugins (e.g. messagebus-memory, messagebus-redis)
 * and selected via MESSAGEBUS_DEFAULT_CODE.
 */
import type { PluginConfigReader } from '../../config/pluginConfig';

export interface MessageBusAdapter {
  publish(topic: string, payload: Record<string, unknown>): Promise<void>;
  subscribe?(
    topic: string | string[],
    handler: (payload: Record<string, unknown>) => Promise<void>,
  ): void | (() => void);
}

export interface MessageBusPluginDefinition {
  code: string;
  createAdapter: (config: PluginConfigReader) => MessageBusAdapter;
}
