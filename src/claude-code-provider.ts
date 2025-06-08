import { ClaudeCodeLanguageModel } from './claude-code-language-model.js';
import { ClaudeCodeCLI } from './claude-code-cli.js';
import type { ClaudeCodeSettings } from './types.js';
import { claudeCodeModelSchema } from './types.js';

export interface ClaudeCodeProvider {
  (modelId: 'opus' | 'sonnet', settings?: ClaudeCodeSettings): ClaudeCodeLanguageModel;

  languageModel(modelId: 'opus' | 'sonnet', settings?: ClaudeCodeSettings): ClaudeCodeLanguageModel;
}

export function createClaudeCode(options: ClaudeCodeSettings = {}): ClaudeCodeProvider {
  const cli = new ClaudeCodeCLI(options.maxConcurrentProcesses);

  const createModel = (modelId: 'opus' | 'sonnet', settings: ClaudeCodeSettings = {}) => {
    const config = claudeCodeModelSchema.parse({
      model: modelId,
      cliPath: settings.cliPath ?? options.cliPath ?? 'claude',
      skipPermissions: settings.skipPermissions ?? options.skipPermissions ?? true,
      disallowedTools: [],
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