# AI Coding Assistant — Monorepo

A full-stack AI-powered coding assistant built as a TypeScript monorepo using npm workspaces.

---

## 📦 Packages

| Package | Tech | Port |
|---------|------|------|
| `shared` | TypeScript library | — |
| `backend` | Express + TypeScript + Anthropic AI | 4000 |
| `frontend` | React + Vite | 5173 |
| `mobile` | Expo React Native | — |
| `desktop` | Electron | — |

---

## 🚀 Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/my-monorepo.git
cd my-monorepo
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
```bash
cp .env.example .env
cp packages/backend/.env.example packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env
cp packages/mobile/.env.example packages/mobile/.env
cp packages/desktop/.env.example packages/desktop/.env
```

> Fill in `ANTHROPIC_API_KEY` and `JWT_SECRET` in `packages/backend/.env`

### 4. Build the shared package
```bash
npm run build:shared
```

### 5. Run in development
```bash
npm run dev:all          # Backend + Frontend together
npm run dev:backend      # Express API on :4000
npm run dev:frontend     # Vite on :5173
npm run dev:mobile       # Expo dev server
npm run dev:desktop      # Electron window
```

---

## 🤖 API Endpoints

Base URL: `http://localhost:4000`

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/chat` | Chat with the AI assistant (REST or SSE stream) |
| `GET` | `/api/chat/conversations` | List user's conversations |
| `DELETE` | `/api/chat/conversations/:id` | Delete a conversation |
| `GET` | `/api/chat/health` | AI service health check |
| `POST` | `/api/explain-code` | Explain a block of code |
| `POST` | `/api/fix-code` | Fix broken or buggy code |
| `POST` | `/api/generate-code` | Generate new code from a prompt |

### Example — Chat (standard)
```bash
curl -X POST http://localhost:4000/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt>" \
  -d '{
    "message": "Add a GET /users route using the User type from shared",
    "filePath": "packages/backend/src/routes/api.ts"
  }'
```

### Example — Chat (streaming)
```bash
curl -X POST http://localhost:4000/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt>" \
  -d '{ "message": "Explain async/await", "stream": true }'
```

### Example — Explain Code
```bash
curl -X POST http://localhost:4000/api/explain-code \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt>" \
  -d '{
    "code": "const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);",
    "language": "TypeScript",
    "detail": "brief"
  }'
```

### Example — Fix Code
```bash
curl -X POST http://localhost:4000/api/fix-code \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt>" \
  -d '{
    "code": "const x: number = \"hello\"",
    "error": "Type string is not assignable to type number"
  }'
```

### Example — Generate Code
```bash
curl -X POST http://localhost:4000/api/generate-code \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt>" \
  -d '{
    "prompt": "A debounce utility function",
    "target": "utility",
    "language": "TypeScript"
  }'
```

---

## 🏗 Architecture

```
Client (React / Expo / Electron)
        │
        ▼
API Gateway — Express :4000
        │
  ┌─────┴────────────────────────────────────┐
  │             Middleware Stack              │
  │  helmet · cors · auth · rateLimit · validate │
  └─────┬────────────────────────────────────┘
        │
  ┌─────┴──────────────────────────────────────────┐
  │                 Service Layer                   │
  │  ai · prompt · response · conversation · token  │
  └─────┬──────────────────────────────────────────┘
        │
  Anthropic Claude API (claude-sonnet-4-20250514)
```

---

## 📁 Project Structure

```
my-monorepo/
├── packages/
│   ├── shared/               TypeScript types & utilities
│   ├── backend/
│   │   └── src/
│   │       ├── config/           Centralised env config + validation
│   │       ├── controllers/      chat · explain · fix · generate
│   │       ├── services/
│   │       │   ├── ai.service.ts          Anthropic client + retry logic
│   │       │   ├── prompt.service.ts      Prompt templates for all routes
│   │       │   ├── response.service.ts    AI response parsing + formatting
│   │       │   ├── conversation.service.ts In-memory conversation memory
│   │       │   └── token.service.ts       Monthly token usage tracking
│   │       ├── middleware/       auth · rateLimit · validate · error
│   │       ├── routes/           api · chat · explain · fix · generate
│   │       ├── types/            shared TypeScript types
│   │       └── utils/            logger
│   ├── frontend/             React + Vite
│   ├── mobile/               Expo React Native
│   └── desktop/              Electron
├── docs/                     All phase documentation
├── package.json
├── tsconfig.base.json
└── README.md
```

---

## 🔐 Environment Variables

### `packages/backend/.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Server port |
| `NODE_ENV` | `development` | Environment |
| `JWT_SECRET` | — | **Required** — JWT signing key |
| `ANTHROPIC_API_KEY` | — | **Required** — Anthropic API key |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` | Model to use |
| `ANTHROPIC_MAX_TOKENS` | `1000` | Max tokens per response |
| `ANTHROPIC_MAX_RETRIES` | `3` | Retry attempts on transient errors |
| `ANTHROPIC_RETRY_DELAY_MS` | `1000` | Base retry delay (exponential backoff) |
| `ANTHROPIC_TIMEOUT_MS` | `30000` | Request timeout |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | CORS allowed origins (comma-separated) |
| `RATE_LIMIT_API` | `60` | General API requests per minute |
| `RATE_LIMIT_AI` | `10` | AI requests per minute |
| `RATE_LIMIT_GENERATE` | `3` | Generate requests per minute |
| `PLAN_FREE_TOKENS` | `100000` | Monthly token cap for free plan |
| `PLAN_PRO_TOKENS` | `500000` | Monthly token cap for pro plan |
| `PLAN_TEAM_TOKENS` | `2000000` | Monthly token cap for team plan |

---

## 🛠 Scripts

```bash
npm run dev:backend      # Start Express backend
npm run dev:frontend     # Start Vite frontend
npm run dev:all          # Backend + Frontend together
npm run build:shared     # Build shared package
npm run build:all        # Build everything
npm run lint             # ESLint all packages
npm run format           # Prettier all packages
```

---

## 📚 Documentation

| Doc | Description |
|-----|-------------|
| [PRD](docs/PRD.md) | Product requirements |
| [UI/UX Spec](docs/UI_UX_Design_Spec.md) | Design specification |
| [UI Mockup](docs/UI_Mockup.html) | Interactive UI mockup |
| [Architecture](docs/System_Architecture.md) | System architecture |
| [Architecture Diagram](docs/Architecture_Diagram.html) | Interactive diagram |
| [Database Schema](docs/Database_Schema.md) | DB schema + SQL |
| [Database ERD](docs/Database_Schema_ERD.html) | Interactive ERD |

---

## 📋 Phase Progress

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 0 | Monorepo base setup | ✅ Done |
| Phase 1 | Product requirements (PRD) | ✅ Done |
| Phase 2 | UI/UX design + mockup | ✅ Done |
| Phase 3 | System architecture | ✅ Done |
| Phase 4 | Database schema | ✅ Done |
| Phase 5 | Backend API — Express + AI routes | ✅ Done |
| Phase 6 | AI integration — prompts · retry · memory | ✅ Done |
| Phase 7 | Frontend integration | 🔜 Next |

---

## 📝 License

MIT
