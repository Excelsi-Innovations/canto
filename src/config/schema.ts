import { z } from 'zod';

export const ModuleTypeSchema = z.enum(['workspace', 'docker', 'custom']);

export const WorkspaceCommandsSchema = z.object({
  dev: z.string().describe('Development command (e.g., "npm run dev")'),
  build: z.string().optional().describe('Build command'),
  test: z.string().optional().describe('Test command'),
  start: z.string().optional().describe('Start command'),
});

const BaseModuleSchema = z.object({
  name: z.string().min(1).describe('Unique module name'),
  type: ModuleTypeSchema.describe('Module type'),
  enabled: z.boolean().default(true).describe('Whether this module is enabled'),
  dependsOn: z
    .array(z.string())
    .optional()
    .default([])
    .describe('List of module names this depends on'),
  logs: z.string().optional().describe('Custom log file path (defaults to ./tmp/<name>.log)'),
  env: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Environment variables for this module'),
});

export const WorkspaceModuleSchema = BaseModuleSchema.extend({
  type: z.literal('workspace'),
  path: z.string().describe('Path to the workspace directory'),
  run: WorkspaceCommandsSchema.describe('Commands to execute'),
  packageManager: z
    .enum(['npm', 'yarn', 'pnpm', 'bun', 'auto'])
    .optional()
    .default('auto')
    .describe('Package manager to use (auto-detect if not specified)'),
});

export const DockerModuleSchema = BaseModuleSchema.extend({
  type: z.literal('docker'),
  composeFile: z.string().describe('Path to docker-compose.yaml file'),
  services: z
    .array(z.string())
    .optional()
    .describe('Specific services to manage (if empty, manages all)'),
  profiles: z.array(z.string()).optional().describe('Docker Compose profiles to activate'),
});

export const CustomModuleSchema = BaseModuleSchema.extend({
  type: z.literal('custom'),
  command: z.string().describe('Shell command to execute'),
  cwd: z.string().optional().describe('Working directory for the command'),
});

export const ModuleSchema = z.discriminatedUnion('type', [
  WorkspaceModuleSchema,
  DockerModuleSchema,
  CustomModuleSchema,
]);

export const GlobalConfigSchema = z.object({
  logsDir: z.string().default('./tmp').describe('Directory for log files'),
  autoAllocatePorts: z
    .boolean()
    .default(true)
    .describe('Automatically allocate free ports when conflicts detected'),
  prerequisites: z
    .object({
      docker: z.boolean().default(false).describe('Require Docker to be installed'),
      dockerCompose: z.boolean().default(false).describe('Require Docker Compose'),
      node: z.string().optional().describe('Minimum Node.js version required'),
    })
    .optional()
    .describe('Prerequisites validation'),
});

export const ConfigSchema = z.object({
  version: z.string().optional().default('1').describe('Config file version'),
  global: GlobalConfigSchema.optional().describe('Global configuration options'),
  modules: z.array(ModuleSchema).min(1).describe('List of modules to manage'),
});

export type ModuleType = z.infer<typeof ModuleTypeSchema>;
export type WorkspaceCommands = z.infer<typeof WorkspaceCommandsSchema>;
export type WorkspaceModule = z.infer<typeof WorkspaceModuleSchema>;
export type DockerModule = z.infer<typeof DockerModuleSchema>;
export type CustomModule = z.infer<typeof CustomModuleSchema>;
export type Module = z.infer<typeof ModuleSchema>;
export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;

/**
 * Validate and parse configuration data
 *
 * @param data - Raw configuration data to validate
 * @returns Validated and typed configuration object
 * @throws {z.ZodError} When validation fails
 */
export function validateConfig(data: unknown): Config {
  return ConfigSchema.parse(data);
}

/**
 * Safely validate configuration data without throwing
 *
 * @param data - Raw configuration data to validate
 * @returns Success object with data, or failure object with Zod errors
 */
export function safeValidateConfig(data: unknown):
  | {
      success: true;
      data: Config;
    }
  | {
      success: false;
      errors: z.ZodError;
    } {
  const result = ConfigSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}
