import { z } from 'zod';

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
    usage: any;
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
  usage: any;
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
  [key: string]: any;
}

export type ClaudeCodeEvent = 
  | ClaudeCodeAssistantEvent 
  | ClaudeCodeResultEvent 
  | ClaudeCodeErrorEvent
  | ClaudeCodeSystemEvent;

// Model configuration
export const claudeCodeModelSchema = z.object({
  model: z.enum(['opus', 'sonnet']).default('opus'),
  cliPath: z.string().default('claude'),
  skipPermissions: z.boolean().default(true),
  disallowedTools: z.array(z.string()).default([]),
  sessionId: z.string().optional(),
  enablePtyStreaming: z.boolean().optional(),
});

export type ClaudeCodeModelConfig = z.infer<typeof claudeCodeModelSchema>;

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
}