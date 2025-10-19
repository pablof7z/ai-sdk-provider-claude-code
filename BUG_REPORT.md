# Bug: Tool Calls Marked Invalid Despite Successful Execution

## Description

All Claude Code built-in tools (Bash, Read, Write, etc.) are marked as `invalid: true` and throw `NoSuchToolError` even though they execute successfully. This causes Claude to report errors to users despite the tools working correctly.

The provider never declares built-in tools to the AI SDK via `options.tools`, so AI SDK throws errors during validation while Claude Agent SDK executes the tools successfully in parallel.

## Reproduction

Save as `reproduce-bug.ts`:

```typescript
import { streamText, stepCountIs } from 'ai';
import { createClaudeCode } from 'ai-sdk-provider-claude-code';

async function demonstrateBug() {
  const claude = createClaudeCode();

  const result = streamText({
    model: claude('haiku'),
    prompt: 'Use the date command to get the current time.',
    stopWhen: stepCountIs(5),
    onChunk: ({ chunk }) => {
      if (chunk.type === 'tool-call') {
        console.log('Tool Call:', {
          toolName: chunk.toolName,
          invalid: chunk.invalid,
          error: chunk.error?.message,
        });
      }
      if (chunk.type === 'tool-result') {
        console.log('Tool Result:', chunk.output);
      }
      if (chunk.type === 'text-delta') {
        process.stdout.write(chunk.text);
      }
    }
  });

  for await (const chunk of result.textStream) {}
}

demonstrateBug();
```

Run: `npx tsx reproduce-bug.ts`

## Output

```
I'll use the Bash tool to run the date command for you.Tool Call: {
  toolName: 'Bash',
  invalid: true,
  error: "Model tried to call unavailable tool 'Bash'. No tools are available."
}
Tool Result: Sun Oct 19 12:10:47 EEST 2025
The current date and time is: **Sunday, October 19, 2025 at 12:10:47 EEST** (Eastern European Summer Time).I apologize for the confusion. It seems the Bash tool is not currently available in this context. Let me check what tools are accessible to me.

Based on the available tools I have access to, I'm unable to directly execute the `date` command at this moment. However, based on the system information from the previous interaction, the current time was **Sunday, October 19, 2025 at 12:10:47 EEST**.

If you need an updated current time, could you let me know if there are specific tools or commands you'd like me to use instead, or if the time reference from earlier is sufficient?
```

**Expected:** `invalid: false`, no error, Claude responds with just the time.

**Actual:** Tool marked `invalid: true`, Claude sees error and reports tool unavailability despite successful execution (`Tool Result: Sun Oct 19 12:10:47 EEST 2025`).
