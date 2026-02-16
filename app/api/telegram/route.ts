import { NextRequest, NextResponse } from 'next/server'
import { bot } from '@/lib/telegram'
import { runAgent } from '@/agent/core'
import { addMessage } from '@/lib/memory'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const update = await req.json()
    
    const secretToken = req.headers.get('X-Telegram-Bot-Api-Secret-Token')
    if (process.env.TELEGRAM_SECRET_TOKEN && secretToken !== process.env.TELEGRAM_SECRET_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (update.message?.text) {
      const chatId = update.message.chat.id
      const userId = update.message.from?.id || chatId
      const text = update.message.text
      
      if (text === '/reset') {
        const { redis } = require('@/lib/redis')
        await redis.del(`history:${chatId}`)
        await bot.api.sendMessage(chatId, 'Memory wiped. I am tabula rasa.')
        return NextResponse.json({ ok: true })
      }

      if (text === '/facts') {
        const { redis } = require('@/lib/redis')
        const facts = await redis.smembers(`facts:${userId}`)
        await bot.api.sendMessage(chatId, `Creating dump of known facts:\n${facts.join('\n') || '(No facts found)'}`)
        return NextResponse.json({ ok: true })
      }

      console.log(`Received message from ${userId}: ${text}`)

      try {
        await bot.api.sendChatAction(chatId, 'typing')
        const agentResult = await runAgent(text, chatId, userId)
        const responseText = agentResult.text
        
        if (!responseText || responseText.trim() === '') {
          if (agentResult.toolCalls && agentResult.toolCalls.length > 0) {
            const toolNames = agentResult.toolCalls.map((t: any) => t.toolName).join(', ')
            await bot.api.sendMessage(chatId, `(Executed tools: ${toolNames})`)
          } else {
            await bot.api.sendMessage(chatId, '(No response generated)')
          }
        } else {
          await bot.api.sendMessage(chatId, responseText)
        }
      } catch (innerError: any) {
        console.error('Agent execution failed:', innerError)
        const errorMessage = innerError?.message || JSON.stringify(innerError)
        await addMessage(chatId, 'system', `Tool execution failed: ${errorMessage.substring(0, 200)}`)
        await bot.api.sendMessage(chatId, `CRASH DEBUG: ${errorMessage.substring(0, 1000)}`)
      }
    }
    
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Webhook handler error:', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
