import type {
  LanguageModelV1,
  LanguageModelV1CallOptions,
  LanguageModelV1CallWarning,
  LanguageModelV1FinishReason,
  LanguageModelV1StreamPart,
  LanguageModelV1ProviderMetadata,
  LanguageModelV1Message,
} from '@ai-sdk/provider';
import { UnsupportedFunctionalityError } from '@ai-sdk/provider';
import { ClaudeCodeCLI } from './claude-code-cli.js';
import type { ClaudeCodeModelConfig } from './types.js';
import { isAssistantEvent, isResultEvent, isSystemEvent, isErrorEvent } from './types.js';
import { ClaudeCodeError, isAuthenticationError } from './errors.js';

export class ClaudeCodeLanguageModel implements LanguageModelV1 {
  readonly specificationVersion = 'v1';
  readonly defaultObjectGenerationMode = 'json' as const;
  readonly supportsImageUrls = false;
  readonly supportsStructuredOutputs = true;

  readonly modelId: string;
  readonly provider = 'claude-code';

  private readonly config: ClaudeCodeModelConfig;
  private readonly cli: ClaudeCodeCLI;
  private sessionId?: string;

  constructor(
    modelId: string,
    config: ClaudeCodeModelConfig,
    cli: ClaudeCodeCLI
  ) {
    this.modelId = modelId;
    this.config = config;
    this.cli = cli;
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
    const { prompt, mode } = options;

    // For object-tool mode, we don't support it yet
    if (mode.type === 'object-tool') {
      throw new UnsupportedFunctionalityError({
        functionality: 'object-tool mode',
      });
    }

    // Convert messages to a single prompt string
    let promptText = this.messagesToPrompt(prompt);
    
    // For object-json mode, append JSON generation instructions
    if (mode.type === 'object-json') {
      promptText = this.appendJsonInstructions(promptText, mode);
    }

    try {
      // Use spawn CLI for non-streaming requests
      const result = await this.cli.execute(
        promptText,
        { ...this.config, sessionId: this.sessionId },
        { signal: options.abortSignal }
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
      let jsonResponse;
      try {
        jsonResponse = JSON.parse(result.stdout.trim());
      } catch {
        throw new ClaudeCodeError({
          message: 'Failed to parse Claude CLI response as JSON',
          code: 'JSON_PARSE_ERROR',
          stderr: result.stdout.slice(0, 500), // Include part of stdout for debugging
        });
      }
      
      // Check for errors
      if (jsonResponse.is_error) {
        throw new ClaudeCodeError({
          message: jsonResponse.error || 'Claude CLI returned an error',
          code: 'CLI_ERROR',
        });
      }

      // Extract text and session ID from the response
      let text = jsonResponse.result || '';
      const newSessionId = jsonResponse.session_id;
      
      // For object-json mode, extract and validate JSON
      if (mode.type === 'object-json') {
        text = this.extractJson(text);
      }
      
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
    // For object-tool mode, we don't support it yet
    if (options.mode.type === 'object-tool') {
      throw new UnsupportedFunctionalityError({
        functionality: 'object-tool mode',
      });
    }

    let promptText = this.messagesToPrompt(options.prompt);
    
    // For object-json mode, append JSON generation instructions
    if (options.mode.type === 'object-json') {
      promptText = this.appendJsonInstructions(promptText, options.mode);
    }
    
    // Use our improved spawn CLI for true zero-latency streaming
    return {
      stream: new ReadableStream({
        start: async (controller) => {
          try {
            const eventStream = this.cli.stream(
              promptText,
              { ...this.config, sessionId: this.sessionId },
              { signal: options.abortSignal }
            );

            let accumulatedText = '';
            
            for await (const event of eventStream) {
              if (isSystemEvent(event) && event.session_id && !this.sessionId) {
                this.sessionId = event.session_id;
              } else if (isAssistantEvent(event) && event.message) {
                const messageContent = event.message.content?.[0]?.text;
                if (messageContent) {
                  if (options.mode.type === 'object-json') {
                    // For object mode, accumulate text
                    accumulatedText += messageContent;
                  } else {
                    // With our readline implementation, this yields immediately when data arrives
                    controller.enqueue({
                      type: 'text-delta',
                      textDelta: messageContent,
                    } as LanguageModelV1StreamPart);
                  }
                }
              } else if (isResultEvent(event)) {
                if (event.session_id) {
                  this.sessionId = event.session_id;
                }
                
                // For object mode, send the accumulated and extracted JSON as a single text delta
                if (options.mode.type === 'object-json' && accumulatedText) {
                  const extractedJson = this.extractJson(accumulatedText);
                  controller.enqueue({
                    type: 'text-delta',
                    textDelta: extractedJson,
                  } as LanguageModelV1StreamPart);
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
            if (isAuthenticationError(error)) {
              controller.error(new ClaudeCodeError({
                message: 'Authentication failed. Please run "claude login" to authenticate.',
                code: 'AUTH_REQUIRED',
              }));
            } else {
              controller.error(error);
            }
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

  private appendJsonInstructions(
    prompt: string,
    mode: { type: 'object-json'; schema?: unknown; name?: string; description?: string }
  ): string {
    let instructions = '\n\nIMPORTANT: You must respond with valid JSON that matches the following requirements:';
    
    if (mode.description) {
      instructions += `\n\nDescription: ${mode.description}`;
    }
    
    if (mode.name) {
      instructions += `\n\nThe JSON object represents: ${mode.name}`;
    }
    
    if (mode.schema) {
      instructions += `\n\nJSON Schema:\n${JSON.stringify(mode.schema, null, 2)}`;
    }
    
    instructions += '\n\nRespond ONLY with the JSON object, no explanation, no markdown code blocks, just the raw JSON.';
    
    return prompt + instructions;
  }

  private extractJson(text: string): string {
    // Remove markdown code blocks if present
    let jsonText = text.trim();
    jsonText = jsonText.replace(/^```json\s*/gm, '');
    jsonText = jsonText.replace(/^```\s*/gm, '');
    jsonText = jsonText.replace(/```\s*$/gm, '');
    
    // Extract JSON object or array
    const objectMatch = jsonText.match(/{[\s\S]*}/); 
    const arrayMatch = jsonText.match(/\[[\s\S]*\]/);
    
    if (objectMatch) {
      jsonText = objectMatch[0];
    } else if (arrayMatch) {
      jsonText = arrayMatch[0];
    }
    
    // Validate JSON
    try {
      JSON.parse(jsonText);
      return jsonText;
    } catch {
      // If parsing fails, return the original text and let the SDK handle the error
      return text;
    }
  }
}