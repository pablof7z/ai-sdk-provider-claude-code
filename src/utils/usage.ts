export interface LanguageModelUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface RawUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/**
 * Calculates token usage from raw Claude Code CLI response data.
 * Aggregates input tokens including cache-related tokens.
 */
export function calcUsage(rawUsage: RawUsage | undefined): LanguageModelUsage {
  if (!rawUsage) {
    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
  }

  const promptTokens = 
    (rawUsage.input_tokens || 0) + 
    (rawUsage.cache_creation_input_tokens || 0) + 
    (rawUsage.cache_read_input_tokens || 0);
  
  const completionTokens = rawUsage.output_tokens || 0;
  
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
}