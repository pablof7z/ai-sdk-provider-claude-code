# Claude Code AI SDK Provider - Project Status

## ✅ What's Working

### Core Functionality
- **Text Generation**: Basic text generation with all Claude models (opus, sonnet, haiku)
- **System Messages**: Full support for system prompts
- **Multi-turn Conversations**: Two approaches:
  1. Message history (recommended) - standard AI SDK pattern
  2. Session IDs with `--resume` flag (experimental)
- **Error Handling**: Proper error propagation and authentication detection
- **Provider Metadata**: Session IDs accessible via `experimental_providerMetadata`
- **Streaming**: Two implementations:
  1. **PTY-based streaming** (experimental) - Real streaming using pseudo-terminal
  2. **Simulated streaming** (default) - Returns complete response as single chunk

### Implementation Details
- Default: Uses `execSync` for reliable JSON output from Claude CLI
- PTY mode: Uses `node-pty` to create pseudo-terminal for real streaming
- All requests use appropriate flags for non-interactive execution
- Session resumption via `--resume` flag maintains context
- Proper escaping of quotes in prompts

## ⚠️ Limitations

### Streaming
- PTY streaming requires `node-pty` package (optional dependency)
- PTY mode may not work in all environments (e.g., some CI systems)
- Default mode uses simulated streaming for maximum compatibility

### Session Management
- Claude CLI returns new session ID for each interaction (even with --resume)
- Context is maintained correctly despite new IDs
- Session IDs only accessible with `experimental_providerMetadata: true`

### Token Usage
- Claude CLI doesn't provide token counts
- Usage always returns 0 for prompt/completion tokens

## 📁 Project Structure

```
/src
  ├── index.ts                    # Main exports
  ├── claude-code-provider.ts     # Provider factory
  ├── claude-code-language-model.ts # AI SDK implementation
  ├── claude-code-cli.ts          # Streaming CLI wrapper (unused)
  ├── claude-code-cli-sync.ts     # Sync CLI wrapper (active)
  ├── claude-code-parser.ts       # Event parser for streaming
  ├── errors.ts                   # Error handling
  └── types.ts                    # TypeScript types

/examples
  ├── basic-usage.ts              # Simple text generation
  ├── streaming-example.ts        # Streaming demo (simulated)
  ├── custom-config.ts            # Configuration options
  ├── test-conversation.ts        # Multi-turn conversation
  ├── test-session.ts             # Session management
  ├── integration-test-basic.ts   # Non-streaming tests
  └── integration-test.ts         # Full test suite
```

## 🚀 Next Steps

1. **Streaming Support**: Investigate alternative approaches for real streaming
2. **Token Counting**: Consider implementing client-side token estimation
3. **Performance**: Add connection pooling for multiple concurrent requests
4. **Documentation**: Expand examples and API documentation
5. **Testing**: Add automated unit tests with mocked CLI responses

## 🔧 Known Issues

1. Error handling test sometimes passes when it should fail
2. Streaming implementation is synchronous under the hood
3. No way to cancel in-progress requests (due to execSync)
4. Session IDs change even when resuming (CLI behavior)

## 📝 Usage Notes

- Always run `claude login` before using the provider
- Use message history for conversations (more reliable than sessions)
- For debugging, check the exact CLI command with verbose logging
- The provider works best with shorter prompts and responses