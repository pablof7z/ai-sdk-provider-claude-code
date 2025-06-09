import type {
  LanguageModelV1,
  LanguageModelV1CallOptions,
  LanguageModelV1CallWarning,
  LanguageModelV1FinishReason,
  LanguageModelV1StreamPart,
  LanguageModelV1ProviderMetadata,
  LanguageModelV1Message,
} from '@ai-sdk/provider';
import { ClaudeCodeCLI } from './claude-code-cli.js';
import { ClaudeCodeCLISync } from './claude-code-cli-sync.js';
import { ClaudeCodeCLIPty } from './claude-code-cli-pty.js';
import type { ClaudeCodeModelConfig } from './types.js';
import { isAssistantEvent, isResultEvent, isSystemEvent, isErrorEvent } from './types.js';
import { ClaudeCodeError, isAuthenticationError } from './errors.js';

export class ClaudeCodeLanguageModel implements LanguageModelV1 {
  readonly specificationVersion = 'v1';
  readonly defaultObjectGenerationMode = 'tool' as const;
  readonly supportsImageUrls = false;
  readonly supportsStructuredOutputs = false;

  readonly modelId: string;
  readonly provider = 'claude-code';

  private readonly config: ClaudeCodeModelConfig;
  private readonly cli: ClaudeCodeCLI;
  private readonly cliSync: ClaudeCodeCLISync;
  private readonly cliPty?: ClaudeCodeCLIPty;
  private sessionId?: string;

  constructor(
    modelId: string,
    config: ClaudeCodeModelConfig,
    cli: ClaudeCodeCLI
  ) {
    this.modelId = modelId;
    this.config = config;
    this.cli = cli;
    this.cliSync = new ClaudeCodeCLISync(); // Create sync CLI instance
    
    // Only create PTY instance if enabled and available
    if (config.enablePtyStreaming) {
      try {
        this.cliPty = new ClaudeCodeCLIPty();
      } catch {
        // PTY not available, fall back to sync
      }
    }
    
    this.sessionId = config.sessionId;
  }

  async doGenerate(options: LanguageModelV1CallOptions): Promise<{
    text?: string;
    finishReason: LanguageModelV1FinishReason;
    usage: {
      promptTokens: number;
      completionTokens: number;
    };
    rawCall: {
      rawPrompt: unknown;
      rawSettings: Record<string, unknown>;
    };
    warnings?: LanguageModelV1CallWarning[];
    providerMetadata?: LanguageModelV1ProviderMetadata;
  }> {
    const { prompt } = options;

    // Convert messages to a single prompt string
    const promptText = this.messagesToPrompt(prompt);

    try {
      // Use sync CLI for non-streaming requests
      const result = this.cliSync.execute(
        promptText,
        { ...this.config, sessionId: this.sessionId }
      );

      if (result.exitCode !== 0 && result.exitCode !== null) {
        throw new ClaudeCodeError({
          message: `Claude CLI failed with exit code ${result.exitCode}`,
          exitCode: result.exitCode,
          stderr: result.stderr,
          promptExcerpt: promptText.slice(0, 100),
        });
      }

      // Parse response - Claude CLI returns a single JSON object for non-streaming
      const jsonResponse = JSON.parse(result.stdout.trim());
      
      // Check for errors
      if (jsonResponse.is_error) {
        throw new ClaudeCodeError({
          message: jsonResponse.error || 'Claude CLI returned an error',
          code: 'CLI_ERROR',
        });
      }

      // Extract text and session ID from the response
      const text = jsonResponse.result || '';
      const newSessionId = jsonResponse.session_id;
      
      if (newSessionId) {
        this.sessionId = newSessionId;
      }

      // Extract token usage from the response
      const usage = jsonResponse.usage || {};
      const promptTokens = (usage.input_tokens || 0) + 
                          (usage.cache_creation_input_tokens || 0) + 
                          (usage.cache_read_input_tokens || 0);
      const completionTokens = usage.output_tokens || 0;

      return {
        text,
        finishReason: 'stop' as LanguageModelV1FinishReason,
        usage: {
          promptTokens,
          completionTokens,
        },
        rawCall: {
          rawPrompt: promptText,
          rawSettings: {
            model: this.modelId,
            sessionId: this.sessionId,
          },
        },
        warnings: [],
        providerMetadata: {
          'claude-code': {
            ...(this.sessionId && { sessionId: this.sessionId }),
            ...(jsonResponse.cost_usd && { costUsd: jsonResponse.cost_usd }),
            ...(jsonResponse.duration_ms && { durationMs: jsonResponse.duration_ms }),
            ...(jsonResponse.usage && { 
              rawUsage: {
                inputTokens: jsonResponse.usage.input_tokens,
                outputTokens: jsonResponse.usage.output_tokens,
                cacheCreationInputTokens: jsonResponse.usage.cache_creation_input_tokens,
                cacheReadInputTokens: jsonResponse.usage.cache_read_input_tokens,
              }
            }),
          },
        },
      };
    } catch (error) {
      if (isAuthenticationError(error)) {
        throw new ClaudeCodeError({
          message: 'Authentication failed. Please run "claude login" to authenticate.',
          code: 'AUTH_REQUIRED',
        });
      }
      throw error;
    }
  }

