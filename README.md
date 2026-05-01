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

### 5. Run apps in development
```bash
# Backend + Frontend together
npm run dev:all

# Or individually
npm run dev:backend    # Express API on :4000
npm run dev:frontend   # Vite on :5173
npm run dev:mobile     # Expo dev server
npm run dev:desktop    # Electron window
```

---

## 🤖 API Endpoints

Base URL: `http://localhost:4000`

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/chat` | Send a message to the AI assistant |
| `POST` | `/api/explain-code` | Explain a block of code |
| `POST` | `/api/fix-code` | Fix broken or buggy code |
| `POST` | `/api/generate-code` | Generate new code from a prompt |
| `GET` | `/api/chat/health` | Health check |

### Example — Chat
```bash
curl -X POST http://localhost:4000/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt>" \
  -d '{
    "message": "Add a GET /users route using the User type from shared",
    "filePath": "packages/backend/src/routes/api.ts"
  }'
```

### Example — Explain Code
```bash
curl -X POST http://localhost:4000/api/explain-code \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt>" \
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
  -H "Authorization: Bearer <your-jwt>" \
  -d '{
    "code": "const x: number = \"hello\"",
    "error": "Type string is not assignable to type number",
    "language": "TypeScript"
  }'
```

### Example — Generate Code
```bash
curl -X POST http://localhost:4000/api/generate-code \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt>" \
  -d '{
    "prompt": "A function that debounces any callback",
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
API Gateway (Express :4000)
        │
  ┌─────┴──────┐
  │  Middleware │  Auth · Rate Limit · Validation
  └─────┬──────┘
        │
  ┌─────┴────────────────────────┐
  │        Core Services          │
  │  AI · Context · Token Tracker │
  └─────┬────────────────────────┘
        │
  Anthropic Claude API (claude-sonnet-4)
```

See [`docs/System_Architecture.md`](docs/System_Architecture.md) for the full diagram.

---

## 📁 Project Structure

```
my-monorepo/
├── packages/
│   ├── shared/          TypeScript types & utilities
│   ├── backend/
│   │   └── src/
│   │       ├── controllers/    chat, explain, fix, generate
│   │       ├── services/       ai, context, token
│   │       ├── middleware/     auth, rateLimit, validate, error
│   │       ├── routes/         api, chat, explain, fix, generate
│   │       ├── types/          shared type definitions
│   │       └── utils/          logger
│   ├── frontend/        React + Vite
│   ├── mobile/          Expo React Native
│   └── desktop/         Electron
├── docs/
│   ├── PRD.md                     Product requirements
│   ├── UI_UX_Design_Spec.md       UI/UX specification
│   ├── UI_Mockup.html             Interactive UI mockup
│   ├── System_Architecture.md     Architecture spec
│   ├── Architecture_Diagram.html  Interactive architecture diagram
│   ├── Database_Schema.md         Database schema + SQL
│   └── Database_Schema_ERD.html   Interactive ERD
├── package.json         Root workspace config
├── tsconfig.base.json   Shared TypeScript config
├── .eslintrc.json       ESLint config
├── .prettierrc          Prettier config
└── README.md
```

---

## 🛠 Scripts

```bash
npm run dev:backend      # Start Express backend
npm run dev:frontend     # Start Vite frontend
npm run dev:mobile       # Start Expo
npm run dev:desktop      # Start Electron
npm run dev:all          # Backend + Frontend together

npm run build:shared     # Build shared package first
npm run build:backend    # Build backend
npm run build:frontend   # Build frontend
npm run build:all        # Build everything

npm run lint             # ESLint all packages
npm run format           # Prettier all packages
```

---

## 🔐 Environment Variables

### `packages/backend/.env`
```
PORT=4000
NODE_ENV=development
JWT_SECRET=your-secret-key
ANTHROPIC_API_KEY=sk-ant-your-key-here
ALLOWED_ORIGINS=http://localhost:5173
```

### `packages/frontend/.env`
```
VITE_API_URL=http://localhost:4000
```

### `packages/mobile/.env`
```
EXPO_PUBLIC_API_URL=http://localhost:4000
```

---

## 📚 Documentation

| Doc | Description |
|-----|-------------|
| [PRD](docs/PRD.md) | Product requirements document |
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
| Phase 5 | Backend API (Express + AI routes) | ✅ Done |
| Phase 6 | Frontend integration | 🔜 Next |

---

## 📝 License

MIT