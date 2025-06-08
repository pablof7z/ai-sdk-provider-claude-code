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
        timeout: 30000, // 30 second timeout
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      
      return {
        stdout,
        stderr: '',
        exitCode: 0,
      };
    } catch (error: any) {
      if (error.code === 'ETIMEDOUT') {
        throw new ClaudeCodeError({
          message: 'Claude CLI timed out after 30 seconds',
          code: 'TIMEOUT',
          promptExcerpt: prompt.slice(0, 100),
        });
      }
      
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        exitCode: error.status || 1,
      };
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