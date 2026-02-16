import { NextRequest, NextResponse } from 'next/server'
import { bot } from '@/lib/telegram'
import { runAgent } from '@/agent/core'

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
      
      console.log(`Received message from ${userId}: ${text}`)

      try {
        await bot.api.sendChatAction(chatId, 'typing')
        const responseText = await runAgent(text, chatId, userId)
        await bot.api.sendMessage(chatId, responseText, { parse_mode: 'Markdown' })
      } catch (innerError) {
        console.error('Agent execution failed:', innerError)
        await bot.api.sendMessage(chatId, 'Error: My brain timed out or crashed.')
      }
    }
    
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Webhook handler error:', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
