import type {
  LanguageModelV1,
  LanguageModelV1CallWarning,
  LanguageModelV1FinishReason,
  LanguageModelV1StreamPart,
} from '@ai-sdk/provider';
import type { ClaudeCodeSettings } from './types.js';
import { convertToClaudeCodeMessages } from './convert-to-claude-code-messages.js';

import { query, AbortError, type Options } from '@anthropic-ai/claude-code';

export interface ClaudeCodeLanguageModelOptions {
  id: ClaudeCodeModelId;
  settings?: ClaudeCodeSettings;
}

export type ClaudeCodeModelId = 'opus' | 'sonnet' | (string & {});

const modelMap: Record<string, string> = {
  'opus': 'opus',
  'sonnet': 'sonnet',
};

export class ClaudeCodeLanguageModel implements LanguageModelV1 {
  readonly specificationVersion = 'v1' as const;
  readonly defaultObjectGenerationMode = 'json' as const;

  readonly modelId: ClaudeCodeModelId;
  readonly settings: ClaudeCodeSettings;
  
  private sessionId?: string;

  constructor(options: ClaudeCodeLanguageModelOptions) {
    this.modelId = options.id;
    this.settings = options.settings ?? {};
  }

  get provider(): string {
    return 'claude-code';
  }

  private getModel(): string {
    const mapped = modelMap[this.modelId];
    return mapped ?? this.modelId;
  }

