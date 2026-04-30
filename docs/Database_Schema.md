# Database Schema Specification
## AI Coding Assistant — Phase 4

**Version:** 1.0  
**Date:** April 29, 2026  
**Database:** PostgreSQL 16

---

## 1. Entity Relationship Overview

```
users
  │
  ├──< projects (one user → many projects)
  │       │
  │       ├──< files (one project → many files)
  │       │       │
  │       │       └──< file_versions (one file → many versions)
  │       │
  │       └──< project_members (many-to-many: users ↔ projects)
  │
  └──< conversations (one user → many conversations)
          │
          ├── project_id? (optional link to a project)
          │
          └──< messages (one conversation → many messages)
                  │
                  └── file_context (optional: path of file when sent)
```

---

## 2. Table Definitions

### 2.1 users

```sql
CREATE TABLE users (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id        VARCHAR(50)  UNIQUE NOT NULL,
  email            VARCHAR(255) UNIQUE NOT NULL,
  name             VARCHAR(255) NOT NULL,
  avatar_url       TEXT,
  plan             VARCHAR(20)  NOT NULL DEFAULT 'free',
  ai_tokens_used   INTEGER      NOT NULL DEFAULT 0,
  ai_tokens_limit  INTEGER      NOT NULL DEFAULT 100000,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  last_login_at    TIMESTAMPTZ
);

CREATE INDEX idx_users_github_id ON users(github_id);
CREATE INDEX idx_users_email     ON users(email);
```

### 2.2 projects

```sql
CREATE TABLE projects (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  slug            VARCHAR(255) NOT NULL,
  description     TEXT,
  visibility      VARCHAR(20)  NOT NULL DEFAULT 'private',
  root_path       TEXT,
  s3_prefix       TEXT,
  default_branch  VARCHAR(100) NOT NULL DEFAULT 'main',
  language_stats  JSONB,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  archived_at     TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_projects_owner_slug ON projects(owner_id, slug);
CREATE INDEX idx_projects_owner_id         ON projects(owner_id);
```

### 2.3 project_members

```sql
CREATE TABLE project_members (
  project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL DEFAULT 'viewer',
  invited_by  UUID        REFERENCES users(id),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX idx_project_members_user_id ON project_members(user_id);
```

### 2.4 files

```sql
CREATE TABLE files (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by    UUID         NOT NULL REFERENCES users(id),
  path          TEXT         NOT NULL,
  name          VARCHAR(255) NOT NULL,
  extension     VARCHAR(50),
  language      VARCHAR(100),
  content       TEXT,
  size_bytes    INTEGER      NOT NULL DEFAULT 0,
  is_directory  BOOLEAN      NOT NULL DEFAULT false,
  parent_path   TEXT,
  version       INTEGER      NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_files_project_path ON files(project_id, path) WHERE deleted_at IS NULL;
CREATE INDEX idx_files_project_id         ON files(project_id);
CREATE INDEX idx_files_parent_path        ON files(project_id, parent_path);
```

### 2.5 file_versions

```sql
CREATE TABLE file_versions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id     UUID        NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  saved_by    UUID        NOT NULL REFERENCES users(id),
  version     INTEGER     NOT NULL,
  content     TEXT        NOT NULL,
  diff        TEXT,
  size_bytes  INTEGER     NOT NULL DEFAULT 0,
  message     VARCHAR(500),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (file_id, version)
);

CREATE INDEX idx_file_versions_file_id ON file_versions(file_id);
```

### 2.6 conversations

```sql
CREATE TABLE conversations (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID         NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  project_id     UUID         REFERENCES projects(id)           ON DELETE SET NULL,
  file_id        UUID         REFERENCES files(id)              ON DELETE SET NULL,
  title          VARCHAR(500),
  model          VARCHAR(100) NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  total_tokens   INTEGER      NOT NULL DEFAULT 0,
  message_count  INTEGER      NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  archived_at    TIMESTAMPTZ
);

CREATE INDEX idx_conversations_user_id    ON conversations(user_id);
CREATE INDEX idx_conversations_project_id ON conversations(project_id);
```

