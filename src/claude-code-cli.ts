import { spawn } from 'child_process';
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

    // Add prompt with print flag for non-interactive mode
    args.push('-p', prompt, '--print');

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

    // Disallowed tools
    if (config.disallowedTools.length > 0) {
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

    child.stdout.on('data', (chunk) => stdout.push(chunk.toString()));
    child.stderr.on('data', (chunk) => stderr.push(chunk.toString()));

    return new Promise((resolve, reject) => {
      child.on('error', (error) => {
        reject(new ClaudeCodeError({
          message: `Failed to spawn Claude CLI: ${error.message}`,
          promptExcerpt: prompt.slice(0, 100),
        }));
      });

      child.on('close', (code) => {
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

    const lineBuffer: string[] = [];
    let currentLine = '';

    child.stderr.on('data', (chunk) => {
      console.error(`Claude CLI stderr: ${chunk.toString()}`);
    });

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      const lines = text.split('\n');

      // Handle partial lines
      lines[0] = currentLine + lines[0];
      currentLine = lines.pop() || '';

      lineBuffer.push(...lines.filter((line: string) => line.trim()));
    });

    // Process lines as they come in
    while (true) {
      if (lineBuffer.length > 0) {
        const line = lineBuffer.shift() as string;
        try {
          const event = JSON.parse(line) as ClaudeCodeEvent;
          yield event;
        } catch {
          console.error('Failed to parse Claude CLI output:', line);
        }
      }

      // Check if process has ended
      if (child.exitCode !== null && lineBuffer.length === 0) {
        break;
      }

      // Small delay to avoid busy waiting
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Handle any errors
    if (child.exitCode !== 0) {
      throw new ClaudeCodeError({
        message: `Claude CLI exited with code ${child.exitCode}`,
        exitCode: child.exitCode,
        promptExcerpt: prompt.slice(0, 100),
      });
    }
  }
}