# AI SDK Provider for Claude Code

**ai-sdk-provider-claude-code** is a community provider for the [Vercel AI SDK](https://sdk.vercel.ai/docs) that enables using Claude through the Claude Code CLI. This provider works with both:
- **Claude Pro/Max subscriptions**: Use your subscription for API-style integrations without separate API keys
- **API key authentication**: Standard pay-per-token usage with your Anthropic API key

## Features

- 🚀 Full compatibility with Vercel AI SDK
- 🔄 Streaming support for real-time responses
- 💬 Session management for multi-turn conversations
- 🔐 No API keys required (uses Claude Code OAuth)
- 📡 Real streaming via PTY (experimental)
- 🛡️ TypeScript support with full type safety
- 📊 JSON output format for structured responses
- 📈 Token usage statistics with detailed breakdowns
- 🏷️ Rich provider metadata (session IDs, timing, usage)

## Project Structure

```
ai-sdk-provider-claude-code/
├── src/
│   ├── index.ts                       # Main exports
│   ├── claude-code-provider.ts        # Provider factory
│   ├── claude-code-language-model.ts  # Language model implementation
│   ├── claude-code-cli.ts             # CLI interaction logic
│   ├── claude-code-parser.ts          # Response parsing
│   ├── types.ts                       # TypeScript types
│   └── errors.ts                      # Error handling
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

## Prerequisites

| Requirement                                         | Version      |
| --------------------------------------------------- | ------------ |
| Node.js                                             | ≥ 18         |
| Claude Code CLI (`@anthropic-ai/claude-code`)       | ≥ 2025‑05‑14 |
| Logged‑in Claude account (run `claude /login` once) |  —           |

1. **Claude Code CLI** installed:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

2. **Authenticated Claude Code CLI**:
   ```bash
   claude login
   ```
   
   > **Note**: This provider works with both subscription-based and API key authentication:
   > - **Pro/Max subscribers**: Usage is covered by your monthly subscription with no additional per-token charges
   > - **API key users**: You will be charged per token according to Anthropic's API pricing

## Installation

```bash
npm install ai ai-sdk-provider-claude-code
```

## Usage

### Basic Example

```typescript
import { generateText } from 'ai';
import { claudeCode } from 'ai-sdk-provider-claude-code';

const { text } = await generateText({
  model: claudeCode('opus'),
  prompt: 'Explain quantum computing in simple terms',
});

console.log(text);
```

### Streaming Example

```typescript
import { streamText } from 'ai';
import { claudeCode } from 'ai-sdk-provider-claude-code';

// Default: Simulated streaming (works everywhere)
const result = await streamText({
  model: claudeCode('sonnet'),
  prompt: 'Write a haiku about programming',
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

### Real Streaming with PTY (Experimental)

```typescript
import { streamText } from 'ai';
import { claudeCode } from 'ai-sdk-provider-claude-code';

// Enable PTY-based real streaming (requires node-pty)
const result = await streamText({
  model: claudeCode('sonnet', { enablePtyStreaming: true }),
  prompt: 'Count from 1 to 10',
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

### Multi-turn Conversations

```typescript
import { generateText } from 'ai';
import { claudeCode } from 'ai-sdk-provider-claude-code';

// Approach 1: Message History (Recommended)
const messages = [];

messages.push({ role: 'user', content: 'My name is Alice. Remember this.' });
const { text: response1 } = await generateText({
  model: claudeCode('sonnet'),
  messages,
});
messages.push({ role: 'assistant', content: response1 });

messages.push({ role: 'user', content: 'What is my name?' });
const { text: response2 } = await generateText({
  model: claudeCode('sonnet'),
  messages,
});

console.log(response2); // Will remember "Alice"

// Approach 2: Session IDs (Experimental)
const { text, experimental_providerMetadata } = await generateText({
  model: claudeCode('sonnet'),
  messages: [{ role: 'user', content: 'My name is Bob.' }],
  experimental_providerMetadata: true,
});

const sessionId = experimental_providerMetadata?.['claude-code']?.sessionId;

const { text: response } = await generateText({
  model: claudeCode('sonnet', { sessionId }),
  messages: [{ role: 'user', content: 'What is my name?' }],
});
```

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
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cliPath` | `string` | `'claude'` | Path to Claude CLI executable |
| `skipPermissions` | `boolean` | `true` | Whether to add `--dangerously-skip-permissions` flag |
| `sessionId` | `string` | `undefined` | Resume a previous conversation session |
| `enablePtyStreaming` | `boolean` | `false` | Enable real streaming via pseudo-terminal (requires node-pty) |
| `timeoutMs` | `number` | `120000` | Timeout for CLI operations in milliseconds (1-600 seconds) |
| `maxConcurrentProcesses` | `number` | `4` | Maximum number of concurrent CLI processes |

## Model Support

- `opus` - Claude 3 Opus (most capable)
- `sonnet` - Claude 3 Sonnet (balanced)

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

### Streaming Modes

1. **Default Mode**: Uses `execSync` with `--print --output-format json` for reliable one-shot responses
2. **PTY Mode**: Uses `--verbose --output-format stream-json` for real-time streaming (experimental)
   - Note: `--verbose` is required by Claude CLI when using `stream-json` format

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

## Limitations

- Requires Node.js environment with `child_process` support
- Limited to text generation (no image support)
- Requires local Claude Code CLI installation

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for solutions to common issues including:
- CLI hanging with spawn/execFile
- Streaming configuration
- Session management
- Platform-specific issues

## Contributing

Contributions are welcome! Please read our [contributing guidelines](CONTRIBUTING.md) before submitting a PR.

## License

MIT - see [LICENSE](LICENSE) for details.

## Acknowledgments

This provider is built for the [Vercel AI SDK](https://sdk.vercel.ai/) and uses the [Claude Code CLI](https://docs.anthropic.com/claude-code/cli) by Anthropic.

## Next Steps

1. **Testing**: Create comprehensive unit and integration tests
2. **Examples**: Build example applications showing real-world usage
3. **CI/CD**: Set up GitHub Actions for automated testing and releases
4. **Documentation**: Add JSDoc comments to all public APIs
5. **Performance**: Profile and optimize CLI spawning and streaming
6. **Community**: Submit PR to Vercel AI SDK to get listed as a community provider

This implementation provides a fully functional AI SDK provider for Claude Code that:
- Follows the Language Model Specification v1 exactly
- Handles streaming and non-streaming modes
- Manages sessions for conversations
- Provides proper error handling
- Includes TypeScript types throughout
- Manages concurrent CLI processes efficiently
- Converts between AI SDK message format and Claude Code CLI format