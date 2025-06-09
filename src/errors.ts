export class ClaudeCodeError extends Error {
    readonly code?: string;
    readonly exitCode?: number;
    readonly stderr?: string;
    readonly promptExcerpt?: string;
  
    constructor({
      message,
      code,
      exitCode,
      stderr,
      promptExcerpt,
    }: {
      message: string;
      code?: string;
      exitCode?: number;
      stderr?: string;
      promptExcerpt?: string;
    }) {
      super(message);
      this.name = 'ClaudeCodeError';
      this.code = code;
      this.exitCode = exitCode;
      this.stderr = stderr;
      this.promptExcerpt = promptExcerpt;
    }
  }
  
  export function isAuthenticationError(error: unknown): boolean {
    return error instanceof ClaudeCodeError && error.exitCode === 401;
  }