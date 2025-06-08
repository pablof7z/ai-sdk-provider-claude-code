# Claude Code AI SDK Provider Examples

This directory contains curated examples demonstrating key features of the Claude Code AI SDK Provider.

## File Structure

```
examples/
├── README.md                 # This documentation
├── basic-usage.ts            # Simple text generation
├── streaming.ts              # Streaming examples
├── conversation-history.ts   # Multi-turn conversations
├── custom-config.ts          # Configuration options
├── timeout-config.ts         # Timeout configuration examples
├── test-session.ts           # Session management
├── integration-test-basic.ts # Comprehensive tests
└── check-cli.ts              # CLI verification utility
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
Demonstrates real-time streaming of Claude's responses.
```bash
npx tsx examples/streaming.ts
```
**Why included**: Shows both simulated and PTY-based streaming options.

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

### 6. Session Management (`test-session.ts`)
Demonstrates experimental session-based conversation continuity.
```bash
npx tsx examples/test-session.ts
```
**Why included**: Shows alternative conversation approach using Claude's session IDs.

## Testing & Verification

### Integration Test (`integration-test-basic.ts`)
Comprehensive test suite that verifies all major features work correctly.
```bash
npx tsx examples/integration-test-basic.ts
```
**Why included**: Helps verify your setup and serves as a reference for all features.

### CLI Verification (`check-cli.ts`)
Utility to check if Claude CLI is properly installed and authenticated.
```bash
npx tsx examples/check-cli.ts
```
**Why included**: Essential troubleshooting tool for setup issues.

## Implementation Notes

During development, we discovered several important constraints:
- **Streaming**: Claude CLI requires `--verbose` flag when using `--output-format stream-json`
- **PTY Mode**: Real streaming requires `node-pty` and may not work in all environments
- **Sessions**: Each CLI call returns a new session ID, but context is maintained with `--resume`

For more technical details, see the main [README](../README.md) and [STATUS](../STATUS.md) documentation.