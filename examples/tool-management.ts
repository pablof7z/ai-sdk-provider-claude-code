/**
 * Example: Tool Management
 * 
 * This example demonstrates how to manage tool permissions for Claude Code.
 * The allowedTools and disallowedTools flags work for BOTH:
 * - Built-in Claude tools (Bash, Edit, Read, Write, etc.)
 * - MCP tools (mcp__serverName__toolName format)
 * 
 * These are session-only permission overrides that use the same rule syntax
 * as settings.json permissions.
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
      prompt: 'What is 2 + 2? Just give me the number.',
    });
    console.log('Response:', response1.trim());
    console.log('   (All built-in and MCP tools would be allowed)');
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n2️⃣  Built-in tools: Allow only Bash commands');
  // 2. Allow only specific Bash commands
  const bashOnlyClaude = createClaudeCode({
    allowedTools: ['Bash(echo:*)', 'Bash(date)', 'Bash(pwd)'],
  });

  try {
    const { text: response2 } = await generateText({
      model: bashOnlyClaude('sonnet'),
      prompt: 'Can you show me the current date? Use the date command.',
    });
    console.log('Response:', response2.trim());
    console.log('   (Only allowed specific Bash commands)');
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n3️⃣  Built-in tools: Block dangerous operations');
  // 3. Block file modifications but allow reading
  const readOnlyClaude = createClaudeCode({
    disallowedTools: ['Write', 'Edit', 'Delete', 'Bash(rm:*)', 'Bash(sudo:*)'],
  });

  try {
    const { text: response3 } = await generateText({
      model: readOnlyClaude('sonnet'),
      prompt: 'What is the capital of France? Just the city name.',
    });
    console.log('Response:', response3.trim());
    console.log('   (Can read files but not write/edit/delete)');
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n4️⃣  Mixed: Built-in tools + MCP tools');
  // 4. Allow specific built-in tools and MCP tools
  const mixedClaude = createClaudeCode({
    allowedTools: [
      'Read',
      'LS',
      'Bash(git log:*)',
      'Bash(git status)',
      'mcp__filesystem__read_file',
      'mcp__git__status'
    ],
  });

  try {
    const { text: response4 } = await generateText({
      model: mixedClaude('sonnet'),
      prompt: 'What is the result of 5 * 8?',
    });
    console.log('Response:', response4.trim());
    console.log('   (Only allowed read operations and git status)');
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n5️⃣  Security lockdown: No tools at all');
  // 5. Maximum security - explicit empty allowlist blocks all tools
  const noToolsClaude = createClaudeCode({
    allowedTools: [], // Empty array = explicit empty allowlist = NO tools allowed
  });

  try {
    const { text: response5 } = await generateText({
      model: noToolsClaude('sonnet'),
      prompt: 'What programming language is this: console.log("Hello")?',
    });
    console.log('Response:', response5.trim());
    console.log('   (No tools allowed - explicit empty allowlist blocks everything)');
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n6️⃣  Model-specific override');
  // 6. Model-specific settings override provider settings
  const baseClaude = createClaudeCode({
    disallowedTools: ['Bash', 'Write'], // Provider blocks these
  });

  try {
    const { text: response6 } = await generateText({
      model: baseClaude('sonnet', {
        // Override to allow everything for this specific call
        disallowedTools: [],
      }),
      prompt: 'Name a popular web framework.',
    });
    console.log('Response:', response6.trim());
    console.log('   (Model override allows all tools for this call)');
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n✅ Tool management examples completed!');
  
  console.log('\n📝 Key Points:');
  console.log('- Flags work for BOTH built-in tools AND MCP tools');
  console.log('- Same rule syntax as settings.json permissions');
  console.log('- Session-only overrides (higher priority than settings files)');
  console.log('- Use specifiers for fine-grained control: Bash(git:*)');
  console.log('- Empty allowedTools ([]) = Explicit empty allowlist = No tools allowed');
  console.log('- Omitting flags entirely = Falls back to normal permission system');
  
  console.log('\n🛠️  Built-in tool names:');
  console.log('- Bash, Edit, Read, Write, Delete, LS, Grep, Glob');
  console.log('- WebFetch, NotebookRead, NotebookEdit');
  console.log('- Use /permissions in Claude to see all available tools');
  
  console.log('\n🔌 MCP tool format:');
  console.log('- mcp__<serverName> (all tools from that server)');
  console.log('- mcp__<serverName>__<toolName> (specific tool)');
  
  console.log('\n🔒 Security patterns:');
  console.log('- Read-only: disallowedTools: ["Write", "Edit", "Delete"]');
  console.log('- No shell: disallowedTools: ["Bash"]');
  console.log('- Safe git: allowedTools: ["Bash(git log:*)", "Bash(git diff:*)"]');
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