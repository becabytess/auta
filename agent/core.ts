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
  save_fact: tool({
    description: 'Save a permanent fact about the user or their preferences. Accepts a single string argument "fact". Handle key-value pairs by formatting them as "Key: Value".',
    parameters: z.object({
      fact: z.string().describe('The fact to remember. If storing a key-value pair, format it as "Key: Value".')
    }) as any,
    execute: async (args: any) => {
      // Robust extraction
      if (!args) return 'Error: No arguments provided.'
      const fact = typeof args === 'string' ? args : (args.fact || args.content || args.text || (Object.keys(args).length > 0 ? JSON.stringify(args) : null));
      
      if (!fact || fact === '{}' || fact === '[]') {
         return 'Error: Empty fact provided. Please provide text.'
      }

      await saveFact(ctx.userId, fact)
      return `Saved fact: "${fact}"`
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
  }),
  // @ts-ignore
  debug_facts: tool({
    description: 'Retrieve and display all known facts for debugging purposes. Only use if explicitly asked by the user to "debug facts" or similar.',
    parameters: z.object({}) as any,
    execute: async () => {
      const { redis } = require('@/lib/redis')
      const rawFacts = await redis.smembers(`facts:${ctx.userId}`)
      const facts = rawFacts.map((f: any) => typeof f === 'object' ? JSON.stringify(f) : f)
      return `Creating dump of known facts:\n${facts.join('\n') || '(No facts found)'}`
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
You are OpenClaw (Lite), an advanced AI assistant.
Your goal is to be helpful, precise, and efficient.

# CORE INSTRUCTIONS
- Use tools whenever necessary.
- When calling a tool, ensure argument names match the schema (e.g. "fact").
- Do NOT call a tool with empty arguments. If you have no data, ask the user.

# MEMORY & LEARNING
- You have access to a persistent memory store (Redis).
- Use 'save_fact' ONLY when the user explicitly asks you to remember something or key information is provided.
- Do NOT call 'save_fact' for every message.

# TOOL USAGE (IMPORTANT)
- To use a tool, output exactly: TOOL: tool_name(arguments)
- arguments can be a JSON object OR a simple string.
- EXAMPLES:
  - TOOL: save_fact("My name is Beka")
  - TOOL: search("latest news about AI")
  - TOOL: save_skill({"name": "morning", "instructions": "drink coffee"})
- Do not explain the tool call, just output it.
- You will receive a TOOL_OUTPUT message with the result.
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

  // 5. Run AI with custom "ReAct" loop for robustness
  const modelToUse = process.env.GROQ_API_KEY 
    ? groq('openai/gpt-oss-120b') 
    : openai('gpt-4o')

  console.log(`Using model: ${process.env.GROQ_API_KEY ? 'Groq (gpt-oss-120b)' : 'OpenAI GPT-4o'}`)

  const tools = createTools({ userId, chatId });
  const searchToolExecute = tools.search.execute;
  const saveFactToolExecute = tools.save_fact.execute;
  const saveSkillToolExecute = tools.save_skill.execute;

  let currentMessages: any[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((h: any) => ({ role: h.role, content: h.content })),
    { role: 'user', content: message }
  ];
  let turns = 0
  const maxTurns = 5
  let check: { text: string; toolCalls: any[]; raw?: any } = { text: '', toolCalls: [] as any[] } // Mock result structure for route.ts

  while (turns < maxTurns) {
    turns++
    const result = await generateText({
      model: modelToUse,
      messages: currentMessages,
      // Disable native tools to force text output
    })

    const response = result.text
    check.text = response

    // Parse TOOL: name(args) - attempt to handle multiline with [\s\S]
    const toolRegex = /TOOL:\s*(\w+)\s*\(([\s\S]*?)\)/g
    const matches = [...response.matchAll(toolRegex)]

    if (matches.length > 0) {
       // Found tool call(s)
       for (const match of matches) {
         const toolName = match[1]
         let argsString = match[2]
         // If generic match captured too much (up to last closing paren?), might be issue. 
         // But non-greedy *? SHOULD stop at first ')'
         // If JSON has ')', it breaks. 
         // Fallback: If JSON parse fails, maybe try to grab more? 
         // Ideally model follows single line instruction.
         
         let args: any = {}
         try {
            // Try to fix loose JSON if needed, or just parse
            argsString = argsString.replace(/'/g, '"') // simple fix
            args = JSON.parse(argsString)
         } catch (e) {
            // Argument likely string literal "..."??
            // If it looks like "...", treat as { fact: "..." } for save_fact?
            if (toolName === 'save_fact') args = { fact: argsString.replace(/^["']|["']$/g, '') }
            else if (toolName === 'search') args = { query: argsString.replace(/^["']|["']$/g, '') }
            else args = { raw: argsString }
         }
         
         check.toolCalls.push({ toolName, args })
         
         // Execute
         let toolResult = ''
         if (toolName === 'save_fact') {
            const f = args.fact || args.raw || JSON.stringify(args)
            toolResult = await saveFactToolExecute({ fact: f })
         } else if (toolName === 'search') {
            const q = args.query || args.raw || 'news'
            toolResult = await searchToolExecute({ query: q })
         } else if (toolName === 'save_skill') {
            toolResult = await saveSkillToolExecute({ name: args.name, instructions: args.instructions })
         } else {
            toolResult = "Tool not found or not implemented in custom ReAct loop."
         }

         // Append tool result to history
         currentMessages.push({ role: 'assistant', content: response })
         currentMessages.push({ role: 'user', content: `TOOL_OUTPUT (${toolName}): ${toolResult}` })
       }
       // Loop continues to generate response to tool output
    } else {
       // No tools, final response
       // Save to history?
       await addMessage(chatId, 'assistant', response)
       check.text = response
       check.raw = { steps: currentMessages } // Fake steps for debug
       return check
    }
  }
  
  return check
  return check
}
