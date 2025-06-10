#!/usr/bin/env tsx

/**
 * Interactive Object Generation CLI
 * 
 * This example provides an interactive command-line tool
 * for experimenting with object generation.
 */

import { createClaudeCode } from '../src/index.js';
import { generateObject, streamObject } from 'ai';
import { z } from 'zod';
import * as readline from 'readline';

const claudeCode = createClaudeCode();

// Pre-defined schemas for quick testing
const SCHEMAS = {
  person: z.object({
    name: z.string(),
    age: z.number(),
    email: z.string().email(),
    bio: z.string(),
  }),
  
  product: z.object({
    name: z.string(),
    price: z.number(),
    description: z.string(),
    inStock: z.boolean(),
    tags: z.array(z.string()),
  }),
  
  todo: z.object({
    id: z.string(),
    title: z.string(),
    completed: z.boolean(),
    priority: z.enum(['low', 'medium', 'high']),
    dueDate: z.string().optional(),
  }),
  
  event: z.object({
    name: z.string(),
    date: z.string(),
    location: z.object({
      venue: z.string(),
      address: z.string(),
      capacity: z.number(),
    }),
    attendees: z.number(),
    tags: z.array(z.string()),
  }),
  
  article: z.object({
    title: z.string(),
    author: z.string(),
    content: z.string(),
    publishedAt: z.string(),
    tags: z.array(z.string()),
    readingTime: z.number(),
  }),
};

// CLI interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise(resolve => rl.question(prompt, resolve));
}

function clearScreen() {
  console.clear();
}

async function displayMenu() {
  console.log('=== Claude Code Object Generation Interactive CLI ===\n');
  console.log('Choose an option:\n');
  console.log('1. Quick generation (pre-defined schemas)');
  console.log('2. Custom schema generation');
  console.log('3. Streaming demo');
  console.log('4. Batch generation');
  console.log('5. Export generated objects');
  console.log('6. Exit\n');
}

