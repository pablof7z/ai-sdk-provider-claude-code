import type { LanguageModelV1, ProviderV1 } from '@ai-sdk/provider';
import { NoSuchModelError } from '@ai-sdk/provider';
import { ClaudeCodeLanguageModel, type ClaudeCodeModelId } from './claude-code-language-model.js';
import type { ClaudeCodeSettings } from './types.js';

export interface ClaudeCodeProvider extends ProviderV1 {
  (modelId: ClaudeCodeModelId, settings?: ClaudeCodeSettings): LanguageModelV1;

  languageModel(
    modelId: ClaudeCodeModelId,
    settings?: ClaudeCodeSettings,
  ): LanguageModelV1;

  chat(
    modelId: ClaudeCodeModelId,
    settings?: ClaudeCodeSettings,
  ): LanguageModelV1;
}

export interface ClaudeCodeProviderSettings {
  /**
   * Default settings to use for all models.
   */
  defaultSettings?: ClaudeCodeSettings;
}

/**
 * Create a Claude Code provider using the official SDK.
 *
 * @param options - Provider configuration options
 * @returns Claude Code provider instance
 */
export function createClaudeCode(
  options: ClaudeCodeProviderSettings = {},
): ClaudeCodeProvider {
  const createModel = (
    modelId: ClaudeCodeModelId,
    settings: ClaudeCodeSettings = {},
  ): LanguageModelV1 => {
    return new ClaudeCodeLanguageModel({
      id: modelId,
      settings: {
        ...options.defaultSettings,
        ...settings,
      },
    });
  };

  const provider = function (
    modelId: ClaudeCodeModelId,
    settings?: ClaudeCodeSettings,
  ) {
    if (new.target) {
      throw new Error(
        'The Claude Code model function cannot be called with the new keyword.',
      );
    }

    return createModel(modelId, settings);
  };

  provider.languageModel = createModel;
  provider.chat = createModel; // Alias for languageModel

  // Add textEmbeddingModel method that throws NoSuchModelError
  provider.textEmbeddingModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'textEmbeddingModel',
    });
  };

  return provider as ClaudeCodeProvider;
}

/**
 * Default Claude Code provider instance.
 */
export const claudeCode = createClaudeCode();