### 2.7 messages

```sql
CREATE TABLE messages (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id    UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role               VARCHAR(20) NOT NULL,
  content            TEXT        NOT NULL,
  selected_code      TEXT,
  file_context       TEXT,
  prompt_tokens      INTEGER     NOT NULL DEFAULT 0,
  completion_tokens  INTEGER     NOT NULL DEFAULT 0,
  latency_ms         INTEGER,
  model              VARCHAR(100),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at      ON messages(conversation_id, created_at);
```

---

## 3. Relationships Summary

| Relationship | Type | Details |
|-------------|------|---------|
| users → projects | One-to-many | A user owns many projects |
| users ↔ projects | Many-to-many | Via project_members |
| projects → files | One-to-many | A project has many files |
| files → file_versions | One-to-many | Full history per file |
| users → conversations | One-to-many | A user has many conversations |
| conversations → project | Many-to-one | Optional context link |
| conversations → messages | One-to-many | A conversation has many messages |

---

## 4. Example Data

### users
```json
{
  "id": "a1b2c3d4-0001-0000-0000-000000000001",
  "github_id": "12345678",
  "email": "shivanshi@example.com",
  "name": "Shivanshi",
  "plan": "pro",
  "ai_tokens_used": 24300,
  "ai_tokens_limit": 500000
}
```

### projects
```json
{
  "id": "b2c3d4e5-0002-0000-0000-000000000002",
  "owner_id": "a1b2c3d4-0001-0000-0000-000000000001",
  "name": "my-monorepo",
  "slug": "my-monorepo",
  "visibility": "private",
  "language_stats": { "TypeScript": 92, "JSON": 6, "HTML": 2 }
}
```

### files
```json
{
  "id": "c3d4e5f6-0003-0000-0000-000000000003",
  "project_id": "b2c3d4e5-0002-0000-0000-000000000002",
  "path": "packages/backend/src/routes/api.ts",
  "name": "api.ts",
  "extension": "ts",
  "language": "TypeScript",
  "size_bytes": 420,
  "version": 3
}
```

### conversations
```json
{
  "id": "d4e5f6a7-0004-0000-0000-000000000004",
  "user_id": "a1b2c3d4-0001-0000-0000-000000000001",
  "project_id": "b2c3d4e5-0002-0000-0000-000000000002",
  "title": "Add GET /users route",
  "model": "claude-sonnet-4-20250514",
  "total_tokens": 1840,
  "message_count": 4
}
```

### messages
```json
[
  {
    "role": "user",
    "content": "Add a GET /users route using the User type from shared",
    "file_context": "packages/backend/src/routes/api.ts",
    "prompt_tokens": 0,
    "completion_tokens": 0
  },
  {
    "role": "assistant",
    "content": "Here's the typed route...",
    "prompt_tokens": 820,
    "completion_tokens": 340,
    "latency_ms": 1240
  }
]
```

---

## 5. Key SQL Queries

### File tree for explorer
```sql
SELECT path, name, is_directory, language, size_bytes, updated_at
FROM files
WHERE project_id = $1 AND deleted_at IS NULL
ORDER BY is_directory DESC, path ASC;
```

### Conversation history for AI context
```sql
SELECT role, content, selected_code, file_context
FROM messages
WHERE conversation_id = $1
ORDER BY created_at ASC
LIMIT 20;
```

### Token usage this month
```sql
SELECT SUM(prompt_tokens + completion_tokens) AS tokens_this_month
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE c.user_id = $1
  AND m.created_at >= date_trunc('month', now());
```

### Project collaborators
```sql
SELECT u.name, u.email, u.avatar_url, pm.role, pm.joined_at
FROM project_members pm
JOIN users u ON u.id = pm.user_id
WHERE pm.project_id = $1
ORDER BY pm.role, pm.joined_at;
```

---

## 6. Migration Order

```
1. users
2. projects
3. project_members
4. files
5. file_versions
6. conversations
7. messages
```

*Schema ready for Prisma or raw SQL migrations in Phase 4.*