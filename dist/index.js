// src/claude-code-provider.ts
import { NoSuchModelError as NoSuchModelError2 } from "@ai-sdk/provider";

// src/claude-code-language-model.ts
import { NoSuchModelError } from "@ai-sdk/provider";
import { generateId } from "@ai-sdk/provider-utils";

// src/convert-to-claude-code-messages.ts
var IMAGE_URL_WARNING = "Image URLs are not supported by this provider; supply base64/data URLs.";
var IMAGE_CONVERSION_WARNING = "Unable to convert image content; supply base64/data URLs.";
function normalizeBase64(base64) {
  return base64.replace(/\s+/g, "");
}
function isImageMimeType(mimeType) {
  return typeof mimeType === "string" && mimeType.trim().toLowerCase().startsWith("image/");
}
function createImageContent(mediaType, data) {
  const trimmedType = mediaType.trim();
  const trimmedData = normalizeBase64(data.trim());
  if (!trimmedType || !trimmedData) {
    return void 0;
  }
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: trimmedType,
      data: trimmedData
    }
  };
}
function extractMimeType(candidate) {
  if (typeof candidate === "string" && candidate.trim()) {
    return candidate.trim();
  }
  return void 0;
}
function parseObjectImage(imageObj, fallbackMimeType) {
  const data = typeof imageObj.data === "string" ? imageObj.data : void 0;
  const mimeType = extractMimeType(
    imageObj.mimeType ?? imageObj.mediaType ?? imageObj.media_type ?? fallbackMimeType
  );
  if (!data || !mimeType) {
    return void 0;
  }
  return createImageContent(mimeType, data);
}
function parseStringImage(value, fallbackMimeType) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return { warning: IMAGE_URL_WARNING };
  }
  const dataUrlMatch = trimmed.match(/^data:([^;]+);base64,(.+)$/i);
  if (dataUrlMatch) {
    const [, mediaType, data] = dataUrlMatch;
    const content = createImageContent(mediaType, data);
    return content ? { content } : { warning: IMAGE_CONVERSION_WARNING };
  }
  const base64Match = trimmed.match(/^base64:([^,]+),(.+)$/i);
  if (base64Match) {
    const [, explicitMimeType, data] = base64Match;
    const content = createImageContent(explicitMimeType, data);
    return content ? { content } : { warning: IMAGE_CONVERSION_WARNING };
  }
  if (fallbackMimeType) {
    const content = createImageContent(fallbackMimeType, trimmed);
    if (content) {
      return { content };
    }
  }
  return { warning: IMAGE_CONVERSION_WARNING };
}
function parseImagePart(part) {
  if (!part || typeof part !== "object") {
    return { warning: IMAGE_CONVERSION_WARNING };
  }
  const imageValue = part.image;
  const mimeType = extractMimeType(part.mimeType);
  if (typeof imageValue === "string") {
    return parseStringImage(imageValue, mimeType);
  }
  if (imageValue && typeof imageValue === "object") {
    const content = parseObjectImage(imageValue, mimeType);
    return content ? { content } : { warning: IMAGE_CONVERSION_WARNING };
  }
  return { warning: IMAGE_CONVERSION_WARNING };
}
function convertBinaryToBase64(data) {
  if (typeof Buffer !== "undefined") {
    const buffer = data instanceof Uint8Array ? Buffer.from(data) : Buffer.from(new Uint8Array(data));
    return buffer.toString("base64");
  }
  if (typeof btoa === "function") {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    let binary = "";
    const chunkSize = 32768;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }
  return void 0;
}
function parseFilePart(part) {
  const mimeType = extractMimeType(part.mediaType ?? part.mimeType);
  if (!mimeType || !isImageMimeType(mimeType)) {
    return {};
  }
  const data = part.data;
  if (typeof data === "string") {
    const content = createImageContent(mimeType, data);
    return content ? { content } : { warning: IMAGE_CONVERSION_WARNING };
  }
  if (data instanceof Uint8Array || typeof ArrayBuffer !== "undefined" && data instanceof ArrayBuffer) {
    const base64 = convertBinaryToBase64(data);
    if (!base64) {
      return { warning: IMAGE_CONVERSION_WARNING };
    }
    const content = createImageContent(mimeType, base64);
    return content ? { content } : { warning: IMAGE_CONVERSION_WARNING };
  }
  return { warning: IMAGE_CONVERSION_WARNING };
}
function convertToClaudeCodeMessages(prompt, mode = { type: "regular" }, jsonSchema2) {
  const messages = [];
  const warnings = [];
  let systemPrompt;
  const streamingSegments = [];
  const imageMap = /* @__PURE__ */ new Map();
  let hasImageParts = false;
  const addSegment = (formatted) => {
    streamingSegments.push({ formatted });
    return streamingSegments.length - 1;
  };
  const addImageForSegment = (segmentIndex, content) => {
    hasImageParts = true;
    if (!imageMap.has(segmentIndex)) {
      imageMap.set(segmentIndex, []);
    }
    imageMap.get(segmentIndex)?.push(content);
  };
  for (const message of prompt) {
    switch (message.role) {
      case "system":
        systemPrompt = message.content;
        if (typeof message.content === "string" && message.content.trim().length > 0) {
          addSegment(message.content);
        } else {
          addSegment("");
        }
        break;
      case "user":
        if (typeof message.content === "string") {
          messages.push(message.content);
          addSegment(`Human: ${message.content}`);
        } else {
          const textParts = message.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
          const segmentIndex = addSegment(textParts ? `Human: ${textParts}` : "");
          if (textParts) {
            messages.push(textParts);
          }
          for (const part of message.content) {
            if (part.type === "image") {
              const { content, warning } = parseImagePart(part);
              if (content) {
                addImageForSegment(segmentIndex, content);
              } else if (warning) {
                warnings.push(warning);
              }
            } else if (part.type === "file") {
              const { content, warning } = parseFilePart(part);
              if (content) {
                addImageForSegment(segmentIndex, content);
              } else if (warning) {
                warnings.push(warning);
              }
            }
          }
        }
        break;
      case "assistant": {
        let assistantContent = "";
        if (typeof message.content === "string") {
          assistantContent = message.content;
        } else {
          const textParts = message.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
          if (textParts) {
            assistantContent = textParts;
          }
          const toolCalls = message.content.filter((part) => part.type === "tool-call");
          if (toolCalls.length > 0) {
            assistantContent += `
[Tool calls made]`;
          }
        }
        const formattedAssistant = `Assistant: ${assistantContent}`;
        messages.push(formattedAssistant);
        addSegment(formattedAssistant);
        break;
      }
      case "tool":
        for (const tool3 of message.content) {
          const resultText = tool3.output.type === "text" ? tool3.output.value : JSON.stringify(tool3.output.value);
          const formattedToolResult = `Tool Result (${tool3.toolName}): ${resultText}`;
          messages.push(formattedToolResult);
          addSegment(formattedToolResult);
        }
        break;
    }
  }
  let finalPrompt = "";
  if (systemPrompt) {
    finalPrompt = systemPrompt;
  }
  if (messages.length > 0) {
    const formattedMessages = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.startsWith("Assistant:") || msg.startsWith("Tool Result")) {
        formattedMessages.push(msg);
      } else {
        formattedMessages.push(`Human: ${msg}`);
      }
    }
    if (finalPrompt) {
      const joinedMessages = formattedMessages.join("\n\n");
      finalPrompt = joinedMessages ? `${finalPrompt}

${joinedMessages}` : finalPrompt;
    } else {
      finalPrompt = formattedMessages.join("\n\n");
    }
  }
  let streamingParts = [];
  const imagePartsInOrder = [];
  const appendImagesForIndex = (index) => {
    const images = imageMap.get(index);
    if (!images) {
      return;
    }
    images.forEach((image) => {
      streamingParts.push(image);
      imagePartsInOrder.push(image);
    });
  };
  if (streamingSegments.length > 0) {
    let accumulatedText = "";
    let emittedText = false;
    const flushText = () => {
      if (!accumulatedText) {
        return;
      }
      streamingParts.push({ type: "text", text: accumulatedText });
      accumulatedText = "";
      emittedText = true;
    };
    streamingSegments.forEach((segment, index) => {
      const segmentText = segment.formatted;
      if (segmentText) {
        if (!accumulatedText) {
          accumulatedText = emittedText ? `

${segmentText}` : segmentText;
        } else {
          accumulatedText += `

${segmentText}`;
        }
      }
      if (imageMap.has(index)) {
        flushText();
        appendImagesForIndex(index);
      }
    });
    flushText();
  }
  if (mode?.type === "object-json" && jsonSchema2) {
    const schemaStr = JSON.stringify(jsonSchema2, null, 2);
    finalPrompt = `CRITICAL: You MUST respond with ONLY a JSON object. NO other text, NO explanations, NO questions.

Your response MUST start with { and end with }

The JSON MUST match this EXACT schema:
${schemaStr}

Now, based on the following conversation, generate ONLY the JSON object with the exact fields specified above:

${finalPrompt}

Remember: Your ENTIRE response must be ONLY the JSON object, starting with { and ending with }`;
    streamingParts = [{ type: "text", text: finalPrompt }, ...imagePartsInOrder];
  }
  return {
    messagesPrompt: finalPrompt,
    systemPrompt,
    ...warnings.length > 0 && { warnings },
    streamingContentParts: streamingParts.length > 0 ? streamingParts : [
      { type: "text", text: finalPrompt },
      ...imagePartsInOrder
    ],
    hasImageParts
  };
}

