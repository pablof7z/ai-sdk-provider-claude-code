# Troubleshooting Guide

This guide documents common issues and solutions discovered during the development of the Claude Code AI SDK Provider.

## Common Issues

### 1. Claude CLI Hangs When Using `spawn` or `execFile`

**Problem**: The Claude CLI hangs indefinitely when spawned as a child process using Node.js `spawn` or `execFile`.

**Root Cause**: Claude CLI seems to have issues with TTY detection and buffer flushing when not connected to a real terminal.

**Solution**: Use one of these approaches:
- **Default**: Use `execSync` with `--print --output-format json` for reliable one-shot responses
- **PTY Mode**: Use `node-pty` to create a pseudo-terminal for real streaming

### 2. Streaming Requires `--verbose` Flag

**Problem**: Getting error: "When using --print, --output-format=stream-json requires --verbose"

**Root Cause**: This is a Claude CLI requirement, not a limitation of our implementation.

**Solution**: Always include `--verbose` when using `--output-format stream-json`.

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

### Why `execSync`?
After extensive testing, `execSync` proved to be the most reliable method for executing Claude CLI:
- ✅ Works consistently across all environments
- ✅ Provides clean JSON output with `--print --output-format json`
- ✅ No TTY detection issues
- ❌ Blocks the event loop (mitigated by keeping responses fast)

### Why PTY for Streaming?
`node-pty` creates a pseudo-terminal that satisfies Claude CLI's TTY requirements:
- ✅ Enables real streaming with `--verbose --output-format stream-json`
- ✅ Works around the spawn/execFile hanging issues
- ❌ Requires additional dependency
- ❌ May not work in all environments (e.g., some CI systems)

### Why Two Implementations?
We provide both approaches to balance reliability and features:
- **Default (execSync)**: Maximum compatibility, simulated streaming
- **PTY Mode**: Better UX with real streaming, when available

## Known Limitations

1. **No Image Support**: CLI doesn't support image inputs
2. **No Concurrent Requests**: Due to `execSync`, requests are processed sequentially
3. **PTY Platform Support**: `node-pty` may not work on all platforms

## References

- [Claude CLI Spawn Issue #771](https://github.com/anthropics/claude-code/issues/771)
- [AI SDK Language Model Specification](https://sdk.vercel.ai/docs/reference/language-model-specification)
- [Node.js child_process documentation](https://nodejs.org/api/child_process.html)