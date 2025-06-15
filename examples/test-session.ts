/**
 * Test conversation continuity using message history
 * 
 * The recommended approach for maintaining conversation context
 * is to use message history rather than session IDs.
 */

import { generateText } from 'ai';
import { createClaudeCode } from '../dist/index.js';

const claudeCode = createClaudeCode();

async function testConversationWithHistory() {
  console.log('🧪 Testing conversation continuity with message history...\n');
  
  // First message - establish context
  console.log('1️⃣ First message: Establishing context...');
  const { text: response1 } = await generateText({
    model: claudeCode('sonnet'),
    messages: [
      { role: 'user', content: 'My name is Alice and I love hiking. Remember this.' }
    ],
  });
  console.log('Response:', response1);
  
  // Second message - test memory with full conversation history
  console.log('\n2️⃣ Second message: Testing memory with conversation history...');
  const { text: response2 } = await generateText({
    model: claudeCode('sonnet'),
    messages: [
      { role: 'user', content: 'My name is Alice and I love hiking. Remember this.' },
      { role: 'assistant', content: response1 },
      { role: 'user', content: 'What did I tell you my name was?' }
    ],
  });
  console.log('Response:', response2);
  
  // Third message - test with more context
  console.log('\n3️⃣ Third message: Testing deeper context...');
  const { text: response3 } = await generateText({
    model: claudeCode('sonnet'),
    messages: [
      { role: 'user', content: 'My name is Alice and I love hiking. Remember this.' },
      { role: 'assistant', content: response1 },
      { role: 'user', content: 'What did I tell you my name was?' },
      { role: 'assistant', content: response2 },
      { role: 'user', content: 'What activity did I mention I enjoy?' }
    ],
  });
  console.log('Response:', response3);
  
  // Verify context was maintained
  const hasName = response2.toLowerCase().includes('alice');
  const hasActivity = response3.toLowerCase().includes('hiking');
  
  console.log('\n✅ Context maintained:');
  console.log('- Remembered name:', hasName);
  console.log('- Remembered activity:', hasActivity);
  
  if (hasName && hasActivity) {
    console.log('\n🎉 Conversation continuity works perfectly using message history!');
  } else {
    console.log('\n⚠️ Some context may have been lost. This is normal for complex conversations.');
  }
}

// Alternative: Testing without history (for comparison)
async function testWithoutHistory() {
  console.log('\n\n🔬 For comparison: Testing WITHOUT message history...\n');
  
  // First message
  console.log('1️⃣ First message...');
  await generateText({
    model: claudeCode('sonnet'),
    prompt: 'My name is Bob and I like swimming. Remember this.',
  });
  
  // Second message - no history provided
  console.log('\n2️⃣ Second message (no history)...');
  const { text } = await generateText({
    model: claudeCode('sonnet'),
    prompt: 'What did I tell you my name was?',
  });
  console.log('Response:', text);
  
  const rememberedName = text.toLowerCase().includes('bob');
  console.log('\nRemembered name without history:', rememberedName);
  console.log('(Expected: false - Claude has no context from previous message)');
}

async function main() {
  try {
    await testConversationWithHistory();
    await testWithoutHistory();
    
    console.log('\n📚 Key takeaway: Always use message history for conversations!');
  } catch (error) {
    console.error('Error:', error);
  }
}

main();