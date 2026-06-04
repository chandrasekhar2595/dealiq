# DealIQ — Full Stack Setup Guide

## What you're deploying

| Layer | Tech | Hosting |
|---|---|---|
| Frontend | React | Vercel (free) |
| Backend API | Node.js + Express | Vercel (free) |
| Database | PostgreSQL | Supabase (free) |
| AI Engine | Claude API | Anthropic (pay per use) |

---

## Step 1 — Set up Supabase (database)

1. Go to https://supabase.com and create a free account
2. Click "New Project" — name it `dealiq`
3. Wait for it to spin up (~2 min)
4. Go to **SQL Editor** in the left sidebar
5. Copy the entire contents of `database/schema.sql` and run it
6. Go to **Settings → API** and copy:
   - `Project URL` → this is your `SUPABASE_URL`
   - `anon public` key → this is your `SUPABASE_ANON_KEY`
   - `service_role` key → this is your `SUPABASE_SERVICE_KEY`

---

## Step 2 — Set up Vercel (hosting)

1. Go to https://vercel.com and create a free account
2. Install Vercel CLI: `npm install -g vercel`
3. In your terminal, navigate to this project folder
4. Run: `vercel login`
5. Run: `vercel` and follow the prompts

---

## Step 3 — Add environment variables

In Vercel dashboard → your project → Settings → Environment Variables, add:

```
ANTHROPIC_API_KEY      = your key from console.anthropic.com
SUPABASE_URL           = from Step 1
SUPABASE_ANON_KEY      = from Step 1
SUPABASE_SERVICE_KEY   = from Step 1
JWT_SECRET             = any random 32+ character string
NEXT_PUBLIC_APP_URL    = https://your-app.vercel.app
```

---

## Step 4 — Deploy frontend (React)

Option A — Use Vercel with Vite:
```bash
cd frontend
npm create vite@latest . -- --template react
# Copy src/App.jsx into the new src/ folder
npm install
vercel
```

Option B — Use Create React App:
```bash
cd frontend
npx create-react-app .
# Copy src/App.jsx into src/
npm install
vercel
```

In your frontend `.env`:
```
REACT_APP_API_URL=https://your-backend.vercel.app/api
```

---

## Step 5 — Run locally for development

```bash
# Terminal 1 — Backend
cd dealiq-full
cp .env.example .env
# Fill in your .env values
npm install
node backend/server.js

# Terminal 2 — Frontend
cd frontend
npm start
```

Backend runs on: http://localhost:4000
Frontend runs on: http://localhost:3000

---

## API Reference

### Auth
| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | /api/auth/signup | email, password, name, company | Create account |
| POST | /api/auth/login | email, password | Get JWT token |
| GET | /api/auth/me | — | Get current user |

### Deals
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/deals | List all deals |
| POST | /api/deals | Create a deal |
| GET | /api/deals/:id | Get deal + signals + analysis |
| PUT | /api/deals/:id | Update a deal |
| DELETE | /api/deals/:id | Delete a deal |
| POST | /api/deals/:id/analyze | Run AI analysis |
| POST | /api/deals/:id/signals | Add a signal |

---

## Project Structure

```
dealiq-full/
├── backend/
│   ├── api/
│   │   ├── auth.js          # Auth routes + middleware
│   │   └── deals.js         # Deal CRUD + AI analysis
│   ├── lib/
│   │   └── supabase.js      # DB client
│   ├── services/
│   │   └── analyzer.js      # Claude AI engine
│   └── server.js            # Express app
├── frontend/
│   └── src/
│       └── App.jsx          # Full React dashboard
├── database/
│   └── schema.sql           # Run this in Supabase
├── vercel.json              # Vercel deployment config
└── .env.example             # Environment variables template
```

---

## Next features to build (in order)

1. Gmail OAuth integration (connect real email data)
2. Slack bot (send deal alerts to reps)
3. Salesforce/HubSpot sync (auto-import deals)
4. Daily email digest (send pipeline report every morning)
5. Team management (multiple reps per account)
