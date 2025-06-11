import { spawn } from 'child_process';
import { createInterface } from 'readline';
import type { ClaudeCodeEvent, ClaudeCodeModelConfig } from './types.js';
import { ClaudeCodeError } from './errors.js';

interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export class ClaudeCodeCLI {
  private activeProcesses = 0;
  private readonly maxProcesses: number;
  private readonly queue: Array<() => void> = [];

  constructor(maxProcesses = 4) {
    this.maxProcesses = maxProcesses;
  }

  async execute(
    prompt: string,
    config: ClaudeCodeModelConfig,
    options: {
      stream?: boolean;
      signal?: AbortSignal;
    } = {}
  ): Promise<SpawnResult> {
    await this.waitForSlot();

    try {
      this.activeProcesses++;
      return await this.spawn(prompt, config, options);
    } finally {
      this.activeProcesses--;
      this.processQueue();
    }
  }

  async *stream(
    prompt: string,
    config: ClaudeCodeModelConfig,
    options: {
      signal?: AbortSignal;
    } = {}
  ): AsyncGenerator<ClaudeCodeEvent> {
    await this.waitForSlot();

    try {
      this.activeProcesses++;
      yield* this.spawnStream(prompt, config, options);
    } finally {
      this.activeProcesses--;
      this.processQueue();
    }
  }

  private async waitForSlot(): Promise<void> {
    if (this.activeProcesses < this.maxProcesses) {
      return;
    }

    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  private processQueue(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }

  private buildArgs(
    prompt: string,
    config: ClaudeCodeModelConfig,
    stream: boolean
  ): string[] {
    const args: string[] = [];

    // Resume session if provided
    if (config.sessionId) {
      args.push('--resume', config.sessionId);
    }

    // Add -p flag for piped input
    args.push('-p');
    
    // Add print flag for non-interactive one-shot mode
    if (!stream) {
      args.push('--print');
    }

    // Model selection
    args.push('--model', config.model);

    // Output format
    args.push('--output-format', stream ? 'stream-json' : 'json');
    
    // Add verbose flag for streaming
    if (stream) {
      args.push('--verbose');
    }

    // Skip permissions if configured
    if (config.skipPermissions) {
      args.push('--dangerously-skip-permissions');
    }

    // Allowed tools
    if (config.allowedTools && config.allowedTools.length > 0) {
      args.push('--allowedTools', config.allowedTools.join(','));
    }

    // Disallowed tools
    if (config.disallowedTools && config.disallowedTools.length > 0) {
      args.push('--disallowedTools', config.disallowedTools.join(','));
    }

    // Debug logging
    if (process.env.DEBUG) {
      console.error('[DEBUG] Claude CLI command:', config.cliPath, args.join(' '));
    }

    return args;
  }

  private async spawn(
    prompt: string,
    config: ClaudeCodeModelConfig,
    options: {
      stream?: boolean;
      signal?: AbortSignal;
    }
  ): Promise<SpawnResult> {
    const args = this.buildArgs(prompt, config, options.stream ?? false);
    const child = spawn(config.cliPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      signal: options.signal,
    });

    const stdout: string[] = [];
    const stderr: string[] = [];

    // Write prompt to stdin
    child.stdin.write(prompt);
    child.stdin.end();

    child.stdout.on('data', (chunk) => stdout.push(chunk.toString()));
    child.stderr.on('data', (chunk) => stderr.push(chunk.toString()));

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutMs = config.timeoutMs || 120000;
      const timeout = setTimeout(() => {
        child.kill();
      }, timeoutMs);

      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(new ClaudeCodeError({
          message: `Failed to spawn Claude CLI: ${error.message}`,
          promptExcerpt: prompt.slice(0, 100),
        }));
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        
        if (code !== 0 && child.killed) {
          const timeoutSeconds = Math.round(timeoutMs / 1000);
          reject(new ClaudeCodeError({
            message: `Claude CLI timed out after ${timeoutSeconds} seconds`,
            code: 'TIMEOUT',
            promptExcerpt: prompt.slice(0, 100),
          }));
          return;
        }
        
        resolve({
          stdout: stdout.join(''),
          stderr: stderr.join(''),
          exitCode: code,
        });
      });
    });
  }

  private async *spawnStream(
    prompt: string,
    config: ClaudeCodeModelConfig,
    options: {
      signal?: AbortSignal;
    }
  ): AsyncGenerator<ClaudeCodeEvent> {
    const args = this.buildArgs(prompt, config, true);
    const child = spawn(config.cliPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      signal: options.signal,
    });

    // Write prompt to stdin
    child.stdin.write(prompt);
    child.stdin.end();

    // Set up timeout
    const timeoutMs = config.timeoutMs || 120000;
    const timeout = setTimeout(() => child.kill(), timeoutMs);

    // Handle stderr
    child.stderr.on('data', (chunk) => {
      if (process.env.DEBUG) {
        console.error(`[DEBUG] Claude CLI stderr: ${chunk.toString()}`);
      }
    });

    try {
      // Use readline for async line iteration - no polling!
      const rl = createInterface({
        input: child.stdout,
        crlfDelay: Infinity
      });

      // Direct async iteration over lines as they arrive
      for await (const line of rl) {
        if (line.trim()) {
          try {
            const event = JSON.parse(line) as ClaudeCodeEvent;
            yield event;
          } catch {
            if (process.env.DEBUG) {
              console.error('[DEBUG] Failed to parse Claude CLI output:', line);
            }
          }
        }
      }

      // Handle exit code after stream ends
      await new Promise<void>((resolve, reject) => {
        child.on('close', (code) => {
          if (code !== 0) {
            if (child.killed) {
              const timeoutSeconds = Math.round(timeoutMs / 1000);
              reject(new ClaudeCodeError({
                message: `Claude CLI timed out after ${timeoutSeconds} seconds`,
                code: 'TIMEOUT',
                promptExcerpt: prompt.slice(0, 100),
              }));
            } else {
              reject(new ClaudeCodeError({
                message: `Claude CLI exited with code ${code}`,
                exitCode: code ?? undefined,
                promptExcerpt: prompt.slice(0, 100),
              }));
            }
          } else {
            resolve();
          }
        });
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}