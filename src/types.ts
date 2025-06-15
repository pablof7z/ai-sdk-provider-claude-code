// Provider settings
export interface ClaudeCodeSettings {
  /**
   * Model to use ('opus' or 'sonnet')
   * @default 'opus'
   */
  model?: 'opus' | 'sonnet';

  /**
   * Custom path to Claude Code CLI executable
   * @default 'claude' (uses system PATH)
   */
  pathToClaudeCodeExecutable?: string;

  /**
   * Custom system prompt to use
   */
  customSystemPrompt?: string;

  /**
   * Append additional content to the system prompt
   */
  appendSystemPrompt?: string;

  /**
   * Maximum number of turns for the conversation
   */
  maxTurns?: number;

  /**
   * Maximum thinking tokens for the model
   */
  maxThinkingTokens?: number;

  /**
   * Working directory for CLI operations
   */
  cwd?: string;

  /**
   * JavaScript runtime to use
   * @default 'node' (or 'bun' if Bun is detected)
   */
  executable?: 'bun' | 'deno' | 'node';

  /**
   * Additional arguments for the JavaScript runtime
   */
  executableArgs?: string[];

  /**
   * Permission mode for tool usage
   * @default 'default'
   */
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';

  /**
   * Custom tool name for permission prompts
   */
  permissionPromptToolName?: string;

  /**
   * Continue the most recent conversation
   */
  continue?: boolean;

  /**
   * Resume a specific session by ID
   */
  resume?: string;

  /**
   * Tools to explicitly allow during execution
   * Examples: ['Read', 'LS', 'Bash(git log:*)']
   */
  allowedTools?: string[];

  /**
   * Tools to disallow during execution
   * Examples: ['Write', 'Edit', 'Bash(rm:*)']
   */
  disallowedTools?: string[];

  /**
   * MCP server configuration
   */
  mcpServers?: Record<string, {
    type?: 'stdio';
    command: string;
    args?: string[];
    env?: Record<string, string>;
  } | {
    type: 'sse';
    url: string;
    headers?: Record<string, string>;
  }>;
}