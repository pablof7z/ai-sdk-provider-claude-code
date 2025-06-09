import type { ClaudeCodeEvent, ClaudeCodeErrorEvent } from './types.js';

export class ClaudeCodeParser {
  static extractText(events: ClaudeCodeEvent[]): string {
    const textParts: string[] = [];

    for (const event of events) {
      if (event.type === 'assistant') {
        // Extract text from assistant message content
        const content = event.message.content;
        if (Array.isArray(content)) {
          for (const part of content) {
            if (part.type === 'text') {
              textParts.push(part.text);
            }
          }
        }
      } else if (event.type === 'result') {
        // Final result contains the complete text
        return event.result;
      }
    }

    return textParts.join('');
  }

  static extractSessionId(events: ClaudeCodeEvent[]): string | undefined {
    for (const event of events) {
      if (event.type === 'result' && event.session_id) {
        return event.session_id;
      } else if (event.type === 'assistant' && event.session_id) {
        return event.session_id;
      }
    }
    return undefined;
  }

  static findError(events: ClaudeCodeEvent[]): ClaudeCodeErrorEvent | undefined {
    return events.find(event => event.type === 'error') as ClaudeCodeErrorEvent | undefined;
  }
}