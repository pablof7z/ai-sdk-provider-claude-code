import * as _ai_sdk_provider from '@ai-sdk/provider';
import { LanguageModelV2, ProviderV2, APICallError, LoadAPIKeyError } from '@ai-sdk/provider';
import { PermissionMode, McpServerConfig, CanUseTool, McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk';
export { CanUseTool, HookCallback, HookCallbackMatcher, HookEvent, HookInput, HookJSONOutput, McpSdkServerConfigWithInstance, McpServerConfig, PermissionBehavior, PermissionResult, PermissionRuleValue, PermissionUpdate, PostToolUseHookInput, PreToolUseHookInput, SessionEndHookInput, SessionStartHookInput, UserPromptSubmitHookInput, createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { ZodObject, ZodRawShape } from 'zod';

type StreamingInputMode = 'auto' | 'always' | 'off';
/**
 * Logger interface for custom logging.
 * Allows consumers to provide their own logging implementation
 * or disable logging entirely.
 *
 * @example
 * ```typescript
 * const customLogger: Logger = {
 *   warn: (message) => myLoggingService.warn(message),
 *   error: (message) => myLoggingService.error(message),
 * };
 * ```
 */
interface Logger {
    /**
     * Log a warning message.
     */
    warn: (message: string) => void;
    /**
     * Log an error message.
     */
    error: (message: string) => void;
}
/**
 * Configuration settings for Claude Code SDK behavior.
 * These settings control how the CLI executes, what permissions it has,
 * and which tools are available during conversations.
 *
 * @example
 * ```typescript
 * const settings: ClaudeCodeSettings = {
 *   maxTurns: 10,
 *   permissionMode: 'auto',
 *   cwd: '/path/to/project',
 *   allowedTools: ['Read', 'LS'],
 *   disallowedTools: ['Bash(rm:*)']
 * };
 * ```
 */
interface ClaudeCodeSettings {
    /**
     * Custom path to Claude Code SDK executable
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
     * Agent SDK system prompt configuration. Preferred over legacy fields.
     * - string: custom system prompt
     * - preset object: Claude Code preset, with optional append
     */
    systemPrompt?: string | {
        type: 'preset';
        preset: 'claude_code';
        append?: string;
    };
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
    permissionMode?: PermissionMode;
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
    mcpServers?: Record<string, McpServerConfig>;
    /**
     * Filesystem settings sources to load (CLAUDE.md, settings.json, etc.)
     * When omitted, the Agent SDK loads no filesystem settings.
     */
    settingSources?: Array<'user' | 'project' | 'local'>;
    /**
     * Hook callbacks for lifecycle events (e.g., PreToolUse, PostToolUse).
     * Note: typed loosely to support multiple SDK versions.
     */
    hooks?: Partial<Record<string, Array<{
        matcher?: string;
        hooks: Array<(...args: unknown[]) => Promise<unknown>>;
    }>>>;
    /**
     * Dynamic permission callback invoked before a tool is executed.
     * Allows runtime approval/denial and optional input mutation.
     */
    canUseTool?: CanUseTool;
    /**
     * Controls whether to send streaming input to the SDK (enables canUseTool).
     * - 'auto' (default): stream when canUseTool is provided
     * - 'always': always stream
     * - 'off': never stream (legacy behavior)
     */
    streamingInput?: StreamingInputMode;
    /**
     * Enable verbose logging for debugging
     */
    verbose?: boolean;
    /**
     * Custom logger for handling warnings and errors.
     * - Set to `false` to disable all logging
     * - Provide a Logger object to use custom logging
     * - Leave undefined to use console (default)
     *
     * @default console
     * @example
     * ```typescript
     * // Disable logging
     * const settings = { logger: false };
     *
     * // Custom logger
     * const settings = {
     *   logger: {
     *     warn: (msg) => myLogger.warn(msg),
     *     error: (msg) => myLogger.error(msg),
     *   }
     * };
     * ```
     */
    logger?: Logger | false;
    /**
     * Environment variables to set
     */
    env?: Record<string, string | undefined>;
    /**
     * Additional directories Claude can access.
     */
    additionalDirectories?: string[];
    /**
     * Programmatically defined subagents.
     */
    agents?: Record<string, {
        description: string;
        tools?: string[];
        prompt: string;
        model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
    }>;
    /**
     * Include partial message events from the SDK stream.
     */
    includePartialMessages?: boolean;
    /**
     * Model to use if primary fails.
     */
    fallbackModel?: string;
    /**
     * When resuming, fork to a new session ID instead of continuing the original.
     */
    forkSession?: boolean;
    /**
     * Callback for stderr output from the underlying process.
     */
    stderr?: (data: string) => void;
    /**
     * Enforce strict MCP validation.
     */
    strictMcpConfig?: boolean;
    /**
     * Additional CLI arguments.
     */
    extraArgs?: Record<string, string | null>;
}

/**
 * Options for creating a Claude Code language model instance.
 *
 * @example
 * ```typescript
 * const model = new ClaudeCodeLanguageModel({
 *   id: 'opus',
 *   settings: {
 *     maxTurns: 10,
 *     permissionMode: 'auto'
 *   }
 * });
 * ```
 */
interface ClaudeCodeLanguageModelOptions {
    /**
     * The model identifier to use.
     * Can be 'opus', 'sonnet', 'haiku', or a custom model string.
     */
    id: ClaudeCodeModelId;
    /**
     * Optional settings to configure the model behavior.
     */
    settings?: ClaudeCodeSettings;
    /**
     * Validation warnings from settings validation.
     * Used internally to pass warnings from provider.
     */
    settingsValidationWarnings?: string[];
}
/**
 * Supported Claude model identifiers.
 * - 'opus': Claude 4.1 Opus model (most capable)
 * - 'sonnet': Claude 4.5 Sonnet model (balanced performance)
 * - 'haiku': Claude 4.5 Haiku model (fastest, most cost-effective) - Available in Claude Code v2.0.17+
 * - Custom string: Any other model identifier supported by the CLI
 *
 * @example
 * ```typescript
 * const opusModel = claudeCode('opus');
 * const sonnetModel = claudeCode('sonnet');
 * const haikuModel = claudeCode('haiku');
 * const customModel = claudeCode('claude-3-opus-20240229');
 * ```
 */
type ClaudeCodeModelId = 'opus' | 'sonnet' | 'haiku' | (string & {});
/**
 * Language model implementation for Claude Code SDK.
 * This class implements the AI SDK's LanguageModelV1 interface to provide
 * integration with Claude models through the Claude Code SDK.
 *
 * Features:
 * - Supports streaming and non-streaming generation
 * - Handles JSON object generation mode
 * - Manages CLI sessions for conversation continuity
 * - Provides detailed error handling and retry logic
 *
 * Limitations:
 * - Image inputs require streaming mode
 * - Does not support structured outputs (tool mode)
 * - Some parameters like temperature and max tokens are not supported by the CLI
 *
 * @example
 * ```typescript
 * const model = new ClaudeCodeLanguageModel({
 *   id: 'opus',
 *   settings: { maxTurns: 5 }
 * });
 *
 * const result = await model.doGenerate({
 *   prompt: [{ role: 'user', content: 'Hello!' }],
 *   mode: { type: 'regular' }
 * });
 * ```
 */
declare class ClaudeCodeLanguageModel implements LanguageModelV2 {
    readonly specificationVersion: "v2";
    readonly defaultObjectGenerationMode: "json";
    readonly supportsImageUrls = false;
    readonly supportedUrls: {};
    readonly supportsStructuredOutputs = false;
    static readonly UNKNOWN_TOOL_NAME = "unknown-tool";
    private static readonly MAX_TOOL_INPUT_SIZE;
    private static readonly MAX_TOOL_INPUT_WARN;
    private static readonly MAX_DELTA_CALC_SIZE;
    readonly modelId: ClaudeCodeModelId;
    readonly settings: ClaudeCodeSettings;
    private sessionId?;
    private modelValidationWarning?;
    private settingsValidationWarnings;
    private logger;
    constructor(options: ClaudeCodeLanguageModelOptions);
    get provider(): string;
    /**
     * Built-in tools available for this model.
     * Pass these to streamText/generateText to avoid tool validation errors:
     *
     * @example
     * ```typescript
     * const model = claudeCode('haiku');
     * streamText({
     *   model,
     *   tools: model.tools, // or { ...model.tools, ...myCustomTools }
     *   prompt: '...'
     * });
     * ```
     */
    get tools(): Record<string, _ai_sdk_provider.LanguageModelV2FunctionTool>;
    private getModel;
    private extractToolUses;
    private extractToolResults;
    private extractToolErrors;
    private serializeToolInput;
    private checkInputSize;
    private normalizeToolResult;
    private generateAllWarnings;
    private handleJsonExtraction;
    private createQueryOptions;
    private handleClaudeCodeError;
    private setSessionId;
    private validateJsonExtraction;
    doGenerate(options: Parameters<LanguageModelV2['doGenerate']>[0]): Promise<Awaited<ReturnType<LanguageModelV2['doGenerate']>>>;
    doStream(options: Parameters<LanguageModelV2['doStream']>[0]): Promise<Awaited<ReturnType<LanguageModelV2['doStream']>>>;
    private serializeWarningsForMetadata;
}

/**
 * Claude Code provider interface that extends the AI SDK's ProviderV1.
 * Provides methods to create language models for interacting with Claude via the CLI.
 *
 * @example
 * ```typescript
 * import { claudeCode } from 'ai-sdk-provider-claude-code';
 *
 * // Create a model instance
 * const model = claudeCode('opus');
 *
 * // Or use the explicit methods
 * const chatModel = claudeCode.chat('sonnet');
 * const languageModel = claudeCode.languageModel('opus', { maxTurns: 10 });
 * ```
 */
interface ClaudeCodeProvider extends ProviderV2 {
    /**
     * Creates a language model instance for the specified model ID.
     * This is a shorthand for calling `languageModel()`.
     *
     * @param modelId - The Claude model to use ('opus' or 'sonnet')
     * @param settings - Optional settings to configure the model
     * @returns A language model instance
     */
    (modelId: ClaudeCodeModelId, settings?: ClaudeCodeSettings): LanguageModelV2;
    /**
     * Creates a language model instance for text generation.
     *
     * @param modelId - The Claude model to use ('opus' or 'sonnet')
     * @param settings - Optional settings to configure the model
     * @returns A language model instance
     */
    languageModel(modelId: ClaudeCodeModelId, settings?: ClaudeCodeSettings): LanguageModelV2;
    /**
     * Alias for `languageModel()` to maintain compatibility with AI SDK patterns.
     *
     * @param modelId - The Claude model to use ('opus' or 'sonnet')
     * @param settings - Optional settings to configure the model
     * @returns A language model instance
     */
    chat(modelId: ClaudeCodeModelId, settings?: ClaudeCodeSettings): LanguageModelV2;
    imageModel(modelId: string): never;
}
/**
 * Configuration options for creating a Claude Code provider instance.
 * These settings will be applied as defaults to all models created by the provider.
 *
 * @example
 * ```typescript
 * const provider = createClaudeCode({
 *   defaultSettings: {
 *     maxTurns: 5,
 *     cwd: '/path/to/project'
 *   }
 * });
 * ```
 */
interface ClaudeCodeProviderSettings {
    /**
     * Default settings to use for all models created by this provider.
     * Individual model settings will override these defaults.
     */
    defaultSettings?: ClaudeCodeSettings;
}
/**
 * Creates a Claude Code provider instance with the specified configuration.
 * The provider can be used to create language models for interacting with Claude 4 models.
 *
 * @param options - Provider configuration options
 * @returns Claude Code provider instance
 *
 * @example
 * ```typescript
 * const provider = createClaudeCode({
 *   defaultSettings: {
 *     permissionMode: 'bypassPermissions',
 *     maxTurns: 10
 *   }
 * });
 *
 * const model = provider('opus');
 * ```
 */
declare function createClaudeCode(options?: ClaudeCodeProviderSettings): ClaudeCodeProvider;
/**
 * Default Claude Code provider instance.
 * Pre-configured provider for quick usage without custom settings.
 *
 * @example
 * ```typescript
 * import { claudeCode } from 'ai-sdk-provider-claude-code';
 * import { generateText } from 'ai';
 *
 * const { text } = await generateText({
 *   model: claudeCode('sonnet'),
 *   prompt: 'Hello, Claude!'
 * });
 * ```
 */
declare const claudeCode: ClaudeCodeProvider;

/**
 * Optional annotations for content items, per MCP specification.
 * Validated against MCP SDK schema version 2025-06-18.
 */
type ContentAnnotations = {
    /** Intended audience(s) for this content */
    audience?: ('user' | 'assistant')[];
    /** Priority hint (0 = least important, 1 = most important) */
    priority?: number;
    /** ISO 8601 timestamp of last modification */
    lastModified?: string;
};
/**
 * Convenience helper to create an SDK MCP server from a simple tool map.
 * Each tool provides a description, a Zod object schema, and a handler.
 *
 * Type definition validated against MCP SDK specification version 2025-06-18.
 * See: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
 */
type MinimalCallToolResult = {
    content: Array<{
        /** Text content */
        type: 'text';
        /** The text content (plain text or structured format like JSON) */
        text: string;
        annotations?: ContentAnnotations;
        _meta?: Record<string, unknown>;
        [key: string]: unknown;
    } | {
        /** Image content (base64-encoded) */
        type: 'image';
        /** Base64-encoded image data */
        data: string;
        /** MIME type of the image (e.g., image/png, image/jpeg) */
        mimeType: string;
        annotations?: ContentAnnotations;
        _meta?: Record<string, unknown>;
        [key: string]: unknown;
    } | {
        /** Audio content (base64-encoded) */
        type: 'audio';
        /** Base64-encoded audio data */
        data: string;
        /** MIME type of the audio (e.g., audio/wav, audio/mp3) */
        mimeType: string;
        annotations?: ContentAnnotations;
        _meta?: Record<string, unknown>;
        [key: string]: unknown;
    } | {
        /** Embedded resource with full content (text or blob) */
        type: 'resource';
        /** Resource contents - either text or blob variant */
        resource: {
            uri: string;
            _meta?: Record<string, unknown>;
            [key: string]: unknown;
        } & ({
            text: string;
            mimeType?: string;
        } | {
            blob: string;
            mimeType: string;
        });
        annotations?: ContentAnnotations;
        _meta?: Record<string, unknown>;
        [key: string]: unknown;
    } | {
        /** Resource link (reference only - no embedded content) */
        type: 'resource_link';
        /** URI of the resource */
        uri: string;
        /** Human-readable name (required per MCP spec) */
        name: string;
        /** Optional description of what this resource represents */
        description?: string;
        /** MIME type of the resource, if known */
        mimeType?: string;
        annotations?: ContentAnnotations;
        _meta?: Record<string, unknown>;
        [key: string]: unknown;
    }>;
    isError?: boolean;
    structuredContent?: Record<string, unknown>;
    _meta?: Record<string, unknown>;
    [key: string]: unknown;
};
declare function createCustomMcpServer<Tools extends Record<string, {
    description: string;
    inputSchema: ZodObject<ZodRawShape>;
    handler: (args: Record<string, unknown>, extra: unknown) => Promise<MinimalCallToolResult>;
}>>(config: {
    name: string;
    version?: string;
    tools: Tools;
}): McpSdkServerConfigWithInstance;

/**
 * Metadata associated with Claude Code SDK errors.
 * Provides additional context about command execution failures.
 */
interface ClaudeCodeErrorMetadata {
    /**
     * Error code from the CLI process (e.g., 'ENOENT', 'ETIMEDOUT').
     */
    code?: string;
    /**
     * Exit code from the Claude Code SDK process.
     * Common codes:
     * - 401: Authentication error
     * - 1: General error
     */
    exitCode?: number;
    /**
     * Standard error output from the CLI process.
     */
    stderr?: string;
    /**
     * Excerpt from the prompt that caused the error.
     * Limited to first 200 characters for debugging.
     */
    promptExcerpt?: string;
}
/**
 * Creates an APICallError with Claude Code specific metadata.
 * Used for general CLI execution errors.
 *
 * @param options - Error details and metadata
 * @param options.message - Human-readable error message
 * @param options.code - Error code from the CLI process
 * @param options.exitCode - Exit code from the CLI
 * @param options.stderr - Standard error output
 * @param options.promptExcerpt - Excerpt of the prompt that caused the error
 * @param options.isRetryable - Whether the error is potentially retryable
 * @returns An APICallError instance with Claude Code metadata
 *
 * @example
 * ```typescript
 * throw createAPICallError({
 *   message: 'Claude Code SDK failed',
 *   code: 'ENOENT',
 *   isRetryable: true
 * });
 * ```
 */
declare function createAPICallError({ message, code, exitCode, stderr, promptExcerpt, isRetryable, }: ClaudeCodeErrorMetadata & {
    message: string;
    isRetryable?: boolean;
}): APICallError;
/**
 * Creates an authentication error for Claude Code SDK login failures.
 *
 * @param options - Error configuration
 * @param options.message - Error message describing the authentication failure
 * @returns A LoadAPIKeyError instance
 *
 * @example
 * ```typescript
 * throw createAuthenticationError({
 *   message: 'Please run "claude login" to authenticate'
 * });
 * ```
 */
declare function createAuthenticationError({ message }: {
    message: string;
}): LoadAPIKeyError;
/**
 * Creates a timeout error for Claude Code SDK operations.
 *
 * @param options - Timeout error details
 * @param options.message - Error message describing the timeout
 * @param options.promptExcerpt - Excerpt of the prompt that timed out
 * @param options.timeoutMs - Timeout duration in milliseconds
 * @returns An APICallError instance configured as a timeout error
 *
 * @example
 * ```typescript
 * throw createTimeoutError({
 *   message: 'Request timed out after 2 minutes',
 *   timeoutMs: 120000
 * });
 * ```
 */
declare function createTimeoutError({ message, promptExcerpt, timeoutMs, }: {
    message: string;
    promptExcerpt?: string;
    timeoutMs?: number;
}): APICallError;
/**
 * Checks if an error is an authentication error.
 * Returns true for LoadAPIKeyError instances or APICallError with exit code 401.
 *
 * @param error - The error to check
 * @returns True if the error is an authentication error
 *
 * @example
 * ```typescript
 * try {
 *   await model.generate(...);
 * } catch (error) {
 *   if (isAuthenticationError(error)) {
 *     console.log('Please authenticate with Claude Code SDK');
 *   }
 * }
 * ```
 */
declare function isAuthenticationError(error: unknown): boolean;
/**
 * Checks if an error is a timeout error.
 * Returns true for APICallError instances with code 'TIMEOUT'.
 *
 * @param error - The error to check
 * @returns True if the error is a timeout error
 *
 * @example
 * ```typescript
 * try {
 *   await model.generate(...);
 * } catch (error) {
 *   if (isTimeoutError(error)) {
 *     console.log('Request timed out, consider retrying');
 *   }
 * }
 * ```
 */
declare function isTimeoutError(error: unknown): boolean;
/**
 * Extracts Claude Code error metadata from an error object.
 *
 * @param error - The error to extract metadata from
 * @returns The error metadata if available, undefined otherwise
 *
 * @example
 * ```typescript
 * try {
 *   await model.generate(...);
 * } catch (error) {
 *   const metadata = getErrorMetadata(error);
 *   if (metadata?.exitCode === 401) {
 *     console.log('Authentication required');
 *   }
 * }
 * ```
 */
declare function getErrorMetadata(error: unknown): ClaudeCodeErrorMetadata | undefined;

export { type ClaudeCodeErrorMetadata, ClaudeCodeLanguageModel, type ClaudeCodeLanguageModelOptions, type ClaudeCodeModelId, type ClaudeCodeProvider, type ClaudeCodeProviderSettings, type ClaudeCodeSettings, type Logger, claudeCode, createAPICallError, createAuthenticationError, createClaudeCode, createCustomMcpServer, createTimeoutError, getErrorMetadata, isAuthenticationError, isTimeoutError };
