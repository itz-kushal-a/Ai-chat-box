# System Architecture Specification
## AI Coding Assistant — Phase 3

**Version:** 1.0  
**Date:** April 29, 2026

---

## 1. Architecture Overview

The system follows a layered, service-oriented architecture with four primary layers: Client, API Gateway, Core Services, and Data. All communication between layers uses HTTPS/WSS. The AI service is isolated as a dedicated microservice to allow independent scaling.

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                               │
│                                                                     │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────┐  │
│   │   Frontend   │  │    Mobile    │  │ Desktop  │  │  VS Code │  │
│   │  React+Vite  │  │    Expo RN   │  │ Electron │  │Extension │  │
│   └──────┬───────┘  └──────┬───────┘  └────┬─────┘  └────┬─────┘  │
└──────────┼─────────────────┼───────────────┼──────────────┼────────┘
           │   HTTPS / WSS   │               │              │
           ▼                 ▼               ▼              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API GATEWAY LAYER                            │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    Express API Gateway                      │   │
│   │         Auth Middleware · Rate Limiting · Routing           │   │
│   └──────┬──────────────┬──────────────┬──────────────┬────────┘   │
└──────────┼──────────────┼──────────────┼──────────────┼────────────┘
           │              │              │              │
           ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        CORE SERVICES LAYER                          │
│                                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌───────────┐  │
│  │   Auth       │ │  File        │ │   Chat /     │ │  Session  │  │
│  │   Service    │ │  Service     │ │  AI Service  │ │  Service  │  │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └─────┬─────┘  │
└─────────┼────────────────┼────────────────┼───────────────┼────────┘
          │                │                │               │
          ▼                ▼                ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          DATA LAYER                                 │
│                                                                     │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│   │  PostgreSQL  │  │    Redis     │  │  File System │             │
│   │  (Users,     │  │  (Sessions,  │  │  / S3        │             │
│   │  Chat Hist)  │  │  Cache)      │  │  (Code files)│             │
│   └──────────────┘  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL SERVICES                             │
│                                                                     │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│   │  Anthropic   │  │   GitHub     │  │   Langfuse   │             │
│   │  Claude API  │  │   OAuth      │  │  (AI Telemetry)│           │
│   └──────────────┘  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Layer Breakdown

### 2.1 Client Layer

All four clients share the `shared` package for types and utilities. They communicate with the backend exclusively through the API Gateway — never directly with services or the database.

**Frontend (React + Vite)**
- Primary interface for desktop browsers
- Monaco Editor for code editing
- WebSocket connection for streaming AI responses
- State managed with Zustand (lightweight, no boilerplate)

**Mobile (Expo React Native)**
- Stripped-down editor view with AI chat focused layout
- REST-only (no WebSocket on mobile for battery efficiency)
- Polling-based response streaming via SSE (Server-Sent Events)

**Desktop (Electron)**
- Direct file system access via preload bridge
- Offline-capable for file editing; AI features require internet
- Auto-update via electron-updater

**VS Code Extension** *(future phase)*
- Sidebar panel embedding the chat UI as a WebView
- Uses the same REST API as other clients

---

### 2.2 API Gateway Layer

Single Express app in `packages/backend` acting as the gateway.

**Responsibilities:**
- JWT authentication via middleware on all protected routes
- Rate limiting: 60 req/min for REST, 10 AI calls/min per user
- Request routing to the correct service handler
- WebSocket upgrade handling for streaming
- Request/response logging

**Base URL:** `https://api.codeai.dev/v1`

---

### 2.3 Core Services Layer

Four service modules, each with a single responsibility:

**Auth Service** (`/auth`)
- GitHub OAuth 2.0 login flow
- JWT issue and refresh token rotation
- Session invalidation on logout

**File Service** (`/files`)
- CRUD operations on code files
- Tree listing for the monorepo workspace
- File diffing for change tracking
- Uploads to S3 for cloud sync (optional)

**Chat / AI Service** (`/chat`)
- Manages conversation history per session
- Builds context window: attaches selected code, file path, and recent messages
- Calls Anthropic Claude API with assembled prompt
- Streams response back to client via WebSocket or SSE
- Logs each call to Langfuse for observability

**Session Service** (`/sessions`)
- Tracks open workspaces and active files per user
- Persists editor tab state and cursor positions
- Stored in Redis for fast read/write

---

### 2.4 Data Layer

**PostgreSQL**
- `users` table: id, email, github_id, created_at
- `conversations` table: id, user_id, created_at
- `messages` table: id, conversation_id, role, content, tokens, created_at
- `workspaces` table: id, user_id, name, root_path, created_at

**Redis**
- Session tokens with TTL
- Per-user rate limit counters
- Active file/tab state cache (expires after 24h)
- AI response cache: identical prompts within 5min reuse cached response

**File System / S3**
- Raw code files stored locally in dev
- S3 bucket in production for cloud-synced workspaces
- Files referenced by path in the database, not stored as blobs

---

### 2.5 External Services

**Anthropic Claude API**
- Model: `claude-sonnet-4-20250514`
- Called by the AI Service with a structured system prompt containing: monorepo context, active file, selected code, and conversation history
- Streaming enabled via `stream: true`
- Max context: 8,000 tokens per request (system + history + user message)

