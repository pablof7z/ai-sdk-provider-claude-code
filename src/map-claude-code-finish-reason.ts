import type { LanguageModelV1FinishReason } from '@ai-sdk/provider';

export function mapClaudeCodeFinishReason(
  subtype?: string
): LanguageModelV1FinishReason {
  switch (subtype) {
    case 'success':
      return 'stop';
    case 'error_max_turns':
      return 'length';
    case 'error_during_execution':
      return 'error';
    default:
      return 'stop';
  }
}