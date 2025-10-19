/**
 * Built-in tool definitions for Claude Code.
 * These tools are always available and executed by the Claude Agent SDK.
 */

import type { LanguageModelV2FunctionTool } from '@ai-sdk/provider';
import { jsonSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod';

/**
 * Defines all built-in Claude Code tools for AI SDK awareness.
 * These tools are provider-executed (handled by Claude Agent SDK).
 */
export function getClaudeCodeBuiltInTools(): LanguageModelV2FunctionTool[] {
  return [
    {
      type: 'function' as const,
      name: 'Bash',
      description: 'Execute bash commands',
      parameters: jsonSchema(z.object({
        command: z.string().describe('The bash command to execute'),
        description: z.string().optional().describe('Description of what the command does'),
        timeout: z.number().optional().describe('Timeout in milliseconds'),
      })),
    },

    {
      type: 'function' as const,
      name: 'Read',
      description: 'Read file contents',
      parameters: jsonSchema(z.object({
        file_path: z.string().describe('Absolute path to the file to read'),
        offset: z.number().optional().describe('Line number to start reading from'),
        limit: z.number().optional().describe('Number of lines to read'),
      })),
    },

    {
      type: 'function' as const,
      name: 'Write',
      description: 'Write content to a file',
      parameters: jsonSchema(z.object({
        file_path: z.string().describe('Absolute path to the file to write'),
        content: z.string().describe('Content to write to the file'),
      })),
    },

    {
      type: 'function' as const,
      name: 'Edit',
      description: 'Edit file contents by replacing text',
      parameters: jsonSchema(z.object({
        file_path: z.string().describe('Absolute path to the file to edit'),
        old_string: z.string().describe('Text to replace'),
        new_string: z.string().describe('Text to replace it with'),
        replace_all: z.boolean().optional().describe('Replace all occurrences'),
      })),
    },

    {
      type: 'function' as const,
      name: 'Glob',
      description: 'Find files matching a pattern',
      parameters: jsonSchema(z.object({
        pattern: z.string().describe('Glob pattern to match files'),
        path: z.string().optional().describe('Directory to search in'),
      })),
    },

    {
      type: 'function' as const,
      name: 'Grep',
      description: 'Search file contents using regex',
      parameters: jsonSchema(z.object({
        pattern: z.string().describe('Regular expression pattern to search for'),
        path: z.string().optional().describe('File or directory to search in'),
        glob: z.string().optional().describe('Glob pattern to filter files'),
        type: z.string().optional().describe('File type to search'),
        output_mode: z.enum(['content', 'files_with_matches', 'count']).optional(),
        '-i': z.boolean().optional().describe('Case insensitive search'),
        '-n': z.boolean().optional().describe('Show line numbers'),
        '-A': z.number().optional().describe('Lines of context after match'),
        '-B': z.number().optional().describe('Lines of context before match'),
        '-C': z.number().optional().describe('Lines of context around match'),
      })),
    },

    {
      type: 'function' as const,
      name: 'Task',
      description: 'Launch a specialized agent for complex tasks',
      parameters: jsonSchema(z.object({
        description: z.string().describe('Short description of the task'),
        prompt: z.string().describe('Detailed task prompt for the agent'),
        subagent_type: z.string().describe('Type of agent to use'),
      })),
    },

    {
      type: 'function' as const,
      name: 'WebFetch',
      description: 'Fetch content from a URL',
      parameters: jsonSchema(z.object({
        url: z.string().describe('URL to fetch content from'),
        prompt: z.string().describe('What to extract from the content'),
      })),
    },

    {
      type: 'function' as const,
      name: 'WebSearch',
      description: 'Search the web',
      parameters: jsonSchema(z.object({
        query: z.string().describe('Search query'),
        allowed_domains: z.array(z.string()).optional(),
        blocked_domains: z.array(z.string()).optional(),
      })),
    },
  ];
}
