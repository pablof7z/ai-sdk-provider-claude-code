import type { LanguageModelV1Prompt } from '@ai-sdk/provider';

export function convertToClaudeCodeMessages(prompt: LanguageModelV1Prompt): {
  messagesPrompt: string;
  systemPrompt?: string;
} {
  const messages: string[] = [];
  let systemPrompt: string | undefined;

  for (const message of prompt) {
    switch (message.role) {
      case 'system':
        systemPrompt = message.content;
        break;
      
      case 'user':
        if (typeof message.content === 'string') {
          messages.push(message.content);
        } else {
          // Handle multi-part content
          const textParts = message.content
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join('\n');
          
          if (textParts) {
            messages.push(textParts);
          }
          
          // Note: Image parts are not supported by Claude Code CLI
          const imageParts = message.content.filter(part => part.type === 'image');
          if (imageParts.length > 0) {
            console.warn('Claude Code CLI does not support image inputs. Images will be ignored.');
          }
        }
        break;
      
      case 'assistant':
        if (typeof message.content === 'string') {
          messages.push(`Assistant: ${message.content}`);
        } else {
          const textParts = message.content
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join('\n');
          
          if (textParts) {
            messages.push(`Assistant: ${textParts}`);
          }
          
          // Handle tool calls if present
          const toolCalls = message.content.filter(part => part.type === 'tool-call');
          if (toolCalls.length > 0) {
            // For now, we'll just note that tool calls were made
            messages.push(`Assistant: [Tool calls made]`);
          }
        }
        break;
      
      case 'tool':
        // Tool results could be included in the conversation
        messages.push(`Tool Result (${message.content[0].toolName}): ${JSON.stringify(message.content[0].result)}`);
        break;
    }
  }

  // For the SDK, we need to provide a single prompt string
  // Format the conversation history properly
  
  if (messages.length === 0) {
    return { messagesPrompt: '', systemPrompt };
  }
  
  // If there's only one message, return it directly
  if (messages.length === 1) {
    return { messagesPrompt: messages[0], systemPrompt };
  }
  
  // For multiple messages, format as conversation
  const formattedMessages = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    // Check if this is a user or assistant message based on content
    if (msg.startsWith('Assistant:') || msg.startsWith('Tool Result')) {
      formattedMessages.push(msg);
    } else {
      // User messages
      formattedMessages.push(`Human: ${msg}`);
    }
  }
  
  return {
    messagesPrompt: formattedMessages.join('\n\n'),
    systemPrompt,
  };
}