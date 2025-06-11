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
- 🔀 Automatic streaming for large responses (prevents 8K truncation)

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
const { text, providerMetadata } = await generateText({
  model: claudeCode('sonnet'),
  messages: [{ role: 'user', content: 'My name is Bob.' }],
});

// Resume with session ID
const sessionId = providerMetadata?.['claude-code']?.sessionId;

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
| `largeResponseThreshold` | `number` | `1000` | Prompt length threshold for auto-streaming (characters) |
| `allowedTools` | `string[]` | `[]` | Tools to explicitly allow (cannot be used with disallowedTools) |
| `disallowedTools` | `string[]` | `[]` | Tools to restrict Claude from using (cannot be used with allowedTools) |

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

### Tool Restrictions

You can control which tools Claude Code can use with either `allowedTools` (allowlist) or `disallowedTools` (denylist):

#### Using allowedTools (Allowlist)
```typescript
import { createClaudeCode } from 'ai-sdk-provider-claude-code';

// Only allow specific tools
const readOnlyClaude = createClaudeCode({
  allowedTools: ['read_file', 'list_files', 'search_files'],
});

// Model-specific override
const { text } = await generateText({
  model: readOnlyClaude('opus', {
    allowedTools: ['read_file'], // Even more restrictive
  }),
  prompt: 'Review this code and identify issues...',
});
```

#### Using disallowedTools (Denylist)
```typescript
// Block specific tools
const restrictedClaude = createClaudeCode({
  disallowedTools: ['read_website', 'run_terminal_command'],
});

// Model-specific override
const { text } = await generateText({
  model: restrictedClaude('opus', {
    disallowedTools: ['create_file', 'edit_file'], // Override provider settings
  }),
  prompt: 'Analyze this code without modifying any files...',
});
```

**Note**: You cannot use both `allowedTools` and `disallowedTools` together - choose one approach based on your needs.

Common tools to manage:
- `read_website` - Web access
- `run_terminal_command` - Command execution
- `create_file` / `edit_file` / `delete_file` - File operations
- `install_packages` - Package management
- `read_file` / `list_files` / `search_files` - File reading operations

## Auto-Streaming for Large Responses

The provider automatically switches to streaming mode internally when responses might exceed Node.js's 8K stdout buffer limit. This prevents truncation errors for large JSON objects or lengthy responses.

### How It Works

The provider detects when to use streaming based on:
- **Prompt length**: Prompts longer than the threshold (default: 1000 chars)
- **Object generation**: Always uses streaming for `generateObject`/`streamObject`
- **Token limits**: When `maxTokens` > 2000

This is completely transparent - you use the same API whether the provider uses streaming internally or not:

```typescript
// Automatically uses streaming internally for large responses
const { object } = await generateObject({
  model: claudeCode('opus'),
  schema: complexSchema,
  prompt: 'Generate a detailed project plan with 20 tasks...',
});

// Also triggers auto-streaming due to high token limit
const { text } = await generateText({
  model: claudeCode('opus'),
  prompt: 'Write a short story',
  maxTokens: 5000,
});
```

### Configuration

You can adjust the threshold for auto-streaming:

```typescript
const claude = createClaudeCode({
  largeResponseThreshold: 500, // Switch to streaming for prompts > 500 chars
});
```

Set to 0 to always use streaming, or a very high number to disable auto-streaming.

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
const { text, usage, providerMetadata } = await generateText({
  model: claudeCode('sonnet'),
  prompt: 'Hello!',
});

console.log(providerMetadata);
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

// Note: streamObject waits for complete response before parsing
// Use generateObject for clarity since streaming doesn't provide benefits
const { object: analysis } = await generateObject({
  model: claudeCode('sonnet'),
  schema: z.object({
    analysis: z.string(),
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    score: z.number(),
  }),
  prompt: 'Analyze this review: "Great product!"',
});

