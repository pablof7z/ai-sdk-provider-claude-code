import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawn } from 'child_process';
import { ClaudeCodeCLI } from './claude-code-cli';
import { PassThrough } from 'stream';

vi.mock('child_process');

describe('ClaudeCodeCLI', () => {
  let cli: ClaudeCodeCLI;
  const mockSpawn = vi.mocked(spawn);

  const createMockProcess = (overrides: any = {}) => {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const stdin = new PassThrough();
    
    const mockProcess = {
      stdin,
      stdout,
      stderr,
      killed: false,
      exitCode: null,
      kill: vi.fn(function(this: any) {
        this.killed = true;
        this.exitCode = 1;
        // Close streams when killed
        stdout.destroy();
        stderr.destroy();
        stdin.destroy();
      }),
      on: vi.fn((event: string, handler: Function) => {
        if (event === 'close') {
          // Store the close handler to call it later
          mockProcess._closeHandler = handler;
        }
      }),
      _closeHandler: null as Function | null,
      ...overrides,
    };
    return mockProcess;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cli = new ClaudeCodeCLI(2);
  });

  describe('execute', () => {
    it('should execute command with correct arguments', async () => {
      const mockProcess = createMockProcess({
        on: vi.fn((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 0);
          }
        }),
      });

      mockSpawn.mockReturnValue(mockProcess as any);

      // Emit data before close
      setTimeout(() => {
        mockProcess.stdout.write(JSON.stringify({ type: 'assistant', message: 'Hello' }) + '\n');
        mockProcess.stdout.end();
      }, 0);

      const result = await cli.execute('test prompt', {
        model: 'opus',
        cliPath: 'claude',
        skipPermissions: true,
        disallowedTools: [],
      });

      expect(mockSpawn).toHaveBeenCalledWith('claude', [
        '-p',
        '--print',
        '--model', 'opus',
        '--output-format', 'json',
        '--dangerously-skip-permissions',
      ], expect.any(Object));

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('{"type":"assistant","message":"Hello"}');
    });

    it('should handle session resumption', async () => {
      const mockProcess = createMockProcess({
        on: vi.fn((event, handler) => {
          if (event === 'close') handler(0);
        }),
      });

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
        const mockProcess = createMockProcess({
          on: vi.fn((event, handler) => {
            if (event === 'close') {
              resolveHandlers.push(handler);
            }
          }),
        });
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

    it('should include disallowedTools in CLI arguments', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = cli.execute('test prompt', {
        model: 'opus',
        cliPath: 'claude',
        skipPermissions: true,
        disallowedTools: ['read_website', 'run_terminal_command'],
        allowedTools: [],
      });

      // Simulate successful completion
      setTimeout(() => {
        mockProcess.stdout.write(JSON.stringify({ result: 'Response', is_error: false }));
        mockProcess.exitCode = 0;
        mockProcess._closeHandler(0);
      }, 5);

      await promise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining([
          '--disallowedTools', 'read_website,run_terminal_command'
        ]),
        expect.any(Object)
      );
    });

    it('should include allowedTools in CLI arguments', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = cli.execute('test prompt', {
        model: 'opus',
        cliPath: 'claude',
        skipPermissions: true,
        allowedTools: ['read_file', 'list_files'],
        disallowedTools: [],
      });

      // Simulate successful completion
      setTimeout(() => {
        mockProcess.stdout.write(JSON.stringify({ result: 'Response', is_error: false }));
        mockProcess.exitCode = 0;
        mockProcess._closeHandler(0);
      }, 5);

      await promise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining([
          '--allowedTools', 'read_file,list_files'
        ]),
        expect.any(Object)
      );
    });
  });

  describe('stream', () => {
    it('should stream events', async () => {
      const mockProcess = createMockProcess();

      mockSpawn.mockReturnValue(mockProcess as any);

      const generatorPromise = cli.stream('test prompt', {
        model: 'sonnet',
        cliPath: 'claude',
        skipPermissions: true,
        allowedTools: [],
        disallowedTools: [],
      });

      // Emit streaming data and close stream
      setTimeout(() => {
        mockProcess.stdout.write(JSON.stringify({ type: 'assistant', message: 'Hello' }) + '\n');
        mockProcess.stdout.write(JSON.stringify({ type: 'assistant', message: ' world' }) + '\n');
        mockProcess.stdout.write(JSON.stringify({ type: 'result', result: { result: 'Hello world' } }) + '\n');
        
        // End the stream and trigger close event
        mockProcess.stdout.end();
        mockProcess.exitCode = 0;
        
        // Simulate the 'close' event
        setTimeout(() => {
          if (mockProcess._closeHandler) {
            mockProcess._closeHandler(0);
          }
        }, 5);
      }, 5);

      const events = [];
      for await (const event of generatorPromise) {
        events.push(event);
      }

      expect(events).toEqual([
        { type: 'assistant', message: 'Hello' },
        { type: 'assistant', message: ' world' },
        { type: 'result', result: { result: 'Hello world' } },
      ]);
    });

    it('should handle streaming errors', async () => {
      const mockProcess = createMockProcess();

      mockSpawn.mockReturnValue(mockProcess as any);

      const generatorPromise = cli.stream('test', {
        model: 'opus',
        cliPath: 'claude',
        skipPermissions: true,
        disallowedTools: [],
      });

      // Simulate the process ending with error
      setTimeout(() => {
        mockProcess.exitCode = 1;
        mockProcess.stdout.end();
        
        // Simulate the 'close' event with error code
        setTimeout(() => {
          if (mockProcess._closeHandler) {
            mockProcess._closeHandler(1);
          }
        }, 5);
      }, 5);

      await expect(async () => {
        const events = [];
        for await (const event of generatorPromise) {
          events.push(event);
        }
      }).rejects.toThrow('Claude CLI exited with code 1');
    });

    it('should handle process spawn failure', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('spawn claude ENOENT');
      });

      await expect(async () => {
        const events = [];
        for await (const event of cli.stream('test', {
          model: 'opus',
          cliPath: 'invalid-claude-path',
          skipPermissions: true,
          disallowedTools: [],
        })) {
          events.push(event);
        }
      }).rejects.toThrow('spawn claude ENOENT');
    });
  });
});