# Troubleshooting Guide

This guide documents common issues and solutions discovered during the development of the Claude Code AI SDK Provider.

## Common Issues

### 1. Claude CLI Hanging Issues (RESOLVED)

**Problem**: The Claude CLI hangs indefinitely when spawned as a child process using Node.js `spawn` or `execFile`.

**Root Cause**: The issue was using command line arguments instead of stdin for prompt input. Claude CLI expects prompts via stdin when using the `-p` flag.

**Solution**: ✅ **FIXED** in current implementation:
- Use `spawn` with `-p` flag and write prompt to `child.stdin`
- Properly close stdin after writing: `child.stdin.write(prompt); child.stdin.end()`
- This eliminates the need for `execSync` or `node-pty` workarounds

### 2. Streaming Requires `--verbose` Flag

**Problem**: Getting error: "When using --print, --output-format=stream-json requires --verbose"

**Root Cause**: This is a Claude CLI requirement, not a limitation of our implementation.

**Solution**: ✅ **IMPLEMENTED** - Always include `--verbose` when using `--output-format stream-json`.

### 3. Session IDs Change Even When Resuming

**Problem**: Claude CLI returns a new session ID for each interaction, even when using `--resume`.

**Expected Behavior**: This is normal Claude CLI behavior. The context is maintained correctly despite new session IDs.

**Solution**: Continue using the `--resume` flag with the original session ID. The conversation context will be preserved.

### 4. Handling Long-Running Tasks

**Problem**: Complex queries with Claude Opus 4 may take longer due to extended thinking mode.

**Root Cause**: Claude Opus 4 can engage in deep reasoning that requires more processing time.

**Solution**: Use AbortSignal with custom timeouts:

```typescript
import { generateText } from 'ai';
import { claudeCode } from 'ai-sdk-provider-claude-code';

// Create a custom timeout
const controller = new AbortController();
const timeoutId = setTimeout(() => {
  controller.abort(new Error('Request timeout'));
}, 300000); // 5 minutes

try {
  const { text } = await generateText({
    model: claudeCode('opus'),
    prompt: 'Complex reasoning task...',
    abortSignal: controller.signal,
  });
  clearTimeout(timeoutId);
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Request timed out');
  }
}
```

**Guidelines**:
- Simple queries: 1-2 minutes usually sufficient
- Complex reasoning: 5-10 minutes may be needed
- Very long tasks: Consider breaking into smaller chunks

### 5. Error Handling with Standard AI SDK Errors

**Problem**: Need to handle different types of errors appropriately.

**Solution**: The provider now uses standard AI SDK error classes:

```typescript
import { APICallError, LoadAPIKeyError } from '@ai-sdk/provider';
import { isAuthenticationError, isTimeoutError, getErrorMetadata } from 'ai-sdk-provider-claude-code';

try {
  // Your code here
} catch (error) {
  if (isAuthenticationError(error)) {
    // Handle authentication error - user needs to run 'claude login'
  } else if (error.name === 'AbortError') {
    // Handle abort/timeout - consider retrying with longer timeout
  } else if (error instanceof APICallError) {
    // Check if retryable
    if (error.isRetryable) {
      // Implement retry logic
    }
    // Get CLI-specific metadata
    const metadata = getErrorMetadata(error);
    console.log('Exit code:', metadata?.exitCode);
  }
}
```

**Error Types**:
- **`LoadAPIKeyError`**: Authentication failures (exit code 401)
- **`APICallError`**: All other CLI failures
  - Timeouts have `isRetryable: true`
  - Other errors have `isRetryable: false`
  - Contains metadata accessible via `getErrorMetadata()`

## Debugging Commands

### Check CLI Installation
```bash
claude --version
```

### Test Basic CLI Functionality
```bash
claude -p "Hello" --print --output-format json
```

### Test Streaming Output
```bash
claude -p "Count to 5" --verbose --output-format stream-json
```

### Test Session Resumption
```bash
# First command
claude -p "My name is Alice" --print --output-format json
# Note the session_id from the response

# Resume session
claude --resume <session_id> -p "What is my name?" --print --output-format json
```

### Test Long-Running Tasks
```bash
# Run the long-running tasks example
npx tsx examples/long-running-tasks.ts

# Or test execution time manually with Claude CLI
time claude -p "Explain quantum computing in detail" --print --output-format json
```

## Implementation Decisions

### Why Unified Spawn Architecture?
After fixing the stdin communication issue, `spawn` became the optimal solution:
- ✅ Works consistently across all environments
- ✅ Supports both streaming and non-streaming modes
- ✅ Zero-latency streaming with readline interface
- ✅ No external dependencies required
- ✅ Proper process lifecycle management
- ✅ Concurrent request handling with process pooling

### Why Readline Interface?
Using Node.js `readline.createInterface()` for parsing CLI output:
- ✅ Event-driven processing eliminates polling delays
- ✅ Immediate response as soon as data arrives
- ✅ Built into Node.js core - no external dependencies
- ✅ Handles line-buffered JSON output correctly
- ✅ Proper async iteration with `for await (const line of rl)`

### Architectural Benefits
The unified approach provides:
- **Performance**: Zero-latency streaming matches AI SDK ecosystem standards
- **Reliability**: Single code path reduces complexity and edge cases
- **Compatibility**: Works in all Node.js environments without optional dependencies
- **Maintainability**: One implementation to test and maintain

## Object Generation Troubleshooting

### 1. Invalid JSON Response

**Problem**: Claude returns text instead of valid JSON when using `generateObject`.

**Solutions**:
- Simplify your schema - start with fewer fields
- Make your prompt more explicit: "Generate only valid JSON"
- Use descriptive field names and add `.describe()` to schema fields
- Implement retry logic for production use

### 2. Object Generation Takes Full Response Time

**Problem**: `streamObject` doesn't stream in real-time like text generation.

**Expected Behavior**: This is normal. Since we use prompt engineering (not native JSON mode), the provider must wait for the complete response before parsing JSON. Use `generateObject` for clarity.

### 3. Missing Required Fields

**Problem**: Generated objects missing required properties.

**Solutions**:
- Emphasize requirements in your prompt
- Use clear, descriptive field names
- Add field descriptions: `z.string().describe('User full name')`

### 4. Type Mismatches

**Problem**: String when expecting number, wrong date format, etc.

**Solutions**:
- Be explicit in descriptions: "age as a number" not just "age"
- For dates, specify format: `.describe('Date in YYYY-MM-DD format')`
- Use regex patterns: `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`

## Known Limitations

1. **No Image Support**: CLI doesn't support image inputs
2. **Process Limits**: Configurable concurrent process limit (default: 4) for system resource management
3. **No Object-Tool Mode**: Only `object-json` mode supported via `generateObject`/`streamObject`
4. **Object Generation Requires Full Response**: Cannot stream JSON in real-time

## References

- [Claude CLI Spawn Issue #771](https://github.com/anthropics/claude-code/issues/771)
- [AI SDK Language Model Specification](https://sdk.vercel.ai/docs/reference/language-model-specification)
- [Node.js child_process documentation](https://nodejs.org/api/child_process.html)