// src/extract-json.ts
import { parse } from "jsonc-parser";
function extractJson(text) {
  let content = text.trim();
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(content);
  if (fenceMatch) {
    content = fenceMatch[1];
  }
  const varMatch = /^\s*(?:const|let|var)\s+\w+\s*=\s*([\s\S]*)/i.exec(content);
  if (varMatch) {
    content = varMatch[1];
    if (content.trim().endsWith(";")) {
      content = content.trim().slice(0, -1);
    }
  }
  const firstObj = content.indexOf("{");
  const firstArr = content.indexOf("[");
  if (firstObj === -1 && firstArr === -1) {
    return text;
  }
  const start = firstArr === -1 ? firstObj : firstObj === -1 ? firstArr : Math.min(firstObj, firstArr);
  content = content.slice(start);
  const tryParse = (value) => {
    const errors = [];
    try {
      const result = parse(value, errors, { allowTrailingComma: true });
      if (errors.length === 0) {
        return JSON.stringify(result, null, 2);
      }
    } catch {
    }
    return void 0;
  };
  const parsed = tryParse(content);
  if (parsed !== void 0) {
    return parsed;
  }
  const openChar = content[0];
  const closeChar = openChar === "{" ? "}" : "]";
  const closingPositions = [];
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === "\\") {
      escapeNext = true;
      continue;
    }
    if (char === '"' && !inString) {
      inString = true;
      continue;
    }
    if (char === '"' && inString) {
      inString = false;
      continue;
    }
    if (inString) continue;
    if (char === openChar) {
      depth++;
    } else if (char === closeChar) {
      depth--;
      if (depth === 0) {
        closingPositions.push(i + 1);
      }
    }
  }
  for (let i = closingPositions.length - 1; i >= 0; i--) {
    const attempt = tryParse(content.slice(0, closingPositions[i]));
    if (attempt !== void 0) {
      return attempt;
    }
  }
  const searchStart = Math.max(0, content.length - 1e3);
  for (let end = content.length - 1; end > searchStart; end--) {
    const attempt = tryParse(content.slice(0, end));
    if (attempt !== void 0) {
      return attempt;
    }
  }
  return text;
}

// src/errors.ts
import { APICallError, LoadAPIKeyError } from "@ai-sdk/provider";
function createAPICallError({
  message,
  code,
  exitCode,
  stderr,
  promptExcerpt,
  isRetryable = false
}) {
  const metadata = {
    code,
    exitCode,
    stderr,
    promptExcerpt
  };
  return new APICallError({
    message,
    isRetryable,
    url: "claude-code-cli://command",
    requestBodyValues: promptExcerpt ? { prompt: promptExcerpt } : void 0,
    data: metadata
  });
}
function createAuthenticationError({ message }) {
  return new LoadAPIKeyError({
    message: message || "Authentication failed. Please ensure Claude Code SDK is properly authenticated."
  });
}
function createTimeoutError({
  message,
  promptExcerpt,
  timeoutMs
}) {
  const metadata = {
    code: "TIMEOUT",
    promptExcerpt
  };
  return new APICallError({
    message,
    isRetryable: true,
    url: "claude-code-cli://command",
    requestBodyValues: promptExcerpt ? { prompt: promptExcerpt } : void 0,
    data: timeoutMs !== void 0 ? { ...metadata, timeoutMs } : metadata
  });
}
function isAuthenticationError(error) {
  if (error instanceof LoadAPIKeyError) return true;
  if (error instanceof APICallError && error.data?.exitCode === 401)
    return true;
  return false;
}
function isTimeoutError(error) {
  if (error instanceof APICallError && error.data?.code === "TIMEOUT")
    return true;
  return false;
}
function getErrorMetadata(error) {
  if (error instanceof APICallError && error.data) {
    return error.data;
  }
  return void 0;
}

// src/map-claude-code-finish-reason.ts
function mapClaudeCodeFinishReason(subtype) {
  switch (subtype) {
    case "success":
      return "stop";
    case "error_max_turns":
      return "length";
    case "error_during_execution":
      return "error";
    default:
      return "stop";
  }
}

