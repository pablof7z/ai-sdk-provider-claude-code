import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeCodeLanguageModel } from './claude-code-language-model';
import { ClaudeCodeCLI } from './claude-code-cli';
import type { LanguageModelV1CallOptions } from '@ai-sdk/provider';
import { UnsupportedFunctionalityError } from '@ai-sdk/provider';
import { ClaudeCodeError } from './errors';
import type { ClaudeCodeEvent, ClaudeCodeAssistantEvent, ClaudeCodeResultEvent, ClaudeCodeErrorEvent } from './types';

vi.mock('./claude-code-cli');

describe('ClaudeCodeLanguageModel', () => {
  let model: ClaudeCodeLanguageModel;
  let mockCLI: ClaudeCodeCLI;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCLI = new ClaudeCodeCLI();
    
    model = new ClaudeCodeLanguageModel('opus', {
      model: 'opus',
      cliPath: 'claude',
      skipPermissions: true,
      allowedTools: [],
      disallowedTools: [],
    }, mockCLI);
  });

  describe('doGenerate', () => {
    it('should generate text response', async () => {
      const mockExecute = vi.spyOn(mockCLI, 'execute').mockResolvedValue({
        stdout: JSON.stringify({
          type: 'result',
          subtype: 'success',
          result: 'Hello!',
          session_id: 'sess_123',
          is_error: false,
          usage: {
            input_tokens: 10,
            output_tokens: 5,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0
          },
          cost_usd: 0.001,
          duration_ms: 1000
        }),
        stderr: '',
        exitCode: 0,
      });

      const options: LanguageModelV1CallOptions = {
        prompt: [
          { role: 'user', content: [{ type: 'text', text: 'Say hello' }] },
        ],
        mode: { type: 'regular' },
      };

      const result = await model.doGenerate(options);

      expect(mockExecute).toHaveBeenCalledWith(
        'Say hello',
        expect.objectContaining({ model: 'opus' }),
        expect.objectContaining({ signal: undefined })
      );

      expect(result).toMatchObject({
        text: 'Hello!',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5 },
      });
      // Session ID should not be persisted when not provided in config
      expect(result.providerMetadata?.['claude-code']?.sessionId).toBeUndefined();
    });

    it('should handle system messages', async () => {
      vi.spyOn(mockCLI, 'execute').mockResolvedValue({
        stdout: JSON.stringify({
          type: 'result',
          result: 'Response',
          is_error: false,
          usage: { input_tokens: 0, output_tokens: 0 }
        }),
        stderr: '',
        exitCode: 0,
      });

      const options: LanguageModelV1CallOptions = {
        prompt: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        ],
        mode: { type: 'regular' },
      };

      const result = await model.doGenerate(options);
      
      expect(mockCLI.execute).toHaveBeenCalledWith(
        'You are helpful\n\nHello',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should handle authentication errors', async () => {
      vi.spyOn(mockCLI, 'execute').mockResolvedValue({
        stdout: '',
        stderr: 'Authentication failed',
        exitCode: 401,
      });

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
        mode: { type: 'regular' },
      };

      await expect(model.doGenerate(options)).rejects.toThrow(
        'Authentication failed. Please run "claude login" to authenticate.'
      );
    });

    it('should handle conversation with assistant messages', async () => {
      vi.spyOn(mockCLI, 'execute').mockResolvedValue({
        stdout: JSON.stringify({
          type: 'result',
          result: 'Nice to meet you!',
          is_error: false,
          usage: { input_tokens: 0, output_tokens: 0 }
        }),
        stderr: '',
        exitCode: 0,
      });

      const options: LanguageModelV1CallOptions = {
        prompt: [
          { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
          { role: 'assistant', content: [{ type: 'text', text: 'Hi there!' }] },
          { role: 'user', content: [{ type: 'text', text: 'My name is Alice' }] },
        ],
        mode: { type: 'regular' },
      };

      await model.doGenerate(options);

      expect(mockCLI.execute).toHaveBeenCalledWith(
        'Hello\n\nAssistant: Hi there!\n\nMy name is Alice',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should handle object-json mode with schema', async () => {
      const mockStream = vi.spyOn(mockCLI, 'stream').mockImplementation(async function* () {
        yield { 
          type: 'assistant', 
          message: { 
            content: [{ type: 'text', text: 'Here is the JSON object:\n```json\n{"name": "John", "age": 30}\n```' }] 
          } 
        } as any;
        yield { 
          type: 'result', 
          session_id: 'sess_123',
          usage: { input_tokens: 20, output_tokens: 10 } 
        } as any;
      });

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Generate a person object' }] }],
        mode: {
          type: 'object-json',
          schema: { 
            type: 'object', 
            properties: { 
              name: { type: 'string' },
              age: { type: 'number' }
            },
            required: ['name', 'age']
          },
          name: 'Person',
          description: 'A person object with name and age'
        },
        inputFormat: 'messages',
      };

      const result = await model.doGenerate(options);

      // Verify the prompt includes JSON instructions
      expect(mockStream).toHaveBeenCalledWith(
        expect.stringContaining('Generate a person object'),
        expect.any(Object),
        expect.any(Object)
      );
      
      const actualPrompt = mockStream.mock.calls[0][0];
      expect(actualPrompt).toContain('IMPORTANT: You must respond with valid JSON');
      expect(actualPrompt).toContain('A person object with name and age');
      expect(actualPrompt).toContain('The JSON object represents: Person');
      expect(actualPrompt).toContain('"required":');
      expect(actualPrompt).toContain('"name"');
      expect(actualPrompt).toContain('"age"');

      // Verify JSON extraction
      expect(result.text).toBe('{"name": "John", "age": 30}');
      expect(result.finishReason).toBe('stop');
    });

    it('should handle object-json mode without schema', async () => {
      vi.spyOn(mockCLI, 'stream').mockImplementation(async function* () {
        yield { 
          type: 'assistant', 
          message: { 
            content: [{ type: 'text', text: '{"items": ["apple", "banana"], "total": 2}' }] 
          } 
        } as any;
        yield { 
          type: 'result',
          usage: { input_tokens: 15, output_tokens: 8 } 
        } as any;
      });

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'List some fruits' }] }],
        mode: { type: 'object-json' },
        inputFormat: 'messages',
      };

      const result = await model.doGenerate(options);
      expect(result.text).toBe('{"items": ["apple", "banana"], "total": 2}');
    });

    it('should extract JSON from various formats', async () => {
      const testCases = [
        {
          input: 'Plain JSON: {"key": "value"}',
          expected: '{"key": "value"}'
        },
        {
          input: 'Here is the result:\n\n```json\n{"nested": {"data": 123}}\n```\n\nThat\'s the JSON.',
          expected: '{"nested": {"data": 123}}'
        },
        {
          input: 'Array response: [1, 2, 3, 4, 5]',
          expected: '[1, 2, 3, 4, 5]'
        },
        {
          input: '```\n{"code": "block", "without": "json"}\n```',
          expected: '{"code": "block", "without": "json"}'
        }
      ];

      for (const testCase of testCases) {
        vi.spyOn(mockCLI, 'stream').mockImplementation(async function* () {
          yield { 
            type: 'assistant', 
            message: { 
              content: [{ type: 'text', text: testCase.input }] 
            } 
          } as any;
          yield { 
            type: 'result',
            usage: { input_tokens: 10, output_tokens: 5 } 
          } as any;
        });

        const options: LanguageModelV1CallOptions = {
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Generate JSON' }] }],
          mode: { type: 'object-json' },
          inputFormat: 'messages',
        };

        const result = await model.doGenerate(options);
        expect(result.text).toBe(testCase.expected);
      }
    });

    it('should handle invalid JSON gracefully', async () => {
      vi.spyOn(mockCLI, 'stream').mockImplementation(async function* () {
        yield { 
          type: 'assistant', 
          message: { 
            content: [{ type: 'text', text: 'This is not valid JSON at all' }] 
          } 
        } as any;
        yield { 
          type: 'result',
          usage: { input_tokens: 10, output_tokens: 5 } 
        } as any;
      });

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Generate JSON' }] }],
        mode: { type: 'object-json' },
        inputFormat: 'messages',
      };

      const result = await model.doGenerate(options);
      // Should return original text when JSON parsing fails
      expect(result.text).toBe('This is not valid JSON at all');
    });

    it('should throw error for object-tool mode', async () => {
      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Use tool' }] }],
        mode: {
          type: 'object-tool',
          tool: {
            type: 'function',
            name: 'getTool',
            description: 'A test tool',
            parameters: { type: 'object', properties: {} },
          },
        },
        inputFormat: 'messages',
      };

      await expect(model.doGenerate(options)).rejects.toThrow(UnsupportedFunctionalityError);
      await expect(model.doGenerate(options)).rejects.toThrow("'object-tool mode' functionality not supported");
    });

    it('should handle rate limit errors', async () => {
      vi.spyOn(mockCLI, 'execute').mockResolvedValue({
        stdout: '',
        stderr: 'Rate limit exceeded',
        exitCode: 429,
      });

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
        mode: { type: 'regular' },
        inputFormat: 'messages',
      };

      await expect(model.doGenerate(options)).rejects.toThrow(
        'Claude CLI failed with exit code 429'
      );
    });

    it('should handle network errors', async () => {
      vi.spyOn(mockCLI, 'execute').mockResolvedValue({
        stdout: '',
        stderr: 'Network error: Connection failed',
        exitCode: 1,
      });

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
        mode: { type: 'regular' },
        inputFormat: 'messages',
      };

      await expect(model.doGenerate(options)).rejects.toThrow(
        'Claude CLI failed with exit code 1'
      );
    });

    it('should handle timeout errors', async () => {
      vi.spyOn(mockCLI, 'execute').mockRejectedValue(
        new ClaudeCodeError({
          message: 'Claude CLI timed out after 120 seconds',
          code: 'TIMEOUT',
          promptExcerpt: 'Test',
        })
      );

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
        mode: { type: 'regular' },
        inputFormat: 'messages',
      };

      await expect(model.doGenerate(options)).rejects.toThrow(
        'Claude CLI timed out after 120 seconds'
      );
    });

    it('should handle malformed JSON responses', async () => {
      vi.spyOn(mockCLI, 'execute').mockResolvedValue({
        stdout: 'invalid json response',
        stderr: '',
        exitCode: 0,
      });

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
        mode: { type: 'regular' },
        inputFormat: 'messages',
      };

      await expect(model.doGenerate(options)).rejects.toThrow();
    });

    it('should handle empty responses', async () => {
      vi.spyOn(mockCLI, 'execute').mockResolvedValue({
        stdout: JSON.stringify({}),
        stderr: '',
        exitCode: 0,
      });

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
        mode: { type: 'regular' },
        inputFormat: 'messages',
      };

      const result = await model.doGenerate(options);
      expect(result.text).toBe('');
    });

    it('should handle CLI process spawn errors', async () => {
      vi.spyOn(mockCLI, 'execute').mockRejectedValue(
        new Error('spawn claude ENOENT')
      );

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
        mode: { type: 'regular' },
        inputFormat: 'messages',
      };

      await expect(model.doGenerate(options)).rejects.toThrow(
        'spawn claude ENOENT'
      );
    });

    it('should handle result with error flag', async () => {
      vi.spyOn(mockCLI, 'execute').mockResolvedValue({
        stdout: JSON.stringify({
          type: 'result',
          subtype: 'error',
          result: '',
          is_error: true,
          error: 'Processing failed',
          usage: { input_tokens: 0, output_tokens: 0 }
        }),
        stderr: '',
        exitCode: 0,
      });

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
        mode: { type: 'regular' },
        inputFormat: 'messages',
      };

      await expect(model.doGenerate(options)).rejects.toThrow(
        'Processing failed'
      );
    });

    it('should handle AbortSignal cancellation', async () => {
      const abortController = new AbortController();
      
      vi.spyOn(mockCLI, 'execute').mockImplementation(async (_prompt, _config, options) => {
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Check if aborted
        if (options?.signal?.aborted) {
          throw new Error('The operation was aborted');
        }
        
        return {
          stdout: JSON.stringify({
            type: 'result',
            result: 'Success',
            is_error: false,
            usage: { input_tokens: 0, output_tokens: 0 }
          }),
          stderr: '',
          exitCode: 0,
        };
      });

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
        mode: { type: 'regular' },
        inputFormat: 'messages',
        abortSignal: abortController.signal,
      };

      // Abort after 25ms
      setTimeout(() => abortController.abort(), 25);

      await expect(model.doGenerate(options)).rejects.toThrow(
        'The operation was aborted'
      );
    });
  });

  describe('doStream', () => {
    it('should stream text response using spawn CLI', async () => {
      const mockStream = async function* (): AsyncGenerator<ClaudeCodeEvent> {
        yield {
          type: 'assistant',
          subtype: 'message_delta',
          message: {
            content: [{ text: 'Hello world!' }]
          }
        } as ClaudeCodeAssistantEvent;
        yield {
          type: 'result',
          subtype: 'success',
          result: 'Hello world!',
          session_id: 'sess_456',
          is_error: false,
          usage: {
            input_tokens: 10,
            output_tokens: 5,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0
          }
        } as ClaudeCodeResultEvent;
      };
      
      vi.spyOn(mockCLI, 'stream').mockReturnValue(mockStream());

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Say hello' }] }],
        mode: { type: 'regular' },
      };

      const result = await model.doStream(options);
      const reader = result.stream.getReader();

      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toMatchObject({ type: 'text-delta', textDelta: 'Hello world!' });
      expect(chunks[1]).toMatchObject({
        type: 'finish',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5 },
      });
      // Session ID should not be persisted when not provided in config
      expect(chunks[1].providerMetadata?.['claude-code']?.sessionId).toBeUndefined();
    });

    it('should handle streaming errors', async () => {
      const mockStream = async function* (): AsyncGenerator<ClaudeCodeEvent> {
        yield {
          type: 'error',
          subtype: 'error',
          error: {
            message: 'Stream error',
            code: 'STREAM_ERROR'
          }
        } as ClaudeCodeErrorEvent;
      };
      
      vi.spyOn(mockCLI, 'stream').mockReturnValue(mockStream());

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
        mode: { type: 'regular' },
      };

      const result = await model.doStream(options);
      const reader = result.stream.getReader();

      await expect(reader.read()).rejects.toThrow('Stream error');
    });

    it('should handle object-json mode in streaming', async () => {
      const mockStream = async function* (): AsyncGenerator<ClaudeCodeEvent> {
        yield {
          type: 'assistant',
          subtype: 'message_delta',
          message: {
            content: [{ text: 'Here is the JSON:\n```json\n{' }]
          }
        } as ClaudeCodeAssistantEvent;
        yield {
          type: 'assistant',
          subtype: 'message_delta',
          message: {
            content: [{ text: '"name": "Alice", "age": 25}' }]
          }
        } as ClaudeCodeAssistantEvent;
        yield {
          type: 'assistant',
          subtype: 'message_delta',
          message: {
            content: [{ text: '\n```' }]
          }
        } as ClaudeCodeAssistantEvent;
        yield {
          type: 'result',
          subtype: 'success',
          result: 'Here is the JSON:\n```json\n{"name": "Alice", "age": 25}\n```',
          session_id: 'sess_789',
          is_error: false,
          usage: {
            input_tokens: 20,
            output_tokens: 10
          }
        } as ClaudeCodeResultEvent;
      };
      
      vi.spyOn(mockCLI, 'stream').mockReturnValue(mockStream());

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Generate a person' }] }],
        mode: {
          type: 'object-json',
          schema: { type: 'object', properties: { name: { type: 'string' }, age: { type: 'number' } } },
        },
        inputFormat: 'messages',
      };

      const result = await model.doStream(options);
      const reader = result.stream.getReader();

      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      // In object mode, we accumulate text and send it as one chunk before finish
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toMatchObject({ 
        type: 'text-delta', 
        textDelta: '{"name": "Alice", "age": 25}' 
      });
      expect(chunks[1]).toMatchObject({
        type: 'finish',
        finishReason: 'stop',
        usage: { promptTokens: 20, completionTokens: 10 }
      });
    });

    it('should throw error for object-tool mode in streaming', async () => {
      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Use tool' }] }],
        mode: {
          type: 'object-tool',
          tool: {
            type: 'function',
            name: 'getTool', 
            description: 'A test tool',
            parameters: { type: 'object', properties: {} },
          },
        },
        inputFormat: 'messages',
      };

      await expect(model.doStream(options)).rejects.toThrow(UnsupportedFunctionalityError);
      await expect(model.doStream(options)).rejects.toThrow("'object-tool mode' functionality not supported");
    });

    it('should handle streaming timeout errors', async () => {
      const mockStream = async function* () {
        throw new ClaudeCodeError({
          message: 'Claude CLI timed out after 120 seconds',
          code: 'TIMEOUT',
          promptExcerpt: 'Test stream',
        });
      };
      
      vi.spyOn(mockCLI, 'stream').mockReturnValue(mockStream());

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test stream' }] }],
        mode: { type: 'regular' },
        inputFormat: 'messages',
      };

      const result = await model.doStream(options);
      const reader = result.stream.getReader();

      await expect(reader.read()).rejects.toThrow('Claude CLI timed out after 120 seconds');
    });

    it('should handle streaming abort signal', async () => {
      const abortController = new AbortController();
      let shouldAbort = false;
      
      const mockStream = async function* () {
        // Simulate some initial data
        yield {
          type: 'assistant',
          message: {
            content: [{ text: 'Starting...' }]
          }
        };
        
        // Wait a bit to allow abort to happen
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Check if we should abort
        if (shouldAbort) {
          throw new Error('The operation was aborted');
        }
        
        // More data
        yield {
          type: 'assistant',
          message: {
            content: [{ text: 'More text' }]
          }
        };
      };
      
      vi.spyOn(mockCLI, 'stream').mockImplementation((prompt, config, options) => {
        // Pass abort signal to our mock
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            shouldAbort = true;
          });
        }
        return mockStream();
      });

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test stream' }] }],
        mode: { type: 'regular' },
        inputFormat: 'messages',
        abortSignal: abortController.signal,
      };

      const result = await model.doStream(options);
      const reader = result.stream.getReader();

      // Read first chunk
      const { value: firstChunk } = await reader.read();
      expect(firstChunk).toMatchObject({ type: 'text-delta', textDelta: 'Starting...' });

      // Abort the operation
      abortController.abort();

      // Give time for abort to propagate
      await new Promise(resolve => setTimeout(resolve, 20));

      // Next read should fail
      await expect(reader.read()).rejects.toThrow('The operation was aborted');
    });
  });

  describe('messagesToPrompt', () => {
    it('should convert messages correctly', () => {
      // Access private method via any cast for testing
      const convertMessages = (model as any).messagesToPrompt.bind(model);

      const messages = [
        { role: 'system', content: 'Be helpful' },
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'Hi!' }] },
        { role: 'user', content: [{ type: 'text', text: 'How are you?' }] },
      ];

      const prompt = convertMessages(messages);
      expect(prompt).toBe('Be helpful\n\nHello\n\nAssistant: Hi!\n\nHow are you?');
    });
  });

  describe('Auto-streaming for large responses', () => {
    it('should use streaming for prompts larger than threshold', async () => {
      const largePrompt = 'x'.repeat(1500); // Exceeds default 1000 char threshold
      const mockStreamSpy = vi.spyOn(mockCLI, 'stream');
      const mockExecuteSpy = vi.spyOn(mockCLI, 'execute');

      // Mock streaming response
      mockStreamSpy.mockImplementation(async function* () {
        yield { type: 'assistant', message: { content: [{ text: '{"result": "streamed"}' }] } } as any;
        yield { type: 'result', usage: { input_tokens: 100, output_tokens: 50 } } as any;
      });

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: largePrompt }] }],
        mode: { type: 'regular' },
        inputFormat: 'messages',
      };

      const result = await model.doGenerate(options);

      expect(mockStreamSpy).toHaveBeenCalled();
      expect(mockExecuteSpy).not.toHaveBeenCalled();
      expect(result.text).toBe('{"result": "streamed"}');
    });

    it('should use streaming for object-json mode regardless of prompt size', async () => {
      const smallPrompt = 'short';
      const mockStreamSpy = vi.spyOn(mockCLI, 'stream');
      const mockExecuteSpy = vi.spyOn(mockCLI, 'execute');

      mockStreamSpy.mockImplementation(async function* () {
        yield { type: 'assistant', message: { content: [{ text: '{"key": "value"}' }] } } as any;
        yield { type: 'result', usage: { input_tokens: 10, output_tokens: 5 } } as any;
      });

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: smallPrompt }] }],
        mode: { type: 'object-json' },
        inputFormat: 'messages',
      };

      const result = await model.doGenerate(options);

      expect(mockStreamSpy).toHaveBeenCalled();
      expect(mockExecuteSpy).not.toHaveBeenCalled();
      expect(result.text).toBe('{"key": "value"}');
    });

    it('should use regular mode for small prompts', async () => {
      const smallPrompt = 'short prompt';
      const mockStreamSpy = vi.spyOn(mockCLI, 'stream');
      const mockExecuteSpy = vi.spyOn(mockCLI, 'execute');

      mockExecuteSpy.mockResolvedValue({
        stdout: JSON.stringify({ result: 'normal response', usage: { input_tokens: 5, output_tokens: 3 } }),
        stderr: '',
        exitCode: 0,
      });

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: smallPrompt }] }],
        mode: { type: 'regular' },
        inputFormat: 'messages',
      };

      const result = await model.doGenerate(options);

      expect(mockExecuteSpy).toHaveBeenCalled();
      expect(mockStreamSpy).not.toHaveBeenCalled();
      expect(result.text).toBe('normal response');
    });

    it('should respect custom largeResponseThreshold', async () => {
      const customConfig: ClaudeCodeModelConfig = { 
        model: 'opus',
        cliPath: 'claude',
        skipPermissions: true,
        disallowedTools: [],
        largeResponseThreshold: 50 
      };
      const customModel = new ClaudeCodeLanguageModel('opus', customConfig, mockCLI);
      
      const mediumPrompt = 'x'.repeat(60); // Exceeds custom 50 char threshold
      const mockStreamSpy = vi.spyOn(mockCLI, 'stream');

      mockStreamSpy.mockImplementation(async function* () {
        yield { type: 'assistant', message: { content: [{ text: 'streamed' }] } } as any;
        yield { type: 'result', usage: { input_tokens: 10, output_tokens: 5 } } as any;
      });

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: mediumPrompt }] }],
        mode: { type: 'regular' },
        inputFormat: 'messages',
      };

      await customModel.doGenerate(options);

      expect(mockStreamSpy).toHaveBeenCalled();
    });

    it('should use streaming when maxTokens > 2000', async () => {
      const smallPrompt = 'short';
      const mockStreamSpy = vi.spyOn(mockCLI, 'stream');

      mockStreamSpy.mockImplementation(async function* () {
        yield { type: 'assistant', message: { content: [{ text: 'large response' }] } } as any;
        yield { type: 'result', usage: { input_tokens: 10, output_tokens: 2500 } } as any;
      });

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: smallPrompt }] }],
        mode: { type: 'regular' },
        inputFormat: 'messages',
        maxTokens: 3000,
      };

      const result = await model.doGenerate(options);

      expect(mockStreamSpy).toHaveBeenCalled();
      expect(result.text).toBe('large response');
    });

    it('should fallback to normal mode on retryable stream errors', async () => {
      const largePrompt = 'x'.repeat(1500);
      const mockStreamSpy = vi.spyOn(mockCLI, 'stream');
      const mockExecuteSpy = vi.spyOn(mockCLI, 'execute');

      // First attempt: streaming fails with timeout
      mockStreamSpy.mockImplementation(async function* () {
        throw new ClaudeCodeError({
          message: 'Timeout',
          code: 'TIMEOUT',
        });
      });

      // Fallback: normal mode succeeds
      mockExecuteSpy.mockResolvedValue({
        stdout: JSON.stringify({ result: 'fallback response', usage: { input_tokens: 100, output_tokens: 50 } }),
        stderr: '',
        exitCode: 0,
      });

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: largePrompt }] }],
        mode: { type: 'regular' },
        inputFormat: 'messages',
      };

      const result = await model.doGenerate(options);

      expect(mockStreamSpy).toHaveBeenCalled();
      expect(mockExecuteSpy).toHaveBeenCalled();
      expect(result.text).toBe('fallback response');
    });

    it('should handle streaming errors without fallback for non-retryable errors', async () => {
      const largePrompt = 'x'.repeat(1500);
      const mockStreamSpy = vi.spyOn(mockCLI, 'stream');

      mockStreamSpy.mockImplementation(async function* () {
        throw new ClaudeCodeError({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      });

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: largePrompt }] }],
        mode: { type: 'regular' },
        inputFormat: 'messages',
      };

      await expect(model.doGenerate(options)).rejects.toThrow('Authentication required');
    });
  });
});