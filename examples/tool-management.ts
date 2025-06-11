/**
 * Example: Tool Management
 * 
 * This example demonstrates how to manage and control which tools Claude Code 
 * can use during execution. You can use either:
 * - allowedTools: Explicitly specify which tools can be used (allowlist approach)
 * - disallowedTools: Specify which tools to block (denylist approach)
 * 
 * Note: This example uses simple, fast operations to demonstrate the concept.
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
      prompt: 'Run the date command to show the current date and time. Just show me the output.',
    });
    console.log('Response:', response1.trim());
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n2️⃣  Using allowedTools (only terminal commands allowed)');
  // 2. Allowlist approach - only allow running terminal commands
  const terminalOnlyClaude = createClaudeCode({
    allowedTools: ['run_terminal_command'],
  });

  try {
    const { text: response2 } = await generateText({
      model: terminalOnlyClaude('sonnet'),
      prompt: 'Run the echo command to print "Hello from Claude". Just show the output.',
    });
    console.log('Response:', response2.trim());
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n3️⃣  Using disallowedTools (terminal commands blocked)');
  // 3. Denylist approach - block terminal commands
  const noTerminalClaude = createClaudeCode({
    disallowedTools: ['run_terminal_command'],
  });

  try {
    const { text: response3 } = await generateText({
      model: noTerminalClaude('sonnet'),
      prompt: 'Try to run the whoami command. What happens?',
    });
    console.log('Response:', response3.trim());
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n4️⃣  Security-focused: No tools allowed');
  // 4. Maximum security - no tools at all
  const noToolsClaude = createClaudeCode({
    allowedTools: [], // Empty array means NO tools allowed
  });

  try {
    const { text: response4 } = await generateText({
      model: noToolsClaude('sonnet'),
      prompt: 'What is the result of 5 * 8? (You cannot use any tools, just calculate)',
    });
    console.log('Response:', response4.trim());
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n5️⃣  Model-specific override');
  // 5. Model-specific settings override provider settings
  const baseClaude = createClaudeCode({
    disallowedTools: ['run_terminal_command'], // Provider blocks terminal
  });

  try {
    const { text: response5 } = await generateText({
      model: baseClaude('sonnet', {
        // Override to allow terminal for this specific call
        disallowedTools: [], // Empty array = allow everything
      }),
      prompt: 'Run pwd command to show the current directory. Just the output.',
    });
    console.log('Response:', response5.trim());
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n✅ Tool management examples completed!');
  
  console.log('\n📝 Key Points:');
  console.log('- allowedTools: Define exactly which tools can be used');
  console.log('- disallowedTools: Block specific tools while allowing others');
  console.log('- Empty allowedTools ([]) = No tools allowed at all');
  console.log('- Model settings override provider settings');
  console.log('- Cannot use both allowedTools and disallowedTools together');
  
  console.log('\n🛡️  Common tool names to manage:');
  console.log('- run_terminal_command: Execute shell commands');
  console.log('- read_file: Read file contents');
  console.log('- create_file/edit_file/delete_file: File operations');
  console.log('- read_website: Web access');
  console.log('- list_files/search_files: File system navigation');
  
  console.log('\n⚠️  Note: Tool restrictions are passed to the CLI but enforcement');
  console.log('depends on the Claude Code CLI implementation. Some tools may');
  console.log('still be accessible depending on how Claude interprets the request.');
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