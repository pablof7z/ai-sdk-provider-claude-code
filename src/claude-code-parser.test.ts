import { describe, it, expect } from 'vitest';
import { ClaudeCodeParser } from './claude-code-parser';
import type { ClaudeCodeEvent, ClaudeCodeAssistantEvent, ClaudeCodeResultEvent, ClaudeCodeErrorEvent } from './types';

describe('ClaudeCodeParser', () => {
  describe('extractText', () => {
    it('should extract text from assistant events', () => {
      const events: ClaudeCodeEvent[] = [
        {
          type: 'assistant',
          message: {
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            model: 'claude-3-opus',
            content: [
              { type: 'text', text: 'Hello ' },
              { type: 'text', text: 'world!' }
            ],
            stop_reason: null,
            stop_sequence: null,
            usage: {}
          },
          parent_tool_use_id: null,
          session_id: 'sess_123'
        }
      ];

      const text = ClaudeCodeParser.extractText(events);
      expect(text).toBe('Hello world!');
    });

    it('should return result text if present', () => {
      const events: ClaudeCodeEvent[] = [
        {
          type: 'assistant',
          message: {
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            model: 'claude-3-opus',
            content: [{ type: 'text', text: 'Hello ' }],
            stop_reason: null,
            stop_sequence: null,
            usage: {}
          },
          parent_tool_use_id: null,
          session_id: 'sess_123'
        },
        {
          type: 'result',
          subtype: 'success',
          cost_usd: 0.01,
          is_error: false,
          duration_ms: 1000,
          duration_api_ms: 800,
          num_turns: 1,
          result: 'Final complete text',
          session_id: 'sess_123',
          total_cost: 0.01,
          usage: {}
        }
      ];

      const text = ClaudeCodeParser.extractText(events);
      expect(text).toBe('Final complete text');
    });

    it('should handle empty events', () => {
      const events: ClaudeCodeEvent[] = [];
      const text = ClaudeCodeParser.extractText(events);
      expect(text).toBe('');
    });
  });

  describe('extractSessionId', () => {
    it('should extract session ID from result event', () => {
      const events: ClaudeCodeEvent[] = [
        {
          type: 'assistant',
          message: {
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            model: 'claude-3-opus',
            content: [{ type: 'text', text: 'Hello' }],
            stop_reason: null,
            stop_sequence: null,
            usage: {}
          },
          parent_tool_use_id: null,
          session_id: 'sess_123'
        },
        {
          type: 'result',
          subtype: 'success',
          cost_usd: 0.01,
          is_error: false,
          duration_ms: 1000,
          duration_api_ms: 800,
          num_turns: 1,
          result: 'text',
          session_id: 'sess_123',
          total_cost: 0.01,
          usage: {}
        }
      ];

      const sessionId = ClaudeCodeParser.extractSessionId(events);
      expect(sessionId).toBe('sess_123');
    });

    it('should return undefined if no session ID', () => {
      const events: ClaudeCodeEvent[] = [
        {
          type: 'system',
          subtype: 'info'
        }
      ];

      const sessionId = ClaudeCodeParser.extractSessionId(events);
      expect(sessionId).toBeUndefined();
    });
  });

  describe('findError', () => {
    it('should find error event', () => {
      const events: ClaudeCodeEvent[] = [
        { type: 'assistant', subtype: 'message_delta', message: { content: [{ text: 'Starting...' }] } } as ClaudeCodeAssistantEvent,
        { type: 'error', subtype: 'error', error: { message: 'Something went wrong', code: 'ERR_001' } } as ClaudeCodeErrorEvent,
      ];

      const error = ClaudeCodeParser.findError(events);
      expect(error).toEqual({
        type: 'error',
        subtype: 'error',
        error: { message: 'Something went wrong', code: 'ERR_001' },
      });
    });

    it('should return undefined if no error', () => {
      const events: ClaudeCodeEvent[] = [
        { type: 'assistant', subtype: 'message_delta', message: { content: [{ text: 'Hello' }] } } as ClaudeCodeAssistantEvent,
        { type: 'result', subtype: 'success', result: 'Success', is_error: false } as ClaudeCodeResultEvent,
      ];

      const error = ClaudeCodeParser.findError(events);
      expect(error).toBeUndefined();
    });
  });
});