async function quickGeneration() {
  clearScreen();
  console.log('📋 Quick Generation\n');
  console.log('Available schemas:');
  Object.keys(SCHEMAS).forEach((key, index) => {
    console.log(`${index + 1}. ${key}`);
  });
  console.log();
  
  const choice = await question('Select a schema (number): ');
  const schemaKeys = Object.keys(SCHEMAS);
  const selectedKey = schemaKeys[parseInt(choice) - 1];
  
  if (!selectedKey) {
    console.log('Invalid selection');
    return;
  }
  
  const prompt = await question(`\nEnter prompt for ${selectedKey}: `);
  
  console.log('\n⏳ Generating...\n');
  
  try {
    const { object, usage } = await generateObject({
      model: claudeCode('sonnet'),
      schema: SCHEMAS[selectedKey as keyof typeof SCHEMAS],
      prompt,
    });
    
    console.log('✅ Generated object:');
    console.log(JSON.stringify(object, null, 2));
    console.log(`\n📊 Tokens used: ${usage.totalTokens}`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
  
  await question('\nPress Enter to continue...');
}

async function customSchemaGeneration() {
  clearScreen();
  console.log('🛠️  Custom Schema Generation\n');
  console.log('Enter your Zod schema code (or "example" for a template):');
  console.log('Type "done" on a new line when finished.\n');
  
  let schemaCode = '';
  let line = await question('');
  
  if (line === 'example') {
    schemaCode = `z.object({
  user: z.object({
    id: z.string().uuid(),
    username: z.string().min(3).max(20),
    profile: z.object({
      bio: z.string().max(200),
      interests: z.array(z.string()),
    }),
  }),
})`;
    console.log('\nExample schema:');
    console.log(schemaCode);
    console.log('\nUsing this schema...\n');
  } else {
    while (line !== 'done') {
      schemaCode += line + '\n';
      line = await question('');
    }
  }
  
  const prompt = await question('\nEnter generation prompt: ');
  
  try {
    // Note: In a real implementation, you'd need to safely evaluate the schema
    console.log('\n⚠️  Note: Custom schema evaluation is simplified for this demo');
    console.log('In production, use a safe schema parser\n');
    
    // For demo, we'll use a simple schema
    const schema = z.object({
      generated: z.any(),
    });
    
    const { object } = await generateObject({
      model: claudeCode('sonnet'),
      schema,
      prompt: `Generate JSON matching this structure: ${schemaCode}\n\n${prompt}`,
    });
    
    console.log('✅ Generated:');
    console.log(JSON.stringify(object, null, 2));
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
  
  await question('\nPress Enter to continue...');
}

async function streamingDemo() {
  clearScreen();
  console.log('🌊 Streaming Demo\n');
  
  const schema = z.object({
    story: z.object({
      title: z.string(),
      genre: z.string(),
      characters: z.array(z.object({
        name: z.string(),
        role: z.string(),
      })),
      chapters: z.array(z.object({
        number: z.number(),
        title: z.string(),
        summary: z.string(),
      })),
    }),
  });
  
  const prompt = await question('Describe the story you want: ');
  
  console.log('\n📖 Generating story...\n');
  
  try {
    const { partialObjectStream } = await streamObject({
      model: claudeCode('sonnet'),
      schema,
      prompt: `Generate a story outline: ${prompt}`,
    });
    
    let lastUpdate = Date.now();
    
    for await (const partialObject of partialObjectStream) {
      if (Date.now() - lastUpdate > 500) { // Update every 500ms
        clearScreen();
        console.log('🌊 Streaming Demo - Generating...\n');
        console.log(JSON.stringify(partialObject, null, 2));
        lastUpdate = Date.now();
      }
    }
    
    console.log('\n✅ Generation complete!');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
  
  await question('\nPress Enter to continue...');
}

async function batchGeneration() {
  clearScreen();
  console.log('📦 Batch Generation\n');
  
  const count = parseInt(await question('How many objects to generate? '));
  const schemaChoice = await question('Schema type (person/product/todo): ');
  
  if (!SCHEMAS[schemaChoice as keyof typeof SCHEMAS]) {
    console.log('Invalid schema type');
    return;
  }
  
  const basePrompt = await question('Base prompt (will be numbered): ');
  
  console.log(`\n⏳ Generating ${count} objects...\n`);
  
  const results = [];
  const startTime = Date.now();
  
  for (let i = 1; i <= count; i++) {
    try {
      process.stdout.write(`Generating ${i}/${count}...`);
      
      const { object } = await generateObject({
        model: claudeCode('sonnet'),
        schema: SCHEMAS[schemaChoice as keyof typeof SCHEMAS],
        prompt: `${basePrompt} #${i}`,
      });
      
      results.push(object);
      process.stdout.write(' ✓\n');
    } catch (error) {
      process.stdout.write(' ✗\n');
    }
  }
  
  const duration = Date.now() - startTime;
  console.log(`\n✅ Generated ${results.length}/${count} objects in ${duration}ms`);
  console.log(`Average: ${Math.round(duration / count)}ms per object`);
  
  const save = await question('\nSave results to file? (y/n): ');
  if (save.toLowerCase() === 'y') {
    const filename = `batch-${schemaChoice}-${Date.now()}.json`;
    await Bun.write(filename, JSON.stringify(results, null, 2));
    console.log(`Saved to ${filename}`);
  }
  
  await question('\nPress Enter to continue...');
}

let generatedObjects: any[] = [];

async function exportObjects() {
  clearScreen();
  console.log('💾 Export Generated Objects\n');
  
  if (generatedObjects.length === 0) {
    console.log('No objects have been generated yet.');
    await question('\nPress Enter to continue...');
    return;
  }
  
  console.log(`You have ${generatedObjects.length} generated objects.\n`);
  console.log('Export format:');
  console.log('1. JSON');
  console.log('2. CSV (flat objects only)');
  console.log('3. Pretty-printed JSON\n');
  
  const format = await question('Select format: ');
  const filename = await question('Filename (without extension): ');
  
  try {
    switch (format) {
      case '1':
        await Bun.write(`${filename}.json`, JSON.stringify(generatedObjects));
        console.log(`✅ Exported to ${filename}.json`);
        break;
      case '2':
        // Simple CSV export (would need proper CSV library in production)
        const csv = 'data,\n' + generatedObjects.map(obj => JSON.stringify(obj)).join('\n');
        await Bun.write(`${filename}.csv`, csv);
        console.log(`✅ Exported to ${filename}.csv`);
        break;
      case '3':
        await Bun.write(`${filename}.json`, JSON.stringify(generatedObjects, null, 2));
        console.log(`✅ Exported to ${filename}.json (formatted)`);
        break;
      default:
        console.log('Invalid format');
    }
  } catch (error: any) {
    console.error('❌ Export failed:', error.message);
  }
  
  await question('\nPress Enter to continue...');
}

async function main() {
  console.log('🚀 Starting Claude Code Object Generation CLI...\n');
  
  let running = true;
  
  while (running) {
    clearScreen();
    await displayMenu();
    
    const choice = await question('Your choice: ');
    
    switch (choice) {
      case '1':
        await quickGeneration();
        break;
      case '2':
        await customSchemaGeneration();
        break;
      case '3':
        await streamingDemo();
        break;
      case '4':
        await batchGeneration();
        break;
      case '5':
        await exportObjects();
        break;
      case '6':
        running = false;
        break;
      default:
        console.log('Invalid choice');
        await question('Press Enter to continue...');
    }
  }
  
  console.log('\n👋 Thanks for using Claude Code Object Generation CLI!');
  rl.close();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Goodbye!');
  rl.close();
  process.exit(0);
});

main().catch(error => {
  console.error('Fatal error:', error);
  rl.close();
  process.exit(1);
});