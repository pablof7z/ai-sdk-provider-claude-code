import { generateText } from 'ai';
import { createClaudeCode } from '../dist/index.js';

async function main() {
  try {
    // Create a custom configured provider
    const claude = createClaudeCode({
      cliPath: 'claude', // or '/usr/local/bin/claude' if not in PATH
      skipPermissions: false, // Ask for permissions
      maxConcurrentProcesses: 2, // Limit concurrent CLI processes
    });

    // Use the custom provider
    const { text } = await generateText({
      model: claude('opus'),
      prompt: 'What is the capital of France?',
    });

    console.log('Response:', text);

    // You can also override settings per model
    const { text: text2 } = await generateText({
      model: claude('sonnet', { skipPermissions: true }),
      prompt: 'Name three programming languages.',
    });

    console.log('\nResponse 2:', text2);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();