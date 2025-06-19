/**
 * Extract JSON from Claude's response using a tolerant parser.
 *
 * The function removes common wrappers such as markdown fences or variable
 * declarations and then attempts to parse the remaining text with
 * `jsonc-parser`.  If valid JSON (or JSONC) can be parsed, it is returned as a
 * string via `JSON.stringify`.  Otherwise the original text is returned.
 *
 * @param text - Raw text which may contain JSON
 * @returns A valid JSON string if extraction succeeds, otherwise the original text
 */
import { parse, type ParseError } from 'jsonc-parser';

export function extractJson(text: string): string {
  let content = text.trim();

  // Strip ```json or ``` fences
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(content);
  if (fenceMatch) {
    content = fenceMatch[1];
  }

  // Strip variable declarations like `const foo =` or `let foo =`
  const varMatch = /^\s*(?:const|let|var)\s+\w+\s*=\s*([\s\S]*)/i.exec(content);
  if (varMatch) {
    content = varMatch[1];
    // Remove trailing semicolon if present
    if (content.trim().endsWith(';')) {
      content = content.trim().slice(0, -1);
    }
  }

  // Find the first opening bracket
  const firstObj = content.indexOf('{');
  const firstArr = content.indexOf('[');
  if (firstObj === -1 && firstArr === -1) {
    return text;
  }
  const start = firstArr === -1 ? firstObj : firstObj === -1 ? firstArr : Math.min(firstObj, firstArr);
  content = content.slice(start);

  // Try to parse the entire string with jsonc-parser
  const tryParse = (value: string): string | undefined => {
    const errors: ParseError[] = [];
    try {
      const result = parse(value, errors, { allowTrailingComma: true });
      if (errors.length === 0) {
        return JSON.stringify(result, null, 2);
      }
    } catch {
      // ignore
    }
    return undefined;
  };

  const parsed = tryParse(content);
  if (parsed !== undefined) {
    return parsed;
  }

  // If parsing the full string failed, progressively truncate until valid
  for (let end = content.length - 1; end > 0; end--) {
    const attempt = tryParse(content.slice(0, end));
    if (attempt !== undefined) {
      return attempt;
    }
  }

  return text;
}