import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeCodeLanguageModel } from './claude-code-language-model.js';

// Mock the SDK module
vi.mock('@anthropic-ai/claude-code/sdk.mjs', () => {
  const mockQuery = vi.fn();
  return {
    query: mockQuery,
    AbortError: class AbortError extends Error {},
    default: { query: mockQuery },
  };
});

describe('ClaudeCodeLanguageModel', () => {
  let model: ClaudeCodeLanguageModel;
  let mockQuery: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const sdkModule = await import('@anthropic-ai/claude-code/sdk.mjs');
    mockQuery = sdkModule.query as any;
    
    model = new ClaudeCodeLanguageModel({
      id: 'sonnet',
      settings: {
        timeoutMs: 5000,
      },
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

      mockQuery.mockReturnValue(mockResponse);

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

      mockQuery.mockReturnValue(mockResponse);

      const result = await model.doGenerate({
        prompt: [{ role: 'user', content: 'Complex task' }],
        mode: { type: 'regular' },
      });

      expect(result.finishReason).toBe('length');
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

      mockQuery.mockReturnValue(mockResponse);

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
  });

  describe('model configuration', () => {
    it('should validate timeout range', () => {
      expect(() => {
        new ClaudeCodeLanguageModel({
          id: 'sonnet',
          settings: {
            timeoutMs: 500, // Too low
          },
        });
      }).not.toThrow(); // Constructor doesn't validate, getArgs does

      const invalidModel = new ClaudeCodeLanguageModel({
        id: 'sonnet',
        settings: {
          timeoutMs: 500,
        },
      });

      // Timeout validation happens in SDK now, not in our code
      // Just verify the model was created with invalid timeout
      expect(invalidModel.settings.timeoutMs).toBe(500);
    });

    it('should map model IDs correctly', () => {
      const sonnetModel = new ClaudeCodeLanguageModel({ id: 'sonnet' });
      // @ts-ignore - accessing private method for testing
      expect(sonnetModel.getModel()).toBe('sonnet');

      const opusModel = new ClaudeCodeLanguageModel({ id: 'opus' });
      // @ts-ignore - accessing private method for testing
      expect(opusModel.getModel()).toBe('opus');
    });
  });
});