# OpenClaw Lite (Serverless Edition)

A lightweight, serverless version of the OpenClaw agent designed for Telegram, running on Next.js and Vercel.
It features persistent memory (Upstash Redis), web search, and skill learning capabilities.

## Features

- **Personality**: Defined in `personalities/SOUL.md`.
- **Memory**: Remembers user facts and context via Redis.
- **Skills**: Can learn new procedures (`save_skill`) and recall them.
- **Tools**: Web Search (Tavily), Browsing (Fetch), Memory Management.
- **Serverless**: Runs on Vercel Free Tier.

## Prerequisites

1. **Telegram Bot Token**: Get from [@BotFather](https://t.me/BotFather).
2. **Upstash Redis**: Create a free database at [upstash.com](https://upstash.com).
3. **OpenAI API Key**: Or Groq key (compatible).
4. **Tavily API Key**: For web search.

## Setup

1. Clone the repo.
2. `npm install`
3. Copy `.env.local.example` to `.env.local` and fill in keys.

## Development

```bash
npm run dev
```

To test locally, use `ngrok` to expose port 3000 and set the webhook to your ngrok URL.

## Deployment to Vercel

1. Push to GitHub.
2. Import to Vercel.
3. Add Environment Variables in Vercel Dashboard.
4. Deploy.

## Post-Deployment (IMPORTANT)

Set your Telegram bot webhook to your localized Vercel URL:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_VERCEL_DOMAIN>/api/telegram&secret_token=<OPTIONAL_SECRET>"
```

## Creating Skills

You can teach the bot new skills by explaining them.
_User_: "Here is how you check my flight status: Go to google.com/flights, search for flight AA123, and read the time."
_Bot_: (Calls `save_skill("check_flight", "Go to google...")`)
_User_: "Check my flight."
_Bot_: (Recalls skill and executes steps).
