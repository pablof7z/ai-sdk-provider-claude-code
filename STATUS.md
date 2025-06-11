# Claude Code AI SDK Provider - Project Status

## ✅ What's Working

### Core Functionality
- **Text Generation**: Full text generation with Claude models (opus, sonnet)
- **System Messages**: Complete support for system prompts
- **Multi-turn Conversations**: Two robust approaches:
  1. **Message history** (recommended) - Standard AI SDK pattern with full context
  2. **Session IDs** with `--resume` flag - Working session continuity
- **Error Handling**: Comprehensive error propagation with authentication detection
- **Provider Metadata**: Rich metadata including session IDs, timing, costs, and detailed usage
- **Streaming**: Unified spawn-based implementation with zero-latency streaming using readline interface
- **Timeout Configuration**: Fully configurable timeouts (1s-10min) optimized for Claude Opus 4
- **Object Generation**: Support for `generateObject`/`streamObject` via prompt engineering with Zod schema validation
- **Auto-Streaming**: Automatic internal streaming for large responses to prevent 8K stdout truncation

### Implementation Details
- **Unified Architecture**: Uses `spawn` with stdin communication for both streaming and non-streaming
- **Zero-Latency Streaming**: Readline interface eliminates polling delays for immediate response
- **Timeout Handling**: Configurable at provider and model levels with proper validation
- **Type Safety**: Complete TypeScript implementation with proper interfaces and type guards
- **Session Management**: Working session resumption with `--resume` flag
- **Process Management**: Concurrent request handling with configurable process limits
- **JSON Schema Validation**: Full Zod schema integration for structured data generation

## ⚠️ Limitations

### Streaming
- Uses event-driven streaming with readline interface for zero latency
- No external dependencies required for streaming functionality
- Works consistently across all Node.js environments

### Session Management
- Claude CLI returns new session ID for each interaction (even with --resume)
- Context is maintained correctly despite new IDs
- Session IDs accessible via `providerMetadata`

### Platform Support
- Requires Node.js environment with `child_process` support
- Limited to text generation (no image support due to CLI limitation)
- Requires local Claude Code CLI installation and authentication
- Object generation requires complete response (no real-time streaming for JSON)

## 📁 Project Structure

```
/src
  ├── index.ts                       # Main exports
  ├── claude-code-provider.ts        # Provider factory with timeout config
  ├── claude-code-language-model.ts  # AI SDK implementation with full metadata
  ├── claude-code-cli.ts             # Unified spawn-based CLI wrapper with readline streaming
  ├── claude-code-parser.ts          # JSON event parser for streaming
  ├── errors.ts                      # Comprehensive error handling
  ├── types.ts                       # TypeScript types with validation schemas
  └── utils/                         # Utility functions
      ├── parse.ts                   # Parsing and metadata helpers
      └── usage.ts                   # Token usage calculation

/examples
  ├── README.md                      # Examples documentation
  ├── basic-usage.ts                 # Simple text generation with metadata
  ├── streaming.ts                   # Streaming response demo
  ├── custom-config.ts               # Provider configuration options
  ├── timeout-config.ts              # Timeout configuration examples
  ├── conversation-history.ts        # Multi-turn conversation with message history
  ├── generate-object.ts             # Original object generation example
  ├── generate-object-basic.ts       # Basic object generation patterns
  ├── generate-object-nested.ts      # Complex nested structures
  ├── generate-object-constraints.ts # Validation and constraints
  ├── tool-management.ts             # Tool access control (allow/disallow)
  ├── test-session.ts                # Session management testing
  ├── abort-signal.ts                # Request cancellation examples
  ├── limitations.ts                 # Provider limitations demo
  ├── integration-test.ts            # Comprehensive integration tests
  └── check-cli.ts                   # CLI installation verification

/tests
  ├── claude-code-language-model.test.ts  # Language model unit tests
  ├── claude-code-provider.test.ts        # Provider factory tests
  ├── claude-code-cli.test.ts             # CLI wrapper tests
  └── claude-code-parser.test.ts          # Response parser tests
```

## 🚀 Recent Achievements

### ✅ Completed
1. **✅ Architectural Overhaul**: Fixed spawn implementation using stdin instead of command arguments
2. **✅ Zero-Latency Streaming**: Replaced polling with readline interface for immediate response
3. **✅ Unified CLI**: Consolidated three implementations (sync/PTY/spawn) into single spawn-based approach
4. **✅ Timeout Configuration**: Fully configurable timeouts (1s-10min) optimized for Claude Opus 4
5. **✅ Type Safety**: Eliminated all TypeScript 'any' types with proper interfaces and type guards
6. **✅ Token Usage**: Working token usage tracking with detailed breakdowns
7. **✅ Provider Metadata**: Rich metadata including costs, timing, and session information
8. **✅ Comprehensive Testing**: All tests updated and passing with new architecture
9. **✅ Documentation**: Complete documentation with streaming improvements
10. **✅ Object Generation**: Full support for structured data generation with JSON schema validation
11. **✅ AI SDK v4 Compatibility**: Updated to latest AI SDK version with all required fields
12. **✅ Auto-Streaming**: Prevents 8K truncation by automatically using streaming for large responses

### 🎯 Current Status
- **Production Ready**: Full AI SDK provider implementation
- **Type Safe**: Complete TypeScript coverage with validation
- **Well Tested**: Comprehensive test suite and example coverage
- **Documented**: Full documentation including timeout configuration
- **Optimized**: 2-minute default timeout perfect for Claude Opus 4's dual-mode responses

## 🔧 Current Behavior

### Working Features
- ✅ Text generation with full metadata
- ✅ Zero-latency streaming with readline interface
- ✅ Multi-turn conversations via message history
- ✅ Session management with resumption
- ✅ Configurable timeouts (1s-10min)
- ✅ Error handling with authentication detection
- ✅ Token usage tracking and cost information
- ✅ TypeScript type safety throughout
- ✅ Concurrent request handling with process pooling
- ✅ Object generation with Zod schema validation
- ✅ AI SDK v4 compatibility with latest interfaces

### Known Characteristics
- Session IDs change on each interaction (Claude CLI behavior - context still maintained)
- Uses spawn with stdin communication for both streaming and non-streaming
- Readline interface provides zero-latency streaming without external dependencies
- Object generation waits for complete response before parsing JSON (no real-time streaming)

## 📝 Usage Notes

- **Authentication**: Always run `claude login` before using the provider
- **Conversations**: Use message history approach (most reliable)
- **Timeouts**: Default 2-minute timeout works for most cases, increase for complex Opus 4 tasks
- **Debugging**: Use `examples/check-cli.ts` to verify installation
- **Performance**: Works well with prompts of any length thanks to configurable timeouts