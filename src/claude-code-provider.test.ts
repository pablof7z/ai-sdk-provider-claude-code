import { describe, it, expect } from 'vitest';
import { createClaudeCode, claudeCode } from './claude-code-provider';
import { ClaudeCodeLanguageModel } from './claude-code-language-model';
import { z } from 'zod';

describe('ClaudeCodeProvider', () => {
  describe('createClaudeCode', () => {
    it('should create a provider instance', () => {
      const provider = createClaudeCode();
      expect(provider).toBeDefined();
      expect(typeof provider).toBe('function');
      expect(provider.languageModel).toBeDefined();
    });

    it('should create opus model', () => {
      const provider = createClaudeCode();
      const model = provider('opus');
      
      expect(model).toBeInstanceOf(ClaudeCodeLanguageModel);
      expect(model.modelId).toBe('opus');
      expect(model.provider).toBe('claude-code');
    });

    it('should create sonnet model', () => {
      const provider = createClaudeCode();
      const model = provider('sonnet');
      
      expect(model).toBeInstanceOf(ClaudeCodeLanguageModel);
      expect(model.modelId).toBe('sonnet');
    });

    it('should accept custom configuration', () => {
      const provider = createClaudeCode({
        cliPath: '/custom/path/claude',
        skipPermissions: false,
        maxConcurrentProcesses: 8,
      });

      const model = provider('opus');
      expect(model).toBeInstanceOf(ClaudeCodeLanguageModel);
    });

    it('should allow model-specific settings to override provider settings', () => {
      const provider = createClaudeCode({
        cliPath: '/default/claude',
        skipPermissions: true,
      });

      const model = provider('opus', {
        cliPath: '/override/claude',
        skipPermissions: false,
      });

      expect(model).toBeInstanceOf(ClaudeCodeLanguageModel);
    });

    it('should support both direct call and languageModel method', () => {
      const provider = createClaudeCode();
      
      const model1 = provider('opus');
      const model2 = provider.languageModel('opus');
      
      expect(model1).toBeInstanceOf(ClaudeCodeLanguageModel);
      expect(model2).toBeInstanceOf(ClaudeCodeLanguageModel);
    });

    it('should throw error when called with new keyword', () => {
      const provider = createClaudeCode();
      
      expect(() => {
        // @ts-expect-error - intentionally calling with new for testing
        new provider('opus');
      }).toThrow('The Claude Code model function cannot be called with the new keyword.');
    });

    it('should accept disallowedTools configuration', () => {
      const provider = createClaudeCode({
        disallowedTools: ['read_website', 'run_terminal_command'],
      });

      const model = provider('opus');
      expect(model).toBeInstanceOf(ClaudeCodeLanguageModel);
    });

    it('should allow model-specific disallowedTools to override provider settings', () => {
      const provider = createClaudeCode({
        disallowedTools: ['read_website'],
      });

      const model = provider('opus', {
        disallowedTools: ['run_terminal_command', 'create_file'],
      });

      expect(model).toBeInstanceOf(ClaudeCodeLanguageModel);
    });

    it('should accept allowedTools configuration', () => {
      const provider = createClaudeCode({
        allowedTools: ['read_file', 'list_files'],
      });

      const model = provider('opus');
      expect(model).toBeInstanceOf(ClaudeCodeLanguageModel);
    });

    it('should allow model-specific allowedTools to override provider settings', () => {
      const provider = createClaudeCode({
        allowedTools: ['read_file'],
      });

      const model = provider('opus', {
        allowedTools: ['read_file', 'list_files', 'search_files'],
      });

      expect(model).toBeInstanceOf(ClaudeCodeLanguageModel);
    });

    describe('validation', () => {
      it('should reject maxConcurrentProcesses of 0', () => {
        expect(() => createClaudeCode({
          maxConcurrentProcesses: 0,
        })).toThrow(z.ZodError);
      });

      it('should reject negative maxConcurrentProcesses', () => {
        expect(() => createClaudeCode({
          maxConcurrentProcesses: -1,
        })).toThrow(z.ZodError);
      });

      it('should reject non-integer maxConcurrentProcesses', () => {
        expect(() => createClaudeCode({
          maxConcurrentProcesses: 2.5,
        })).toThrow(z.ZodError);
      });

      it('should reject maxConcurrentProcesses over 100', () => {
        expect(() => createClaudeCode({
          maxConcurrentProcesses: 101,
        })).toThrow(z.ZodError);
      });

      it('should accept valid maxConcurrentProcesses values', () => {
        expect(() => createClaudeCode({
          maxConcurrentProcesses: 1,
        })).not.toThrow();

        expect(() => createClaudeCode({
          maxConcurrentProcesses: 50,
        })).not.toThrow();

        expect(() => createClaudeCode({
          maxConcurrentProcesses: 100,
        })).not.toThrow();
      });

      it('should provide descriptive error for invalid maxConcurrentProcesses', () => {
        try {
          createClaudeCode({ maxConcurrentProcesses: 0 });
        } catch (error) {
          expect(error).toBeInstanceOf(z.ZodError);
          const zodError = error as z.ZodError;
          expect(zodError.errors[0].message).toBe('Number must be greater than or equal to 1');
        }
      });
    });
  });

  describe('claudeCode', () => {
    it('should export a default instance', () => {
      expect(claudeCode).toBeDefined();
      expect(typeof claudeCode).toBe('function');
    });

    it('should create models using default instance', () => {
      const model = claudeCode('sonnet');
      expect(model).toBeInstanceOf(ClaudeCodeLanguageModel);
      expect(model.modelId).toBe('sonnet');
    });

    it('should throw error when default instance is called with new keyword', () => {
      expect(() => {
        // @ts-expect-error - intentionally calling with new for testing
        new claudeCode('opus');
      }).toThrow('The Claude Code model function cannot be called with the new keyword.');
    });
  });
});