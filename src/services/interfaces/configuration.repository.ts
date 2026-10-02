import type { Configuration } from '../../domain/schemas';

/**
 * ConfigurationRepository — stores and retrieves customer configurations.
 *
 * Production: backed by a database or Shopify metafields.
 * Demo: in-memory store via the serverless function.
 */
export interface ConfigurationRepository {
  save(configuration: Configuration): Promise<{ configurationId: string }>;
  load(configurationId: string): Promise<Configuration | null>;
}
