# AI SDK Provider for Claude Code (Alpha)

> **Warning**: This package is experimental and subject to change.

**ai-sdk-provider-claude-code** lets you use Claude via the [Vercel AI SDK](https://sdk.vercel.ai/docs) through the official `@anthropic-ai/claude-code` CLI.

## Installation

### 1. Install and authenticate the CLI
```bash
npm install -g @anthropic-ai/claude-code
claude login
```

### 2. Add the provider
```bash
npm install git+https://github.com/ben-vargas/ai-sdk-provider-claude-code.git
npm install ai
```

## Quick Start

```typescript
import { generateText } from 'ai';
import { claudeCode } from 'ai-sdk-provider-claude-code';

const { text } = await generateText({
  model: claudeCode('sonnet'),
  prompt: 'Hello, Claude!'
});

console.log(text);
```

## Models

- **`opus`** - Claude 4 Opus (most capable)
- **`sonnet`** - Claude 4 Sonnet (balanced performance)

## Documentation

- **[Usage Guide](docs/GUIDE.md)** - Comprehensive examples and configuration
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Examples](examples/)** - Sample scripts and patterns

## Core Features

- 🚀 Full Vercel AI SDK compatibility
- 🔄 Streaming support
- 💬 Multi-turn conversations
- 🎯 Object generation with JSON schemas
- 🛑 AbortSignal support
- 🔧 Tool management (MCP servers, permissions)

## Limitations

- Requires Node.js ≥ 18
- No image support
- Some AI SDK parameters unsupported (temperature, maxTokens, etc.)

## Contributing

We welcome contributions, especially:
- Code structure improvements
- Performance optimizations
- Better error handling
- Additional examples

See [Contributing Guidelines](docs/GUIDE.md#contributing) for details.

For development status and technical details, see [Development Status](docs/DEVELOPMENT-STATUS.md).

## License

MIT