#!/usr/bin/env tsx

import { createClaudeCode } from '../src/index.js';
import { generateObject, streamObject } from 'ai';
import { z } from 'zod';

// Create the provider
const claudeCode = createClaudeCode();

console.log('=== Claude Code Generate Object Example ===\n');

// Example 1: Generate a simple object with schema
async function generateRecipe() {
  console.log('1. Generating a recipe object with schema validation...\n');
  
  const recipeSchema = z.object({
    name: z.string().describe('Name of the recipe'),
    ingredients: z.array(z.object({
      item: z.string(),
      amount: z.string()
    })).describe('List of ingredients with amounts'),
    instructions: z.array(z.string()).describe('Step-by-step cooking instructions'),
    prepTime: z.number().describe('Preparation time in minutes'),
    cookTime: z.number().describe('Cooking time in minutes'),
    servings: z.number().describe('Number of servings')
  });

  try {
    const { object: recipe } = await generateObject({
      model: claudeCode('opus'),
      prompt: 'Generate a detailed recipe for chocolate chip cookies',
      schema: recipeSchema,
    });

    console.log('Generated Recipe:');
    console.log(JSON.stringify(recipe, null, 2));
    console.log('\n');
  } catch (error) {
    console.error('Error generating recipe:', error);
  }
}

// Example 2: Generate a complex nested object
async function generateUserProfile() {
  console.log('2. Generating a user profile with nested data...\n');
  
  const userSchema = z.object({
    id: z.string().describe('Unique user ID'),
    username: z.string().describe('Username'),
    profile: z.object({
      firstName: z.string(),
      lastName: z.string(),
      age: z.number().min(0).max(150),
      email: z.string().email(),
      bio: z.string().describe('Short biography'),
      interests: z.array(z.string()).describe('List of interests'),
      location: z.object({
        city: z.string(),
        country: z.string(),
        timezone: z.string()
      })
    }),
    settings: z.object({
      theme: z.enum(['light', 'dark', 'auto']),
      notifications: z.boolean(),
      language: z.string()
    })
  });

  try {
    const { object: userProfile } = await generateObject({
      model: claudeCode('opus'),
      prompt: 'Generate a complete user profile for a software developer named Alex who loves open source',
      schema: userSchema,
    });

    console.log('Generated User Profile:');
    console.log(JSON.stringify(userProfile, null, 2));
    console.log('\n');
  } catch (error) {
    console.error('Error generating user profile:', error);
  }
}

// Example 3: Stream object generation
async function streamAnalysis() {
  console.log('3. Streaming analysis results...\n');
  
  const analysisSchema = z.object({
    summary: z.string().describe('Brief summary of the analysis'),
    sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']),
    keyPoints: z.array(z.string()).describe('Main points identified'),
    confidence: z.number().min(0).max(1).describe('Confidence score'),
    recommendations: z.array(z.string()).describe('Actionable recommendations')
  });

  try {
    const { partialObjectStream } = await streamObject({
      model: claudeCode('opus'),
      prompt: 'Analyze this product review: "This laptop is amazing! The battery life is incredible, lasting all day. The keyboard feels great to type on, though the trackpad could be more responsive. Overall, excellent value for money."',
      schema: analysisSchema,
    });

    console.log('Streaming analysis results:');
    for await (const partialObject of partialObjectStream) {
      console.clear();
      console.log('=== Claude Code Generate Object Example ===\n');
      console.log('3. Streaming analysis results...\n');
      console.log('Partial result:');
      console.log(JSON.stringify(partialObject, null, 2));
    }
    console.log('\n✓ Streaming complete\n');
  } catch (error) {
    console.error('Error streaming analysis:', error);
  }
}

// Example 4: Generate without strict schema (free-form JSON)
async function generateFreeformJSON() {
  console.log('4. Generating free-form JSON without schema...\n');
  
  try {
    const { object } = await generateObject({
      model: claudeCode('opus'),
      prompt: 'Create a JSON object representing a fictional space mission with crew members, mission objectives, and spacecraft details',
      schema: z.any(), // Allow any valid JSON
    });

    console.log('Generated Space Mission:');
    console.log(JSON.stringify(object, null, 2));
    console.log('\n');
  } catch (error) {
    console.error('Error generating space mission:', error);
  }
}

// Run all examples
async function main() {
  await generateRecipe();
  await generateUserProfile();
  await streamAnalysis();
  await generateFreeformJSON();
  
  console.log('✅ All examples completed!');
}

main().catch(console.error);