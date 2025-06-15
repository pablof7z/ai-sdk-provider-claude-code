import type {
  LanguageModelV1,
  LanguageModelV1CallOptions,
  LanguageModelV1CallWarning,
  LanguageModelV1FinishReason,
  LanguageModelV1StreamPart,
} from '@ai-sdk/provider';
import { NoSuchModelError } from '@ai-sdk/provider';
import { z } from 'zod';
import type { ClaudeCodeSettings } from './types.js';
import { convertToClaudeCodeMessages } from './convert-to-claude-code-messages.js';
import { mapClaudeCodeFinishReason } from './map-claude-code-finish-reason.js';

// @ts-ignore - SDK types are not exported properly
import { query, AbortError } from '@anthropic-ai/claude-code/sdk.mjs';

type SDKMessage = any;
type Options = any;

export interface ClaudeCodeLanguageModelOptions {
  id: ClaudeCodeModelId;
  settings?: ClaudeCodeSettings;
}

export type ClaudeCodeModelId = 'opus' | 'sonnet';

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
    options: LanguageModelV1CallOptions,
  ): Promise<{
    text: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
    };
    finishReason: LanguageModelV1FinishReason;
    rawCall: { rawPrompt: unknown; rawSettings: Record<string, unknown> };
    warnings?: LanguageModelV1CallWarning[];
  }> {
    const { messagesPrompt } = convertToClaudeCodeMessages(options.prompt);

    const abortController = new AbortController();
    if (options.abortSignal) {
      options.abortSignal.addEventListener('abort', () => abortController.abort());
    }

    const queryOptions: Options = {
      model: this.getModel(),
      abortController,
      resume: this.sessionId,
      timeoutMs: this.settings.timeoutMs,
      pathToClaudeCodeExecutable: this.settings.pathToClaudeCodeExecutable,
      customSystemPrompt: this.settings.customSystemPrompt,
      appendSystemPrompt: this.settings.appendSystemPrompt,
      maxTurns: this.settings.maxTurns,
      maxThinkingTokens: this.settings.maxThinkingTokens,
      cwd: this.settings.cwd,
      executable: this.settings.executable,
      executableArgs: this.settings.executableArgs,
      permissionMode: this.settings.permissionMode,
      permissionPromptToolName: this.settings.permissionPromptToolName,
      continue: this.settings.continue,
      allowedTools: this.settings.allowedTools,
      disallowedTools: this.settings.disallowedTools,
      mcpServers: this.settings.mcpServers,
    };

    let text = '';
    let usage = { promptTokens: 0, completionTokens: 0 };
    let finishReason: LanguageModelV1FinishReason = 'stop';
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
          
          if ('usage' in message) {
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
      text,
      usage,
      finishReason,
      rawCall: {
        rawPrompt: messagesPrompt,
        rawSettings: queryOptions,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  async doStream(
    options: LanguageModelV1CallOptions,
  ): Promise<{
    stream: ReadableStream<LanguageModelV1StreamPart>;
    rawCall: { rawPrompt: unknown; rawSettings: Record<string, unknown> };
    warnings?: LanguageModelV1CallWarning[];
  }> {
    const { messagesPrompt } = convertToClaudeCodeMessages(options.prompt);

    const abortController = new AbortController();
    if (options.abortSignal) {
      options.abortSignal.addEventListener('abort', () => abortController.abort());
    }

    const queryOptions: Options = {
      model: this.getModel(),
      abortController,
      resume: this.sessionId,
      timeoutMs: this.settings.timeoutMs,
      pathToClaudeCodeExecutable: this.settings.pathToClaudeCodeExecutable,
      customSystemPrompt: this.settings.customSystemPrompt,
      appendSystemPrompt: this.settings.appendSystemPrompt,
      maxTurns: this.settings.maxTurns,
      maxThinkingTokens: this.settings.maxThinkingTokens,
      cwd: this.settings.cwd,
      executable: this.settings.executable,
      executableArgs: this.settings.executableArgs,
      permissionMode: this.settings.permissionMode,
      permissionPromptToolName: this.settings.permissionPromptToolName,
      continue: this.settings.continue,
      allowedTools: this.settings.allowedTools,
      disallowedTools: this.settings.disallowedTools,
      mcpServers: this.settings.mcpServers,
    };

    const warnings: LanguageModelV1CallWarning[] = [];

    const stream = new ReadableStream<LanguageModelV1StreamPart>({
      async start(controller) {
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
              if ('usage' in message) {
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

              controller.enqueue({
                type: 'finish',
                finishReason,
                usage,
                providerMetadata: {
                  sessionId: message.session_id,
                  costUsd: message.total_cost_usd,
                  durationMs: message.duration_ms,
                },
              });
            } else if (message.type === 'system' && message.subtype === 'init') {
              // Store session ID for future use
              (controller as any).sessionId = message.session_id;
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