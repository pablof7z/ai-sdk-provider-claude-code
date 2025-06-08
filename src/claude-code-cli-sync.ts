import { execSync } from 'child_process';
import type { ClaudeCodeModelConfig } from './types.js';
import { ClaudeCodeError } from './errors.js';

export class ClaudeCodeCLISync {
  execute(
    prompt: string,
    config: ClaudeCodeModelConfig
  ): { stdout: string; stderr: string; exitCode: number } {
    const args = this.buildArgs(prompt, config);
    const cliPath = config.cliPath || 'claude';
    const command = `${cliPath} ${args.join(' ')}`;
    
    try {
      const stdout = execSync(command, {
        encoding: 'utf8',
        timeout: config.timeoutMs || 120000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      
      return {
        stdout,
        stderr: '',
        exitCode: 0,
      };
    } catch (error) {
      // Type guard for execSync error
      const isExecError = (err: unknown): err is Error & {
        code?: string;
        stdout?: string | Buffer;
        stderr?: string | Buffer;
        status?: number;
      } => {
        return err instanceof Error;
      };

      if (isExecError(error)) {
        if (error.code === 'ETIMEDOUT') {
          const timeoutSeconds = Math.round((config.timeoutMs || 120000) / 1000);
          throw new ClaudeCodeError({
            message: `Claude CLI timed out after ${timeoutSeconds} seconds`,
            code: 'TIMEOUT',
            promptExcerpt: prompt.slice(0, 100),
          });
        }
        
        return {
          stdout: typeof error.stdout === 'string' ? error.stdout : error.stdout?.toString() || '',
          stderr: typeof error.stderr === 'string' ? error.stderr : error.stderr?.toString() || '',
          exitCode: error.status || 1,
        };
      }
      
      // Fallback for unknown errors
      throw error;
    }
  }

  private buildArgs(
    prompt: string,
    config: ClaudeCodeModelConfig
  ): string[] {
    const args: string[] = [];

    // Resume session if provided
    if (config.sessionId) {
      args.push('--resume', config.sessionId);
    }

    // Add prompt with print flag for non-interactive mode
    args.push('-p', `"${prompt.replace(/"/g, '\\"')}"`, '--print');

    // Model selection
    args.push('--model', config.model);

    // Output format - always use json for sync mode
    args.push('--output-format', 'json');

    // Skip permissions if configured
    if (config.skipPermissions) {
      args.push('--dangerously-skip-permissions');
    }

    return args;
  }
}