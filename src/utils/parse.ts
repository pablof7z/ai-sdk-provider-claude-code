import type { LanguageModelV1ProviderMetadata } from '@ai-sdk/provider';
import type { ClaudeCodeResultEvent } from '../types.js';
import type { RawUsage } from './usage.js';

export interface ParsedResult {
  text: string;
  sessionId?: string;
  usage?: RawUsage;
  cost_usd?: number;
  duration_ms?: number;
}

/**
 * Parses Claude Code CLI result to extract text and metadata.
 * Handles both string responses and structured event objects.
 */
export function parseClaudeResult(
  raw: string | ClaudeCodeResultEvent
): ParsedResult {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return {
        text: parsed.result || '',
        sessionId: parsed.session_id,
        usage: parsed.usage,
        cost_usd: parsed.cost_usd,
        duration_ms: parsed.duration_ms,
      };
    } catch {
      return { text: raw };
    }
  }

  // Handle ClaudeCodeResultEvent
  return {
    text: raw.result || '',
    sessionId: raw.session_id,
    usage: raw.usage,
    cost_usd: raw.cost_usd,
    duration_ms: raw.duration_ms,
  };
}

/**
 * Extracts JSON content from object mode response.
 * Looks for JSON blocks wrapped in markdown code fences.
 */
export function extractJsonFromObjectMode(content: string): string | null {
  const match = content.match(/```json\n([\s\S]*?)\n```/);
  return match ? match[1].trim() : null;
}

/**
 * Builds provider metadata object for AI SDK.
 */
export function buildProviderMetadata(
  sessionId: string | null | undefined,
  result: ParsedResult
): LanguageModelV1ProviderMetadata {
  return {
    'claude-code': {
      ...(sessionId && { sessionId }),
      ...(result.cost_usd && { costUsd: result.cost_usd }),
      ...(result.duration_ms && { durationMs: result.duration_ms }),
      ...(result.usage && { 
        rawUsage: {
          inputTokens: result.usage.input_tokens || 0,
          outputTokens: result.usage.output_tokens || 0,
          cacheCreationInputTokens: result.usage.cache_creation_input_tokens || 0,
          cacheReadInputTokens: result.usage.cache_read_input_tokens || 0,
        }
      }),
    },
  };
}

/**
 * Handles session ID updates.
 * Returns the new session ID if it's different and valid.
 */
export function handleSessionId(
  currentId: string | null | undefined,
  newId: string | null | undefined
): string | null {
  if (newId && newId !== currentId) {
    return newId;
  }
  return currentId || null;
}

/**
 * Checks if an error message indicates authentication failure.
 */
export function checkAuthenticationError(stderr: string): boolean {
  return stderr.includes('not logged in') || 
         stderr.includes('authentication') ||
         stderr.includes('unauthenticated');
}

/**
 * Type guard for object-tool mode.
 */
export function isObjectToolMode(
  mode: Parameters<import('@ai-sdk/provider').LanguageModelV1['doGenerate']>[0]['mode']
): boolean {
  return mode?.type === 'object-tool';
}