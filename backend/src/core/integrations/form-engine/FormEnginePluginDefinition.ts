import { type Router } from 'express';
import { PluginConfigReader } from '../../config/pluginConfig';
import { FormEngineAdapter } from './FormEngineAdapter';

export interface FormEngineMetadata {
  code: string;
  name: string;
  version?: string;
}

/** Resolved route definition for a form engine that contributes HTTP routes. */
export interface FormEngineRouteDefinition {
  code: string;
  routeBasePath: string;
  createRouter: (config: PluginConfigReader) => Router;
}

export interface FormEnginePluginDefinition {
  code: string;
  metadata: FormEngineMetadata;
  createAdapter: (config: PluginConfigReader) => FormEngineAdapter;
  /**
   * Optional base path for mounting this engine's router (e.g. '/formio-v5').
   * If a function, called with the plugin config at mount time.
   */
  routeBasePath?: string | ((config: PluginConfigReader) => string);
  /**
   * Optional router factory. Only used when routeBasePath is set and
   * PLUGIN_<CODE>_ROUTES_ENABLED is 'true'.
   */
  createRouter?: (config: PluginConfigReader) => Router;
}
