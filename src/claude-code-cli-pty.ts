import * as pty from 'node-pty';
import type { ClaudeCodeEvent, ClaudeCodeModelConfig } from './types.js';
import { ClaudeCodeError } from './errors.js';

export class ClaudeCodeCLIPty {
  async *stream(
    prompt: string,
    config: ClaudeCodeModelConfig,
    options?: { signal?: AbortSignal }
  ): AsyncGenerator<ClaudeCodeEvent> {
    const args = this.buildArgs(prompt, config);
    const command = 'claude';
    
    // Create pseudo-terminal
    const ptyProcess = pty.spawn(command, args, {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: process.cwd(),
      env: process.env as any,
    });

    let buffer = '';
    let jsonStarted = false;
    let braceCount = 0;
    const events: ClaudeCodeEvent[] = [];
    let processExited = false;

    const cleanup = () => {
      if (!processExited) {
        processExited = true;
        ptyProcess.kill();
      }
    };

    if (options?.signal) {
      options.signal.addEventListener('abort', cleanup);
    }

    // Set up data handler
    ptyProcess.onData((data) => {
      // Look for JSON output
      for (const char of data) {
        if (!jsonStarted && char === '{') {
          jsonStarted = true;
          buffer = '{';
          braceCount = 1;
        } else if (jsonStarted) {
          buffer += char;
          if (char === '{') braceCount++;
          else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              // Complete JSON object
              try {
                const parsed = JSON.parse(buffer);
                
                // Convert to our event format
                if (parsed.type === 'system' && parsed.subtype === 'init') {
                  // Store session ID for later
                  events.push({
                    type: 'system',
                    subtype: 'init',
                    session_id: parsed.session_id,
                  } as any);
                } else if (parsed.type === 'assistant') {
                  events.push({
                    type: 'assistant',
                    message: parsed.message,
                  } as ClaudeCodeEvent);
                } else if (parsed.type === 'result') {
                  events.push({
                    type: 'result',
                    subtype: parsed.subtype,
                    result: parsed.result,
                    session_id: parsed.session_id,
                    is_error: parsed.is_error,
                    error: parsed.error,
                  } as any);
                }
              } catch {
                // Continue parsing
              }
              buffer = '';
              jsonStarted = false;
            }
          }
        }
      }
    });

    // Wait for process to complete
    const exitPromise = new Promise<void>((resolve, reject) => {
      ptyProcess.onExit(({ exitCode }) => {
        processExited = true;
        if (exitCode !== 0 && exitCode !== null) {
          reject(new ClaudeCodeError({
            message: `Claude CLI exited with code ${exitCode}`,
            code: 'CLI_EXIT',
            exitCode,
          }));
        } else {
          resolve();
        }
      });

      // Handle timeout
      setTimeout(() => {
        cleanup();
        reject(new ClaudeCodeError({
          message: 'Claude CLI timed out',
          code: 'TIMEOUT',
        }));
      }, 30000);
    });

    try {
      // Wait for process to complete
      await exitPromise;
      
      // Yield all collected events
      for (const event of events) {
        yield event;
      }
    } finally {
      cleanup();
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

    // Add prompt - requires --verbose for stream-json output
    args.push('-p', prompt, '--verbose');

    // Model selection
    args.push('--model', config.model);

    // Output format for streaming
    args.push('--output-format', 'stream-json');

    // Skip permissions if configured
    if (config.skipPermissions) {
      args.push('--dangerously-skip-permissions');
    }

    return args;
  }
}