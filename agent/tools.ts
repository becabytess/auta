import { tool } from 'ai'
import { z } from 'zod'
import { saveFact } from '@/lib/memory'

// Simple Tavily Search Tool
export const searchTool = tool({
  description: 'Search the web for real-time information. Use this for news, facts, or technical documentation.',
  parameters: z.object({
    query: z.string().describe('The search query to execute'),
  }),
  execute: async ({ query }) => {
    if (!process.env.TAVILY_API_KEY) {
      return 'Error: TAVILY_API_KEY is not configured.'
    }
    
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.TAVILY_API_KEY}`
        },
        body: JSON.stringify({
          query,
          search_depth: "basic",
          max_results: 3
        })
      });
      
      const data = await response.json();
      return JSON.stringify(data.results.map((r: any) => ({
        title: r.title,
        url: r.url,
        content: r.content
      })), null, 2);
    } catch (error) {
      console.error('Search failed:', error);
      return 'Search failed due to an API error.';
    }
  },
})

// Memory Tool
export const memoryTool = tool({
  description: 'Save important facts about the user for long-term recall.',
  parameters: z.object({
    fact: z.string().describe('The fact to remember (e.g. "User prefers dark mode", "User lives in NYC")'),
  }),
  execute: async ({ fact }) => {
    // In a real implementation, we'd need userId from context. For now, defaulting to global 'user'.
    // We will solve this by passing context into tools if possible, or using a closure.
    // Since 'tool' definition is static here, we might need to dynamically create tools in core.ts
    // For simplicity, we'll return a placeholder string instruction for the agent to use the specialized function.
    return `Use the built-in memory system. This is a placeholder.` 
  },
})
