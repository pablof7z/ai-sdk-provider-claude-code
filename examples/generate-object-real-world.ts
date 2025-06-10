#!/usr/bin/env tsx

/**
 * Real-World API Pattern Examples
 * 
 * This example demonstrates practical object generation patterns
 * commonly used in production applications.
 * 
 * Topics covered:
 * - REST API responses
 * - GraphQL-style queries
 * - Webhook payloads
 * - Configuration files
 * - Database schemas
 */

import { createClaudeCode } from '../src/index.js';
import { generateObject } from 'ai';
import { z } from 'zod';

const claudeCode = createClaudeCode();

console.log('=== Claude Code: Real-World API Patterns ===\n');

// Example 1: REST API response with pagination
async function example1_restApiResponse() {
  console.log('1️⃣  REST API Response with Pagination\n');
  
  const apiResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
      users: z.array(z.object({
        id: z.string().uuid(),
        username: z.string(),
        email: z.string().email(),
        profile: z.object({
          firstName: z.string(),
          lastName: z.string(),
          avatar: z.string().url(),
          bio: z.string().max(500).optional(),
          joinedAt: z.string().datetime(),
        }),
        roles: z.array(z.enum(['admin', 'moderator', 'user', 'premium'])),
        stats: z.object({
          posts: z.number().int().min(0),
          followers: z.number().int().min(0),
          following: z.number().int().min(0),
        }),
        isVerified: z.boolean(),
        lastActiveAt: z.string().datetime(),
      })),
      pagination: z.object({
        page: z.number().int().positive(),
        perPage: z.number().int().positive(),
        totalItems: z.number().int().min(0),
        totalPages: z.number().int().positive(),
        hasNext: z.boolean(),
        hasPrev: z.boolean(),
      }),
    }),
    meta: z.object({
      requestId: z.string().uuid(),
      timestamp: z.string().datetime(),
      duration: z.number().describe('Response time in milliseconds'),
      version: z.string().regex(/^v\d+\.\d+\.\d+$/),
    }),
    links: z.object({
      self: z.string().url(),
      next: z.string().url().optional(),
      prev: z.string().url().optional(),
      first: z.string().url(),
      last: z.string().url(),
    }),
  });

  const { object } = await generateObject({
    model: claudeCode('sonnet'),
    schema: apiResponseSchema,
    prompt: 'Generate a REST API response for a user list endpoint. Show page 2 of 5 with 3 users per page. Include varied user types and activity levels.',
  });

  console.log('Generated API response:');
  console.log(JSON.stringify(object, null, 2));
  console.log();
}

// Example 2: GraphQL-style nested query response
async function example2_graphqlResponse() {
  console.log('2️⃣  GraphQL-Style Query Response\n');
  
  const graphqlResponseSchema = z.object({
    data: z.object({
      organization: z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        repositories: z.object({
          edges: z.array(z.object({
            node: z.object({
              id: z.string(),
              name: z.string(),
              description: z.string().nullable(),
              isPrivate: z.boolean(),
              primaryLanguage: z.object({
                name: z.string(),
                color: z.string(),
              }).nullable(),
              stargazerCount: z.number(),
              forkCount: z.number(),
              issues: z.object({
                totalCount: z.number(),
              }),
              pullRequests: z.object({
                totalCount: z.number(),
              }),
              lastCommit: z.object({
                committedDate: z.string().datetime(),
                message: z.string(),
                author: z.object({
                  name: z.string(),
                  email: z.string().email(),
                }),
              }),
            }),
            cursor: z.string(),
          })),
          pageInfo: z.object({
            hasNextPage: z.boolean(),
            hasPreviousPage: z.boolean(),
            startCursor: z.string(),
            endCursor: z.string(),
          }),
          totalCount: z.number(),
        }),
      }),
    }),
    extensions: z.object({
      requestId: z.string(),
      cost: z.object({
        requestedQueryCost: z.number(),
        actualQueryCost: z.number(),
        throttleStatus: z.object({
          maximumAvailable: z.number(),
          currentlyAvailable: z.number(),
          restoreRate: z.number(),
        }),
      }),
    }),
  });

  const { object } = await generateObject({
    model: claudeCode('sonnet'),
    schema: graphqlResponseSchema,
    prompt: 'Generate a GraphQL response for querying an organization\'s repositories. Show a software company with 5 diverse open-source projects.',
  });

  console.log('Generated GraphQL response:');
  console.log(JSON.stringify(object, null, 2));
  console.log();
}

// Example 3: Webhook payload
async function example3_webhookPayload() {
  console.log('3️⃣  Webhook Event Payload\n');
  
  const webhookPayloadSchema = z.object({
    event: z.enum(['payment.succeeded', 'payment.failed', 'subscription.created', 'subscription.cancelled']),
    eventId: z.string().uuid(),
    webhookId: z.string().uuid(),
    timestamp: z.string().datetime(),
    data: z.object({
      object: z.object({
        id: z.string(),
        type: z.enum(['payment', 'subscription']),
        amount: z.number().describe('Amount in cents'),
        currency: z.string().length(3),
        status: z.string(),
        customer: z.object({
          id: z.string(),
          email: z.string().email(),
          name: z.string(),
          metadata: z.record(z.string()).optional(),
        }),
        paymentMethod: z.object({
          type: z.enum(['card', 'bank_transfer', 'paypal']),
          last4: z.string().length(4).optional(),
          brand: z.string().optional(),
          expiryMonth: z.number().min(1).max(12).optional(),
          expiryYear: z.number().optional(),
        }),
        subscription: z.object({
          id: z.string(),
          plan: z.string(),
          interval: z.enum(['monthly', 'yearly']),
          currentPeriodEnd: z.string().datetime(),
        }).optional(),
        metadata: z.record(z.string()),
      }),
      previousAttributes: z.record(z.any()).optional(),
    }),
    signature: z.object({
      timestamp: z.number(),
      scheme: z.string(),
      signature: z.string(),
    }),
  });

  const { object } = await generateObject({
    model: claudeCode('sonnet'),
    schema: webhookPayloadSchema,
    prompt: 'Generate a webhook payload for a successful payment event for a premium subscription.',
  });

  console.log('Generated webhook payload:');
  console.log(JSON.stringify(object, null, 2));
  console.log();
}

