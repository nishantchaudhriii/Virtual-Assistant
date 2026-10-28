# Virtual Assistant (MERN + Gemini) – macOS setup

## 0. Prerequisites
- **Node.js 20 or newer** (`node -v`). Install with `brew install node` or from nodejs.org.
- **Google Chrome** (voice recognition doesn't work in Firefox, and is flaky in Safari).
- A MongoDB database (pick one):
  - **Local:** `brew tap mongodb/brew && brew install mongodb-community && brew services start mongodb-community`
  - **Atlas (free):** create a cluster at mongodb.com/atlas, add your IP under *Network Access*, and copy the connection string.
- A free **Gemini API key**: https://aistudio.google.com/app/apikey

## 1. Backend (Terminal 1)
```bash
cd backend
cp .env.example .env      # then open .env in VS Code and fill in the values
npm install
npm run dev
```
You should see `db connected` and `server started on http://localhost:8000`.
If it exits with a MongoDB error, the message tells you what to fix.

## 2. Frontend (Terminal 2)
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173 in Chrome.

## Troubleshooting
- **Never copy `node_modules` between Windows and Mac.** If you get errors like
  `Cannot find module @rollup/rollup-darwin-arm64` or `lightningcss`, run:
  `rm -rf node_modules package-lock.json && npm install` inside `frontend/`.
- **Sign up shows "Cannot reach the server"** → the backend isn't running (check Terminal 1).
- **Assistant says it can't reach its brain** → check `GEMINI_API_KEY` / `GEMINI_MODEL` in `backend/.env`
  and read the error printed in the backend terminal.
- **Mic doesn't work** → allow microphone access for localhost in Chrome (lock icon in the address bar),
  and make sure macOS lets Chrome use the mic (System Settings → Privacy & Security → Microphone).
- Say your assistant's name to wake it (e.g. "Shifra, what time is it?"). Slightly mis-heard names ("Sifra") still work.
  After it answers you have ~12 seconds to ask a follow-up **without** repeating the name (change `FOLLOW_UP_MS` in `frontend/src/pages/Home.jsx`, or set it to `0` to always require the name).
- **Google / YouTube / Instagram tabs don't open** → Chrome blocks pop-ups that aren't triggered by a click. Click the pop-up icon in the address bar once and choose "Always allow pop-ups from localhost".
- **Want to see how fast it is?** The backend terminal prints a line for every question, e.g. `⚡ local intent "get-time" in 3ms` or `✅ Gemini gemini-3.1-flash-lite-preview answered in 640ms`.

## How fast replies work
- Time / date / day / month, "open calculator/Instagram/Facebook", weather, and "search … on Google/YouTube", "play …" are answered **instantly on the server without calling Gemini**.
- Everything else goes to a fast Gemini model with "thinking" turned off. If a model is slow (>2.5 s) a backup model starts in parallel and the first answer wins; retired/overloaded models are skipped automatically (see `GEMINI_MODEL` in `.env`).
