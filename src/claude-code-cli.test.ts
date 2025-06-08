import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawn } from 'child_process';
import { ClaudeCodeCLI } from './claude-code-cli';
import { PassThrough } from 'stream';

vi.mock('child_process');

describe('ClaudeCodeCLI', () => {
  let cli: ClaudeCodeCLI;
  const mockSpawn = vi.mocked(spawn);

  beforeEach(() => {
    vi.clearAllMocks();
    cli = new ClaudeCodeCLI(2);
  });

  describe('execute', () => {
    it('should execute command with correct arguments', async () => {
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      
      const mockProcess = {
        stdout,
        stderr,
        on: vi.fn((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 0);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      // Emit data before close
      setTimeout(() => {
        stdout.write(JSON.stringify({ type: 'assistant', message: 'Hello' }) + '\n');
        stdout.end();
      }, 0);

      const result = await cli.execute('test prompt', {
        model: 'opus',
        cliPath: 'claude',
        skipPermissions: true,
        disallowedTools: [],
      });

      expect(mockSpawn).toHaveBeenCalledWith('claude', [
        '-p', 'test prompt',
        '--print',
        '--model', 'opus',
        '--output-format', 'json',
        '--dangerously-skip-permissions',
      ], expect.any(Object));

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('{"type":"assistant","message":"Hello"}');
    });

    it('should handle session resumption', async () => {
      const mockProcess = {
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        on: vi.fn((event, handler) => {
          if (event === 'close') handler(0);
        }),
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      await cli.execute('test', {
        model: 'opus',
        cliPath: 'claude',
        skipPermissions: false,
        disallowedTools: [],
        sessionId: 'sess_123',
      });

      expect(mockSpawn).toHaveBeenCalledWith('claude', 
        expect.arrayContaining(['--resume', 'sess_123']),
        expect.any(Object)
      );
    });

    it('should respect max concurrent processes', async () => {
      let resolveHandlers: Array<(code: number) => void> = [];
      
      mockSpawn.mockImplementation(() => {
        const mockProcess = {
          stdout: new PassThrough(),
          stderr: new PassThrough(),
          on: vi.fn((event, handler) => {
            if (event === 'close') {
              resolveHandlers.push(handler);
            }
          }),
        };
        return mockProcess as any;
      });

      // Start 3 processes (max is 2)
      const promise1 = cli.execute('prompt1', { model: 'opus', cliPath: 'claude', skipPermissions: true, disallowedTools: [] });
      const promise2 = cli.execute('prompt2', { model: 'opus', cliPath: 'claude', skipPermissions: true, disallowedTools: [] });
      
      // Wait for first two to start
      await new Promise(resolve => setImmediate(resolve));
      
      // First two should spawn immediately
      expect(mockSpawn).toHaveBeenCalledTimes(2);
      
      // Start third (should queue)
      const promise3 = cli.execute('prompt3', { model: 'opus', cliPath: 'claude', skipPermissions: true, disallowedTools: [] });

      // Complete first process
      resolveHandlers[0](0);

      // Wait for queue processing
      await new Promise(resolve => setImmediate(resolve));

      // Third should now spawn
      expect(mockSpawn).toHaveBeenCalledTimes(3);

      // Complete remaining processes
      resolveHandlers[1](0);
      resolveHandlers[2](0);

      await Promise.all([promise1, promise2, promise3]);
    });
  });

  describe('stream', () => {
    it('should stream events', async () => {
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      
      const mockProcess = {
        stdout,
        stderr,
        exitCode: null,
        on: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const generator = cli.stream('test prompt', {
        model: 'sonnet',
        cliPath: 'claude',
        skipPermissions: true,
        disallowedTools: [],
      });

      // Emit streaming data
      setTimeout(() => {
        stdout.write(JSON.stringify({ type: 'assistant', message: 'Hello' }) + '\n');
        stdout.write(JSON.stringify({ type: 'assistant', message: ' world' }) + '\n');
        stdout.write(JSON.stringify({ type: 'result', result: { result: 'Hello world' } }) + '\n');
        (mockProcess as any).exitCode = 0;
      }, 0);

      const events = [];
      for await (const event of generator) {
        events.push(event);
        if (events.length === 3) break;
      }

      expect(events).toEqual([
        { type: 'assistant', message: 'Hello' },
        { type: 'assistant', message: ' world' },
        { type: 'result', result: { result: 'Hello world' } },
      ]);
    });

    it('should handle streaming errors', async () => {
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      
      const mockProcess = {
        stdout,
        stderr,
        exitCode: null,
        on: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const generator = cli.stream('test', {
        model: 'opus',
        cliPath: 'claude',
        skipPermissions: true,
        disallowedTools: [],
      });

      setTimeout(() => {
        (mockProcess as any).exitCode = 1;
      }, 0);

      await expect(async () => {
        const events = [];
        for await (const event of generator) {
          events.push(event);
        }
      }).rejects.toThrow('Claude CLI exited with code 1');
    });
  });
});