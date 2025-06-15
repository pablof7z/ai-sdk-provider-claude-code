/**
 * Basic integration test for the Claude Code AI SDK Provider
 * Tests only non-streaming functionality
 */

import { generateText } from 'ai';
import { claudeCode, isAuthenticationError } from '../dist/index.js';

async function testBasicGeneration() {
  console.log('🧪 Test 1: Basic text generation with Sonnet...');
  try {
    const { text } = await generateText({
      model: claudeCode('sonnet'),
      prompt: 'Say "Hello from Claude Code Provider!" and nothing else.',
    });
    console.log('✅ Success:', text);
  } catch (error) {
    console.error('❌ Failed:', error);
    throw error;
  }
}

async function testWithSystemMessage() {
  console.log('\n🧪 Test 2: With system message...');
  try {
    const { text } = await generateText({
      model: claudeCode('sonnet'),
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Be concise.' },
        { role: 'user', content: 'What is 2+2?' },
      ],
    });
    console.log('✅ Success:', text);
  } catch (error) {
    console.error('❌ Failed:', error);
    throw error;
  }
}

async function testConversation() {
  console.log('\n🧪 Test 3: Conversation (session persistence)...');
  try {
    // First message
    const { text: text1, providerMetadata } = await generateText({
      model: claudeCode('sonnet'),
      messages: [
        { role: 'user', content: 'My favorite color is blue. Remember this.' },
      ],
    });
    console.log('✅ First message:', text1);
    
    // Note: Session ID from JSON response is at top level, not in providerMetadata
    // For now, we'll skip session continuation test
    console.log('   (Session continuation not yet implemented with sync CLI)');
    
  } catch (error) {
    console.error('❌ Failed:', error);
    throw error;
  }
}

async function testErrorHandling() {
  console.log('\n🧪 Test 4: Error handling...');
  try {
    const badClaude = claudeCode('sonnet', { 
      pathToClaudeCodeExecutable: 'claude-nonexistent' 
    });
    
    await generateText({
      model: badClaude,
      prompt: 'This should fail',
    });
    
    console.error('❌ Expected error but got success');
  } catch (error) {
    console.log('✅ Error handled correctly:', (error as Error).message);
  }
}

async function runAllTests() {
  console.log('🚀 Running Claude Code AI SDK Provider Basic Integration Tests\n');
  
  try {
    await testBasicGeneration();
    await testWithSystemMessage();
    await testConversation();
    await testErrorHandling();
    
    console.log('\n✅ All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Tests failed');
    if (isAuthenticationError(error)) {
      console.log('\n⚠️  Authentication required. Please run: claude login');
    }
    process.exit(1);
  }
}

// Add global timeout
setTimeout(() => {
  console.log('\n⏱️ Tests timed out after 60 seconds');
  process.exit(1);
}, 60000);

runAllTests();