import { stepCountIs } from 'ai';
import { createClaudeCode, streamText } from './dist/index.js';

async function demonstrateBug() {
  const claude = createClaudeCode();

  const result = streamText({
    model: claude('haiku'),
    prompt: 'Use the date command to get the current time.',
    stopWhen: stepCountIs(5),
    onChunk: ({ chunk }) => {
      if (chunk.type === 'tool-call') {
        console.log('Tool Call:', {
          toolName: chunk.toolName,
          invalid: chunk.invalid,
          error: chunk.error?.message,
        });
      }
      if (chunk.type === 'tool-result') {
        console.log('Tool Result:', chunk.output);
      }
      if (chunk.type === 'text-delta') {
        process.stdout.write(chunk.text);
      }
    }
  });

  for await (const chunk of result.textStream) {}
}

demonstrateBug();
