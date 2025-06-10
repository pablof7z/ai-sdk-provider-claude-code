import { generateText } from 'ai';
import { claudeCode } from '../dist/index.js';

async function main() {
  try {
    // Basic text generation with metadata
    const { text, usage, experimental_providerMetadata } = await generateText({
      model: claudeCode('opus'),
      prompt: 'Explain the concept of recursion in programming in 2-3 sentences.',
      experimental_providerMetadata: true,
    });

    console.log('Response:', text);
    console.log('\nToken usage:', usage);
    
    // Show provider metadata
    const metadata = experimental_providerMetadata?.['claude-code'];
    if (metadata) {
      console.log('\nProvider metadata:');
      console.log(`- Session ID: ${metadata.sessionId}`);
      console.log(`- Duration: ${metadata.durationMs}ms`);
      console.log(`- Cost: $${typeof metadata.costUsd === 'number' ? metadata.costUsd.toFixed(4) : '0.00'}`);
      console.log('  (Pro/Max subscribers: covered by subscription, API key users: actual charge)');
    }
  } catch (error) {
    console.error('Error:', error);
    console.log('\nMake sure you have:');
    console.log('1. Installed Claude Code CLI: npm install -g @anthropic-ai/claude-code');
    console.log('2. Authenticated: claude login');
  }
}

main();