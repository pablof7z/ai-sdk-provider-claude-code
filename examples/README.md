# Claude Code AI SDK Provider Examples

This directory contains curated examples demonstrating key features of the Claude Code AI SDK Provider.

## File Structure

```
examples/
├── README.md                      # This documentation
├── basic-usage.ts                 # Simple text generation
├── streaming.ts                   # Streaming examples
├── conversation-history.ts        # Multi-turn conversations
├── custom-config.ts               # Configuration options
├── timeout-config.ts              # Timeout configuration examples
├── tool-management.ts             # Tool access control (allow/disallow)
├── test-session.ts                # Session management
├── abort-signal.ts                # Request cancellation with AbortController
├── limitations.ts                 # Provider limitations and unsupported features
├── generate-object.ts             # Object generation overview
├── generate-object-basic.ts       # Basic object patterns
├── generate-object-nested.ts      # Complex nested structures
├── generate-object-constraints.ts # Validation constraints
├── integration-test.ts            # Comprehensive tests
└── check-cli.ts                   # CLI verification utility
```

## Prerequisites

1. Install and authenticate Claude Code CLI:
```bash
npm install -g @anthropic-ai/claude-code
claude login
```

2. Build the provider:
```bash
npm run build
```

## Core Examples

### 1. Basic Usage (`basic-usage.ts`)
The simplest example showing how to generate text with Claude.
```bash
npx tsx examples/basic-usage.ts
```
**Why included**: Essential starting point for new users.

### 2. Streaming Responses (`streaming.ts`)
Demonstrates real-time streaming of Claude's responses using the unified spawn architecture.
```bash
npx tsx examples/streaming.ts
```
**Why included**: Shows zero-latency streaming with readline interface.

### 3. Multi-turn Conversations (`conversation-history.ts`)
Shows how to maintain context across multiple messages using the message history approach.
```bash
npx tsx examples/conversation-history.ts
```
**Why included**: Demonstrates the recommended pattern for conversational AI.

### 4. Custom Configuration (`custom-config.ts`)
Demonstrates provider configuration options including model selection and CLI path.
```bash
npx tsx examples/custom-config.ts
```
**Why included**: Shows how to customize the provider for different environments.

### 5. Timeout Configuration (`timeout-config.ts`)
Demonstrates configurable timeout settings for handling Claude Opus 4's extended thinking.
```bash
npx tsx examples/timeout-config.ts
```
**Why included**: Shows how to configure timeouts for different use cases and Claude models.

### 6. Tool Management (`tool-management.ts`)
Demonstrates how to control which tools Claude Code can use with both allowlist and denylist approaches.
```bash
npx tsx examples/tool-management.ts
```
**Why included**: Shows fine-grained control over Claude's tool access for security and compliance.

### 7. Session Management (`test-session.ts`)
Demonstrates experimental session-based conversation continuity.
```bash
npx tsx examples/test-session.ts
```
**Why included**: Shows alternative conversation approach using Claude's session IDs.

### 8. Request Cancellation (`abort-signal.ts`)
Shows how to cancel in-progress requests using AbortController and AbortSignal.
```bash
npx tsx examples/abort-signal.ts
```
**Why included**: Essential for implementing timeouts, user cancellations, and cleanup.

### 9. Provider Limitations (`limitations.ts`)
Explicitly demonstrates which AI SDK features are NOT supported by Claude Code CLI.
```bash
npx tsx examples/limitations.ts
```
**Why included**: Helps users understand what parameters are ignored and why.

## Object Generation Examples

### 10. Object Generation Overview (`generate-object.ts`)
Introduction to object generation with JSON schema validation.
```bash
npx tsx examples/generate-object.ts
```
**Why included**: Shows the basics of structured data generation.

### 11. Basic Object Patterns (`generate-object-basic.ts`)
Simple schemas with primitives, arrays, and optional fields.
```bash
npx tsx examples/generate-object-basic.ts
```
**Why included**: Essential patterns for getting started with object generation.

### 12. Nested Structures (`generate-object-nested.ts`)
Complex hierarchical data like organizations, orders, and configurations.
```bash
npx tsx examples/generate-object-nested.ts
```
**Why included**: Demonstrates real-world data modeling.

### 13. Validation Constraints (`generate-object-constraints.ts`)
Using Zod's validation features for enums, ranges, and patterns.
```bash
npx tsx examples/generate-object-constraints.ts
```
**Why included**: Shows how to enforce data quality with constraints.

## Testing & Verification

### Integration Test (`integration-test.ts`)
Comprehensive test suite that verifies all major features work correctly.
```bash
npx tsx examples/integration-test.ts
```
**Why included**: Helps verify your setup and serves as a reference for all features.

### CLI Verification (`check-cli.ts`)
Utility to check if Claude CLI is properly installed and authenticated.
```bash
npx tsx examples/check-cli.ts
```
**Why included**: Essential troubleshooting tool for setup issues.

## Error Handling

All examples include basic error handling. Common error scenarios you might encounter:

1. **Authentication errors**: Run `claude login` if you see authentication failures
2. **CLI not found**: Install with `npm install -g @anthropic-ai/claude-code`
3. **Timeout errors**: Increase timeout in provider settings (see `timeout-config.ts`)
4. **Invalid models**: Use only "opus" or "sonnet"

For error handling, you can use the `isAuthenticationError` helper:
```typescript
import { isAuthenticationError } from '../dist/index.js';

try {
  // Your code here
} catch (error) {
  if (isAuthenticationError(error)) {
    console.error('Please run: claude login');
  }
}
```

## Implementation Notes

During development, we discovered several important constraints and solutions:
- **Streaming**: Claude CLI requires `--verbose` flag when using `--output-format stream-json`
- **Spawn Architecture**: Fixed hanging issues by using stdin communication instead of command arguments
- **Zero-Latency**: Readline interface eliminates polling delays for immediate streaming response
- **Sessions**: Each CLI call returns a new session ID, but context is maintained with `--resume`

For more technical details, see the main [README](../README.md) and [STATUS](../STATUS.md) documentation.