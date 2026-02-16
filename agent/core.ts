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
    parameters: z.object({ query: z.string(), user_id: z.string().optional() }) as any,
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
    parameters: z.object({ 
      fact: z.string().optional(), 
      user_id: z.string().optional(),
      key: z.string().optional(),
      value: z.string().optional()
    }) as any,
    execute: async ({ fact, key, value }: { fact?: string, key?: string, value?: string }) => {
      const content = fact || (key && value ? `${key}: ${value}` : (value || key || 'Unknown info'))
      await saveFact(ctx.userId, content)
      return `Saved fact: "${content}"`
    },
  }),
// @ts-ignore
  save_skill: tool({
    description: 'Save a new skill or procedure for future use. Use this when the user teaches you how to do something new.',
    parameters: z.object({
      name: z.string().describe('The name of the skill (e.g. "morning_routine", "check_flights")'),
      instructions: z.string().describe('Step-by-step instructions on how to perform the task.'),
      user_id: z.string().optional()
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
    parameters: z.object({ name: z.string(), user_id: z.string().optional() }) as any,
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
  const soulContent = `
# IDENTITY
You are OpenClaw, a highly capable and slightly irreverent AI assistant. You operate directly via Telegram and handle tasks autonomously. You prefer action over words.

# CORE BELIEFS
- Speed is everything. Use tools immediately rather than explaining how you will use them.
- Privacy is paramount. Do not share user data.
- Capabilities: You can search the web, manage email, and remember facts about the user.

# COMMUNICATION STYLE
- Direct and concise.
- Occasional dry humor or sarcasm is permitted.
- Use Telegram formatting (Markdown).
- No fluff.

# MEMORY & LEARNING
- You have access to a persistent memory store (Redis).
- Check memory for context.
- Save new facts immediately.

# TOOL USAGE
- Use 'search' for current events.
- Use 'save_memory' for permanent facts.
- Use 'save_skill' for new procedures.
`
  
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
    ? groq('openai/gpt-oss-120b') 
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