  async doStream(
    options: LanguageModelV1CallOptions
  ): Promise<{
    stream: ReadableStream<LanguageModelV1StreamPart>;
    rawCall: {
      rawPrompt: unknown;
      rawSettings: Record<string, unknown>;
    };
    warnings?: LanguageModelV1CallWarning[];
  }> {
    const promptText = this.messagesToPrompt(options.prompt);
    
    // Use PTY if available and enabled
    if (this.cliPty) {
      return {
        stream: new ReadableStream({
          start: async (controller) => {
            try {
              if (!this.cliPty) {
                throw new ClaudeCodeError({
                  message: 'PTY CLI instance not available',
                  code: 'PTY_UNAVAILABLE',
                });
              }
              
              const eventStream = this.cliPty.stream(
                promptText,
                { ...this.config, sessionId: this.sessionId },
                { signal: options.abortSignal }
              );

              // let fullText = '';
              for await (const event of eventStream) {
                if (isSystemEvent(event) && event.session_id && !this.sessionId) {
                  this.sessionId = event.session_id;
                } else if (isAssistantEvent(event) && event.message) {
                  const messageContent = event.message.content?.[0]?.text;
                  if (messageContent) {
                    // For true streaming, we'd need to track deltas
                    // For now, send the full text as one chunk
                    controller.enqueue({
                      type: 'text-delta',
                      textDelta: messageContent,
                    } as LanguageModelV1StreamPart);
                  }
                } else if (isResultEvent(event)) {
                  if (event.session_id) {
                    this.sessionId = event.session_id;
                  }
                  
                  // Extract token usage from the result event
                  const usage = event.usage || {};
                  const promptTokens = (usage.input_tokens || 0) + 
                                      (usage.cache_creation_input_tokens || 0) + 
                                      (usage.cache_read_input_tokens || 0);
                  const completionTokens = usage.output_tokens || 0;
                  
                  controller.enqueue({
                    type: 'finish',
                    finishReason: 'stop',
                    usage: {
                      promptTokens,
                      completionTokens,
                    },
                    providerMetadata: {
                      'claude-code': {
                        ...(this.sessionId && { sessionId: this.sessionId }),
                        ...(event.cost_usd && { costUsd: event.cost_usd }),
                        ...(event.duration_ms && { durationMs: event.duration_ms }),
                        ...(usage && { 
                          rawUsage: {
                            inputTokens: usage.input_tokens,
                            outputTokens: usage.output_tokens,
                            cacheCreationInputTokens: usage.cache_creation_input_tokens,
                            cacheReadInputTokens: usage.cache_read_input_tokens,
                          }
                        }),
                      },
                    },
                  } as LanguageModelV1StreamPart);
                } else if (isErrorEvent(event)) {
                  controller.error(new ClaudeCodeError({
                    message: event.error.message || 'Claude CLI error',
                    code: event.error.code || 'CLI_ERROR',
                  }));
                  return;
                }
              }

              controller.close();
            } catch (error) {
              controller.error(error);
            }
          },
        }),
        rawCall: {
          rawPrompt: promptText,
          rawSettings: {
            model: this.modelId,
            sessionId: this.sessionId,
            enablePtyStreaming: true,
          },
        },
        warnings: [],
      };
    }
    
    // Fall back to simulated streaming with sync CLI
    return {
      stream: new ReadableStream({
        start: async (controller) => {
          try {
            // Use sync CLI and simulate streaming
            const result = this.cliSync.execute(
              promptText,
              { ...this.config, sessionId: this.sessionId }
            );

            if (result.exitCode !== 0 && result.exitCode !== null) {
              throw new ClaudeCodeError({
                message: `Claude CLI failed with exit code ${result.exitCode}`,
                exitCode: result.exitCode,
                stderr: result.stderr,
                promptExcerpt: promptText.slice(0, 100),
              });
            }

            const jsonResponse = JSON.parse(result.stdout.trim());
            
            if (jsonResponse.is_error) {
              throw new ClaudeCodeError({
                message: jsonResponse.error || 'Claude CLI returned an error',
                code: 'CLI_ERROR',
              });
            }

            const text = jsonResponse.result || '';
            const newSessionId = jsonResponse.session_id;
            
            if (newSessionId) {
              this.sessionId = newSessionId;
            }

            // Simulate streaming by sending the whole response
            controller.enqueue({
              type: 'text-delta',
              textDelta: text,
            } as LanguageModelV1StreamPart);

            // Extract token usage from the response
            const usage = jsonResponse.usage || {};
            const promptTokens = (usage.input_tokens || 0) + 
                                (usage.cache_creation_input_tokens || 0) + 
                                (usage.cache_read_input_tokens || 0);
            const completionTokens = usage.output_tokens || 0;

            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: {
                promptTokens,
                completionTokens,
              },
              providerMetadata: {
                'claude-code': {
                  ...(this.sessionId && { sessionId: this.sessionId }),
                  ...(jsonResponse.cost_usd && { costUsd: jsonResponse.cost_usd }),
                  ...(jsonResponse.duration_ms && { durationMs: jsonResponse.duration_ms }),
                  ...(usage && { 
                    rawUsage: {
                      inputTokens: usage.input_tokens,
                      outputTokens: usage.output_tokens,
                      cacheCreationInputTokens: usage.cache_creation_input_tokens,
                      cacheReadInputTokens: usage.cache_read_input_tokens,
                    }
                  }),
                },
              },
            } as LanguageModelV1StreamPart);

            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      }),
      rawCall: {
        rawPrompt: promptText,
        rawSettings: {
          model: this.modelId,
          sessionId: this.sessionId,
        },
      },
      warnings: [],
    };
  }

  private messagesToPrompt(prompt: LanguageModelV1Message[]): string {
    const messages = prompt
      .filter(msg => msg.role !== 'system')
      .map(msg => {
        if (msg.role === 'user') {
          const content = msg.content
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join(' ');
          return content;
        } else if (msg.role === 'assistant') {
          const content = msg.content
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join(' ');
          return `Assistant: ${content}`;
        }
        return '';
      })
      .filter(text => text)
      .join('\n\n');

    // Prepend system message if present
    const systemMessage = prompt.find(msg => msg.role === 'system');
    if (systemMessage && systemMessage.role === 'system') {
      return `${systemMessage.content}\n\n${messages}`;
    }

    return messages;
  }
}