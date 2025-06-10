#!/usr/bin/env tsx

/**
 * Simple Real-World Patterns
 * 
 * This example demonstrates simple, practical patterns
 * for common API and configuration scenarios.
 * 
 * Topics covered:
 * - REST API responses
 * - GraphQL responses
 * - Webhook payloads
 * - Configuration files
 * - Database schemas
 * 
 * Each example is kept simple and focused on one pattern.
 */

import { createClaudeCode } from '../src/index.js';
import { generateObject } from 'ai';
import { z } from 'zod';

const claudeCode = createClaudeCode();

console.log('=== Claude Code: Simple Pattern Examples ===\n');

// Example 1: Simple REST API response
async function example1_restApiResponse() {
  console.log('1️⃣  Simple REST API Response\n');
  
  const apiResponseSchema = z.object({
    success: z.boolean(),
    data: z.array(z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email(),
      role: z.enum(['admin', 'user']),
    })),
    pagination: z.object({
      page: z.number(),
      total: z.number(),
    }),
  });

  const { object } = await generateObject({
    model: claudeCode('sonnet'),
    schema: apiResponseSchema,
    prompt: 'Generate a simple API response with 3 users on page 1 of 2.',
  });

  console.log('Generated API response:');
  console.log(JSON.stringify(object, null, 2));
  console.log();
}

// Example 2: GraphQL-style response
async function example2_graphqlResponse() {
  console.log('2️⃣  Simple GraphQL Response\n');
  
  const graphqlResponseSchema = z.object({
    data: z.object({
      user: z.object({
        id: z.string(),
        name: z.string(),
        posts: z.array(z.object({
          id: z.string(),
          title: z.string(),
          likes: z.number(),
        })),
      }),
    }),
    errors: z.array(z.any()).optional(),
  });

  const { object } = await generateObject({
    model: claudeCode('sonnet'),
    schema: graphqlResponseSchema,
    prompt: 'Generate a GraphQL response for a user with 2 posts.',
  });

  console.log('Generated GraphQL response:');
  console.log(JSON.stringify(object, null, 2));
  console.log();
}

// Example 3: Webhook payload
async function example3_webhookPayload() {
  console.log('3️⃣  Simple Webhook Payload\n');
  
  const webhookPayloadSchema = z.object({
    event: z.enum(['user.created', 'user.updated', 'user.deleted']),
    timestamp: z.string(),
    data: z.object({
      userId: z.string(),
      email: z.string().email(),
      action: z.string(),
    }),
  });

  const { object } = await generateObject({
    model: claudeCode('sonnet'),
    schema: webhookPayloadSchema,
    prompt: 'Generate a webhook payload for a new user signup.',
  });

  console.log('Generated webhook payload:');
  console.log(JSON.stringify(object, null, 2));
  console.log();
}

// Example 4: Application configuration
async function example4_applicationConfig() {
  console.log('4️⃣  Simple App Configuration\n');
  
  const configSchema = z.object({
    app: z.object({
      name: z.string(),
      port: z.number(),
      environment: z.enum(['dev', 'prod']),
    }),
    database: z.object({
      host: z.string(),
      port: z.number(),
      name: z.string(),
    }),
    features: z.object({
      logging: z.boolean(),
      caching: z.boolean(),
    }),
  });

  const { object } = await generateObject({
    model: claudeCode('sonnet'),
    schema: configSchema,
    prompt: 'Generate a simple app configuration for production.',
  });

  console.log('Generated configuration:');
  console.log(JSON.stringify(object, null, 2));
  console.log();
}

// Example 5: Database schema
async function example5_databaseSchema() {
  console.log('5️⃣  Simple Database Schema\n');
  
  const databaseSchema = z.object({
    tables: z.array(z.object({
      name: z.string(),
      columns: z.array(z.object({
        name: z.string(),
        type: z.enum(['text', 'number', 'boolean', 'date']),
        required: z.boolean(),
      })),
    })),
  });

  const { object } = await generateObject({
    model: claudeCode('sonnet'),
    schema: databaseSchema,
    prompt: 'Generate a simple blog database schema with users and posts tables.',
  });

  console.log('Generated database schema:');
  console.log(JSON.stringify(object, null, 2));
  console.log();
}

// Main execution
async function main() {
  try {
    await example1_restApiResponse();
    await example2_graphqlResponse();
    await example3_webhookPayload();
    await example4_applicationConfig();
    await example5_databaseSchema();
    
    console.log('✅ All examples completed!');
    console.log('\n🌍 Simple patterns demonstrated:');
    console.log('- REST API responses');
    console.log('- GraphQL query results');
    console.log('- Webhook payloads');
    console.log('- App configurations');
    console.log('- Database schemas');
    console.log('\n💡 Start with these simple patterns and add complexity as needed!');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main().catch(console.error);