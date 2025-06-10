#!/usr/bin/env tsx

/**
 * Error Handling and Recovery Examples
 * 
 * This example demonstrates robust error handling strategies
 * for object generation with the Claude Code provider.
 * 
 * Topics covered:
 * - Common error scenarios
 * - Retry strategies
 * - Schema simplification
 * - Fallback approaches
 * - Debugging techniques
 */

import { createClaudeCode } from '../src/index.js';
import { generateObject } from 'ai';
import { z } from 'zod';

const claudeCode = createClaudeCode();

console.log('=== Claude Code: Error Handling & Recovery ===\n');

// Example 1: Basic retry with exponential backoff
async function example1_retryWithBackoff() {
  console.log('1️⃣  Retry with Exponential Backoff\n');
  
  const schema = z.object({
    transaction: z.object({
      id: z.string().uuid(),
      amount: z.number().positive(),
      currency: z.string().length(3),
      timestamp: z.string().datetime(),
    }),
  });

  async function generateWithRetry(maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${maxRetries}...`);
        
        const { object } = await generateObject({
          model: claudeCode('sonnet'),
          schema,
          prompt: 'Generate a financial transaction.',
        });
        
        console.log('✅ Success!');
        return object;
      } catch (error: any) {
        console.log(`❌ Attempt ${attempt} failed: ${error.message}`);
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
  }

  try {
    const result = await generateWithRetry();
    console.log('Final result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('Failed after all retries');
  }
  console.log();
}

// Example 2: Schema simplification on failure
async function example2_schemaSimplification() {
  console.log('2️⃣  Progressive Schema Simplification\n');
  
  // Complex schema that might fail
  const complexSchema = z.object({
    report: z.object({
      id: z.string().uuid(),
      title: z.string().min(10).max(100),
      date: z.string().datetime(),
      metrics: z.object({
        revenue: z.number().positive().multipleOf(0.01),
        growth: z.number().min(-100).max(1000),
        efficiency: z.number().min(0).max(100),
      }),
      segments: z.array(z.object({
        name: z.string(),
        value: z.number(),
        percentage: z.number().min(0).max(100),
      })).length(5),
    }),
  });

  // Simplified fallback schema
  const simpleSchema = z.object({
    report: z.object({
      title: z.string(),
      revenue: z.number(),
      growth: z.number(),
    }),
  });

  console.log('Trying complex schema first...');
  try {
    const { object } = await generateObject({
      model: claudeCode('sonnet'),
      schema: complexSchema,
      prompt: 'Generate a quarterly business report with exactly 5 segments.',
    });
    console.log('✅ Complex schema succeeded:');
    console.log(JSON.stringify(object, null, 2));
  } catch (error: any) {
    console.log(`❌ Complex schema failed: ${error.message}`);
    console.log('\n📉 Falling back to simplified schema...');
    
    try {
      const { object } = await generateObject({
        model: claudeCode('sonnet'),
        schema: simpleSchema,
        prompt: 'Generate a basic quarterly business report.',
      });
      console.log('✅ Simple schema succeeded:');
      console.log(JSON.stringify(object, null, 2));
    } catch (fallbackError) {
      console.log('❌ Even simple schema failed:', fallbackError);
    }
  }
  console.log();
}

// Example 3: Handling validation errors
async function example3_validationErrorHandling() {
  console.log('3️⃣  Validation Error Recovery\n');
  
  const strictSchema = z.object({
    user: z.object({
      email: z.string().email(),
      age: z.number().int().min(18).max(120),
      website: z.string().url(),
      phone: z.string().regex(/^\+[1-9]\d{1,14}$/),
    }),
  });

  // Custom error handler with helpful messages
  async function generateWithValidation(prompt: string) {
    try {
      const { object } = await generateObject({
        model: claudeCode('sonnet'),
        schema: strictSchema,
        prompt,
      });
      return object;
    } catch (error: any) {
      if (error.name === 'ZodError') {
        console.log('❌ Validation failed. Issues:');
        error.errors.forEach((err: any) => {
          console.log(`  - ${err.path.join('.')}: ${err.message}`);
        });
        
        // Try with more specific prompt
        console.log('\n🔄 Retrying with detailed instructions...');
        const detailedPrompt = `${prompt}
        
IMPORTANT requirements:
- Email must be valid (e.g., user@example.com)
- Age must be 18-120
- Website must include http:// or https://
- Phone must be international format starting with +`;
        
        const { object } = await generateObject({
          model: claudeCode('sonnet'),
          schema: strictSchema,
          prompt: detailedPrompt,
        });
        return object;
      }
      throw error;
    }
  }

  try {
    const result = await generateWithValidation('Generate a user profile for an adult software developer.');
    console.log('✅ Generated valid user:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('❌ Failed to generate valid data:', error);
  }
  console.log();
}

// Example 4: Timeout and cancellation handling
async function example4_timeoutHandling() {
  console.log('4️⃣  Timeout and Cancellation Handling\n');
  
  const largeSchema = z.object({
    dataset: z.object({
      entries: z.array(z.object({
        id: z.string(),
        data: z.string(),
        metadata: z.object({
          created: z.string(),
          tags: z.array(z.string()),
        }),
      })).min(100), // Large array that might timeout
    }),
  });

  // Create provider with custom timeout
  const fastClaude = createClaudeCode({ timeoutMs: 5000 }); // 5 second timeout
  
  console.log('Attempting generation with 5s timeout...');
  const abortController = new AbortController();
  
  // Set up timeout handler
  const timeoutId = setTimeout(() => {
    console.log('⏱️  Timeout reached, cancelling...');
    abortController.abort();
  }, 5000);

  try {
    const { object } = await generateObject({
      model: fastClaude('sonnet'),
      schema: largeSchema,
      prompt: 'Generate a dataset with 100 entries.',
      abortSignal: abortController.signal,
    });
    
    clearTimeout(timeoutId);
    console.log('✅ Completed within timeout');
    console.log(`Generated ${object.dataset.entries.length} entries`);
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.log('❌ Generation cancelled due to timeout');
      console.log('💡 Consider: Using smaller schemas or longer timeouts');
    } else {
      console.log('❌ Generation failed:', error.message);
    }
  }
  console.log();
}

// Example 5: Debug mode for troubleshooting
async function example5_debugMode() {
  console.log('5️⃣  Debug Mode for Troubleshooting\n');
  
  const schema = z.object({
    analysis: z.object({
      sentiment: z.enum(['positive', 'negative', 'neutral']),
      confidence: z.number().min(0).max(1),
      keywords: z.array(z.string()).min(3).max(10),
    }),
  });

  // Debug wrapper that logs detailed information
  async function generateWithDebug(prompt: string) {
    console.log('🔍 DEBUG: Starting generation');
    console.log('📝 Prompt:', prompt);
    console.log('📋 Schema:', JSON.stringify(schema.shape, null, 2));
    
    const startTime = Date.now();
    
    try {
      const { object, usage, warnings } = await generateObject({
        model: claudeCode('sonnet'),
        schema,
        prompt,
        // @ts-ignore - accessing experimental features
        experimental_telemetry: true,
      });
      
      const duration = Date.now() - startTime;
      
      console.log('✅ SUCCESS');
      console.log(`⏱️  Duration: ${duration}ms`);
      console.log(`📊 Tokens: ${usage.totalTokens} (prompt: ${usage.promptTokens}, completion: ${usage.completionTokens})`);
      if (warnings?.length) {
        console.log('⚠️  Warnings:', warnings);
      }
      console.log('📦 Result:', JSON.stringify(object, null, 2));
      
      return object;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      console.log('❌ FAILED');
      console.log(`⏱️  Duration: ${duration}ms`);
      console.log(`🚨 Error Type: ${error.constructor.name}`);
      console.log(`📝 Error Message: ${error.message}`);
      if (error.cause) {
        console.log(`🔗 Cause:`, error.cause);
      }
      
      throw error;
    }
  }

  try {
    await generateWithDebug('Analyze this text: "This product exceeded my expectations! Highly recommend."');
  } catch (error) {
    console.log('\n💡 Debug info can help identify issues with prompts or schemas');
  }
  console.log();
}

// Example 6: Fallback strategies
async function example6_fallbackStrategies() {
  console.log('6️⃣  Multiple Fallback Strategies\n');
  
  // Strategy 1: Try different models
  async function tryDifferentModels(schema: z.ZodSchema, prompt: string) {
    const models = ['opus', 'sonnet'] as const;
    
    for (const model of models) {
      try {
        console.log(`Trying ${model}...`);
        const { object } = await generateObject({
          model: claudeCode(model),
          schema,
          prompt,
        });
        console.log(`✅ ${model} succeeded`);
        return { object, model };
      } catch (error) {
        console.log(`❌ ${model} failed`);
      }
    }
    throw new Error('All models failed');
  }

  // Strategy 2: Decompose complex generation
  async function decomposeGeneration() {
    console.log('\n🔀 Trying decomposed generation...');
    
    // Instead of generating everything at once, break it down
    const nameResult = await generateObject({
      model: claudeCode('sonnet'),
      schema: z.object({ name: z.string() }),
      prompt: 'Generate a company name for a tech startup.',
    });

    const detailsResult = await generateObject({
      model: claudeCode('sonnet'),
      schema: z.object({ 
        description: z.string(),
        founded: z.number(),
      }),
      prompt: `Generate details for the company "${nameResult.object.name}".`,
    });

    return {
      company: {
        ...nameResult.object,
        ...detailsResult.object,
      },
    };
  }

  // Try strategies
  const schema = z.object({
    company: z.object({
      name: z.string(),
      description: z.string(),
      founded: z.number(),
    }),
  });

  try {
    // First try direct generation
    console.log('Strategy 1: Direct generation');
    const direct = await generateObject({
      model: claudeCode('sonnet'),
      schema,
      prompt: 'Generate a tech startup company.',
    });
    console.log('✅ Direct generation worked:', direct.object);
  } catch {
    console.log('❌ Direct generation failed');
    
    // Try decomposition
    const decomposed = await decomposeGeneration();
    console.log('✅ Decomposed generation worked:', decomposed);
  }
  console.log();
}

// Main execution
async function main() {
  try {
    await example1_retryWithBackoff();
    await example2_schemaSimplification();
    await example3_validationErrorHandling();
    await example4_timeoutHandling();
    await example5_debugMode();
    await example6_fallbackStrategies();
    
    console.log('✅ All error handling examples completed!');
    console.log('\n🛡️  Best practices for robust object generation:');
    console.log('1. Implement retry logic with backoff');
    console.log('2. Have simplified fallback schemas');
    console.log('3. Provide clear validation error messages');
    console.log('4. Set appropriate timeouts');
    console.log('5. Use debug logging for troubleshooting');
    console.log('6. Consider decomposition for complex objects');
    console.log('7. Test with different models if needed');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main().catch(console.error);