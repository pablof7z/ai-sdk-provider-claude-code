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
import { createAPICallError, createAuthenticationError, isAuthenticationError, getErrorMetadata } from './errors.js';
import { calcUsage } from './utils/usage.js';
import { 
  parseClaudeResult, 
  extractJsonFromObjectMode, 
  buildProviderMetadata, 
  handleSessionId,
  isObjectToolMode
} from './utils/parse.js';

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
    rawResponse?: {
      headers?: Record<string, string>;
    };
    warnings?: LanguageModelV1CallWarning[];
    providerMetadata?: LanguageModelV1ProviderMetadata;
  }> {
    const { prompt, mode } = options;

    // For object-tool mode, we don't support it yet
    if (isObjectToolMode(mode)) {
      throw new UnsupportedFunctionalityError({
        functionality: 'object-tool mode',
      });
    }

    // Estimate if response might exceed 8K based on prompt characteristics
    const promptText = this.messagesToPrompt(prompt);
    const largeResponseThreshold = this.config.largeResponseThreshold ?? 1000;
    
    const estimatedLarge = 
      promptText.length > largeResponseThreshold || // Large prompts often generate large responses
      mode.type === 'object-json' || // Object generation tends to be verbose
      (options.maxTokens && options.maxTokens > 2000); // High token limit
    
    if (estimatedLarge) {
      // Use streaming internally to bypass 8K stdout buffer limit
      try {
        return await this.doGenerateViaStreaming(options);
      } catch (streamError) {
        // If streaming fails with certain errors, try regular mode as fallback
        if (this.isRetryableStreamError(streamError)) {
          return await this.doGenerateNormal(options);
        }
        throw streamError;
      }
    }
    
    // Use normal non-streaming for small responses
    return await this.doGenerateNormal(options);
  }

  private async doGenerateNormal(options: LanguageModelV1CallOptions): Promise<{
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
    rawResponse?: {
      headers?: Record<string, string>;
    };
    warnings?: LanguageModelV1CallWarning[];
    providerMetadata?: LanguageModelV1ProviderMetadata;
  }> {
    const { prompt, mode } = options;

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
        throw createAPICallError({
          message: `Claude CLI failed with exit code ${result.exitCode}`,
          exitCode: result.exitCode,
          stderr: result.stderr,
          promptExcerpt: promptText.slice(0, 100),
          isRetryable: false,
        });
      }

      // Parse response - Claude CLI returns a single JSON object for non-streaming
      let jsonResponse;
      try {
        jsonResponse = JSON.parse(result.stdout.trim());
      } catch {
        // Check if response was truncated
        const output = result.stdout.trim();
        const lastChar = output[output.length - 1];
        const isTruncated = lastChar !== '}' && lastChar !== ']';
        
        throw createAPICallError({
          message: isTruncated 
            ? `Claude CLI response was truncated at ${output.length} characters. This is a bug - please report it. The provider should have automatically used streaming mode.`
            : 'Failed to parse Claude CLI response as JSON',
          code: 'JSON_PARSE_ERROR',
          stderr: output.slice(0, 500),
          promptExcerpt: promptText.slice(0, 100),
          isRetryable: false,
        });
      }
      
      // Check for errors
      if (jsonResponse.is_error) {
        throw createAPICallError({
          message: jsonResponse.error || 'Claude CLI returned an error',
          code: 'CLI_ERROR',
          isRetryable: false,
        });
      }

      // Parse the result
      const parsed = parseClaudeResult(jsonResponse);
      let text = parsed.text;
      
      // For object-json mode, extract and validate JSON
      if (mode.type === 'object-json') {
        const jsonContent = extractJsonFromObjectMode(text);
        if (jsonContent) {
          text = jsonContent;
        } else {
          text = this.extractJson(text);
        }
      }
      
      // Update session ID only if it was provided in config
      if (this.config.sessionId) {
        this.sessionId = handleSessionId(this.sessionId, parsed.sessionId) || this.sessionId;
      }

      // Calculate token usage
      const usage = calcUsage(parsed.usage);

      return {
        text,
        finishReason: 'stop' as LanguageModelV1FinishReason,
        usage,
        rawCall: {
          rawPrompt: promptText,
          rawSettings: {
            model: this.modelId,
            sessionId: this.sessionId,
          },
        },
        rawResponse: {
          headers: {},
        },
        warnings: [],
        providerMetadata: buildProviderMetadata(this.sessionId, parsed),
      };
    } catch (error) {
      if (isAuthenticationError(error)) {
        throw createAuthenticationError({
          message: 'Authentication failed. Please run "claude login" to authenticate.',
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
    rawResponse?: {
      headers?: Record<string, string>;
    };
    request?: {
      body?: string;
    };
    warnings?: LanguageModelV1CallWarning[];
  }> {
    // For object-tool mode, we don't support it yet
    if (isObjectToolMode(options.mode)) {
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
              if (isSystemEvent(event) && this.config.sessionId) {
                this.sessionId = handleSessionId(this.sessionId, event.session_id) || this.sessionId;
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
                // Update session ID only if it was provided in config
                if (this.config.sessionId) {
                  this.sessionId = handleSessionId(this.sessionId, event.session_id) || this.sessionId;
                }
                
                // For object mode, send the accumulated and extracted JSON as a single text delta
                if (options.mode.type === 'object-json' && accumulatedText) {
                  const jsonContent = extractJsonFromObjectMode(accumulatedText);
                  const extractedJson = jsonContent || this.extractJson(accumulatedText);
                  controller.enqueue({
                    type: 'text-delta',
                    textDelta: extractedJson,
                  } as LanguageModelV1StreamPart);
                }
                
                // Parse result and calculate usage
                const parsed = parseClaudeResult(event);
                const usage = calcUsage(parsed.usage);
                
                controller.enqueue({
                  type: 'finish',
                  finishReason: 'stop',
                  usage,
                  providerMetadata: buildProviderMetadata(this.sessionId, parsed),
                } as LanguageModelV1StreamPart);
              } else if (isErrorEvent(event)) {
                controller.error(createAPICallError({
                  message: event.error.message || 'Claude CLI error',
                  code: event.error.code || 'CLI_ERROR',
                  isRetryable: false,
                }));
                return;
              }
            }

            controller.close();
          } catch (error) {
            if (isAuthenticationError(error)) {
              controller.error(createAuthenticationError({
                message: 'Authentication failed. Please run "claude login" to authenticate.',
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
      rawResponse: {
        headers: {},
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
      // System messages in AI SDK have content as a string
      const systemContent = systemMessage.content;
      return systemContent ? `${systemContent}\n\n${messages}` : messages;
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

  private async doGenerateViaStreaming(options: LanguageModelV1CallOptions): Promise<{
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
    rawResponse?: {
      headers?: Record<string, string>;
    };
    warnings?: LanguageModelV1CallWarning[];
    providerMetadata?: LanguageModelV1ProviderMetadata;
  }> {
    const { prompt, mode } = options;
    
    // Convert messages to a single prompt string
    let promptText = this.messagesToPrompt(prompt);
    
    // For object-json mode, append JSON generation instructions
    if (mode.type === 'object-json') {
      promptText = this.appendJsonInstructions(promptText, mode);
    }
    
    // Accumulate the full response using streaming
    let accumulatedText = '';
    let usage: { promptTokens: number; completionTokens: number } | undefined;
    let sessionId: string | undefined;
    let providerMetadata: LanguageModelV1ProviderMetadata = {};
    
    try {
      const eventStream = this.cli.stream(
        promptText,
        { ...this.config, sessionId: this.sessionId },
        { signal: options.abortSignal }
      );
      
      for await (const event of eventStream) {
        if (isSystemEvent(event)) {
          sessionId = handleSessionId(sessionId, event.session_id) || sessionId;
        } else if (isAssistantEvent(event) && event.message) {
          const messageContent = event.message.content?.[0]?.text;
          if (messageContent) {
            accumulatedText += messageContent;
          }
        } else if (isResultEvent(event)) {
          sessionId = handleSessionId(sessionId, event.session_id) || sessionId;
          
          // Parse result and calculate usage
          const parsed = parseClaudeResult(event);
          usage = calcUsage(parsed.usage);
          providerMetadata = buildProviderMetadata(sessionId, parsed);
        } else if (isErrorEvent(event)) {
          throw createAPICallError({
            message: event.error.message || 'Claude CLI error',
            code: event.error.code || 'CLI_ERROR',
            isRetryable: false,
          });
        }
      }
      
      // Process accumulated text
      if (mode.type === 'object-json') {
        const jsonContent = extractJsonFromObjectMode(accumulatedText);
        accumulatedText = jsonContent || this.extractJson(accumulatedText);
      } else if (accumulatedText.includes('```')) {
        accumulatedText = this.extractJson(accumulatedText);
      }
      
      // Update session ID only if it was provided in config
      if (this.config.sessionId) {
        this.sessionId = handleSessionId(this.sessionId, sessionId) || this.sessionId;
      }
      
      return {
        text: accumulatedText,
        finishReason: 'stop' as LanguageModelV1FinishReason,
        usage: usage || { promptTokens: 0, completionTokens: 0 },
        rawCall: {
          rawPrompt: promptText,
          rawSettings: {
            model: this.modelId,
            sessionId: this.sessionId,
          },
        },
        rawResponse: {
          headers: {},
        },
        warnings: [],
        providerMetadata,
      };
    } catch (error) {
      if (isAuthenticationError(error)) {
        throw createAuthenticationError({
          message: 'Authentication failed. Please run "claude login" to authenticate.',
        });
      }
      throw error;
    }
  }

  private isRetryableStreamError(error: unknown): boolean {
    // Only retry on specific errors that might succeed with non-streaming
    const metadata = getErrorMetadata(error);
    if (metadata) {
      return metadata.code === 'TIMEOUT' || metadata.code === 'STREAM_ERROR';
    }
    return false;
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