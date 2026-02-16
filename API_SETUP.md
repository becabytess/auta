# Free API Setup Guide for "Auta"

You are building a "Serverless Agent". We have optimized this to minimize the number of API keys you need.

---

## 1. Upstash Redis (The Memory)

**What it is:** The database for your bot's memory.
**Cost:** Free (10,000 commands per day).

**How to get it:**

1. Go to [console.upstash.com](https://console.upstash.com).
2. Log in with your GitHub or Google account.
3. Click the green **"Create Database"** button.
   - **Name:** `auta-memory`
   - **Type:** Regional (keeps it free)
   - **Region:** Choose `US-East-1` or `EU-West-1` (doesn't matter much).
4. Once created, scroll down to the **"REST API"** section.
5. You will see two long strings. Copy them:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

---

## 2. Telegram (The Body)

**What it is:** The chat interface.
**Cost:** Free.

**How to get it:**

1. Open Telegram app.
2. Search for `@BotFather`.
3. Send the message: `/newbot`.
4. Follow the instructions to name it (e.g., `AutaBot`).
5. It will give you a token (looks like `123456:ABC-DEF...`). Copy it.

---

## 3. Groq (The Brain)

**What it is:** The super-fast AI model (Llama 3).
**Cost:** Free (currently in beta, very high limits).

**How to get it:**

1. Go to [console.groq.com](https://console.groq.com).
2. Login and go to "API Keys".
3. Click **"Create API Key"**.
4. Copy it.

---

## 4. Search (The Eyes)

**We are using DuckDuckGo.**
**Cost:** Free.
**API Key:** NOT REQUIRED (We use a scraper).

---

## Summary of Keys needed for `.env.local`

- `TELEGRAM_BOT_TOKEN`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `GROQ_API_KEY`
