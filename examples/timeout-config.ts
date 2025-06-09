import { generateText } from 'ai';
import { claudeCode, createClaudeCode } from '../dist/index.js';

async function main() {
  console.log('Testing configurable timeout settings...\n');

  try {
    // Default provider (2-minute timeout)
    console.log('1. Using default timeout (2 minutes)...');
    const { text: text1 } = await generateText({
      model: claudeCode('sonnet'),
      prompt: 'What is 2+2?',
    });
    console.log('✅ Success:', text1);

    // Provider with custom 30-second timeout  
    const claude30s = createClaudeCode({
      timeoutMs: 30000, // 30 seconds
    });

    console.log('\n2. Using shorter 30-second timeout...');
    const { text: text2 } = await generateText({
      model: claude30s('sonnet'),
      prompt: 'What is 3+3?',
    });
    console.log('✅ Success:', text2);

    // Provider with longer 5-minute timeout
    const claude5min = createClaudeCode({
      timeoutMs: 300000, // 5 minutes
    });

    console.log('\n3. Using longer 5-minute timeout...');
    const { text: text3 } = await generateText({
      model: claude5min('sonnet'),
      prompt: 'Explain quantum computing briefly.',
    });
    console.log('✅ Success:', text3);

    // Per-model timeout override
    console.log('\n4. Per-model timeout override (10 seconds)...');
    const { text: text4 } = await generateText({
      model: claude5min('sonnet', { timeoutMs: 10000 }), // Override to 10 seconds
      prompt: 'Say hello.',
    });
    console.log('✅ Success:', text4);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();