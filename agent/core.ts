// @ts-nocheck
import { generateText, tool } from 'ai'
import { openai } from '@ai-sdk/openai'
import { groq } from '@ai-sdk/groq'
import { z } from 'zod'
import { getHistory, addMessage, getFacts, saveFact } from '@/lib/memory'
import { readFileSync } from 'fs'
import path from 'path'

// Define context type
interface AgentContext {
  userId: number
  chatId: number
}

// Function to create tools with context access
const createTools = (ctx: AgentContext) => ({
// @ts-ignore
  search: tool({
    description: 'Search the web for real-time information.',
    parameters: z.object({ query: z.string() }) as any,
    execute: async ({ query }: { query: string }) => {
      // Using DuckDuckGo Search (Keyless)
      try {
        const { search } = require('duck-duck-scrape');
        const results = await search(query, { safeSearch: 0 });
        
        if (!results.results || results.results.length === 0) {
          return 'No results found.';
        }

        return JSON.stringify(results.results.slice(0, 3).map((r: any) => ({
          title: r.title,
          url: r.url,
          content: r.description // duck-duck-scrape usually provides a description snippet
        })), null, 2);
      } catch (e) {
        console.error('Search failed:', e);
        return 'Search failed. The web might be blocking us temporarily.';
      }
    },
  }),
// @ts-ignore
  save_memory: tool({
    description: 'Save a permanent fact about the user or their preferences.',
    parameters: z.object({ fact: z.string() }) as any,
    execute: async ({ fact }: { fact: string }) => {
      await saveFact(ctx.userId, fact)
      return `Saved fact: "${fact}"`
    },
  }),
// @ts-ignore
  save_skill: tool({
    description: 'Save a new skill or procedure for future use. Use this when the user teaches you how to do something new.',
    parameters: z.object({
      name: z.string().describe('The name of the skill (e.g. "morning_routine", "check_flights")'),
      instructions: z.string().describe('Step-by-step instructions on how to perform the task.')
    }) as any,
    execute: async ({ name, instructions }: { name: string, instructions: string }) => {
      // We use Redis hash to store skills
      await saveFact(ctx.userId, `Skill: ${name} - ${instructions}`) // Storing as fact for now to keep it simple
      return `Skill "${name}" saved successfully via adding to memory.`
    }
  }),
// @ts-ignore
  retrieve_skill: tool({
    description: 'Retrieve instructions for a specific skill.',
    parameters: z.object({ name: z.string() }) as any,
    execute: async ({ name }: { name: string }) => {
      return `(Skill retrieval is implicit via memory context. If you need specific details, ask the user or search memory for "Skill: ${name}")`
    }
  }),
  // @ts-ignore
  browse: tool({
    description: 'Visit a webpage and return its content. Use this when search is not enough.',
    parameters: z.object({ url: z.string() }) as any,
    execute: async ({ url }: { url: string }) => {
      // Note: Browsing on serverless is complex. This is a placeholder for `agent-browser` or Puppeteer.
      // Implementing full Puppeteer here requires heavy setup. For "Lite", we recommend using a service like Tavily Extract or similar.
      // However, if deployed, we can try basic fetch first.
      try {
        const response = await fetch(url);
        const text = await response.text();
        return text.substring(0, 2000) + '... (truncated)';
      } catch (e) {
        return 'Failed to browse page.';
      }
    }
  })
})

export async function runAgent(message: string, chatId: number, userId: number = chatId) {
  // 1. Load Context & Memory
  const history = await getHistory(chatId)
  const facts = await getFacts(userId)
  
  // 2. Load Personality
  const soulPath = path.join(process.cwd(), 'personalities', 'SOUL.md')
  const soulContent = readFileSync(soulPath, 'utf-8')
  
  // 3. Construct System Prompt
  const systemPrompt = `
${soulContent}

# USER CONTEXT
- User ID: ${userId}
- Known Facts:
${facts.length > 0 ? facts.map(f => `- ${f}`).join('\n') : '(None yet)'}

# CURRENT MISSION
You are responding to a message on Telegram.
Be concise. Use tools if necessary.
`

  // 4. Update History (User Message)
  await addMessage(chatId, 'user', message)

  // 5. Run AI
  const modelToUse = process.env.GROQ_API_KEY 
    ? groq('llama-3.3-70b-versatile') 
    : openai('gpt-4o')

  console.log(`Using model: ${process.env.GROQ_API_KEY ? 'Groq Llama 3' : 'OpenAI GPT-4o'}`)

  const result = await generateText({
    model: modelToUse, // Or other model
    system: systemPrompt,
    tools: createTools({ userId, chatId }),
    // @ts-ignore
    maxSteps: 5, // Allow multi-step reasoning
    messages: [
      ...history.map((h: any) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ]
  })

  // 6. Update History (Assistant Response)
  await addMessage(chatId, 'assistant', result.text)

  return result.text
}
