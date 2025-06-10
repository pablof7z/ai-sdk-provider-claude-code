# 🚧 ALPHA: AI SDK Provider for Claude Code

> **⚠️ Alpha Software**: This project is in active development and seeking feedback from early adopters. Much of the implementation is AI-generated and we welcome refactoring suggestions for improved structure and addressing any noticeable issues.

**ai-sdk-provider-claude-code** is a community provider for the [Vercel AI SDK](https://sdk.vercel.ai/docs) that enables using Claude through the Claude Code CLI. Works with both Claude Pro/Max subscriptions and API key authentication.

## 🚀 Alpha Quick Start

### Prerequisites
```bash
# 1. Install Claude Code CLI
npm install -g @anthropic-ai/claude-code

# 2. Authenticate with Claude
claude login
```

### Installation (Alpha Distribution)
```bash
# Install directly from GitHub
npm install git+https://github.com/ben-vargas/ai-sdk-provider-claude-code.git
npm install ai
```

### Try It Now
```typescript
import { generateText } from 'ai';
import { claudeCode } from 'ai-sdk-provider-claude-code';

// Basic text generation
const { text } = await generateText({
  model: claudeCode('sonnet'),
  prompt: 'Explain recursion in one sentence',
});

console.log(text);
```

### Test Your Setup
```bash
# Verify everything works
npm run build
npx tsx examples/check-cli.ts
npx tsx examples/basic-usage.ts
```

## 🧪 Alpha Testing & Feedback

**Found an issue?** [Open an issue](https://github.com/ben-vargas/ai-sdk-provider-claude-code/issues)  
**Have suggestions?** [Start a discussion](https://github.com/ben-vargas/ai-sdk-provider-claude-code/discussions)  
**Want to contribute?** We're especially interested in:
- Code structure improvements
- Performance optimizations
- Better error handling patterns
- Additional example use cases

---

## Core Features

- 🚀 Full compatibility with Vercel AI SDK
- 🔄 Streaming support for real-time responses  
- 💬 Session management for multi-turn conversations
- 🔐 No API keys required (uses Claude Code OAuth)
- 🛡️ TypeScript support with full type safety
- ⏱️ Configurable timeouts (1s-10min) optimized for Claude Opus 4
- 📈 Token usage statistics with detailed breakdowns
- 🏷️ Rich provider metadata (session IDs, timing, costs)
- ⚡ Zero-latency streaming with readline interface
- 🎯 Object generation support with JSON schema validation

## Model Support

- **`opus`** - Claude 3 Opus (most capable, use with longer timeouts for complex reasoning)
- **`sonnet`** - Claude 3 Sonnet (balanced speed and capability)

## Known Alpha Limitations

- Requires Node.js ≥ 18 and local Claude Code CLI installation
- Limited to text generation (no image support due to CLI limitation)  
- Some code structure improvements needed (AI-generated, welcoming refactoring!)

> **Cost Note**: For Pro/Max subscribers, usage is covered by subscription. API key users are charged per token.

## Installation Options

### Alpha (Current)
```bash
# Install from GitHub
npm install git+https://github.com/ben-vargas/ai-sdk-provider-claude-code.git
npm install ai
```

### Future npm Release
```bash
# Will be available when published
npm install ai ai-sdk-provider-claude-code
```

## Essential Examples

### Streaming Responses

```typescript
import { streamText } from 'ai';
import { claudeCode } from 'ai-sdk-provider-claude-code';

const result = await streamText({
  model: claudeCode('sonnet'),
  prompt: 'Write a haiku about programming',
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

### Multi-turn Conversations

```typescript
import { generateText } from 'ai';
import { claudeCode } from 'ai-sdk-provider-claude-code';

const messages = [];

// First turn
messages.push({ role: 'user', content: 'My name is Alice' });
const { text: response1 } = await generateText({
  model: claudeCode('sonnet'),
  messages,
});
messages.push({ role: 'assistant', content: response1 });

// Second turn - remembers context
messages.push({ role: 'user', content: 'What is my name?' });
const { text: response2 } = await generateText({
  model: claudeCode('sonnet'),
  messages,
});
console.log(response2); // "Alice"
```

### Object Generation with JSON Schema

```typescript
import { generateObject } from 'ai';
import { claudeCode } from 'ai-sdk-provider-claude-code';
import { z } from 'zod';

const { object } = await generateObject({
  model: claudeCode('sonnet'),
  schema: z.object({
    name: z.string().describe('Full name'),
    age: z.number().describe('Age in years'),
    email: z.string().email().describe('Email address'),
    interests: z.array(z.string()).describe('List of hobbies'),
  }),
  prompt: 'Generate a profile for a software developer',
});

console.log(object);
// {
//   name: "Alex Chen",
//   age: 28,
//   email: "alex.chen@example.com",
//   interests: ["coding", "open source", "machine learning"]
// }
```

### Timeout Configuration

```typescript
import { createClaudeCode } from 'ai-sdk-provider-claude-code';

// Default: 2-minute timeout
const claude = createClaudeCode();

// For complex Opus 4 tasks: longer timeout
const claudeLong = createClaudeCode({
  timeoutMs: 600000, // 10 minutes
});

const { text } = await generateText({
  model: claudeLong('opus'),
  prompt: 'Analyze this complex problem in detail...',
});
```


### Session Management (Experimental)

```typescript
import { generateText } from 'ai';
import { claudeCode } from 'ai-sdk-provider-claude-code';

// First message
const { text, experimental_providerMetadata } = await generateText({
  model: claudeCode('sonnet'),
  messages: [{ role: 'user', content: 'My name is Bob.' }],
  experimental_providerMetadata: true,
});

// Resume with session ID
const sessionId = experimental_providerMetadata?.['claude-code']?.sessionId;

const { text: response } = await generateText({
  model: claudeCode('sonnet', { sessionId }),
  messages: [{ role: 'user', content: 'What is my name?' }],
});
```

---

## Detailed Configuration

### Timeout Configuration

The provider includes configurable timeouts to handle Claude Opus 4's extended thinking capabilities:

```typescript
import { createClaudeCode } from 'ai-sdk-provider-claude-code';

// Default: 2-minute timeout for most use cases
const claude = createClaudeCode();

// Custom timeout at provider level
const claude5min = createClaudeCode({
  timeoutMs: 300000, // 5 minutes for complex tasks
});

// Per-model timeout override
const { text } = await generateText({
  model: claude5min('opus', { timeoutMs: 600000 }), // Override to 10 minutes
  prompt: 'Analyze this complex dataset...',
});
```

**Timeout Guidelines:**
- **Default (2 minutes)**: Good for most queries including Opus 4's quick responses
- **5-10 minutes**: Recommended for complex reasoning tasks with Opus 4's extended thinking
- **Maximum (10 minutes)**: Matches Anthropic's API timeout limit
- **Minimum (1 second)**: For testing or very fast responses

**Important**: For tasks expected to take longer than 10 minutes, consider breaking them into smaller chunks or using streaming approaches.

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cliPath` | `string` | `'claude'` | Path to Claude CLI executable |
| `skipPermissions` | `boolean` | `true` | Whether to add `--dangerously-skip-permissions` flag |
| `sessionId` | `string` | `undefined` | Resume a previous conversation session |
| `timeoutMs` | `number` | `120000` | Timeout for CLI operations in milliseconds (1-600 seconds) |
| `maxConcurrentProcesses` | `number` | `4` | Maximum number of concurrent CLI processes |

### Custom Configuration

```typescript
import { createClaudeCode } from 'ai-sdk-provider-claude-code';

const claude = createClaudeCode({
  cliPath: '/usr/local/bin/claude',
  skipPermissions: false,
  maxConcurrentProcesses: 2,
  timeoutMs: 180000, // 3 minutes
});

const { text } = await generateText({
  model: claude('opus'),
  prompt: 'Hello, Claude!',
});
```

## Implementation Details

### JSON Output Format

The provider uses Claude CLI's `--output-format json` flag for reliable parsing of responses. This provides structured output with:

- **Result text**: The actual response from Claude
- **Session ID**: For conversation continuity
- **Error handling**: Structured error information
- **Metadata**: Usage statistics and timing information

Example JSON response:
```json
{
  "type": "result",
  "subtype": "success",
  "result": "Hello! How can I help you today?",
  "session_id": "abc-123-def",
  "is_error": false,
  "duration_ms": 1500,
  "usage": {
    "input_tokens": 10,
    "output_tokens": 20
  }
}
```

### Streaming Implementation

The provider uses a unified spawn-based architecture with readline interface for zero-latency streaming:
- **Non-streaming**: Uses `spawn` with `--print --output-format json` for reliable responses
- **Streaming**: Uses `spawn` with `--verbose --output-format stream-json` for real-time streaming
  - Note: `--verbose` is required by Claude CLI when using `stream-json` format
  - Readline interface eliminates polling delays for immediate response

### Provider Metadata

The provider returns rich metadata including token usage, timing, and cost information:

```typescript
const { text, usage, experimental_providerMetadata } = await generateText({
  model: claudeCode('sonnet'),
  prompt: 'Hello!',
  experimental_providerMetadata: true,
});

console.log(experimental_providerMetadata);
// {
//   "claude-code": {
//     "sessionId": "abc-123-def",
//     "costUsd": 0.0285561,      // Note: Always non-zero for tracking
//     "durationMs": 3056,
//     "rawUsage": {
//       "inputTokens": 4,
//       "outputTokens": 7,
//       "cacheCreationInputTokens": 5924,
//       "cacheReadInputTokens": 10075
//     }
//   }
// }
```

**Important Note about Costs**: The `costUsd` field shows the cost of the API usage:
- **For Pro/Max subscribers**: This is informational only - usage is covered by your monthly subscription
- **For API key users**: This represents actual charges that will be billed to your account

## Object Generation

The provider supports object generation through prompt engineering, allowing you to generate structured data with JSON schema validation:

```typescript
import { generateObject, streamObject } from 'ai';
import { claudeCode } from 'ai-sdk-provider-claude-code';
import { z } from 'zod';

// Generate a complete object
const { object } = await generateObject({
  model: claudeCode('sonnet'),
  schema: z.object({
    recipe: z.object({
      name: z.string(),
      ingredients: z.array(z.string()),
      instructions: z.array(z.string()),
      prepTime: z.number(),
      servings: z.number(),
    }),
  }),
  prompt: 'Generate a recipe for chocolate chip cookies',
});

// Stream partial objects
const { partialObjectStream } = await streamObject({
  model: claudeCode('sonnet'),
  schema: z.object({
    analysis: z.string(),
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    score: z.number(),
  }),
  prompt: 'Analyze this review: "Great product!"',
});

for await (const partial of partialObjectStream) {
  console.log(partial); // Partial objects as they stream
}
```

**How it works**: The provider appends JSON generation instructions to your prompt and extracts valid JSON from Claude's response. While not as robust as native JSON mode, it works well for most use cases.

**Note**: The `object-tool` mode is not supported. Only `object-json` mode (via `generateObject`/`streamObject`) is available.

## Limitations

- **No image support**: The Claude Code CLI doesn't support image inputs
- **Object-tool mode not supported**: Only `object-json` mode works via `generateObject`/`streamObject`
- **Text-only responses**: No support for file generation or other modalities
- **Session management**: While sessions are supported, message history is the recommended approach

## Error Handling

```typescript
import { generateText } from 'ai';
import { claudeCode, isAuthenticationError } from 'ai-sdk-provider-claude-code';

try {
  const { text } = await generateText({
    model: claudeCode('opus'),
    prompt: 'Hello!',
  });
} catch (error) {
  if (isAuthenticationError(error)) {
    console.error('Please run "claude login" to authenticate');
  } else {
    console.error('Error:', error);
  }
}
```

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for solutions to common issues including:
- CLI hanging with spawn/execFile
- Streaming configuration
- Session management
- Platform-specific issues
- Timeout configuration for Claude Opus 4

## Project Structure

```
ai-sdk-provider-claude-code/
├── src/
│   ├── index.ts                       # Main exports
│   ├── claude-code-provider.ts        # Provider factory with timeout config
│   ├── claude-code-language-model.ts  # AI SDK implementation with full metadata
│   ├── claude-code-cli.ts             # Unified spawn-based CLI wrapper with readline streaming
│   ├── claude-code-parser.ts          # JSON event parser for streaming
│   ├── errors.ts                      # Comprehensive error handling
│   └── types.ts                       # TypeScript types with validation schemas
├── examples/
│   ├── basic-usage.ts                 # Simple text generation with metadata
│   ├── streaming.ts                   # Streaming response demo
│   ├── custom-config.ts               # Provider configuration options
│   ├── timeout-config.ts              # Timeout configuration examples
│   ├── conversation-history.ts        # Multi-turn conversation with message history
│   ├── generate-object.ts             # Object generation with JSON schemas
│   ├── test-session.ts                # Session management testing
│   ├── integration-test.ts            # Comprehensive integration tests
│   └── check-cli.ts                   # CLI installation verification
├── package.json
├── tsconfig.json
└── LICENSE
```

## Contributing

Contributions are welcome! Please read our [contributing guidelines](CONTRIBUTING.md) before submitting a PR.

**Alpha Focus Areas:**
- Code structure improvements (AI-generated code cleanup)
- Performance optimizations
- Better error handling patterns
- TypeScript type improvements
- Additional example use cases

## License

MIT - see [LICENSE](LICENSE) for details.

## Acknowledgments

This provider is built for the [Vercel AI SDK](https://sdk.vercel.ai/) and uses the [Claude Code CLI](https://docs.anthropic.com/claude-code/cli) by Anthropic.