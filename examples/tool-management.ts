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

import { stepCountIs, streamText } from 'ai';
import { createClaudeCode } from '../dist/index.js';
// NOTE: Migrating to Claude Agent SDK:
// - System prompt is not applied by default
// - Filesystem settings (CLAUDE.md, settings.json) are not loaded by default
// To restore old behavior, set when creating model instances, e.g.:
//   systemPrompt: { type: 'preset', preset: 'claude_code' }
//   settingSources: ['user', 'project', 'local']

async function testToolManagement() {
  // Test without any tool restrictions
  const claude = createClaudeCode({
    defaultSettings: {
      // No allowedTools restriction
    },
  });

  try {
    const model = claude('haiku');
    const result2 = streamText({
      model,
      tools: model.tools, // Include built-in tools to avoid validation errors
      prompt: 'Use the date command; give me the time and nothing else. If you get confused, apologize and say you are confused.',
      stopWhen: stepCountIs(5),
      onChunk: ({chunk}) => {
        switch (chunk.type) {
          case 'tool-result':
            console.log(`✅ Tool ${chunk.toolName} Result:`, chunk.output);
            break;
          case 'text-delta':
            process.stdout.write(chunk.text);
            if (chunk.text.match(/(apologize|confusion)/i)) {
              console.log("\n❗ Detected confusion, but can't use any tools to resolve it.");
              process.exit(1);
            }

            break;
          case 'tool-call':
            console.log("👉 Tool Call:", chunk);
            break;
        }
      }
    });

    // Collect text from stream
    for await (const chunk of result2.textStream) {
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the examples
testToolManagement()
  .then(() => {
    console.log('\nAll examples completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nExample failed:', error);
    process.exit(1);
  });
