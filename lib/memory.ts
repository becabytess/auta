import { redis } from './redis'

const HISTORY_LIMIT = 20

export async function getHistory(chatId: number) {
  const key = `history:${chatId}`
  const raw = await redis.lrange(key, 0, -1)
  return raw.map((item) => {
    try {
      return typeof item === 'string' ? JSON.parse(item) : item
    } catch (e) {
      console.error('Failed to parse history item:', item)
      return null
    }
  }).filter(Boolean).reverse()
}

export async function addMessage(chatId: number, role: 'user' | 'assistant' | 'system', content: string) {
  const key = `history:${chatId}`
  const message = JSON.stringify({ role, content, timestamp: Date.now() })
  await redis.lpush(key, message)
  await redis.ltrim(key, 0, HISTORY_LIMIT - 1)
}

export async function getFacts(userId: number) {
  const coreKey = `facts:core:${userId}`
  const generalKey = `facts:general:${userId}`
  // Legacy key check
  const legacyKey = `facts:${userId}`
  
  const [core, general, legacy] = await Promise.all([
     redis.smembers(coreKey),
     redis.smembers(generalKey),
     redis.smembers(legacyKey)
  ])

  const allGeneral = [...general, ...legacy].filter(f => f && f !== '{}' && f !== '[]')

  // Return formatted strings
  const coreFacts = core.map((f: string) => `[CORE] ${f}`)
  const generalFacts = allGeneral.map((f: string) => `[GENERAL] ${f}`)
  
  return [...coreFacts, ...generalFacts]
}

export async function saveFact(userId: number, fact: string, category: 'core' | 'general' = 'general') {
  const key = `facts:${category}:${userId}`
  // Also keep legacy key support? Or migrate? 
  // For simplicity, just use new keys.
  // Ideally we should remove from old key if moving, but whatever.
  await redis.sadd(key, fact)
}

export async function clearHistory(chatId: number) {
  const key = `history:${chatId}`
  await redis.del(key)
}