**GitHub OAuth**
- Used for login only — no repo access required in Phase 3
- Scopes: `read:user`, `user:email`

**Langfuse**
- Observability for all AI calls
- Tracks: prompt tokens, completion tokens, latency, model, user id
- Used for cost monitoring and quality evaluation

---

## 3. Data Flow

### 3.1 User Sends a Chat Message

```
User types message + selects code in editor
        │
        ▼
Frontend builds payload:
  { message, selectedCode, filePath, conversationId }
        │
        ▼
POST /v1/chat/message  (REST) or
WS   /v1/chat/stream   (WebSocket for streaming)
        │
        ▼
API Gateway → validates JWT → forwards to Chat Service
        │
        ▼
Chat Service:
  1. Loads last N messages from PostgreSQL (conversation history)
  2. Builds system prompt with monorepo context + selected code
  3. Calls Anthropic Claude API (streaming)
  4. Saves user message to DB
        │
        ▼
Streams response tokens back to client via WebSocket
        │
        ▼
On stream complete:
  - Saves AI message to DB
  - Logs call to Langfuse
  - Updates Redis token usage counter
        │
        ▼
Frontend renders streamed tokens into chat bubble
```

### 3.2 User Opens a File

```
User clicks file in explorer
        │
        ▼
GET /v1/files/:workspaceId/:path
        │
        ▼
API Gateway → JWT check → File Service
        │
        ▼
File Service reads from local FS or S3
        │
        ▼
Returns: { content, language, lastModified }
        │
        ▼
Frontend loads content into Monaco Editor
Session Service updates active tab state in Redis
```

### 3.3 Authentication Flow

```
User clicks "Login with GitHub"
        │
        ▼
Frontend redirects to GitHub OAuth
        │
        ▼
GitHub returns code → POST /v1/auth/github/callback
        │
        ▼
Auth Service exchanges code for GitHub token
Fetches user profile from GitHub API
Upserts user record in PostgreSQL
        │
        ▼
Issues JWT (access token, 15min) + refresh token (7 days)
Stores refresh token in Redis with TTL
        │
        ▼
Returns tokens to frontend
Frontend stores JWT in memory (not localStorage)
Refresh token stored in httpOnly cookie
```

---

## 4. API Structure

### Authentication
```
POST   /v1/auth/github             → Initiate GitHub OAuth
POST   /v1/auth/github/callback    → Handle OAuth callback, return JWT
POST   /v1/auth/refresh            → Refresh access token
POST   /v1/auth/logout             → Invalidate session
```

### Files
```
GET    /v1/files/:workspaceId           → List file tree
GET    /v1/files/:workspaceId/*path     → Get file content
POST   /v1/files/:workspaceId/*path     → Create file
PUT    /v1/files/:workspaceId/*path     → Update file content
DELETE /v1/files/:workspaceId/*path     → Delete file
```

### Chat
```
GET    /v1/chat/conversations                    → List conversations
POST   /v1/chat/conversations                    → New conversation
GET    /v1/chat/conversations/:id/messages       → Get message history
POST   /v1/chat/message                          → Send message (REST, non-streaming)
WS     /v1/chat/stream                           → Send message (WebSocket, streaming)
DELETE /v1/chat/conversations/:id                → Clear conversation
```

### Session
```
GET    /v1/session                    → Get current workspace state
PUT    /v1/session/active-file        → Update active file
PUT    /v1/session/tabs               → Update open tabs
```

### Workspaces
```
GET    /v1/workspaces                 → List user workspaces
POST   /v1/workspaces                 → Create workspace
GET    /v1/workspaces/:id             → Get workspace details
DELETE /v1/workspaces/:id             → Delete workspace
```

---

## 5. Security Considerations

- JWT stored in memory only — never in localStorage (XSS protection)
- Refresh token in httpOnly, SameSite=Strict cookie (CSRF protection)
- All API routes require valid JWT except `/auth/*`
- File paths sanitized server-side to prevent directory traversal
- Rate limiting per user prevents AI API cost abuse
- All secrets in environment variables, never committed to git
- HTTPS enforced in production; HTTP only in local dev

---

## 6. Scalability Notes

- Chat/AI Service can be horizontally scaled independently (stateless, Redis-backed)
- PostgreSQL read replicas for message history queries
- Redis cluster for session state in high-traffic scenarios
- S3 + CDN for file serving at scale
- WebSocket connections managed via sticky sessions or a pub/sub layer (Redis Pub/Sub)

---

## 7. Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Monaco Editor, Zustand |
| Mobile | Expo SDK 51, React Native |
| Desktop | Electron 29 |
| API Gateway | Express, TypeScript, tsx |
| Auth | GitHub OAuth 2.0, JWT, bcrypt |
| AI Service | Anthropic Claude API (claude-sonnet-4) |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| File Storage | Local FS (dev), AWS S3 (prod) |
| Observability | Langfuse |
| Shared | TypeScript, npm workspaces |

---

*Architecture is designed for Phase 3 implementation. Infra and deployment config covered in a future phase.*