console.log(analysis);
```

**How it works**: The provider appends JSON generation instructions to your prompt and extracts valid JSON from Claude's response. While not as robust as native JSON mode, it works well for most use cases.

**Important limitations**:
- **No real-time streaming for objects**: Since we rely on prompt engineering rather than native JSON support, `streamObject` must wait for the complete response before parsing the JSON. This means `streamObject` and `generateObject` behave identically for object generation - both wait for the full response.
- **Object-tool mode not supported**: Only `object-json` mode (via `generateObject`/`streamObject`) is available.
- **Regular text streaming works**: Only standard text generation truly benefits from streaming. Object generation always requires the complete response.

## Object Generation Cookbook

### Quick Start Examples

#### Basic Objects
Start with simple schemas and clear prompts:
```typescript
const { object } = await generateObject({
  model: claudeCode('sonnet'),
  schema: z.object({
    name: z.string(),
    age: z.number(),
    email: z.string().email(),
  }),
  prompt: 'Generate a developer profile',
});
```
[Full example](examples/generate-object-basic.ts)

#### Nested Structures
Build complex hierarchical data:
```typescript
const { object } = await generateObject({
  model: claudeCode('sonnet'),
  schema: z.object({
    company: z.object({
      departments: z.array(z.object({
        name: z.string(),
        teams: z.array(z.object({
          name: z.string(),
          members: z.number(),
        })),
      })),
    }),
  }),
  prompt: 'Generate a company org structure',
});
```
[Full example](examples/generate-object-nested.ts)

#### Constrained Generation
Use Zod's validation features:
```typescript
const { object } = await generateObject({
  model: claudeCode('sonnet'),
  schema: z.object({
    status: z.enum(['pending', 'active', 'completed']),
    priority: z.number().min(1).max(5),
    tags: z.array(z.string()).min(1).max(3),
  }),
  prompt: 'Generate a task with medium priority',
});
```
[Full example](examples/generate-object-constraints.ts)


### Best Practices

1. **Start Simple**: Begin with basic schemas and add complexity gradually
2. **Clear Prompts**: Be specific about what you want generated
3. **Use Descriptions**: Add `.describe()` to schema fields for better results
4. **Handle Errors**: Implement retry logic for production use
5. **Test Schemas**: Validate your schemas work before deployment

### Common Patterns

- **Data Models**: [User profiles, products, orders](examples/generate-object-nested.ts)
- **Validation**: [Enums, constraints, regex patterns](examples/generate-object-constraints.ts)
- **Basic Objects**: [Simple schemas and arrays](examples/generate-object-basic.ts)
- **Note**: For object generation, use `generateObject` instead of `streamObject` as streaming provides no benefits

## Object Generation Troubleshooting

### Common Issues and Solutions

#### 1. Invalid JSON Response
**Problem**: Claude returns text instead of valid JSON

**Solutions**:
- Simplify your schema - start with fewer fields
- Make your prompt more explicit: "Generate only valid JSON"
- Check the schema for overly complex constraints
- Use the retry pattern:

```typescript
async function generateWithRetry(schema, prompt, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await generateObject({ model, schema, prompt });
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
}
```

#### 2. Missing Required Fields
**Problem**: Generated objects missing required properties

**Solutions**:
- Emphasize requirements in your prompt
- Use descriptive field names
- Add field descriptions with `.describe()`
- Example:
```typescript
z.object({
  // Bad: vague field name
  val: z.number(),
  
  // Good: clear field name with description
  totalPrice: z.number().describe('Total price in USD'),
})
```

#### 3. Type Mismatches
**Problem**: String when expecting number, wrong date format, etc.

**Solutions**:
- Be explicit in descriptions: "age as a number" not just "age"
- For dates, specify format: `.describe('Date in YYYY-MM-DD format')`
- Use regex patterns for strings: `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`

#### 4. Schema Too Complex
**Problem**: Very complex schemas fail or timeout

**Solutions**:
- Break into smaller parts and combine:
```typescript
// Instead of one huge schema, compose smaller ones
const userSchema = z.object({ /* user fields */ });
const settingsSchema = z.object({ /* settings */ });
const profileSchema = z.object({
  user: userSchema,
  settings: settingsSchema,
});
```
- Generate in steps and merge results
- Increase timeout for complex generations

#### 5. Inconsistent Results
**Problem**: Same prompt gives different structure each time

**Solutions**:
- Make schemas more constrained (use enums, min/max)
- Provide example in prompt
- Use consistent field naming conventions
- Consider using `opus` model for complex schemas

### Debugging Tips

1. **Enable Debug Logging**:
```typescript
const { object, usage, warnings } = await generateObject({
  model: claudeCode('sonnet'),
  schema: yourSchema,
  prompt: yourPrompt,
});
console.log('Tokens used:', usage);
console.log('Warnings:', warnings);
```

2. **Test Schema Separately**:
```typescript
// Validate your schema works
const testData = { /* your test object */ };
try {
  schema.parse(testData);
  console.log('Schema is valid');
} catch (e) {
  console.log('Schema errors:', e.errors);
}
```

3. **Progressive Enhancement**:
Start with minimal schema, test, then add fields one by one

4. **Check Examples**:
Review our examples for implementation patterns

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
│   ├── types.ts                       # TypeScript types with validation schemas
│   └── utils/                         # Utility functions
│       ├── parse.ts                   # Parsing and metadata helpers
│       └── usage.ts                   # Token usage calculation
├── examples/
│   ├── README.md                      # Examples documentation
│   ├── basic-usage.ts                 # Simple text generation with metadata
│   ├── streaming.ts                   # Streaming response demo
│   ├── custom-config.ts               # Provider configuration options
│   ├── timeout-config.ts              # Timeout configuration examples
│   ├── conversation-history.ts        # Multi-turn conversation with message history
│   ├── generate-object.ts             # Original object generation example
│   ├── generate-object-basic.ts       # Basic object generation patterns
│   ├── generate-object-nested.ts      # Complex nested structures
│   ├── generate-object-constraints.ts # Validation and constraints
│   ├── tool-management.ts             # Tool access control (allow/disallow)
│   ├── test-session.ts                # Session management testing
│   ├── abort-signal.ts                # Request cancellation examples
│   ├── limitations.ts                 # Provider limitations demo
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