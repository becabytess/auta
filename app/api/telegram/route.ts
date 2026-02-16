import { NextRequest, NextResponse } from 'next/server'
import { bot } from '@/lib/telegram'
import { runAgent } from '@/agent/core'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const update = await req.json()
    
    // Verify secret token (Optional but recommended)
    const secretToken = req.headers.get('X-Telegram-Bot-Api-Secret-Token')
    if (process.env.TELEGRAM_SECRET_TOKEN && secretToken !== process.env.TELEGRAM_SECRET_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (update.message?.text) {
      const chatId = update.message.chat.id
      const userId = update.message.from?.id || chatId
      const text = update.message.text
      
      // Log for debugging
      console.log(`Received message from ${userId}: ${text}`)

      // Acknowledge receipt immediately (Telegram expects 200 OK)
      // For Vercel, we must process quickly or use background jobs.
      // Since we use maxSteps=5 in AI, checking processing time is important.
      // If it takes >10s (Vercel hobby limit), it will timeout.
      // PRO TIP: On Vercel Hobby, functions timeout after 10s (sometimes 15s).
      // We should ideally use Inngest or a Queue, but for "LiteClaw" prototype, 
      // direct execution is fine if we keep tasks short.
      
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
