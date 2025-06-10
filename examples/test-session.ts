/**
 * Test session management functionality
 */

import { generateText } from 'ai';
import { claudeCode } from '../dist/index.js';

async function testSessionManagement() {
  console.log('🧪 Testing session management with Sonnet...');
  
  const model = claudeCode('sonnet');
  
  // First message
  console.log('\n1️⃣ First message: Establishing context...');
  const response1 = await generateText({
    model,
    messages: [
      { role: 'user', content: 'My name is Alice and I love programming. What\'s my name?' },
    ],
  });
  console.log('Response:', response1.text);
  console.log('Session ID:', response1.providerMetadata?.['claude-code']?.sessionId);
  
  // Extract session ID if available
  const sessionId = response1.providerMetadata?.['claude-code']?.sessionId;
  
  if (sessionId && typeof sessionId === 'string') {
    console.log('\n2️⃣ Second message: Testing memory with same session...');
    const modelWithSession = claudeCode('sonnet', { sessionId });
    const response2 = await generateText({
      model: modelWithSession,
      messages: [
        { role: 'user', content: 'What did I tell you my name was?' },
      ],
    });
    console.log('Response:', response2.text);
    const newSessionId = response2.providerMetadata?.['claude-code']?.sessionId;
    console.log('Session context maintained:', response2.text.toLowerCase().includes('alice'));
    console.log('New session ID:', newSessionId);
  } else {
    console.log('\n⚠️ No session ID returned - session continuation not available');
  }
}

testSessionManagement()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });