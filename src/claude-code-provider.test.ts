import { describe, it, expect } from 'vitest';
import { createClaudeCode, claudeCode } from './claude-code-provider';
import { ClaudeCodeLanguageModel } from './claude-code-language-model';

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
  });
});