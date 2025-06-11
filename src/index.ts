export { createClaudeCode, claudeCode } from './claude-code-provider.js';
export type { ClaudeCodeProvider } from './claude-code-provider.js';
export type { ClaudeCodeSettings } from './types.js';
export { 
  isAuthenticationError, 
  isTimeoutError, 
  getErrorMetadata,
  createAPICallError,
  createAuthenticationError,
  createTimeoutError
} from './errors.js';
export type { ClaudeCodeErrorMetadata } from './errors.js';