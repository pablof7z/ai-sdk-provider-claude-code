import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeCodeLanguageModel } from './claude-code-language-model';
import { ClaudeCodeCLI } from './claude-code-cli';
import { ClaudeCodeCLISync } from './claude-code-cli-sync';
import type { LanguageModelV1CallOptions } from '@ai-sdk/provider';

vi.mock('./claude-code-cli');
vi.mock('./claude-code-cli-sync');

describe('ClaudeCodeLanguageModel', () => {
  let model: ClaudeCodeLanguageModel;
  let mockCLI: ClaudeCodeCLI;
  let mockCLISync: ClaudeCodeCLISync;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCLI = new ClaudeCodeCLI();
    mockCLISync = new ClaudeCodeCLISync();
    
    // Mock the sync CLI instance creation
    vi.mocked(ClaudeCodeCLISync).mockReturnValue(mockCLISync);
    
    model = new ClaudeCodeLanguageModel('opus', {
      model: 'opus',
      cliPath: 'claude',
      skipPermissions: true,
      disallowedTools: [],
    }, mockCLI);
  });

  describe('doGenerate', () => {
    it('should generate text response', async () => {
      const mockExecute = vi.spyOn(mockCLISync, 'execute').mockReturnValue({
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
        mode: 'regular',
      };

      const result = await model.doGenerate(options);

      expect(mockExecute).toHaveBeenCalledWith(
        'Say hello',
        expect.objectContaining({ model: 'opus' })
      );

      expect(result).toMatchObject({
        text: 'Hello!',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5 },
      });
      expect(result.providerMetadata?.['claude-code']?.sessionId).toBe('sess_123');
    });

    it('should handle system messages', async () => {
      vi.spyOn(mockCLISync, 'execute').mockReturnValue({
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
        mode: 'regular',
      };

      const result = await model.doGenerate(options);
      
      expect(mockCLISync.execute).toHaveBeenCalledWith(
        'You are helpful\n\nHello',
        expect.any(Object)
      );
    });

    it('should handle authentication errors', async () => {
      vi.spyOn(mockCLISync, 'execute').mockReturnValue({
        stdout: '',
        stderr: 'Authentication failed',
        exitCode: 401,
      });

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
        mode: 'regular',
      };

      await expect(model.doGenerate(options)).rejects.toThrow(
        'Authentication failed. Please run "claude login" to authenticate.'
      );
    });

    it('should handle conversation with assistant messages', async () => {
      vi.spyOn(mockCLISync, 'execute').mockReturnValue({
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
        mode: 'regular',
      };

      await model.doGenerate(options);

      expect(mockCLISync.execute).toHaveBeenCalledWith(
        'Hello\n\nAssistant: Hi there!\n\nMy name is Alice',
        expect.any(Object)
      );
    });
  });

  describe('doStream', () => {
    it('should stream text response using sync CLI', async () => {
      vi.spyOn(mockCLISync, 'execute').mockReturnValue({
        stdout: JSON.stringify({
          type: 'result',
          result: 'Hello world!',
          session_id: 'sess_456',
          is_error: false,
          usage: {
            input_tokens: 10,
            output_tokens: 5,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0
          }
        }),
        stderr: '',
        exitCode: 0,
      });

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Say hello' }] }],
        mode: 'regular',
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
        providerMetadata: { 'claude-code': { sessionId: 'sess_456' } },
      });
    });

    it('should handle streaming errors', async () => {
      vi.spyOn(mockCLISync, 'execute').mockReturnValue({
        stdout: JSON.stringify({
          is_error: true,
          error: 'Stream error'
        }),
        stderr: '',
        exitCode: 0,
      });

      const options: LanguageModelV1CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
        mode: 'regular',
      };

      const result = await model.doStream(options);
      const reader = result.stream.getReader();

      await expect(reader.read()).rejects.toThrow('Stream error');
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
});