# Next Steps

Your "OpenClaw Lite" agent is ready!

## 1. Credentials

Fill in `.env.local` using the keys from your providers:

- **Telegram**: Search for `@BotFather` on Telegram, send `/newbot`.
- **Upstash**: Go to upstash.com -> Create Database -> Vercel KV.
- **Groq/OpenAI**: Get your API key.
- **Tavily**: Get your key for search.

## 2. Deploy

1. Push this folder to a GitHub repository.
2. Go to Vercel.com -> Add New Project -> Import from GitHub.
3. In Environment Variables, paste the contents of your `.env.local`.
4. Click Deploy.

## 3. Connect Telegram

Once deployed, copy your Vercel URL (e.g. `https://auta-bot.vercel.app`).
Run this command in your terminal (replace placeholders):

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_VERCEL_DOMAIN>/api/telegram"
```

## 4. Chat!

Open your bot in Telegram and say "Hello".
Try teaching it: "My name is Beca and I am a software engineer."
Then ask: "Who am I?" (It will check Redis memory).
Then try: "Check the latest news on AI agents" (It will use Tavily search).
Then try: "Here is how you check stock: Go to google and type stock AAPL." (It will save the skill).
