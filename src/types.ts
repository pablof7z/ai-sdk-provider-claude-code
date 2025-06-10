import { z } from 'zod';

// Usage information returned by Claude CLI
export interface ClaudeUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  server_tool_use?: {
    web_search_requests?: number;
  };
}

// Claude Code CLI event types
export interface ClaudeCodeAssistantEvent {
  type: 'assistant';
  message: {
    id: string;
    type: string;
    role: string;
    model: string;
    content: Array<{
      type: string;
      text: string;
    }>;
    stop_reason: string | null;
    stop_sequence: string | null;
    usage: ClaudeUsage;
  };
  parent_tool_use_id: string | null;
  session_id: string;
}

export interface ClaudeCodeResultEvent {
  type: 'result';
  subtype: string;
  cost_usd: number;
  is_error: boolean;
  duration_ms: number;
  duration_api_ms: number;
  num_turns: number;
  result: string;
  session_id: string;
  total_cost: number;
  usage: ClaudeUsage;
}

export interface ClaudeCodeErrorEvent {
  type: 'error';
  error: {
    message: string;
    code?: string;
  };
}

export interface ClaudeCodeSystemEvent {
  type: 'system';
  subtype: string;
  session_id?: string;
  [key: string]: unknown;
}

export type ClaudeCodeEvent = 
  | ClaudeCodeAssistantEvent 
  | ClaudeCodeResultEvent 
  | ClaudeCodeErrorEvent
  | ClaudeCodeSystemEvent;

// Type guards for event types
export function isAssistantEvent(event: ClaudeCodeEvent): event is ClaudeCodeAssistantEvent {
  return event.type === 'assistant';
}

export function isResultEvent(event: ClaudeCodeEvent): event is ClaudeCodeResultEvent {
  return event.type === 'result';
}

export function isErrorEvent(event: ClaudeCodeEvent): event is ClaudeCodeErrorEvent {
  return event.type === 'error';
}

export function isSystemEvent(event: ClaudeCodeEvent): event is ClaudeCodeSystemEvent {
  return event.type === 'system';
}

// Model configuration
export const claudeCodeModelSchema = z.object({
  model: z.enum(['opus', 'sonnet']).default('opus'),
  cliPath: z.string().default('claude'),
  skipPermissions: z.boolean().default(true),
  disallowedTools: z.array(z.string()).default([]),
  sessionId: z.string().optional(),
  enablePtyStreaming: z.boolean().optional(),
  timeoutMs: z.number().min(1000).max(600000).default(120000),
});

export type ClaudeCodeModelConfig = z.infer<typeof claudeCodeModelSchema>;

// Provider settings schema for validation
export const claudeCodeSettingsSchema = z.object({
  cliPath: z.string().optional(),
  skipPermissions: z.boolean().optional(),
  maxConcurrentProcesses: z.number().optional(),
  timeoutMs: z.number().min(1000).max(600000).optional(),
  sessionId: z.string().optional(),
  enablePtyStreaming: z.boolean().optional(),
}).strict();

// Provider settings
export interface ClaudeCodeSettings {
  /**
   * Path to the Claude CLI executable
   * @default 'claude'
   */
  cliPath?: string;

  /**
   * Whether to add --dangerously-skip-permissions flag
   * @default true
   */
  skipPermissions?: boolean;

  /**
   * Maximum number of concurrent CLI processes
   * @default 4
   */
  maxConcurrentProcesses?: number;

  /**
   * Timeout for CLI operations in milliseconds
   * Range: 1-600 seconds (1,000-600,000ms)
   * @default 120000 (120 seconds)
   */
  timeoutMs?: number;

  /**
   * Optional session ID for conversation continuity
   */
  sessionId?: string;

  /**
   * Enable PTY streaming (experimental)
   */
  enablePtyStreaming?: boolean;
}