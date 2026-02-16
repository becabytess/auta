import { redis } from './redis'

const HISTORY_LIMIT = 20

export async function getHistory(chatId: number) {
  const key = `history:${chatId}`
  const raw = await redis.lrange(key, 0, -1)
  return raw.map((item) => JSON.parse(item)).reverse()
}

export async function addMessage(chatId: number, role: 'user' | 'assistant' | 'system', content: string) {
  const key = `history:${chatId}`
  const message = JSON.stringify({ role, content, timestamp: Date.now() })
  await redis.lpush(key, message)
  await redis.ltrim(key, 0, HISTORY_LIMIT - 1)
}

export async function getFacts(userId: number) {
  const key = `facts:${userId}`
  return await redis.smembers(key)
}

export async function saveFact(userId: number, fact: string) {
  const key = `facts:${userId}`
  await redis.sadd(key, fact)
}

export async function clearHistory(chatId: number) {
  const key = `history:${chatId}`
  await redis.del(key)
}
