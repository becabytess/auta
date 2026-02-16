import { runAgent } from './agent/core'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function main() {
  console.log('--- STARTING TEST ---')
  console.log('ENV KEYS:', Object.keys(process.env).filter(k => k.includes('API') || k.includes('TOKEN') || k.includes('URL')))
  
  try {
    const response = await runAgent('Hello', 12345, 12345)
    console.log('--- SUCCESS ---')
    console.log(response)
  } catch (error: any) {
    console.log('--- CRASH ---')
    console.log('Message:', error.message)
    console.log('Full Error:', error)
  }
}

main().catch(console.error)
