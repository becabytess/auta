import { Bot } from 'grammy'

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is not set')
}

export const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN)