// src/validation.ts
import { z } from "zod";
import { existsSync } from "fs";
var loggerFunctionSchema = z.object({
  warn: z.any().refine((val) => typeof val === "function", {
    message: "warn must be a function"
  }),
  error: z.any().refine((val) => typeof val === "function", {
    message: "error must be a function"
  })
});
var claudeCodeSettingsSchema = z.object({
  pathToClaudeCodeExecutable: z.string().optional(),
  customSystemPrompt: z.string().optional(),
  appendSystemPrompt: z.string().optional(),
  systemPrompt: z.union([
    z.string(),
    z.object({
      type: z.literal("preset"),
      preset: z.literal("claude_code"),
      append: z.string().optional()
    })
  ]).optional(),
  maxTurns: z.number().int().min(1).max(100).optional(),
  maxThinkingTokens: z.number().int().positive().max(1e5).optional(),
  cwd: z.string().refine(
    (val) => {
      if (typeof process === "undefined" || !process.versions?.node) {
        return true;
      }
      return !val || existsSync(val);
    },
    { message: "Working directory must exist" }
  ).optional(),
  executable: z.enum(["bun", "deno", "node"]).optional(),
  executableArgs: z.array(z.string()).optional(),
  permissionMode: z.enum(["default", "acceptEdits", "bypassPermissions", "plan"]).optional(),
  permissionPromptToolName: z.string().optional(),
  continue: z.boolean().optional(),
  resume: z.string().optional(),
  allowedTools: z.array(z.string()).optional(),
  disallowedTools: z.array(z.string()).optional(),
  settingSources: z.array(z.enum(["user", "project", "local"])).optional(),
  streamingInput: z.enum(["auto", "always", "off"]).optional(),
  // Hooks and tool-permission callback (permissive validation of shapes)
  canUseTool: z.any().refine((v) => v === void 0 || typeof v === "function", {
    message: "canUseTool must be a function"
  }).optional(),
  hooks: z.record(
    z.string(),
    z.array(
      z.object({
        matcher: z.string().optional(),
        hooks: z.array(z.any()).nonempty()
      })
    )
  ).optional(),
  mcpServers: z.record(
    z.string(),
    z.union([
      // McpStdioServerConfig
      z.object({
        type: z.literal("stdio").optional(),
        command: z.string(),
        args: z.array(z.string()).optional(),
        env: z.record(z.string(), z.string()).optional()
      }),
      // McpSSEServerConfig
      z.object({
        type: z.literal("sse"),
        url: z.string(),
        headers: z.record(z.string(), z.string()).optional()
      }),
      // McpHttpServerConfig
      z.object({
        type: z.literal("http"),
        url: z.string(),
        headers: z.record(z.string(), z.string()).optional()
      }),
      // McpSdkServerConfig (in-process custom tools)
      z.object({
        type: z.literal("sdk"),
        name: z.string(),
        instance: z.any()
      })
    ])
  ).optional(),
  verbose: z.boolean().optional(),
  logger: z.union([z.literal(false), loggerFunctionSchema]).optional(),
  env: z.record(z.string(), z.string().optional()).optional(),
  additionalDirectories: z.array(z.string()).optional(),
  agents: z.record(
    z.string(),
    z.object({
      description: z.string(),
      tools: z.array(z.string()).optional(),
      prompt: z.string(),
      model: z.enum(["sonnet", "opus", "haiku", "inherit"]).optional()
    })
  ).optional(),
  includePartialMessages: z.boolean().optional(),
  fallbackModel: z.string().optional(),
  forkSession: z.boolean().optional(),
  stderr: z.function().args(z.string()).returns(z.void()).optional(),
  strictMcpConfig: z.boolean().optional(),
  extraArgs: z.record(z.string(), z.union([z.string(), z.null()])).optional()
}).strict();
function validateModelId(modelId) {
  const knownModels = ["opus", "sonnet", "haiku"];
  if (!modelId || modelId.trim() === "") {
    throw new Error("Model ID cannot be empty");
  }
  if (!knownModels.includes(modelId)) {
    return `Unknown model ID: '${modelId}'. Proceeding with custom model. Known models are: ${knownModels.join(", ")}`;
  }
  return void 0;
}
function validateSettings(settings) {
  const warnings = [];
  const errors = [];
  try {
    const result = claudeCodeSettingsSchema.safeParse(settings);
    if (!result.success) {
      const errorObject = result.error;
      const issues = errorObject.errors || errorObject.issues || [];
      issues.forEach((err) => {
        const path = err.path.join(".");
        errors.push(`${path ? `${path}: ` : ""}${err.message}`);
      });
      return { valid: false, warnings, errors };
    }
    const validSettings = result.data;
    if (validSettings.maxTurns && validSettings.maxTurns > 20) {
      warnings.push(
        `High maxTurns value (${validSettings.maxTurns}) may lead to long-running conversations`
      );
    }
    if (validSettings.maxThinkingTokens && validSettings.maxThinkingTokens > 5e4) {
      warnings.push(
        `Very high maxThinkingTokens (${validSettings.maxThinkingTokens}) may increase response time`
      );
    }
    if (validSettings.allowedTools && validSettings.disallowedTools) {
      warnings.push(
        "Both allowedTools and disallowedTools are specified. Only allowedTools will be used."
      );
    }
    const validateToolNames = (tools, type) => {
      tools.forEach((tool3) => {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\([^)]*\))?$/.test(tool3) && !tool3.startsWith("mcp__")) {
          warnings.push(`Unusual ${type} tool name format: '${tool3}'`);
        }
      });
    };
    if (validSettings.allowedTools) {
      validateToolNames(validSettings.allowedTools, "allowed");
    }
    if (validSettings.disallowedTools) {
      validateToolNames(validSettings.disallowedTools, "disallowed");
    }
    return { valid: true, warnings, errors };
  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
    return { valid: false, warnings, errors };
  }
}
function validatePrompt(prompt) {
  const MAX_PROMPT_LENGTH = 1e5;
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return `Very long prompt (${prompt.length} characters) may cause performance issues or timeouts`;
  }
  return void 0;
}
function validateSessionId(sessionId) {
  if (sessionId && !/^[a-zA-Z0-9-_]+$/.test(sessionId)) {
    return `Unusual session ID format. This may cause issues with session resumption.`;
  }
  return void 0;
}

// src/logger.ts
var defaultLogger = {
  warn: (message) => console.warn(message),
  error: (message) => console.error(message)
};
var noopLogger = {
  warn: () => {
  },
  error: () => {
  }
};
function getLogger(logger) {
  if (logger === false) {
    return noopLogger;
  }
  if (logger === void 0) {
    return defaultLogger;
  }
  return logger;
}

// src/claude-code-built-in-tools.ts
import { jsonSchema } from "@ai-sdk/provider-utils";
import { z as z2 } from "zod";
function getClaudeCodeBuiltInTools() {
  return [
    {
      type: "function",
      name: "Bash",
      description: "Execute bash commands",
      parameters: jsonSchema(z2.object({
        command: z2.string().describe("The bash command to execute"),
        description: z2.string().optional().describe("Description of what the command does"),
        timeout: z2.number().optional().describe("Timeout in milliseconds")
      }))
    },
    {
      type: "function",
      name: "Read",
      description: "Read file contents",
      parameters: jsonSchema(z2.object({
        file_path: z2.string().describe("Absolute path to the file to read"),
        offset: z2.number().optional().describe("Line number to start reading from"),
        limit: z2.number().optional().describe("Number of lines to read")
      }))
    },
    {
      type: "function",
      name: "Write",
      description: "Write content to a file",
      parameters: jsonSchema(z2.object({
        file_path: z2.string().describe("Absolute path to the file to write"),
        content: z2.string().describe("Content to write to the file")
      }))
    },
    {
      type: "function",
      name: "Edit",
      description: "Edit file contents by replacing text",
      parameters: jsonSchema(z2.object({
        file_path: z2.string().describe("Absolute path to the file to edit"),
        old_string: z2.string().describe("Text to replace"),
        new_string: z2.string().describe("Text to replace it with"),
        replace_all: z2.boolean().optional().describe("Replace all occurrences")
      }))
    },
    {
      type: "function",
      name: "Glob",
      description: "Find files matching a pattern",
      parameters: jsonSchema(z2.object({
        pattern: z2.string().describe("Glob pattern to match files"),
        path: z2.string().optional().describe("Directory to search in")
      }))
    },
    {
      type: "function",
      name: "Grep",
      description: "Search file contents using regex",
      parameters: jsonSchema(z2.object({
        pattern: z2.string().describe("Regular expression pattern to search for"),
        path: z2.string().optional().describe("File or directory to search in"),
        glob: z2.string().optional().describe("Glob pattern to filter files"),
        type: z2.string().optional().describe("File type to search"),
        output_mode: z2.enum(["content", "files_with_matches", "count"]).optional(),
        "-i": z2.boolean().optional().describe("Case insensitive search"),
        "-n": z2.boolean().optional().describe("Show line numbers"),
        "-A": z2.number().optional().describe("Lines of context after match"),
        "-B": z2.number().optional().describe("Lines of context before match"),
        "-C": z2.number().optional().describe("Lines of context around match")
      }))
    },
    {
      type: "function",
      name: "Task",
      description: "Launch a specialized agent for complex tasks",
      parameters: jsonSchema(z2.object({
        description: z2.string().describe("Short description of the task"),
        prompt: z2.string().describe("Detailed task prompt for the agent"),
        subagent_type: z2.string().describe("Type of agent to use")
      }))
    },
    {
      type: "function",
      name: "WebFetch",
      description: "Fetch content from a URL",
      parameters: jsonSchema(z2.object({
        url: z2.string().describe("URL to fetch content from"),
        prompt: z2.string().describe("What to extract from the content")
      }))
    },
    {
      type: "function",
      name: "WebSearch",
      description: "Search the web",
      parameters: jsonSchema(z2.object({
        query: z2.string().describe("Search query"),
        allowed_domains: z2.array(z2.string()).optional(),
        blocked_domains: z2.array(z2.string()).optional()
      }))
    },
    {
      type: "function",
      name: "TodoWrite",
      description: "Create and manage a task list",
      parameters: jsonSchema(z2.object({
        todos: z2.array(z2.object({
          content: z2.string(),
          status: z2.enum(["pending", "in_progress", "completed"]),
          activeForm: z2.string()
        }))
      }))
    },
    {
      type: "function",
      name: "AskUserQuestion",
      description: "Ask the user questions during execution",
      parameters: jsonSchema(z2.object({
        questions: z2.array(z2.object({
          question: z2.string(),
          header: z2.string(),
          options: z2.array(z2.object({
            label: z2.string(),
            description: z2.string()
          })),
          multiSelect: z2.boolean()
        })),
        answers: z2.record(z2.string()).optional()
      }))
    },
    {
      type: "function",
      name: "BashOutput",
      description: "Retrieve output from a background bash shell",
      parameters: jsonSchema(z2.object({
        bash_id: z2.string().describe("ID of the background shell"),
        filter: z2.string().optional().describe("Regex to filter output lines")
      }))
    },
    {
      type: "function",
      name: "KillShell",
      description: "Kill a running background bash shell",
      parameters: jsonSchema(z2.object({
        shell_id: z2.string().describe("ID of the shell to kill")
      }))
    },
    {
      type: "function",
      name: "NotebookEdit",
      description: "Edit a Jupyter notebook cell",
      parameters: jsonSchema(z2.object({
        notebook_path: z2.string().describe("Path to the notebook"),
        new_source: z2.string().describe("New source for the cell"),
        cell_id: z2.string().optional(),
        cell_type: z2.enum(["code", "markdown"]).optional(),
        edit_mode: z2.enum(["replace", "insert", "delete"]).optional()
      }))
    },
    {
      type: "function",
      name: "Skill",
      description: "Execute a skill within the conversation",
      parameters: jsonSchema(z2.object({
        command: z2.string().describe("Skill name to invoke")
      }))
    },
    {
      type: "function",
      name: "SlashCommand",
      description: "Execute a slash command",
      parameters: jsonSchema(z2.object({
        command: z2.string().describe("Slash command with arguments")
      }))
    }
  ];
}

