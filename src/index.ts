// Provider exports
export { createClaudeCode, claudeCode } from './claude-code-provider.js';
export type { ClaudeCodeProvider, ClaudeCodeProviderSettings } from './claude-code-provider.js';

// Model exports
export type { ClaudeCodeModelId } from './claude-code-language-model.js';
export type { ClaudeCodeSettings } from './types.js';

// Error handling exports
export { 
  isAuthenticationError, 
  isTimeoutError, 
  getErrorMetadata,
  createAPICallError,
  createAuthenticationError,
  createTimeoutError
} from './errors.js';
export type { ClaudeCodeErrorMetadata } from './errors.js';