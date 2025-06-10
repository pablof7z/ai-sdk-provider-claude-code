#!/usr/bin/env tsx

/**
 * Streaming Object Generation Examples
 * 
 * This example demonstrates real-time streaming object generation
 * with the Claude Code provider.
 * 
 * Topics covered:
 * - Basic streaming with partial objects
 * - Progress tracking during generation
 * - Handling large object streams
 * - Stream interruption and cancellation
 * - Performance considerations
 */

import { createClaudeCode } from '../src/index.js';
import { streamObject } from 'ai';
import { z } from 'zod';

const claudeCode = createClaudeCode();

console.log('=== Claude Code: Streaming Object Generation ===\n');

// Example 1: Basic streaming with progress
async function example1_basicStreaming() {
  console.log('1️⃣  Basic Streaming with Progress Tracking\n');
  
  const articleSchema = z.object({
    title: z.string(),
    author: z.string(),
    publishDate: z.string(),
    summary: z.string(),
    sections: z.array(z.object({
      heading: z.string(),
      content: z.string(),
    })),
    tags: z.array(z.string()),
  });

  console.log('Generating article...');
  const startTime = Date.now();
  
  const { partialObjectStream, object } = await streamObject({
    model: claudeCode('sonnet'),
    schema: articleSchema,
    prompt: 'Generate a technical article about WebAssembly with 3 sections.',
  });

  // Track progress
  let updateCount = 0;
  let lastProgress = '';
  
  for await (const partialObject of partialObjectStream) {
    updateCount++;
    
    // Show progress indicators
    const progress = [];
    if (partialObject.title) progress.push('✓ Title');
    if (partialObject.author) progress.push('✓ Author');
    if (partialObject.summary) progress.push('✓ Summary');
    if (partialObject.sections?.length) progress.push(`✓ ${partialObject.sections.length} sections`);
    if (partialObject.tags?.length) progress.push(`✓ ${partialObject.tags.length} tags`);
    
    const currentProgress = progress.join(' | ');
    if (currentProgress !== lastProgress) {
      console.log(`Progress: ${currentProgress}`);
      lastProgress = currentProgress;
    }
  }

  const finalObject = await object;
  const duration = Date.now() - startTime;
  
  console.log(`\nCompleted in ${duration}ms with ${updateCount} updates`);
  console.log('Final article:', JSON.stringify(finalObject, null, 2));
  console.log();
}

// Example 2: Streaming large datasets
async function example2_largeDatasetStreaming() {
  console.log('2️⃣  Streaming Large Dataset Generation\n');
  
  const datasetSchema = z.object({
    dataset: z.object({
      name: z.string(),
      description: z.string(),
      metadata: z.object({
        recordCount: z.number(),
        generatedAt: z.string(),
        version: z.string(),
      }),
      records: z.array(z.object({
        id: z.string(),
        timestamp: z.string(),
        metrics: z.object({
          cpu: z.number(),
          memory: z.number(),
          disk: z.number(),
          network: z.number(),
        }),
        status: z.string(),
        alerts: z.array(z.string()).optional(),
      })),
    }),
  });

  console.log('Streaming large monitoring dataset...');
  
  const { partialObjectStream, object } = await streamObject({
    model: claudeCode('sonnet'),
    schema: datasetSchema,
    prompt: 'Generate a monitoring dataset with 10 server metrics records showing various performance levels and some alerts.',
  });

  // Show streaming progress for large arrays
  let recordCount = 0;
  let metadataReceived = false;
  
  for await (const partialObject of partialObjectStream) {
    if (partialObject.dataset?.metadata && !metadataReceived) {
      console.log('📊 Metadata received:', partialObject.dataset.metadata);
      metadataReceived = true;
    }
    
    const currentRecordCount = partialObject.dataset?.records?.length || 0;
    if (currentRecordCount > recordCount) {
      recordCount = currentRecordCount;
      console.log(`📈 Records generated: ${recordCount}`);
    }
  }

  const finalDataset = await object;
  console.log('\nDataset generation complete!');
  console.log(`Total records: ${finalDataset.dataset.records.length}`);
  console.log();
}