// Example 4: Application configuration
async function example4_applicationConfig() {
  console.log('4️⃣  Application Configuration File\n');
  
  const configSchema = z.object({
    app: z.object({
      name: z.string(),
      version: z.string().regex(/^\d+\.\d+\.\d+$/),
      environment: z.enum(['development', 'staging', 'production']),
      debug: z.boolean(),
    }),
    server: z.object({
      host: z.string(),
      port: z.number().int().min(1).max(65535),
      ssl: z.object({
        enabled: z.boolean(),
        cert: z.string().optional(),
        key: z.string().optional(),
      }),
      cors: z.object({
        enabled: z.boolean(),
        origins: z.array(z.string().url()),
        methods: z.array(z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'])),
        credentials: z.boolean(),
      }),
    }),
    database: z.object({
      primary: z.object({
        type: z.enum(['postgres', 'mysql', 'mongodb']),
        host: z.string(),
        port: z.number(),
        name: z.string(),
        user: z.string(),
        ssl: z.boolean(),
        pool: z.object({
          min: z.number().int().min(0),
          max: z.number().int().min(1),
          idleTimeoutMillis: z.number(),
        }),
      }),
      cache: z.object({
        type: z.enum(['redis', 'memcached']),
        host: z.string(),
        port: z.number(),
        ttl: z.number().describe('Default TTL in seconds'),
      }),
    }),
    services: z.object({
      email: z.object({
        provider: z.enum(['sendgrid', 'ses', 'smtp']),
        from: z.string().email(),
        replyTo: z.string().email().optional(),
      }),
      storage: z.object({
        provider: z.enum(['s3', 'gcs', 'azure']),
        bucket: z.string(),
        region: z.string(),
        cdn: z.object({
          enabled: z.boolean(),
          url: z.string().url().optional(),
        }),
      }),
      queue: z.object({
        provider: z.enum(['sqs', 'rabbitmq', 'redis']),
        url: z.string(),
        workers: z.number().int().positive(),
      }),
    }),
    features: z.object({
      rateLimit: z.object({
        enabled: z.boolean(),
        windowMs: z.number(),
        max: z.number(),
      }),
      monitoring: z.object({
        enabled: z.boolean(),
        service: z.enum(['datadog', 'newrelic', 'prometheus']),
        apiKey: z.string().optional(),
      }),
    }),
  });

  const { object } = await generateObject({
    model: claudeCode('sonnet'),
    schema: configSchema,
    prompt: 'Generate a production configuration for a scalable SaaS application using PostgreSQL, Redis, and AWS services.',
  });

  console.log('Generated configuration:');
  console.log(JSON.stringify(object, null, 2));
  console.log();
}

// Example 5: Database schema definition
async function example5_databaseSchema() {
  console.log('5️⃣  Database Schema Definition\n');
  
  const databaseSchemaDefinition = z.object({
    schema: z.object({
      name: z.string(),
      version: z.string(),
      tables: z.array(z.object({
        name: z.string(),
        description: z.string().optional(),
        columns: z.array(z.object({
          name: z.string(),
          type: z.enum(['uuid', 'varchar', 'text', 'integer', 'bigint', 'decimal', 'boolean', 'timestamp', 'json', 'array']),
          length: z.number().optional(),
          nullable: z.boolean(),
          primaryKey: z.boolean().optional(),
          unique: z.boolean().optional(),
          default: z.any().optional(),
          references: z.object({
            table: z.string(),
            column: z.string(),
            onDelete: z.enum(['cascade', 'restrict', 'set null']),
            onUpdate: z.enum(['cascade', 'restrict']),
          }).optional(),
        })),
        indexes: z.array(z.object({
          name: z.string(),
          columns: z.array(z.string()),
          unique: z.boolean(),
          type: z.enum(['btree', 'hash', 'gin', 'gist']).optional(),
        })).optional(),
        constraints: z.array(z.object({
          name: z.string(),
          type: z.enum(['check', 'unique', 'foreign_key']),
          definition: z.string(),
        })).optional(),
      })),
      relationships: z.array(z.object({
        from: z.object({
          table: z.string(),
          column: z.string(),
        }),
        to: z.object({
          table: z.string(),
          column: z.string(),
        }),
        type: z.enum(['one-to-one', 'one-to-many', 'many-to-many']),
        through: z.string().optional().describe('Junction table for many-to-many'),
      })),
    }),
  });

  const { object } = await generateObject({
    model: claudeCode('sonnet'),
    schema: databaseSchemaDefinition,
    prompt: 'Generate a database schema for a blog platform with users, posts, comments, and tags. Include proper relationships and indexes.',
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
    
    console.log('✅ All real-world examples completed!');
    console.log('\n🌍 Patterns demonstrated:');
    console.log('- RESTful API responses with HATEOAS links');
    console.log('- GraphQL nested query structures');
    console.log('- Webhook event payloads with signatures');
    console.log('- Complex application configurations');
    console.log('- Database schema definitions');
    console.log('\n💡 These patterns can be adapted for your specific use cases!');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main().catch(console.error);