/**
 * Configuration module
 * Handles loading, parsing, and validating dev.config.* files
 */

export * from './schema';
export * from './parser';
export {
  type Config,
  type Module,
  type WorkspaceModule,
  type DockerModule,
  type CustomModule,
  type GlobalConfig,
} from './schema';