  async doGenerate(
    options: Parameters<LanguageModelV1['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV1['doGenerate']>>> {
    const { messagesPrompt } = convertToClaudeCodeMessages(options.prompt);

    const abortController = new AbortController();
    if (options.abortSignal) {
      options.abortSignal.addEventListener('abort', () => abortController.abort());
    }

    const queryOptions: Options = {
      model: this.getModel(),
      abortController,
      resume: this.sessionId,
      pathToClaudeCodeExecutable: this.settings.pathToClaudeCodeExecutable,
      customSystemPrompt: this.settings.customSystemPrompt,
      appendSystemPrompt: this.settings.appendSystemPrompt,
      maxTurns: this.settings.maxTurns,
      maxThinkingTokens: this.settings.maxThinkingTokens,
      cwd: this.settings.cwd,
      executable: this.settings.executable,
      executableArgs: this.settings.executableArgs,
      permissionMode: this.settings.permissionMode as any, // SDK expects specific string type
      permissionPromptToolName: this.settings.permissionPromptToolName,
      continue: this.settings.continue,
      allowedTools: this.settings.allowedTools,
      disallowedTools: this.settings.disallowedTools,
      mcpServers: this.settings.mcpServers as any, // SDK has specific type for this
    };

    let text = '';
    let usage = { promptTokens: 0, completionTokens: 0 };
    let finishReason: LanguageModelV1FinishReason = 'stop';
    let costUsd: number | undefined;
    let durationMs: number | undefined;
    let rawUsage: any | undefined;
    const warnings: LanguageModelV1CallWarning[] = [];

    try {
      const response = query({
        prompt: messagesPrompt,
        options: queryOptions,
      });

      for await (const message of response) {
        if (message.type === 'assistant') {
          text += message.message.content.map((c: any) => 
            c.type === 'text' ? c.text : ''
          ).join('');
        } else if (message.type === 'result') {
          this.sessionId = message.session_id;
          costUsd = message.total_cost_usd;
          durationMs = message.duration_ms;
          
          if ('usage' in message) {
            rawUsage = message.usage;
            usage = {
              promptTokens: (message.usage.cache_creation_input_tokens ?? 0) + 
                           (message.usage.cache_read_input_tokens ?? 0) +
                           (message.usage.input_tokens ?? 0),
              completionTokens: message.usage.output_tokens ?? 0,
            };
          }

          if (message.subtype === 'error_max_turns') {
            finishReason = 'length';
          } else if (message.subtype === 'error_during_execution') {
            finishReason = 'error';
          }
        } else if (message.type === 'system' && message.subtype === 'init') {
          this.sessionId = message.session_id;
        }
      }
    } catch (error: any) {
      if (error instanceof AbortError) {
        throw options.abortSignal?.aborted ? options.abortSignal.reason : error;
      }
      throw error;
    }

    return {
      text: text || undefined,
      usage,
      finishReason,
      rawCall: {
        rawPrompt: messagesPrompt,
        rawSettings: queryOptions,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
      providerMetadata: {
        'claude-code': {
          ...(this.sessionId !== undefined && { sessionId: this.sessionId }),
          ...(costUsd !== undefined && { costUsd }),
          ...(durationMs !== undefined && { durationMs }),
          ...(rawUsage !== undefined && { rawUsage }),
        },
      },
    };
  }

  async doStream(
    options: Parameters<LanguageModelV1['doStream']>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV1['doStream']>>> {
    const { messagesPrompt } = convertToClaudeCodeMessages(options.prompt);

    const abortController = new AbortController();
    if (options.abortSignal) {
      options.abortSignal.addEventListener('abort', () => abortController.abort());
    }

    const queryOptions: Options = {
      model: this.getModel(),
      abortController,
      resume: this.sessionId,
      pathToClaudeCodeExecutable: this.settings.pathToClaudeCodeExecutable,
      customSystemPrompt: this.settings.customSystemPrompt,
      appendSystemPrompt: this.settings.appendSystemPrompt,
      maxTurns: this.settings.maxTurns,
      maxThinkingTokens: this.settings.maxThinkingTokens,
      cwd: this.settings.cwd,
      executable: this.settings.executable,
      executableArgs: this.settings.executableArgs,
      permissionMode: this.settings.permissionMode as any, // SDK expects specific string type
      permissionPromptToolName: this.settings.permissionPromptToolName,
      continue: this.settings.continue,
      allowedTools: this.settings.allowedTools,
      disallowedTools: this.settings.disallowedTools,
      mcpServers: this.settings.mcpServers as any, // SDK has specific type for this
    };

    const warnings: LanguageModelV1CallWarning[] = [];

    const stream = new ReadableStream<LanguageModelV1StreamPart>({
      start: async (controller) => {
        try {
          const response = query({
            prompt: messagesPrompt,
            options: queryOptions,
          });

          let usage = { promptTokens: 0, completionTokens: 0 };

          for await (const message of response) {
            if (message.type === 'assistant') {
              const text = message.message.content
                .map((c: any) => (c.type === 'text' ? c.text : ''))
                .join('');
              
              if (text) {
                controller.enqueue({
                  type: 'text-delta',
                  textDelta: text,
                });
              }
            } else if (message.type === 'result') {
              let rawUsage: any | undefined;
              if ('usage' in message) {
                rawUsage = message.usage;
                usage = {
                  promptTokens: (message.usage.cache_creation_input_tokens ?? 0) + 
                               (message.usage.cache_read_input_tokens ?? 0) +
                               (message.usage.input_tokens ?? 0),
                  completionTokens: message.usage.output_tokens ?? 0,
                };
              }

              let finishReason: LanguageModelV1FinishReason = 'stop';
              if (message.subtype === 'error_max_turns') {
                finishReason = 'length';
              } else if (message.subtype === 'error_during_execution') {
                finishReason = 'error';
              }

              // Store session ID in the model instance
              this.sessionId = message.session_id;
              
              controller.enqueue({
                type: 'finish',
                finishReason,
                usage,
                providerMetadata: {
                  'claude-code': {
                    sessionId: message.session_id,
                    ...(message.total_cost_usd !== undefined && { costUsd: message.total_cost_usd }),
                    ...(message.duration_ms !== undefined && { durationMs: message.duration_ms }),
                    ...(rawUsage !== undefined && { rawUsage }),
                  },
                },
              });
            } else if (message.type === 'system' && message.subtype === 'init') {
              // Store session ID for future use
              this.sessionId = message.session_id;
            }
          }

          controller.close();
        } catch (error: any) {
          if (error instanceof AbortError) {
            controller.error(options.abortSignal?.aborted ? options.abortSignal.reason : error);
          } else {
            controller.error(error);
          }
        }
      },
    });

    return {
      stream,
      rawCall: {
        rawPrompt: messagesPrompt,
        rawSettings: queryOptions,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
}