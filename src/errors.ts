import { APICallError, LoadAPIKeyError } from '@ai-sdk/provider';

export interface ClaudeCodeErrorMetadata {
  code?: string;
  exitCode?: number;
  stderr?: string;
  promptExcerpt?: string;
}

export function createAPICallError({
  message,
  code,
  exitCode,
  stderr,
  promptExcerpt,
  isRetryable = false,
}: ClaudeCodeErrorMetadata & {
  message: string;
  isRetryable?: boolean;
}): APICallError {
  const metadata: ClaudeCodeErrorMetadata = {
    code,
    exitCode,
    stderr,
    promptExcerpt,
  };

  return new APICallError({
    message,
    isRetryable,
    url: 'claude-code-cli://command',
    requestBodyValues: promptExcerpt ? { prompt: promptExcerpt } : undefined,
    data: metadata,
  });
}

export function createAuthenticationError({
  message,
}: {
  message: string;
}): LoadAPIKeyError {
  return new LoadAPIKeyError({
    message: message || 'Authentication failed. Please ensure Claude Code CLI is properly authenticated.',
  });
}

export function createTimeoutError({
  message,
  promptExcerpt,
  timeoutMs,
}: {
  message: string;
  promptExcerpt?: string;
  timeoutMs: number;
}): APICallError {
  // Store timeoutMs in metadata for potential use by error handlers
  const metadata: ClaudeCodeErrorMetadata = {
    code: 'TIMEOUT',
    promptExcerpt,
  };
  
  return new APICallError({
    message,
    isRetryable: true,
    url: 'claude-code-cli://command',
    requestBodyValues: promptExcerpt ? { prompt: promptExcerpt } : undefined,
    data: { ...metadata, timeoutMs },
  });
}

export function isAuthenticationError(error: unknown): boolean {
  if (error instanceof LoadAPIKeyError) return true;
  if (error instanceof APICallError && (error.data as ClaudeCodeErrorMetadata)?.exitCode === 401) return true;
  return false;
}

export function isTimeoutError(error: unknown): boolean {
  if (error instanceof APICallError && (error.data as ClaudeCodeErrorMetadata)?.code === 'TIMEOUT') return true;
  return false;
}

export function getErrorMetadata(error: unknown): ClaudeCodeErrorMetadata | undefined {
  if (error instanceof APICallError && error.data) {
    return error.data as ClaudeCodeErrorMetadata;
  }
  return undefined;
}