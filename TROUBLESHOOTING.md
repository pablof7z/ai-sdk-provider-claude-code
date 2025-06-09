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

### 4. Claude CLI Timeout Errors

**Problem**: Getting timeout errors like "Claude CLI timed out after 120 seconds" especially with Claude Opus 4.

**Root Cause**: Claude Opus 4 can use extended thinking mode for complex queries, which may take longer than the default 2-minute timeout.

**Solutions**:
1. **Increase timeout for complex tasks**:
   ```typescript
   // 5-minute timeout for complex reasoning
   const claude = createClaudeCode({ timeoutMs: 300000 });
   
   // Or per-model override
   const model = claude('opus', { timeoutMs: 600000 }); // 10 minutes
   ```

2. **Use appropriate timeouts by task complexity**:
   - Simple queries: Default 2 minutes is sufficient
   - Complex reasoning: 5-10 minutes recommended
   - Maximum allowed: 10 minutes (matches Anthropic's API limit)

3. **For very long tasks**, consider breaking them into smaller chunks or using streaming approaches.

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

### Test Timeout Configuration
```bash
# Run the timeout configuration example
npx tsx examples/timeout-config.ts

# Or test a specific timeout manually with Claude CLI
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

## Known Limitations

1. **No Image Support**: CLI doesn't support image inputs
2. **Process Limits**: Configurable concurrent process limit (default: 4) for system resource management

## References

- [Claude CLI Spawn Issue #771](https://github.com/anthropics/claude-code/issues/771)
- [AI SDK Language Model Specification](https://sdk.vercel.ai/docs/reference/language-model-specification)
- [Node.js child_process documentation](https://nodejs.org/api/child_process.html)