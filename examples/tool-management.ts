/**
 * Example: Tool Management
 * 
 * This example demonstrates how to manage and control which tools Claude Code 
 * can use during execution. You can use either:
 * - allowedTools: Explicitly specify which tools can be used (allowlist approach)
 * - disallowedTools: Specify which tools to block (denylist approach)
 */

import { generateText } from 'ai';
import { createClaudeCode } from '../dist/index.js';

async function testToolManagement() {
  console.log('🔧 Testing Claude Code Tool Management\n');

  // 1. Default behavior - all tools allowed
  console.log('1️⃣  Default (all tools allowed)');
  const defaultClaude = createClaudeCode();
  
  try {
    const { text: response1 } = await generateText({
      model: defaultClaude('sonnet'),
      prompt: 'What is the current date? (You can use any tools you need)',
    });
    console.log('Response:', response1);
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n2️⃣  Using allowedTools (allowlist approach)');
  // 2. Allowlist approach - only specific tools allowed
  const readOnlyClaude = createClaudeCode({
    allowedTools: ['read_file', 'list_files', 'search_files'],
  });

  try {
    const { text: response2 } = await generateText({
      model: readOnlyClaude('sonnet'),
      prompt: 'Can you analyze the code in this directory and create a summary file?',
    });
    console.log('Response:', response2);
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n3️⃣  Using disallowedTools (denylist approach)');
  // 3. Denylist approach - specific tools blocked
  const restrictedClaude = createClaudeCode({
    disallowedTools: ['read_website', 'run_terminal_command'],
  });

  try {
    const { text: response3 } = await generateText({
      model: restrictedClaude('sonnet'),
      prompt: 'Can you check what\'s on https://example.com? (web access restricted)',
    });
    console.log('Response:', response3);
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n4️⃣  Model-specific overrides');
  // 4. Model-specific settings override provider settings
  const baseClaude = createClaudeCode({
    allowedTools: ['read_file', 'list_files'], // Base allows only reading
  });

  try {
    const { text: response4 } = await generateText({
      model: baseClaude('sonnet', {
        // Override to allow more tools for this specific call
        allowedTools: ['read_file', 'list_files', 'search_files', 'create_file'],
      }),
      prompt: 'Create a simple Python script that prints "Hello World"',
    });
    console.log('Response:', response4);
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n5️⃣  Security-focused configuration (using allowedTools)');
  // 5. Security-focused configuration - only allow minimal tools
  const secureClaude = createClaudeCode({
    allowedTools: [], // No tools allowed at all
  });

  try {
    const { text: response5 } = await generateText({
      model: secureClaude('opus'),
      prompt: 'Analyze this code pattern and suggest improvements: function add(a, b) { return a + b; }',
    });
    console.log('Response:', response5);
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n6️⃣  Practical use case - code review only');
  // 6. Practical use case - allow reading but not modifying
  const reviewOnlyClaude = createClaudeCode({
    allowedTools: [
      'read_file',
      'list_files',
      'search_files',
      'view_image',  // Can view diagrams
      // No write/execute tools allowed
    ],
  });

  try {
    const { text: response6 } = await generateText({
      model: reviewOnlyClaude('opus'),
      prompt: 'Review this function for potential issues: function divide(a, b) { return a / b; }',
    });
    console.log('Response:', response6);
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n✅ Tool management examples completed!');
}

// Run the examples
testToolManagement()
  .then(() => {
    console.log('\nAll examples completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\nExample failed:', error);
    process.exit(1);
  });