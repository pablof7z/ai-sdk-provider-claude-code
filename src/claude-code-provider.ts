import { ClaudeCodeLanguageModel } from './claude-code-language-model.js';
import { ClaudeCodeCLI } from './claude-code-cli.js';
import type { ClaudeCodeSettings } from './types.js';
import { claudeCodeModelSchema, claudeCodeSettingsSchema } from './types.js';

export interface ClaudeCodeProvider {
  (modelId: 'opus' | 'sonnet', settings?: ClaudeCodeSettings): ClaudeCodeLanguageModel;

  languageModel(modelId: 'opus' | 'sonnet', settings?: ClaudeCodeSettings): ClaudeCodeLanguageModel;
}

export function createClaudeCode(options: ClaudeCodeSettings = {}): ClaudeCodeProvider {
  // Validate provider settings
  const validatedOptions = claudeCodeSettingsSchema.parse(options);
  const cli = new ClaudeCodeCLI(validatedOptions.maxConcurrentProcesses);

  const createModel = (modelId: 'opus' | 'sonnet', settings: ClaudeCodeSettings = {}) => {
    // Validate per-model settings if provided
    const validatedSettings = settings ? claudeCodeSettingsSchema.parse(settings) : {};
    
    const config = claudeCodeModelSchema.parse({
      model: modelId,
      cliPath: validatedSettings.cliPath ?? validatedOptions.cliPath ?? 'claude',
      skipPermissions: validatedSettings.skipPermissions ?? validatedOptions.skipPermissions ?? true,
      timeoutMs: validatedSettings.timeoutMs ?? validatedOptions.timeoutMs ?? 120000,
      sessionId: validatedSettings.sessionId ?? validatedOptions.sessionId,
      enablePtyStreaming: validatedSettings.enablePtyStreaming ?? validatedOptions.enablePtyStreaming,
      allowedTools: validatedSettings.allowedTools ?? validatedOptions.allowedTools ?? [],
      disallowedTools: validatedSettings.disallowedTools ?? validatedOptions.disallowedTools ?? [],
      largeResponseThreshold: validatedSettings.largeResponseThreshold ?? validatedOptions.largeResponseThreshold,
    });

    return new ClaudeCodeLanguageModel(modelId, config, cli);
  };

  const provider = Object.assign(createModel, {
    languageModel: createModel,
  });

  return provider as ClaudeCodeProvider;
}

/**
 * Default Claude Code provider instance.
 */
export const claudeCode = createClaudeCode();