// src/claude-code-language-model.ts
import { query } from "@anthropic-ai/claude-agent-sdk";
var CLAUDE_CODE_TRUNCATION_WARNING = "Claude Code CLI output ended unexpectedly; returning truncated response from buffered text. Await upstream fix to avoid data loss.";
var MIN_TRUNCATION_LENGTH = 1024;
var POSITION_PATTERN = /position\s+(\d+)/i;
function hasUnclosedJsonStructure(text) {
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (inString) {
      if (char === "\\") {
        escapeNext = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{" || char === "[") {
      depth++;
      continue;
    }
    if (char === "}" || char === "]") {
      if (depth > 0) {
        depth--;
      }
    }
  }
  return depth > 0 || inString;
}
function isClaudeCodeTruncationError(error, bufferedText) {
  if (!(error instanceof SyntaxError)) {
    return false;
  }
  if (!bufferedText) {
    return false;
  }
  const rawMessage = typeof error.message === "string" ? error.message : "";
  const message = rawMessage.toLowerCase();
  const truncationIndicators = [
    "unexpected end of json input",
    "unexpected end of input",
    "unexpected end of string",
    "unterminated string"
  ];
  if (!truncationIndicators.some((indicator) => message.includes(indicator))) {
    return false;
  }
  const positionMatch = rawMessage.match(POSITION_PATTERN);
  if (positionMatch) {
    const position = Number.parseInt(positionMatch[1], 10);
    if (Number.isFinite(position)) {
      const isNearBufferEnd = Math.abs(position - bufferedText.length) <= 16;
      if (isNearBufferEnd && position >= MIN_TRUNCATION_LENGTH) {
        return true;
      }
      if (!isNearBufferEnd) {
        return false;
      }
    }
  }
  if (bufferedText.length < MIN_TRUNCATION_LENGTH) {
    return false;
  }
  return hasUnclosedJsonStructure(bufferedText);
}
function isAbortError(err) {
  if (err && typeof err === "object") {
    const e = err;
    if (typeof e.name === "string" && e.name === "AbortError") return true;
    if (typeof e.code === "string" && e.code.toUpperCase() === "ABORT_ERR") return true;
  }
  return false;
}
var STREAMING_FEATURE_WARNING = "Claude Agent SDK features (hooks/MCP/images) require streaming input. Set `streamingInput: 'always'` or provide `canUseTool` (auto streams only when canUseTool is set).";
function toAsyncIterablePrompt(messagesPrompt, outputStreamEnded, sessionId, contentParts) {
  const content = contentParts && contentParts.length > 0 ? contentParts : [{ type: "text", text: messagesPrompt }];
  const msg = {
    type: "user",
    message: {
      role: "user",
      content
    },
    parent_tool_use_id: null,
    session_id: sessionId ?? ""
  };
  return {
    async *[Symbol.asyncIterator]() {
      yield msg;
      await outputStreamEnded;
    }
  };
}
var modelMap = {
  opus: "opus",
  sonnet: "sonnet",
  haiku: "haiku"
};
var ClaudeCodeLanguageModel = class _ClaudeCodeLanguageModel {
  specificationVersion = "v2";
  defaultObjectGenerationMode = "json";
  supportsImageUrls = false;
  supportedUrls = {};
  supportsStructuredOutputs = false;
  // Fallback/magic string constants
  static UNKNOWN_TOOL_NAME = "unknown-tool";
  // Tool input safety limits
  static MAX_TOOL_INPUT_SIZE = 1048576;
  // 1MB hard limit
  static MAX_TOOL_INPUT_WARN = 102400;
  // 100KB warning threshold
  static MAX_DELTA_CALC_SIZE = 1e4;
  // 10KB delta computation threshold
  modelId;
  settings;
  sessionId;
  modelValidationWarning;
  settingsValidationWarnings;
  logger;
  constructor(options) {
    this.modelId = options.id;
    this.settings = options.settings ?? {};
    this.settingsValidationWarnings = options.settingsValidationWarnings ?? [];
    this.logger = getLogger(this.settings.logger);
    if (!this.modelId || typeof this.modelId !== "string" || this.modelId.trim() === "") {
      throw new NoSuchModelError({
        modelId: this.modelId,
        modelType: "languageModel"
      });
    }
    this.modelValidationWarning = validateModelId(this.modelId);
    if (this.modelValidationWarning) {
      this.logger.warn(`Claude Code Model: ${this.modelValidationWarning}`);
    }
  }
  get provider() {
    return "claude-code";
  }
  /**
   * Built-in tools available for this model.
   * Pass these to streamText/generateText to avoid tool validation errors:
   *
   * @example
   * ```typescript
   * const model = claudeCode('haiku');
   * streamText({
   *   model,
   *   tools: model.tools, // or { ...model.tools, ...myCustomTools }
   *   prompt: '...'
   * });
   * ```
   */
  get tools() {
    const builtInTools = getClaudeCodeBuiltInTools();
    return builtInTools.reduce(
      (acc, tool3) => {
        acc[tool3.name] = tool3;
        return acc;
      },
      {}
    );
  }
  getModel() {
    const mapped = modelMap[this.modelId];
    return mapped ?? this.modelId;
  }
  extractToolUses(content) {
    if (!Array.isArray(content)) {
      return [];
    }
    return content.filter(
      (item) => typeof item === "object" && item !== null && "type" in item && item.type === "tool_use"
    ).map((item) => {
      const { id, name, input } = item;
      return {
        id: typeof id === "string" && id.length > 0 ? id : generateId(),
        name: typeof name === "string" && name.length > 0 ? name : _ClaudeCodeLanguageModel.UNKNOWN_TOOL_NAME,
        input
      };
    });
  }
  extractToolResults(content) {
    if (!Array.isArray(content)) {
      return [];
    }
    return content.filter(
      (item) => typeof item === "object" && item !== null && "type" in item && item.type === "tool_result"
    ).map((item) => {
      const { tool_use_id, content: content2, is_error, name } = item;
      return {
        id: typeof tool_use_id === "string" && tool_use_id.length > 0 ? tool_use_id : generateId(),
        name: typeof name === "string" && name.length > 0 ? name : void 0,
        result: content2,
        isError: Boolean(is_error)
      };
    });
  }
  extractToolErrors(content) {
    if (!Array.isArray(content)) {
      return [];
    }
    return content.filter(
      (item) => typeof item === "object" && item !== null && "type" in item && item.type === "tool_error"
    ).map((item) => {
      const { tool_use_id, error, name } = item;
      return {
        id: typeof tool_use_id === "string" && tool_use_id.length > 0 ? tool_use_id : generateId(),
        name: typeof name === "string" && name.length > 0 ? name : void 0,
        error
      };
    });
  }
  serializeToolInput(input) {
    if (typeof input === "string") {
      return this.checkInputSize(input);
    }
    if (input === void 0) {
      return "";
    }
    try {
      const serialized = JSON.stringify(input);
      return this.checkInputSize(serialized);
    } catch {
      const fallback = String(input);
      return this.checkInputSize(fallback);
    }
  }
  checkInputSize(str) {
    const length = str.length;
    if (length > _ClaudeCodeLanguageModel.MAX_TOOL_INPUT_SIZE) {
      throw new Error(
        `Tool input exceeds maximum size of ${_ClaudeCodeLanguageModel.MAX_TOOL_INPUT_SIZE} bytes (got ${length} bytes). This may indicate a malformed request or an attempt to process excessively large data.`
      );
    }
    if (length > _ClaudeCodeLanguageModel.MAX_TOOL_INPUT_WARN) {
      console.warn(
        `[claude-code] Large tool input detected: ${length} bytes. Performance may be impacted. Consider chunking or reducing input size.`
      );
    }
    return str;
  }
  normalizeToolResult(result) {
    if (typeof result === "string") {
      try {
        return JSON.parse(result);
      } catch {
        return result;
      }
    }
    return result;
  }
  generateAllWarnings(options, prompt) {
    const warnings = [];
    const unsupportedParams = [];
    if (options.temperature !== void 0) unsupportedParams.push("temperature");
    if (options.topP !== void 0) unsupportedParams.push("topP");
    if (options.topK !== void 0) unsupportedParams.push("topK");
    if (options.presencePenalty !== void 0) unsupportedParams.push("presencePenalty");
    if (options.frequencyPenalty !== void 0) unsupportedParams.push("frequencyPenalty");
    if (options.stopSequences !== void 0 && options.stopSequences.length > 0)
      unsupportedParams.push("stopSequences");
    if (options.seed !== void 0) unsupportedParams.push("seed");
    if (unsupportedParams.length > 0) {
      for (const param of unsupportedParams) {
        warnings.push({
          type: "unsupported-setting",
          setting: param,
          details: `Claude Code SDK does not support the ${param} parameter. It will be ignored.`
        });
      }
    }
    if (this.modelValidationWarning) {
      warnings.push({
        type: "other",
        message: this.modelValidationWarning
      });
    }
    this.settingsValidationWarnings.forEach((warning) => {
      warnings.push({
        type: "other",
        message: warning
      });
    });
    const promptWarning = validatePrompt(prompt);
    if (promptWarning) {
      warnings.push({
        type: "other",
        message: promptWarning
      });
    }
    return warnings;
  }
  handleJsonExtraction(text, warnings) {
    const extracted = extractJson(text);
    const validation = this.validateJsonExtraction(text, extracted);
    if (!validation.valid && validation.warning) {
      warnings.push(validation.warning);
    }
    return extracted;
  }
  createQueryOptions(abortController) {
    const opts = {
      model: this.getModel(),
      abortController,
      resume: this.settings.resume ?? this.sessionId,
      pathToClaudeCodeExecutable: this.settings.pathToClaudeCodeExecutable,
      maxTurns: this.settings.maxTurns,
      maxThinkingTokens: this.settings.maxThinkingTokens,
      cwd: this.settings.cwd,
      executable: this.settings.executable,
      executableArgs: this.settings.executableArgs,
      permissionMode: this.settings.permissionMode,
      permissionPromptToolName: this.settings.permissionPromptToolName,
      continue: this.settings.continue,
      allowedTools: this.settings.allowedTools,
      disallowedTools: this.settings.disallowedTools,
      mcpServers: this.settings.mcpServers,
      canUseTool: this.settings.canUseTool
    };
    if (this.settings.systemPrompt !== void 0) {
      opts.systemPrompt = this.settings.systemPrompt;
    } else if (this.settings.customSystemPrompt !== void 0) {
      this.logger.warn(
        "[claude-code] 'customSystemPrompt' is deprecated and will be removed in a future major release. Please use 'systemPrompt' instead (string or { type: 'preset', preset: 'claude_code', append? })."
      );
      opts.systemPrompt = this.settings.customSystemPrompt;
    } else if (this.settings.appendSystemPrompt !== void 0) {
      this.logger.warn(
        "[claude-code] 'appendSystemPrompt' is deprecated and will be removed in a future major release. Please use 'systemPrompt: { type: 'preset', preset: 'claude_code', append: <text> }' instead."
      );
      opts.systemPrompt = {
        type: "preset",
        preset: "claude_code",
        append: this.settings.appendSystemPrompt
      };
    }
    if (this.settings.settingSources !== void 0) {
      opts.settingSources = this.settings.settingSources;
    }
    if (this.settings.additionalDirectories !== void 0) {
      opts.additionalDirectories = this.settings.additionalDirectories;
    }
    if (this.settings.agents !== void 0) {
      opts.agents = this.settings.agents;
    }
    if (this.settings.includePartialMessages !== void 0) {
      opts.includePartialMessages = this.settings.includePartialMessages;
    }
    if (this.settings.fallbackModel !== void 0) {
      opts.fallbackModel = this.settings.fallbackModel;
    }
    if (this.settings.forkSession !== void 0) {
      opts.forkSession = this.settings.forkSession;
    }
    if (this.settings.stderr !== void 0) {
      opts.stderr = this.settings.stderr;
    }
    if (this.settings.strictMcpConfig !== void 0) {
      opts.strictMcpConfig = this.settings.strictMcpConfig;
    }
    if (this.settings.extraArgs !== void 0) {
      opts.extraArgs = this.settings.extraArgs;
    }
    if (this.settings.hooks) {
      opts.hooks = this.settings.hooks;
    }
    if (this.settings.env !== void 0) {
      opts.env = { ...process.env, ...this.settings.env };
    }
    return opts;
  }
  handleClaudeCodeError(error, messagesPrompt) {
    if (isAbortError(error)) {
      throw error;
    }
    const isErrorWithMessage = (err) => {
      return typeof err === "object" && err !== null && "message" in err;
    };
    const isErrorWithCode = (err) => {
      return typeof err === "object" && err !== null;
    };
    const authErrorPatterns = [
      "not logged in",
      "authentication",
      "unauthorized",
      "auth failed",
      "please login",
      "claude login"
    ];
    const errorMessage = isErrorWithMessage(error) && error.message ? error.message.toLowerCase() : "";
    const exitCode = isErrorWithCode(error) && typeof error.exitCode === "number" ? error.exitCode : void 0;
    const isAuthError = authErrorPatterns.some((pattern) => errorMessage.includes(pattern)) || exitCode === 401;
    if (isAuthError) {
      return createAuthenticationError({
        message: isErrorWithMessage(error) && error.message ? error.message : "Authentication failed. Please ensure Claude Code SDK is properly authenticated."
      });
    }
    const errorCode = isErrorWithCode(error) && typeof error.code === "string" ? error.code : "";
    if (errorCode === "ETIMEDOUT" || errorMessage.includes("timeout")) {
      return createTimeoutError({
        message: isErrorWithMessage(error) && error.message ? error.message : "Request timed out",
        promptExcerpt: messagesPrompt.substring(0, 200)
        // Don't specify timeoutMs since we don't know the actual timeout value
        // It's controlled by the consumer via AbortSignal
      });
    }
    const isRetryable = errorCode === "ENOENT" || errorCode === "ECONNREFUSED" || errorCode === "ETIMEDOUT" || errorCode === "ECONNRESET";
    return createAPICallError({
      message: isErrorWithMessage(error) && error.message ? error.message : "Claude Code SDK error",
      code: errorCode || void 0,
      exitCode,
      stderr: isErrorWithCode(error) && typeof error.stderr === "string" ? error.stderr : void 0,
      promptExcerpt: messagesPrompt.substring(0, 200),
      isRetryable
    });
  }
  setSessionId(sessionId) {
    this.sessionId = sessionId;
    const warning = validateSessionId(sessionId);
    if (warning) {
      this.logger.warn(`Claude Code Session: ${warning}`);
    }
  }
  validateJsonExtraction(originalText, extractedJson) {
    if (extractedJson === originalText) {
      return {
        valid: false,
        warning: {
          type: "other",
          message: "JSON extraction from model response may be incomplete or modified. The model may not have returned valid JSON."
        }
      };
    }
    try {
      JSON.parse(extractedJson);
      return { valid: true };
    } catch {
      return {
        valid: false,
        warning: {
          type: "other",
          message: "JSON extraction resulted in invalid JSON. The response may be malformed."
        }
      };
    }
  }
  async doGenerate(options) {
    const mode = options.responseFormat?.type === "json" ? { type: "object-json" } : { type: "regular" };
    const {
      messagesPrompt,
      warnings: messageWarnings,
      streamingContentParts,
      hasImageParts
    } = convertToClaudeCodeMessages(
      options.prompt,
      mode,
      options.responseFormat?.type === "json" ? options.responseFormat.schema : void 0
    );
    const abortController = new AbortController();
    let abortListener;
    if (options.abortSignal?.aborted) {
      abortController.abort(options.abortSignal.reason);
    } else if (options.abortSignal) {
      abortListener = () => abortController.abort(options.abortSignal?.reason);
      options.abortSignal.addEventListener("abort", abortListener, { once: true });
    }
    const queryOptions = this.createQueryOptions(abortController);
    let text = "";
    let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let finishReason = "stop";
    let wasTruncated = false;
    let costUsd;
    let durationMs;
    let rawUsage;
    const warnings = this.generateAllWarnings(
      options,
      messagesPrompt
    );
    if (messageWarnings) {
      messageWarnings.forEach((warning) => {
        warnings.push({
          type: "other",
          message: warning
        });
      });
    }
    const modeSetting = this.settings.streamingInput ?? "auto";
    const wantsStreamInput = modeSetting === "always" || modeSetting === "auto" && !!this.settings.canUseTool;
    if (!wantsStreamInput && hasImageParts) {
      warnings.push({
        type: "other",
        message: STREAMING_FEATURE_WARNING
      });
    }
    let done = () => {
    };
    const outputStreamEnded = new Promise((resolve) => {
      done = () => resolve(void 0);
    });
    try {
      if (this.settings.canUseTool && this.settings.permissionPromptToolName) {
        throw new Error(
          "canUseTool requires streamingInput mode ('auto' or 'always') and cannot be used with permissionPromptToolName (SDK constraint). Set streamingInput: 'auto' (or 'always') and remove permissionPromptToolName, or remove canUseTool."
        );
      }
      const sdkPrompt = wantsStreamInput ? toAsyncIterablePrompt(
        messagesPrompt,
        outputStreamEnded,
        this.settings.resume ?? this.sessionId,
        streamingContentParts
      ) : messagesPrompt;
      const response = query({
        prompt: sdkPrompt,
        options: queryOptions
      });
      for await (const message of response) {
        if (message.type === "assistant") {
          text += message.message.content.map((c) => c.type === "text" ? c.text : "").join("");
        } else if (message.type === "result") {
          done();
          this.setSessionId(message.session_id);
          costUsd = message.total_cost_usd;
          durationMs = message.duration_ms;
          if ("usage" in message) {
            rawUsage = message.usage;
            usage = {
              inputTokens: (message.usage.cache_creation_input_tokens ?? 0) + (message.usage.cache_read_input_tokens ?? 0) + (message.usage.input_tokens ?? 0),
              outputTokens: message.usage.output_tokens ?? 0,
              totalTokens: (message.usage.cache_creation_input_tokens ?? 0) + (message.usage.cache_read_input_tokens ?? 0) + (message.usage.input_tokens ?? 0) + (message.usage.output_tokens ?? 0)
            };
          }
          finishReason = mapClaudeCodeFinishReason(message.subtype);
        } else if (message.type === "system" && message.subtype === "init") {
          this.setSessionId(message.session_id);
        }
      }
    } catch (error) {
      done();
      if (isAbortError(error)) {
        throw options.abortSignal?.aborted ? options.abortSignal.reason : error;
      }
      if (isClaudeCodeTruncationError(error, text)) {
        wasTruncated = true;
        finishReason = "length";
        warnings.push({
          type: "other",
          message: CLAUDE_CODE_TRUNCATION_WARNING
        });
      } else {
        throw this.handleClaudeCodeError(error, messagesPrompt);
      }
    } finally {
      if (options.abortSignal && abortListener) {
        options.abortSignal.removeEventListener("abort", abortListener);
      }
    }
    if (options.responseFormat?.type === "json" && text) {
      text = this.handleJsonExtraction(text, warnings);
    }
    return {
      content: [{ type: "text", text }],
      usage,
      finishReason,
      warnings,
      response: {
        id: generateId(),
        timestamp: /* @__PURE__ */ new Date(),
        modelId: this.modelId
      },
      request: {
        body: messagesPrompt
      },
      providerMetadata: {
        "claude-code": {
          ...this.sessionId !== void 0 && { sessionId: this.sessionId },
          ...costUsd !== void 0 && { costUsd },
          ...durationMs !== void 0 && { durationMs },
          ...rawUsage !== void 0 && { rawUsage },
          ...wasTruncated && { truncated: true }
        }
      }
    };
  }
  async doStream(options) {
    const mode = options.responseFormat?.type === "json" ? { type: "object-json" } : { type: "regular" };
    const {
      messagesPrompt,
      warnings: messageWarnings,
      streamingContentParts,
      hasImageParts
    } = convertToClaudeCodeMessages(
      options.prompt,
      mode,
      options.responseFormat?.type === "json" ? options.responseFormat.schema : void 0
    );
    const abortController = new AbortController();
    let abortListener;
    if (options.abortSignal?.aborted) {
      abortController.abort(options.abortSignal.reason);
    } else if (options.abortSignal) {
      abortListener = () => abortController.abort(options.abortSignal?.reason);
      options.abortSignal.addEventListener("abort", abortListener, { once: true });
    }
    const queryOptions = this.createQueryOptions(abortController);
    const warnings = this.generateAllWarnings(
      options,
      messagesPrompt
    );
    if (messageWarnings) {
      messageWarnings.forEach((warning) => {
        warnings.push({
          type: "other",
          message: warning
        });
      });
    }
    const modeSetting = this.settings.streamingInput ?? "auto";
    const wantsStreamInput = modeSetting === "always" || modeSetting === "auto" && !!this.settings.canUseTool;
    if (!wantsStreamInput && hasImageParts) {
      warnings.push({
        type: "other",
        message: STREAMING_FEATURE_WARNING
      });
    }
    const stream = new ReadableStream({
      start: async (controller) => {
        let done = () => {
        };
        const outputStreamEnded = new Promise((resolve) => {
          done = () => resolve(void 0);
        });
        const toolStates = /* @__PURE__ */ new Map();
        const streamWarnings = [];
        const closeToolInput = (toolId, state) => {
          if (!state.inputClosed && state.inputStarted) {
            controller.enqueue({
              type: "tool-input-end",
              id: toolId
            });
            state.inputClosed = true;
          }
        };
        const emitToolCall = (toolId, state) => {
          if (state.callEmitted) {
            return;
          }
          closeToolInput(toolId, state);
          controller.enqueue({
            type: "tool-call",
            toolCallId: toolId,
            toolName: state.name,
            input: state.lastSerializedInput ?? "",
            providerExecuted: true,
            providerMetadata: {
              "claude-code": {
                // rawInput preserves the original serialized format before AI SDK normalization.
                // Use this if you need the exact string sent to the Claude CLI, which may differ
                // from the `input` field after AI SDK processing.
                rawInput: state.lastSerializedInput ?? ""
              }
            }
          });
          state.callEmitted = true;
        };
        const finalizeToolCalls = () => {
          for (const [toolId, state] of toolStates) {
            emitToolCall(toolId, state);
          }
          toolStates.clear();
        };
        let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
        let accumulatedText = "";
        let textPartId;
        try {
          controller.enqueue({ type: "stream-start", warnings });
          if (this.settings.canUseTool && this.settings.permissionPromptToolName) {
            throw new Error(
              "canUseTool requires streamingInput mode ('auto' or 'always') and cannot be used with permissionPromptToolName (SDK constraint). Set streamingInput: 'auto' (or 'always') and remove permissionPromptToolName, or remove canUseTool."
            );
          }
          const sdkPrompt = wantsStreamInput ? toAsyncIterablePrompt(
            messagesPrompt,
            outputStreamEnded,
            this.settings.resume ?? this.sessionId,
            streamingContentParts
          ) : messagesPrompt;
          const response = query({
            prompt: sdkPrompt,
            options: queryOptions
          });
          for await (const message of response) {
            if (message.type === "assistant") {
              if (!message.message?.content) {
                console.warn(
                  `[claude-code] Unexpected assistant message structure: missing content field. Message type: ${message.type}. This may indicate an SDK protocol violation.`,
                  message
                );
                continue;
              }
              const content = message.message.content;
              for (const tool3 of this.extractToolUses(content)) {
                const toolId = tool3.id;
                let state = toolStates.get(toolId);
                if (!state) {
                  state = {
                    name: tool3.name,
                    inputStarted: false,
                    inputClosed: false,
                    callEmitted: false
                  };
                  toolStates.set(toolId, state);
                }
                state.name = tool3.name;
                if (!state.inputStarted) {
                  controller.enqueue({
                    type: "tool-input-start",
                    id: toolId,
                    toolName: tool3.name,
                    providerExecuted: true
                  });
                  state.inputStarted = true;
                }
                const serializedInput = this.serializeToolInput(tool3.input);
                if (serializedInput) {
                  let deltaPayload = "";
                  if (state.lastSerializedInput === void 0) {
                    if (serializedInput.length <= _ClaudeCodeLanguageModel.MAX_DELTA_CALC_SIZE) {
                      deltaPayload = serializedInput;
                    }
                  } else if (serializedInput.length <= _ClaudeCodeLanguageModel.MAX_DELTA_CALC_SIZE && state.lastSerializedInput.length <= _ClaudeCodeLanguageModel.MAX_DELTA_CALC_SIZE && serializedInput.startsWith(state.lastSerializedInput)) {
                    deltaPayload = serializedInput.slice(state.lastSerializedInput.length);
                  } else if (serializedInput !== state.lastSerializedInput) {
                    deltaPayload = "";
                  }
                  if (deltaPayload) {
                    controller.enqueue({
                      type: "tool-input-delta",
                      id: toolId,
                      delta: deltaPayload
                    });
                  }
                  state.lastSerializedInput = serializedInput;
                }
              }
              const text = content.map((c) => c.type === "text" ? c.text : "").join("");
              if (text) {
                accumulatedText += text;
                if (options.responseFormat?.type !== "json") {
                  if (!textPartId) {
                    textPartId = generateId();
                    controller.enqueue({
                      type: "text-start",
                      id: textPartId
                    });
                  }
                  controller.enqueue({
                    type: "text-delta",
                    id: textPartId,
                    delta: text
                  });
                }
              }
            } else if (message.type === "user") {
              if (!message.message?.content) {
                console.warn(
                  `[claude-code] Unexpected user message structure: missing content field. Message type: ${message.type}. This may indicate an SDK protocol violation.`,
                  message
                );
                continue;
              }
              const content = message.message.content;
              for (const result of this.extractToolResults(content)) {
                let state = toolStates.get(result.id);
                const toolName = result.name ?? state?.name ?? _ClaudeCodeLanguageModel.UNKNOWN_TOOL_NAME;
                if (!state) {
                  console.warn(
                    `[claude-code] Received tool result for unknown tool ID: ${result.id}`
                  );
                  state = {
                    name: toolName,
                    inputStarted: false,
                    inputClosed: false,
                    callEmitted: false
                  };
                  toolStates.set(result.id, state);
                  if (!state.inputStarted) {
                    controller.enqueue({
                      type: "tool-input-start",
                      id: result.id,
                      toolName,
                      providerExecuted: true
                    });
                    state.inputStarted = true;
                  }
                  if (!state.inputClosed) {
                    controller.enqueue({
                      type: "tool-input-end",
                      id: result.id
                    });
                    state.inputClosed = true;
                  }
                }
                state.name = toolName;
                const normalizedResult = this.normalizeToolResult(result.result);
                const rawResult = typeof result.result === "string" ? result.result : (() => {
                  try {
                    return JSON.stringify(result.result);
                  } catch {
                    return String(result.result);
                  }
                })();
                emitToolCall(result.id, state);
                controller.enqueue({
                  type: "tool-result",
                  toolCallId: result.id,
                  toolName,
                  result: normalizedResult,
                  isError: result.isError,
                  providerExecuted: true,
                  providerMetadata: {
                    "claude-code": {
                      // rawResult preserves the original CLI output string before JSON parsing.
                      // Use this when you need the exact string returned by the tool, especially
                      // if the `result` field has been parsed/normalized and you need the original format.
                      rawResult
                    }
                  }
                });
              }
              for (const error of this.extractToolErrors(content)) {
                let state = toolStates.get(error.id);
                const toolName = error.name ?? state?.name ?? _ClaudeCodeLanguageModel.UNKNOWN_TOOL_NAME;
                if (!state) {
                  console.warn(
                    `[claude-code] Received tool error for unknown tool ID: ${error.id}`
                  );
                  state = {
                    name: toolName,
                    inputStarted: true,
                    inputClosed: true,
                    callEmitted: false
                  };
                  toolStates.set(error.id, state);
                }
                emitToolCall(error.id, state);
                const rawError = typeof error.error === "string" ? error.error : typeof error.error === "object" && error.error !== null ? (() => {
                  try {
                    return JSON.stringify(error.error);
                  } catch {
                    return String(error.error);
                  }
                })() : String(error.error);
                controller.enqueue({
                  type: "tool-error",
                  toolCallId: error.id,
                  toolName,
                  error: rawError,
                  providerExecuted: true,
                  providerMetadata: {
                    "claude-code": {
                      rawError
                    }
                  }
                });
              }
            } else if (message.type === "result") {
              done();
              let rawUsage;
              if ("usage" in message) {
                rawUsage = message.usage;
                usage = {
                  inputTokens: (message.usage.cache_creation_input_tokens ?? 0) + (message.usage.cache_read_input_tokens ?? 0) + (message.usage.input_tokens ?? 0),
                  outputTokens: message.usage.output_tokens ?? 0,
                  totalTokens: (message.usage.cache_creation_input_tokens ?? 0) + (message.usage.cache_read_input_tokens ?? 0) + (message.usage.input_tokens ?? 0) + (message.usage.output_tokens ?? 0)
                };
              }
              const finishReason = mapClaudeCodeFinishReason(
                message.subtype
              );
              this.setSessionId(message.session_id);
              if (options.responseFormat?.type === "json" && accumulatedText) {
                const extractedJson = this.handleJsonExtraction(accumulatedText, streamWarnings);
                const jsonTextId = generateId();
                controller.enqueue({
                  type: "text-start",
                  id: jsonTextId
                });
                controller.enqueue({
                  type: "text-delta",
                  id: jsonTextId,
                  delta: extractedJson
                });
                controller.enqueue({
                  type: "text-end",
                  id: jsonTextId
                });
              } else if (textPartId) {
                controller.enqueue({
                  type: "text-end",
                  id: textPartId
                });
              }
              finalizeToolCalls();
              const warningsJson = this.serializeWarningsForMetadata(streamWarnings);
              controller.enqueue({
                type: "finish",
                finishReason,
                usage,
                providerMetadata: {
                  "claude-code": {
                    sessionId: message.session_id,
                    ...message.total_cost_usd !== void 0 && {
                      costUsd: message.total_cost_usd
                    },
                    ...message.duration_ms !== void 0 && { durationMs: message.duration_ms },
                    ...rawUsage !== void 0 && { rawUsage },
                    // JSON validation warnings are collected during streaming and included
                    // in providerMetadata since the AI SDK's finish event doesn't support
                    // a top-level warnings field (unlike stream-start which was already emitted)
                    ...streamWarnings.length > 0 && {
                      warnings: warningsJson
                    }
                  }
                }
              });
            } else if (message.type === "system" && message.subtype === "init") {
              this.setSessionId(message.session_id);
              controller.enqueue({
                type: "response-metadata",
                id: message.session_id,
                timestamp: /* @__PURE__ */ new Date(),
                modelId: this.modelId
              });
            }
          }
          finalizeToolCalls();
          controller.close();
        } catch (error) {
          done();
          if (isClaudeCodeTruncationError(error, accumulatedText)) {
            const truncationWarning = {
              type: "other",
              message: CLAUDE_CODE_TRUNCATION_WARNING
            };
            streamWarnings.push(truncationWarning);
            const emitJsonText = () => {
              const extractedJson = this.handleJsonExtraction(accumulatedText, streamWarnings);
              const jsonTextId = generateId();
              controller.enqueue({
                type: "text-start",
                id: jsonTextId
              });
              controller.enqueue({
                type: "text-delta",
                id: jsonTextId,
                delta: extractedJson
              });
              controller.enqueue({
                type: "text-end",
                id: jsonTextId
              });
            };
            if (options.responseFormat?.type === "json") {
              emitJsonText();
            } else if (textPartId) {
              controller.enqueue({
                type: "text-end",
                id: textPartId
              });
            } else if (accumulatedText) {
              const fallbackTextId = generateId();
              controller.enqueue({
                type: "text-start",
                id: fallbackTextId
              });
              controller.enqueue({
                type: "text-delta",
                id: fallbackTextId,
                delta: accumulatedText
              });
              controller.enqueue({
                type: "text-end",
                id: fallbackTextId
              });
            }
            finalizeToolCalls();
            const warningsJson = this.serializeWarningsForMetadata(streamWarnings);
            controller.enqueue({
              type: "finish",
              finishReason: "length",
              usage,
              providerMetadata: {
                "claude-code": {
                  ...this.sessionId !== void 0 && { sessionId: this.sessionId },
                  truncated: true,
                  ...streamWarnings.length > 0 && {
                    warnings: warningsJson
                  }
                }
              }
            });
            controller.close();
            return;
          }
          finalizeToolCalls();
          let errorToEmit;
          if (isAbortError(error)) {
            errorToEmit = options.abortSignal?.aborted ? options.abortSignal.reason : error;
          } else {
            errorToEmit = this.handleClaudeCodeError(error, messagesPrompt);
          }
          controller.enqueue({
            type: "error",
            error: errorToEmit
          });
          controller.close();
        } finally {
          if (options.abortSignal && abortListener) {
            options.abortSignal.removeEventListener("abort", abortListener);
          }
        }
      },
      cancel: () => {
        if (options.abortSignal && abortListener) {
          options.abortSignal.removeEventListener("abort", abortListener);
        }
      }
    });
    return {
      stream,
      request: {
        body: messagesPrompt
      }
    };
  }
  serializeWarningsForMetadata(warnings) {
    const result = warnings.map((w) => {
      const base = { type: w.type };
      if ("message" in w) {
        const m = w.message;
        if (m !== void 0) base.message = String(m);
      }
      if (w.type === "unsupported-setting") {
        const setting = w.setting;
        if (setting !== void 0) base.setting = String(setting);
        if ("details" in w) {
          const d = w.details;
          if (d !== void 0) base.details = String(d);
        }
      }
      return base;
    });
    return result;
  }
};

// src/claude-code-provider.ts
function createClaudeCode(options = {}) {
  const logger = getLogger(options.defaultSettings?.logger);
  if (options.defaultSettings) {
    const validation = validateSettings(options.defaultSettings);
    if (!validation.valid) {
      throw new Error(`Invalid default settings: ${validation.errors.join(", ")}`);
    }
    if (validation.warnings.length > 0) {
      validation.warnings.forEach((warning) => logger.warn(`Claude Code Provider: ${warning}`));
    }
  }
  const createModel = (modelId, settings = {}) => {
    const mergedSettings = {
      ...options.defaultSettings,
      ...settings
    };
    const validation = validateSettings(mergedSettings);
    if (!validation.valid) {
      throw new Error(`Invalid settings: ${validation.errors.join(", ")}`);
    }
    return new ClaudeCodeLanguageModel({
      id: modelId,
      settings: mergedSettings,
      settingsValidationWarnings: validation.warnings
    });
  };
  const provider = function(modelId, settings) {
    if (new.target) {
      throw new Error("The Claude Code model function cannot be called with the new keyword.");
    }
    return createModel(modelId, settings);
  };
  provider.languageModel = createModel;
  provider.chat = createModel;
  provider.textEmbeddingModel = (modelId) => {
    throw new NoSuchModelError2({
      modelId,
      modelType: "textEmbeddingModel"
    });
  };
  provider.imageModel = (modelId) => {
    throw new NoSuchModelError2({
      modelId,
      modelType: "imageModel"
    });
  };
  return provider;
}
var claudeCode = createClaudeCode();

// src/index.ts
import { createSdkMcpServer as createSdkMcpServer2, tool as tool2 } from "@anthropic-ai/claude-agent-sdk";

// src/mcp-helpers.ts
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import "zod";
function createCustomMcpServer(config) {
  const defs = Object.entries(config.tools).map(
    ([name, def]) => tool(
      name,
      def.description,
      def.inputSchema.shape,
      (args, extra) => def.handler(args, extra)
    )
  );
  return createSdkMcpServer({ name: config.name, version: config.version, tools: defs });
}
export {
  ClaudeCodeLanguageModel,
  claudeCode,
  createAPICallError,
  createAuthenticationError,
  createClaudeCode,
  createCustomMcpServer,
  createSdkMcpServer2 as createSdkMcpServer,
  createTimeoutError,
  getErrorMetadata,
  isAuthenticationError,
  isTimeoutError,
  tool2 as tool
};
//# sourceMappingURL=index.js.map