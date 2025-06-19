import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeCodeLanguageModel } from './claude-code-language-model.js';

// Mock the SDK module with factory function
vi.mock('@anthropic-ai/claude-code', () => {
  return {
    query: vi.fn(),
    AbortError: class AbortError extends Error {
      constructor(message?: string) {
        super(message);
        this.name = 'AbortError';
      }
    },
  };
});

// Import the mocked module to get typed references
import { query as mockQuery, AbortError as MockAbortError } from '@anthropic-ai/claude-code';

describe('ClaudeCodeLanguageModel', () => {
  let model: ClaudeCodeLanguageModel;

  beforeEach(() => {
    vi.clearAllMocks();
    
    model = new ClaudeCodeLanguageModel({
      id: 'sonnet',
      settings: {},
    });
  });

  describe('doGenerate', () => {
    it('should generate text from SDK response', async () => {
      const mockResponse = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'system',
            subtype: 'init',
            session_id: 'test-session-123',
          };
          yield {
            type: 'assistant',
            message: {
              content: [
                { type: 'text', text: 'Hello, ' },
                { type: 'text', text: 'world!' },
              ],
            },
          };
          yield {
            type: 'result',
            subtype: 'success',
            session_id: 'test-session-123',
            usage: {
              input_tokens: 10,
              output_tokens: 5,
              cache_creation_input_tokens: 0,
              cache_read_input_tokens: 0,
            },
            total_cost_usd: 0.001,
            duration_ms: 1000,
          };
        },
      };

      vi.mocked(mockQuery).mockReturnValue(mockResponse);

      const result = await model.doGenerate({
        prompt: [{ role: 'user', content: 'Say hello' }],
        mode: { type: 'regular' },
      });

      expect(result.text).toBe('Hello, world!');
      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
      });
      expect(result.finishReason).toBe('stop');
    });

    it('should handle error_max_turns as length finish reason', async () => {
      const mockResponse = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: 'Partial response' }],
            },
          };
          yield {
            type: 'result',
            subtype: 'error_max_turns',
            session_id: 'test-session-123',
            usage: {
              input_tokens: 100,
              output_tokens: 50,
            },
          };
        },
      };

      vi.mocked(mockQuery).mockReturnValue(mockResponse);

      const result = await model.doGenerate({
        prompt: [{ role: 'user', content: 'Complex task' }],
        mode: { type: 'regular' },
      });

      expect(result.finishReason).toBe('length');
    });

    it('should handle AbortError correctly', async () => {
      const abortController = new AbortController();
      const abortReason = new Error('User cancelled');
      
      // Set up the mock to throw AbortError when called
      vi.mocked(mockQuery).mockImplementation(() => {
        throw new MockAbortError('Operation aborted');
      });

      // Abort before calling to ensure signal.aborted is true
      abortController.abort(abortReason);

      const promise = model.doGenerate({
        prompt: [{ role: 'user', content: 'Test abort' }],
        mode: { type: 'regular' },
        abortSignal: abortController.signal,
      });

      // Should throw the abort reason since signal is aborted
      await expect(promise).rejects.toThrow(abortReason);
    });
  });

  describe('doStream', () => {
    it('should stream text chunks from SDK response', async () => {
      const mockResponse = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: 'Hello' }],
            },
          };
          yield {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: ', world!' }],
            },
          };
          yield {
            type: 'result',
            subtype: 'success',
            session_id: 'test-session-123',
            usage: {
              input_tokens: 10,
              output_tokens: 5,
            },
            total_cost_usd: 0.001,
            duration_ms: 1000,
          };
        },
      };

      vi.mocked(mockQuery).mockReturnValue(mockResponse);

      const result = await model.doStream({
        prompt: [{ role: 'user', content: 'Say hello' }],
        mode: { type: 'regular' },
      });

      const chunks: any[] = [];
      const reader = result.stream.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual({
        type: 'text-delta',
        textDelta: 'Hello',
      });
      expect(chunks[1]).toEqual({
        type: 'text-delta',
        textDelta: ', world!',
      });
      expect(chunks[2]).toMatchObject({
        type: 'finish',
        finishReason: 'stop',
        usage: {
          promptTokens: 10,
          completionTokens: 5,
        },
      });
    });

    it('should emit JSON once in object-json mode and return finish metadata', async () => {
      const mockResponse = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: '{"a": 1' }],
            },
          };
          yield {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: ', "b": 2}' }],
            },
          };
          yield {
            type: 'result',
            subtype: 'success',
            session_id: 'json-session-1',
            usage: {
              input_tokens: 6,
              output_tokens: 3,
            },
            total_cost_usd: 0.001,
            duration_ms: 1000,
          };
        },
      };

      vi.mocked(mockQuery).mockReturnValue(mockResponse);

      const result = await model.doStream({
        prompt: [{ role: 'user', content: 'Return JSON' }],
        mode: { type: 'object-json' },
        temperature: 0.5, // This will trigger a warning
      });

      const chunks: any[] = [];
      const reader = result.stream.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual({
        type: 'text-delta',
        textDelta: '{\n  "a": 1,\n  "b": 2\n}',
      });
      expect(chunks[1]).toMatchObject({
        type: 'finish',
        finishReason: 'stop',
        usage: {
          promptTokens: 6,
          completionTokens: 3,
        },
        providerMetadata: {
          'claude-code': {
            sessionId: 'json-session-1',
            costUsd: 0.001,
            durationMs: 1000,
          },
        },
      });

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings?.[0]).toMatchObject({
        type: 'unsupported-setting',
        setting: 'temperature',
      });
    });

    it('should handle malformed JSON in object-json streaming mode', async () => {
      const mockResponse = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: 'Here is the JSON: {"a": 1, "b": ' }],
            },
          };
          yield {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: 'invalid}' }],
            },
          };
          yield {
            type: 'result',
            subtype: 'success',
            session_id: 'json-session-2',
            usage: {
              input_tokens: 8,
              output_tokens: 5,
            },
          };
        },
      };

      vi.mocked(mockQuery).mockReturnValue(mockResponse);

      const result = await model.doStream({
        prompt: [{ role: 'user', content: 'Return invalid JSON' }],
        mode: { type: 'object-json' },
      });

      const chunks: any[] = [];
      const reader = result.stream.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      expect(chunks).toHaveLength(2);
      // When JSON is malformed, extractJson returns the original text
      expect(chunks[0]).toEqual({
        type: 'text-delta',
        textDelta: 'Here is the JSON: {"a": 1, "b": invalid}',
      });
      expect(chunks[1]).toMatchObject({
        type: 'finish',
        finishReason: 'stop',
        usage: {
          promptTokens: 8,
          completionTokens: 5,
        },
      });
    });
  });

  describe('model configuration', () => {
    it('should store model ID correctly', () => {
      const sonnetModel = new ClaudeCodeLanguageModel({ id: 'sonnet' });
      expect(sonnetModel.modelId).toBe('sonnet');

      const opusModel = new ClaudeCodeLanguageModel({ id: 'opus' });
      expect(opusModel.modelId).toBe('opus');
      
      // Test custom model ID
      const customModel = new ClaudeCodeLanguageModel({ id: 'custom-model' });
      expect(customModel.modelId).toBe('custom-model');
    });
    
    it('should have correct provider name', () => {
      const model = new ClaudeCodeLanguageModel({ id: 'sonnet' });
      expect(model.provider).toBe('claude-code');
    });
    
    it('should have correct specification version', () => {
      const model = new ClaudeCodeLanguageModel({ id: 'sonnet' });
      expect(model.specificationVersion).toBe('v1');
    });
    
    it('should support object generation mode', () => {
      const model = new ClaudeCodeLanguageModel({ id: 'sonnet' });
      expect(model.defaultObjectGenerationMode).toBe('json');
    });
  });
});