// Example 3: Real-time UI updates simulation
async function example3_realtimeUIUpdates() {
  console.log('3️⃣  Simulating Real-time UI Updates\n');
  
  const dashboardSchema = z.object({
    dashboard: z.object({
      title: z.string(),
      lastUpdated: z.string(),
      widgets: z.array(z.object({
        id: z.string(),
        type: z.enum(['chart', 'metric', 'table', 'alert']),
        title: z.string(),
        data: z.any(), // Flexible data structure
        position: z.object({
          x: z.number(),
          y: z.number(),
          width: z.number(),
          height: z.number(),
        }),
      })),
    }),
  });

  console.log('Building dashboard in real-time...\n');
  
  const { partialObjectStream } = await streamObject({
    model: claudeCode('sonnet'),
    schema: dashboardSchema,
    prompt: 'Generate a business analytics dashboard with 6 different widgets showing sales, revenue, and customer metrics.',
  });

  // Simulate UI updates
  const widgetTypes = new Set<string>();
  
  for await (const partialObject of partialObjectStream) {
    // Clear console for animation effect (in real app, this would update UI)
    console.clear();
    console.log('=== Claude Code: Streaming Object Generation ===\n');
    console.log('3️⃣  Simulating Real-time UI Updates\n');
    console.log('Building dashboard in real-time...\n');
    
    if (partialObject.dashboard?.title) {
      console.log(`📊 Dashboard: ${partialObject.dashboard.title}`);
    }
    
    if (partialObject.dashboard?.widgets) {
      console.log(`\n🔧 Widgets (${partialObject.dashboard.widgets.length}):`);
      
      partialObject.dashboard.widgets.forEach((widget, index) => {
        if (widget.type) widgetTypes.add(widget.type);
        console.log(`  ${index + 1}. ${widget.title || 'Loading...'} [${widget.type || '...'}]`);
      });
    }
    
    console.log(`\n📈 Widget types: ${Array.from(widgetTypes).join(', ')}`);
    
    // Small delay to show animation
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n✅ Dashboard complete!\n');
}

// Example 4: Stream with cancellation
async function example4_streamCancellation() {
  console.log('4️⃣  Stream Cancellation Example\n');
  
  const reportSchema = z.object({
    report: z.object({
      title: z.string(),
      executive_summary: z.string(),
      sections: z.array(z.object({
        title: z.string(),
        content: z.string(),
        subsections: z.array(z.object({
          title: z.string(),
          content: z.string(),
        })).optional(),
      })),
      conclusion: z.string(),
      recommendations: z.array(z.string()),
    }),
  });

  console.log('Starting long report generation (will cancel after 3 sections)...\n');
  
  const abortController = new AbortController();
  
  try {
    const { partialObjectStream } = await streamObject({
      model: claudeCode('sonnet'),
      schema: reportSchema,
      prompt: 'Generate a comprehensive 10-section business report about digital transformation.',
      abortSignal: abortController.signal,
    });

    let sectionCount = 0;
    
    for await (const partialObject of partialObjectStream) {
      const currentSections = partialObject.report?.sections?.length || 0;
      
      if (currentSections > sectionCount) {
        sectionCount = currentSections;
        console.log(`📄 Section ${sectionCount}: ${partialObject.report?.sections?.[sectionCount - 1]?.title}`);
        
        // Cancel after 3 sections
        if (sectionCount >= 3) {
          console.log('\n⚠️  Cancelling stream...');
          abortController.abort();
          break;
        }
      }
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('✅ Stream successfully cancelled\n');
    } else {
      throw error;
    }
  }
}

// Example 5: Performance comparison
async function example5_performanceComparison() {
  console.log('5️⃣  Streaming vs Non-streaming Performance\n');
  
  const schema = z.object({
    catalog: z.object({
      products: z.array(z.object({
        id: z.string(),
        name: z.string(),
        price: z.number(),
        category: z.string(),
      })),
    }),
  });

  // Non-streaming timing
  console.log('Generating without streaming...');
  const nonStreamStart = Date.now();
  
  const { object: nonStreamResult } = await streamObject({
    model: claudeCode('sonnet'),
    schema,
    prompt: 'Generate a product catalog with 5 items.',
  });
  
  const nonStreamDuration = Date.now() - nonStreamStart;
  console.log(`Non-streaming duration: ${nonStreamDuration}ms`);
  console.log(`Products generated: ${nonStreamResult.catalog.products.length}`);
  
  // Streaming timing
  console.log('\nGenerating with streaming feedback...');
  const streamStart = Date.now();
  let firstUpdateTime = 0;
  let updateCount = 0;
  
  const { partialObjectStream, object } = await streamObject({
    model: claudeCode('sonnet'),
    schema,
    prompt: 'Generate a product catalog with 5 items.',
  });
  
  for await (const partialObject of partialObjectStream) {
    updateCount++;
    if (updateCount === 1) {
      firstUpdateTime = Date.now() - streamStart;
      console.log(`First update received: ${firstUpdateTime}ms`);
    }
    
    const productCount = partialObject.catalog?.products?.length || 0;
    if (productCount > 0 && updateCount % 5 === 0) {
      console.log(`Products so far: ${productCount}`);
    }
  }
  
  const streamResult = await object;
  const streamDuration = Date.now() - streamStart;
  
  console.log(`\nStreaming complete: ${streamDuration}ms`);
  console.log(`Total updates: ${updateCount}`);
  console.log(`Products generated: ${streamResult.catalog.products.length}`);
  console.log('\n📊 Performance Summary:');
  console.log(`- Time to first feedback: ${firstUpdateTime}ms (streaming only)`);
  console.log(`- Total generation time: Similar for both methods`);
  console.log(`- User experience: Streaming provides immediate feedback\n`);
}

// Main execution
async function main() {
  try {
    await example1_basicStreaming();
    await example2_largeDatasetStreaming();
    await example3_realtimeUIUpdates();
    await example4_streamCancellation();
    await example5_performanceComparison();
    
    console.log('✅ All streaming examples completed!');
    console.log('\n🌊 Key insights:');
    console.log('- Streaming provides immediate user feedback');
    console.log('- Partial objects allow progressive UI updates');
    console.log('- Large datasets benefit from streaming progress');
    console.log('- Streams can be cancelled mid-generation');
    console.log('- Total time is similar, but UX is much better with streaming');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main().catch(console.error);